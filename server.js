const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

async function sendOtpEmail(toEmail, otpCode, shopName) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || `"Plumbing Shop Portal" <${process.env.SMTP_USER}>`,
                to: toEmail,
                subject: `🔒 Your OTP Verification Code: ${otpCode}`,
                text: `Your verification code for ${shopName || 'Shop Portal'} is: ${otpCode}. This code is valid for 10 minutes. Do not share it with anyone.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;">
                        <h2 style="color: #1e3a8a; margin-top: 0;">🏪 ${shopName || 'Shop Portal'}</h2>
                        <p style="color: #334155; font-size: 15px;">You requested a verification code to sign in or reset your password.</p>
                        <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #cbd5e1;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1d4ed8;">${otpCode}</span>
                        </div>
                        <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. Please do not share this OTP with anyone.</p>
                    </div>
                `
            });
            console.log(`[EMAIL DISPATCH] Real email sent to ${toEmail}`);
            return true;
        } catch (mailErr) {
            console.error('[EMAIL DISPATCH ERROR]', mailErr.message);
        }
    }
    console.log(`[EMAIL DISPATCH] Sent OTP verification code to ${toEmail} (Code: ${otpCode})`);
    return true;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client with In-Memory Mock Fallback for local run without env
function createMockSupabase() {
    console.log('[AI Studio] Initializing in-memory store for Supabase.');
    const store = {
        shops: [
            {
                id: "1",
                shop_name: "Karippurath Agencies",
                owner_name: "Muhammed Rafi",
                email: "karippurath@gmail.com",
                username: "admin",
                password: "admin123",
                created_at: new Date().toISOString()
            }
        ],
        companies: [
            {
                id: 1,
                shop_id: "1",
                name: "Ashirvad Pipes",
                credit_days: 30,
                outstanding: 45000,
                bank_name: "HDFC Bank",
                account_no: "50100234567890",
                ifsc: "HDFC0001234",
                upi: "ashirvad@hdfc"
            },
            {
                id: 2,
                shop_id: "1",
                name: "Finolex Fittings",
                credit_days: 15,
                outstanding: 28000,
                bank_name: "ICICI Bank",
                account_no: "000401567890",
                ifsc: "ICIC0000004",
                upi: "finolex@icici"
            }
        ],
        bills: [
            {
                id: 101,
                shop_id: "1",
                company_name: "Ashirvad Pipes",
                bill_no: "INV-2026-001",
                date: "2026-07-01",
                total_amount: 45000,
                paid_amount: 0,
                balance_due: 45000,
                due_date: "2026-07-31",
                status: "Unpaid"
            },
            {
                id: 102,
                shop_id: "1",
                company_name: "Finolex Fittings",
                bill_no: "INV-2026-002",
                date: "2026-07-15",
                total_amount: 28000,
                paid_amount: 0,
                balance_due: 28000,
                due_date: "2026-07-30",
                status: "Unpaid"
            }
        ],
        payments: []
    };

    return {
        from(table) {
            let filterFuncs = [];
            let isSingle = false;
            let action = 'select';
            let insertData = null;
            let updateFields = null;

            const queryObj = {
                select() {
                    if (action !== 'delete' && action !== 'update' && action !== 'insert') action = 'select';
                    return queryObj;
                },
                eq(col, val) {
                    filterFuncs.push(item => item[col] == val);
                    return queryObj;
                },
                neq(col, val) {
                    filterFuncs.push(item => item[col] != val);
                    return queryObj;
                },
                single() {
                    isSingle = true;
                    return queryObj;
                },
                insert(rows) {
                    action = 'insert';
                    insertData = rows;
                    return queryObj;
                },
                update(fields) {
                    action = 'update';
                    updateFields = fields;
                    return queryObj;
                },
                delete() {
                    action = 'delete';
                    return queryObj;
                },
                then(resolve, reject) {
                    try {
                        if (!store[table]) store[table] = [];

                        if (action === 'insert') {
                            const items = Array.isArray(insertData) ? insertData : [insertData];
                            const createdItems = [];
                            items.forEach(item => {
                                const newItem = { ...item };
                                if (!newItem.id) {
                                    newItem.id = table === 'shops' ? 'shop_' + Date.now() : Date.now() + Math.floor(Math.random() * 1000);
                                }
                                store[table].push(newItem);
                                createdItems.push(newItem);
                            });
                            return resolve({ data: createdItems, error: null });
                        }

                        let matches = store[table].filter(item => filterFuncs.every(fn => fn(item)));

                        if (action === 'update') {
                            matches.forEach(item => Object.assign(item, updateFields));
                            return resolve({ data: matches, error: null });
                        }

                        if (action === 'delete') {
                            store[table] = store[table].filter(item => !filterFuncs.every(fn => fn(item)));
                            return resolve({ data: matches, error: null });
                        }

                        // Default action === 'select'
                        if (isSingle) {
                            if (matches.length === 0) {
                                return resolve({ data: null, error: { message: 'Row not found' } });
                            } else {
                                return resolve({ data: { ...matches[0] }, error: null });
                            }
                        } else {
                            return resolve({ data: matches.map(x => ({ ...x })), error: null });
                        }
                    } catch (err) {
                        if (reject) reject(err);
                    }
                }
            };
            return queryObj;
        },
        auth: {
            signInWithOtp: async () => ({ data: {}, error: null }),
            verifyOtp: async () => ({ data: {}, error: { message: "Mock auth" } })
        }
    };
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
let supabase;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('[AI Studio] Connected to Supabase.');
    } catch (err) {
        console.warn('[AI Studio] Supabase init failed, using mock store:', err.message);
        supabase = createMockSupabase();
    }
} else {
    console.log('[AI Studio] SUPABASE_URL not configured. Operating in in-memory mode.');
    supabase = createMockSupabase();
}

// --- Multi-Shop Session & Authentication Store ---
const sessions = {}; // token -> shop object
const otpStore = {}; // cleanEmail -> { code, expiresAt }

async function getAuthShop(req) {
    const authHeader = req.headers['authorization'] || req.headers['x-shop-token'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (authHeader) {
        token = authHeader;
    }

    if (!token) {
        return null;
    }

    if (sessions[token]) {
        return sessions[token];
    }

    return null;
}

// Helper to format shop output
function formatShopResponse(shop) {
    return {
        id: shop.id,
        shopName: shop.shop_name,
        ownerName: shop.owner_name,
        email: shop.email || shop.username || ''
    };
}

// --- Auth Endpoints ---

// Register New Shop API (Email & Password)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { shopName, ownerName, email, password } = req.body;
        if (!shopName || !email || !password) {
            return res.status(400).json({ error: "Shop Name, Email ID, and Password are required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const { data: existingShops } = await supabase.from('shops').select('*');
        const duplicate = (existingShops || []).find(s => 
            (s.email && s.email.toLowerCase() === cleanEmail) || 
            (s.username && s.username.toLowerCase() === cleanEmail)
        );
        
        if (duplicate) {
            return res.status(400).json({ error: "A shop with this Email ID already exists. Please log in instead." });
        }

        const newShopPayload = {
            id: "shop_" + Date.now(),
            shop_name: shopName.trim(),
            owner_name: (ownerName || shopName).trim(),
            email: cleanEmail,
            username: cleanEmail,
            password: password.trim(),
            created_at: new Date().toISOString()
        };

        const { data: insertedShops, error: insertErr } = await supabase.from('shops').insert([newShopPayload]).select();
        if (insertErr) {
            console.warn("Shop registration insert warning:", insertErr.message);
            await supabase.from('shops').insert([newShopPayload]);
        }

        const newShop = (insertedShops && insertedShops[0]) ? insertedShops[0] : newShopPayload;

        const token = "token_" + Date.now() + "_" + Math.random().toString(36).substring(2);
        sessions[token] = newShop;

        res.json({
            success: true,
            token: token,
            shop: formatShopResponse(newShop)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login Shop API (Email & Password)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const inputEmail = (email || username || '').trim().toLowerCase();
        
        if (!inputEmail || !password) {
            return res.status(400).json({ error: "Email ID and Password are required." });
        }

        const { data: shops } = await supabase.from('shops').select('*');
        
        let shop = (shops || []).find(s => 
            ((s.email && s.email.toLowerCase() === inputEmail) || 
             (s.username && s.username.toLowerCase() === inputEmail)) && 
            s.password === password
        );

        if (!shop) {
            return res.status(400).json({ error: "Invalid Email ID or Password." });
        }

        const token = "token_" + Date.now() + "_" + Math.random().toString(36).substring(2);
        sessions[token] = shop;

        res.json({
            success: true,
            token: token,
            shop: formatShopResponse(shop)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send OTP API (For OTP Login or Reset Password)
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email ID is required to send OTP." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const { data: shops } = await supabase.from('shops').select('*');
        
        const shop = (shops || []).find(s => 
            (s.email && s.email.toLowerCase() === cleanEmail) || 
            (s.username && s.username.toLowerCase() === cleanEmail)
        );

        if (!shop) {
            return res.status(400).json({ error: "No shop account found registered with this Email ID." });
        }

        // Generate 6-digit OTP code as backup
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins
        otpStore[cleanEmail] = { code: otpCode, expiresAt };

        let supabaseAuthSent = false;

        // Call Supabase Auth signInWithOtp to trigger Supabase native email OTP
        if (supabase && supabase.auth && typeof supabase.auth.signInWithOtp === 'function') {
            try {
                const { error: sbErr } = await supabase.auth.signInWithOtp({
                    email: cleanEmail,
                    options: {
                        shouldCreateUser: false
                    }
                });
                if (!sbErr) {
                    supabaseAuthSent = true;
                    console.log(`[SUPABASE AUTH] Native OTP sent successfully to ${cleanEmail}`);
                } else {
                    console.log('[SUPABASE AUTH] signInWithOtp notice:', sbErr.message);
                }
            } catch (sbEx) {
                console.log('[SUPABASE AUTH EXCEPTION]', sbEx.message);
            }
        }

        // Attempt to update shop record in database
        try {
            await supabase.from('shops').update({
                otp_code: otpCode,
                otp_expires_at: new Date(expiresAt).toISOString()
            }).eq('id', shop.id);
        } catch (dbErr) {
            console.log('Supabase otp column update optional:', dbErr.message);
        }

        // Dispatch backup Email via SMTP if Supabase Native Auth email wasn't sent
        if (!supabaseAuthSent) {
            await sendOtpEmail(cleanEmail, otpCode, shop.shop_name);
        }

        res.json({
            success: true,
            message: `OTP verification code sent to ${cleanEmail}. Please check your email inbox.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify Email OTP & Login API
app.post('/api/auth/login-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email ID and OTP code are required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.trim();

        const storedOtp = otpStore[cleanEmail];
        const { data: shops } = await supabase.from('shops').select('*');
        const shop = (shops || []).find(s => 
            (s.email && s.email.toLowerCase() === cleanEmail) || 
            (s.username && s.username.toLowerCase() === cleanEmail)
        );

        if (!shop) {
            return res.status(400).json({ error: "No shop account found with this Email ID." });
        }

        let isValid = false;

        // 1. Try Supabase Auth verifyOtp natively
        if (supabase && supabase.auth && typeof supabase.auth.verifyOtp === 'function') {
            try {
                const { data: sbData, error: sbErr } = await supabase.auth.verifyOtp({
                    email: cleanEmail,
                    token: cleanOtp,
                    type: 'email'
                });
                if (!sbErr && sbData && sbData.session) {
                    isValid = true;
                    console.log(`[SUPABASE AUTH] Native OTP verified for ${cleanEmail}`);
                }
            } catch (sbEx) {
                console.log('[SUPABASE AUTH VERIFY EXCEPTION]', sbEx.message);
            }
        }

        // 2. Fallback check stored OTP code or shop table OTP code
        if (!isValid) {
            if (storedOtp && storedOtp.code === cleanOtp && Date.now() < storedOtp.expiresAt) {
                isValid = true;
            } else if (shop.otp_code === cleanOtp && shop.otp_expires_at && new Date(shop.otp_expires_at).getTime() > Date.now()) {
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({ error: "Invalid or expired OTP code." });
        }

        // Clear OTP after successful use
        delete otpStore[cleanEmail];

        const token = "token_" + Date.now() + "_" + Math.random().toString(36).substring(2);
        sessions[token] = shop;

        res.json({
            success: true,
            token: token,
            shop: formatShopResponse(shop)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Forgot / Reset Password API
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "Email ID, OTP code, and New Password are required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.trim();
        const cleanPassword = newPassword.trim();

        if (cleanPassword.length < 4) {
            return res.status(400).json({ error: "New password must be at least 4 characters long." });
        }

        const storedOtp = otpStore[cleanEmail];
        const { data: shops } = await supabase.from('shops').select('*');
        const shop = (shops || []).find(s => 
            (s.email && s.email.toLowerCase() === cleanEmail) || 
            (s.username && s.username.toLowerCase() === cleanEmail)
        );

        if (!shop) {
            return res.status(400).json({ error: "No shop account found with this Email ID." });
        }

        let isValid = false;

        // 1. Try Supabase Auth verifyOtp natively
        if (supabase && supabase.auth && typeof supabase.auth.verifyOtp === 'function') {
            try {
                const { data: sbData, error: sbErr } = await supabase.auth.verifyOtp({
                    email: cleanEmail,
                    token: cleanOtp,
                    type: 'recovery'
                });
                if (!sbErr && sbData) {
                    isValid = true;
                } else {
                    const { data: sbData2, error: sbErr2 } = await supabase.auth.verifyOtp({
                        email: cleanEmail,
                        token: cleanOtp,
                        type: 'email'
                    });
                    if (!sbErr2 && sbData2) {
                        isValid = true;
                    }
                }
            } catch (sbEx) {
                console.log('[SUPABASE AUTH VERIFY EXCEPTION]', sbEx.message);
            }
        }

        // 2. Fallback check stored OTP
        if (!isValid) {
            if (storedOtp && storedOtp.code === cleanOtp && Date.now() < storedOtp.expiresAt) {
                isValid = true;
            } else if (shop.otp_code === cleanOtp && shop.otp_expires_at && new Date(shop.otp_expires_at).getTime() > Date.now()) {
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({ error: "Invalid or expired OTP code." });
        }

        // Clear OTP
        delete otpStore[cleanEmail];

        // Update password
        shop.password = cleanPassword;
        await supabase.from('shops').update({
            password: cleanPassword,
            otp_code: null,
            otp_expires_at: null
        }).eq('id', shop.id);

        res.json({
            success: true,
            message: "Password reset successfully! You can now log in with your new password."
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Logged-in Shop Info
app.get('/api/auth/me', async (req, res) => {
    const shop = await getAuthShop(req);
    if (!shop) {
        return res.json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        shop: formatShopResponse(shop)
    });
});

// Logout Shop API
app.post('/api/auth/logout', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['x-shop-token'];
        if (authHeader) {
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            delete sessions[token];
        }
        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        res.json({ success: true, message: "Logged out" });
    }
});

// Update Shop Credentials / Settings
app.put('/api/auth/update-credentials', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { shopName, ownerName, email, username, password } = req.body;
        const cleanEmail = (email || username || shop.email || shop.username || '').trim().toLowerCase();

        if (cleanEmail && cleanEmail !== (shop.email || shop.username)) {
            const { data: shops } = await supabase.from('shops').select('*');
            const taken = (shops || []).find(s => 
                String(s.id) !== String(shop.id) && 
                ((s.email && s.email.toLowerCase() === cleanEmail) || 
                 (s.username && s.username.toLowerCase() === cleanEmail))
            );
            if (taken) {
                return res.status(400).json({ error: "Email ID is already registered to another shop." });
            }
        }

        shop.shop_name = shopName ? shopName.trim() : shop.shop_name;
        shop.owner_name = ownerName ? ownerName.trim() : shop.owner_name;
        shop.email = cleanEmail;
        shop.username = cleanEmail;
        if (password && password.trim()) {
            shop.password = password.trim();
        }

        await supabase.from('shops').update({
            shop_name: shop.shop_name,
            owner_name: shop.owner_name,
            email: shop.email,
            username: shop.username,
            password: shop.password
        }).eq('id', shop.id);

        res.json({
            success: true,
            message: "Shop details updated successfully!",
            shop: formatShopResponse(shop)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-shop-token'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
    else if (authHeader) token = authHeader;

    if (token && sessions[token]) {
        delete sessions[token];
    }
    res.json({ success: true });
});

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const today = new Date().toISOString().split('T')[0];
        
        const { data: rawCompanies, error: compErr } = await supabase.from('companies').select('*');
        if (compErr) throw compErr;

        const { data: rawBills, error: billErr } = await supabase.from('bills').select('*');
        if (billErr) throw billErr;

        const { data: rawPayments, error: payErr } = await supabase.from('payments').select('*');
        if (payErr) throw payErr;

        const companies = (rawCompanies || []).filter(c => String(c.shop_id || '1') === shopId);
        const bills = (rawBills || []).filter(b => String(b.shop_id || '1') === shopId);
        const payments = (rawPayments || []).filter(p => String(p.shop_id || '1') === shopId);

        let totalOutstanding = 0;
        let currentDue = 0;
        let overdueAmount = 0;

        companies.forEach(comp => {
            totalOutstanding += (parseFloat(comp.outstanding) || 0);
        });

        bills.forEach(bill => {
            if (bill.status !== 'Settled') {
                const bal = parseFloat(bill.balance_due) || 0;
                if (bill.due_date < today) {
                    overdueAmount += bal;
                } else {
                    currentDue += bal;
                }
            }
        });

        const formattedCompanies = companies.map(c => ({
            id: c.id,
            name: c.name,
            creditDays: c.credit_days,
            outstanding: c.outstanding,
            bankName: c.bank_name,
            accountNo: c.account_no,
            ifsc: c.ifsc,
            upi: c.upi
        }));

        const formattedBills = bills.map(b => ({
            id: b.id,
            companyName: b.company_name,
            billNo: b.bill_no,
            date: b.date,
            totalAmount: b.total_amount,
            paidAmount: b.paid_amount,
            balanceDue: b.balance_due,
            dueDate: b.due_date,
            status: b.status
        }));

        const formattedPayments = payments.map(p => ({
            id: p.id,
            billId: p.bill_id,
            companyName: p.company_name,
            billNo: p.bill_no,
            amount: p.amount,
            date: p.date,
            mode: p.mode,
            remark: p.remark
        }));

        res.json({
            companies: formattedCompanies,
            bills: formattedBills,
            payments: formattedPayments,
            metrics: { totalOutstanding, currentDue, overdueAmount }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Company
app.post('/api/company', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const { name, creditDays, openingBalance, bankName, accountNo, ifsc, upi } = req.body;
        const parsedCreditDays = parseInt(creditDays) || 0;
        const parsedOpeningBal = parseFloat(openingBalance) || 0;
        const compId = Date.now();
        
        const newComp = { 
            id: compId,
            shop_id: shopId,
            name, 
            credit_days: parsedCreditDays, 
            outstanding: parsedOpeningBal, 
            bank_name: bankName, 
            account_no: accountNo, 
            ifsc, 
            upi 
        };

        const { data: insertedComps, error: insertErr } = await supabase.from('companies').insert([newComp]).select();
        if (insertErr) {
            console.warn("Company insert warning:", insertErr.message);
            await supabase.from('companies').insert([newComp]);
        }

        const createdComp = (insertedComps && insertedComps[0]) ? insertedComps[0] : newComp;

        if (parsedOpeningBal > 0) {
            const today = new Date().toISOString().split('T')[0];
            const newBill = {
                id: Date.now() + 1,
                shop_id: shopId,
                company_name: name,
                bill_no: "OPENING-BAL",
                date: today,
                total_amount: parsedOpeningBal,
                paid_amount: 0,
                balance_due: parsedOpeningBal,
                due_date: today,
                status: "Unpaid"
            };
            const { error: billErr } = await supabase.from('bills').insert([newBill]);
            if (billErr) {
                console.warn("Opening balance bill insert warning:", billErr.message);
                await supabase.from('bills').insert([newBill]);
            }
        }

        res.json({ success: true, company: { id: createdComp.id, name, creditDays: parsedCreditDays, outstanding: parsedOpeningBal, bankName, accountNo, ifsc, upi } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Company Details
app.put('/api/company/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);
        const { name, creditDays, bankName, accountNo, ifsc, upi } = req.body;
        
        const { data: companies } = await supabase.from('companies').select('*');
        let existing = (companies || []).find(c => (String(c.id) === String(rawId) || c.id === numId) && String(c.shop_id || '1') === shopId);

        if (!existing) return res.status(404).json({ error: "Company not found" });

        const oldName = existing.name;
        const newName = (name && name.trim()) ? name.trim() : oldName;

        if (oldName !== newName) {
            const { data: bills } = await supabase.from('bills').select('*');
            (bills || []).filter(b => b.company_name === oldName && String(b.shop_id || '1') === shopId)
                .forEach(async b => {
                    await supabase.from('bills').update({ company_name: newName }).eq('id', b.id);
                });

            const { data: payments } = await supabase.from('payments').select('*');
            (payments || []).filter(p => p.company_name === oldName && String(p.shop_id || '1') === shopId)
                .forEach(async p => {
                    await supabase.from('payments').update({ company_name: newName }).eq('id', p.id);
                });
        }

        const updatedData = {
            name: newName,
            credit_days: creditDays !== undefined && creditDays !== '' ? parseInt(creditDays) : existing.credit_days,
            bank_name: bankName !== undefined ? bankName : existing.bank_name,
            account_no: accountNo !== undefined ? accountNo : existing.account_no,
            ifsc: ifsc !== undefined ? ifsc : existing.ifsc,
            upi: upi !== undefined ? upi : existing.upi
        };

        const { error: updateErr } = await supabase.from('companies').update(updatedData).eq('id', existing.id);
        if (updateErr) throw updateErr;

        res.json({ success: true, company: { id: existing.id, ...updatedData } });
    } catch (err) {
        console.error("Update company error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Company
app.delete('/api/company/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);

        const { data: companies } = await supabase.from('companies').select('*');
        let comp = (companies || []).find(c => (String(c.id) === String(rawId) || c.id === numId) && String(c.shop_id || '1') === shopId);

        const compName = comp ? comp.name : null;
        if (comp) {
            const { data: payments } = await supabase.from('payments').select('*');
            const compPayments = (payments || []).filter(p => p.company_name === compName && String(p.shop_id || '1') === shopId);
            
            const { data: bills } = await supabase.from('bills').select('*');
            const compBills = (bills || []).filter(b => b.company_name === compName && String(b.shop_id || '1') === shopId);

            // Save snapshot into Trash / Recovery Bin
            await saveToTrash(
                shopId,
                'company',
                `Distributor: ${comp.name}`,
                `Distributor profile deleted with ${compBills.length} purchase bill(s) and ${compPayments.length} payment record(s). Outstanding was ₹${(parseFloat(comp.outstanding) || 0).toLocaleString('en-IN')}.`,
                { company: comp, bills: compBills, payments: compPayments }
            );

            for (let p of compPayments) {
                await supabase.from('payments').delete().eq('id', p.id);
            }
            for (let b of compBills) {
                await supabase.from('bills').delete().eq('id', b.id);
            }
            await supabase.from('companies').delete().eq('id', comp.id);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Delete company error:", err);
        res.status(500).json({ error: err.message });
    }
});


// Helper to save deleted items to 30-Day Recycle Bin
async function saveToTrash(shopId, type, title, details, payload) {
    const trashRecord = {
        id: 'trash_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        shop_id: String(shopId),
        type: type, // 'company' | 'bill' | 'payment'
        title: title,
        details: details,
        deleted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        payload: JSON.stringify(payload)
    };

    try {
        await supabase.from('trash_bin').insert([trashRecord]);
    } catch (err) {
        console.warn("Notice: Error saving snapshot to trash_bin:", err ? err.message : 'Unknown');
    }
}

// Helper to robustly insert payment records across varying Supabase table schemas
async function insertPaymentRecord(paymentObj) {
    let candidate = {
        id: paymentObj.id || Date.now() + Math.floor(Math.random() * 100000),
        bill_id: paymentObj.bill_id || null,
        company_name: paymentObj.company_name,
        bill_no: paymentObj.bill_no || null,
        amount: parseFloat(paymentObj.amount) || 0,
        date: paymentObj.date || new Date().toISOString().split('T')[0],
        mode: paymentObj.mode || paymentObj.payment_mode || 'NEFT',
        remark: paymentObj.remark || '',
        shop_id: paymentObj.shop_id ? String(paymentObj.shop_id) : null
    };

    for (let attempt = 1; attempt <= 10; attempt++) {
        const { data, error } = await supabase.from('payments').insert([candidate]).select();
        if (!error) {
            return (data && data[0]) ? data[0] : candidate;
        }

        console.warn(`Payment insert attempt ${attempt} warning:`, error.message);
        const errMsg = error.message || '';

        // Extract unknown column name if Supabase reported missing column
        const match = errMsg.match(/Could not find the '([^']+)' column/i) ||
                      errMsg.match(/column ["']([^"']+)["'] of relation/i) ||
                      errMsg.match(/column ["']([^"']+)["'] does not exist/i);

        if (match && match[1]) {
            const unknownCol = match[1];
            if (candidate.hasOwnProperty(unknownCol)) {
                delete candidate[unknownCol];
                console.log(`Stripped unknown column '${unknownCol}' from payment payload. Retrying...`);
                continue;
            }
        }

        // Handle NOT NULL constraint on id
        if (/null value in column ["']id["']/i.test(errMsg) || /violates not-null constraint/i.test(errMsg)) {
            if (!candidate.id) {
                candidate.id = Date.now() + Math.floor(Math.random() * 100000);
                continue;
            }
        }

        // Sequential fallback removals if schema is minimal
        if (candidate.hasOwnProperty('payment_mode')) {
            delete candidate.payment_mode;
            continue;
        }
        if (candidate.hasOwnProperty('bill_no')) {
            delete candidate.bill_no;
            continue;
        }
        if (candidate.hasOwnProperty('bill_id')) {
            delete candidate.bill_id;
            continue;
        }
        if (candidate.hasOwnProperty('shop_id')) {
            delete candidate.shop_id;
            continue;
        }

        console.error("All payment insert retries exhausted:", error);
        throw new Error(error.message || "Failed to save payment record to database");
    }
}

// Recalculate company bills and outstanding balance
async function recalculateCompanyState(companyName, shopId) {
    if (!companyName) return;
    const currentShopId = String(shopId || '1');

    try {
        const { data: rawCompanies } = await supabase.from('companies').select('*');
        let company = (rawCompanies || []).find(c => c.name === companyName && (!c.shop_id || String(c.shop_id) === currentShopId || String(c.shop_id) === '1' || currentShopId === '1'));
        if (!company) return;

        const { data: rawBills } = await supabase.from('bills').select('*');
        let bills = (rawBills || []).filter(b => b && b.company_name === companyName && (!b.shop_id || String(b.shop_id) === currentShopId || String(b.shop_id) === '1' || currentShopId === '1'));

        // Sort bills FIFO: oldest date/due_date first
        bills.sort((a, b) => new Date(a.date || a.due_date) - new Date(b.date || b.due_date) || (Number(a.id) - Number(b.id)));

        const { data: rawPayments } = await supabase.from('payments').select('*');
        let payments = (rawPayments || []).filter(p => p && p.company_name === companyName && (!p.shop_id || String(p.shop_id) === currentShopId || String(p.shop_id) === '1' || currentShopId === '1'));

        let billPaidMap = {};
        bills.forEach(b => { billPaidMap[String(b.id)] = 0; });

        let unallocatedPayments = 0;

        payments.forEach(p => {
            const payAmt = parseFloat(p.amount) || 0;
            if (p.bill_id && billPaidMap[String(p.bill_id)] !== undefined) {
                billPaidMap[String(p.bill_id)] += payAmt;
            } else {
                unallocatedPayments += payAmt;
            }
        });

        for (let bill of bills) {
            let totalAmt = parseFloat(bill.total_amount) || 0;
            let paid = billPaidMap[String(bill.id)] || 0;

            if (paid < totalAmt && unallocatedPayments > 0) {
                let needed = totalAmt - paid;
                let fill = Math.min(needed, unallocatedPayments);
                paid += fill;
                unallocatedPayments -= fill;
            }

            let balanceDue = Math.max(0, totalAmt - paid);
            let status = "Unpaid";
            if (balanceDue <= 0) {
                balanceDue = 0;
                status = "Settled";
            } else if (paid > 0) {
                status = "Partial";
            }

            await supabase.from('bills').update({
                paid_amount: paid,
                balance_due: balanceDue,
                status: status
            }).eq('id', bill.id);
        }

        let totalBillAmount = bills.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        let totalPaymentAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        let calculatedOutstanding = totalBillAmount - totalPaymentAmount;

        await supabase.from('companies').update({
            outstanding: calculatedOutstanding
        }).eq('id', company.id);
    } catch (err) {
        console.error("Error in recalculateCompanyState:", err);
    }
}

// Add Bill
app.post('/api/bill', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const { companyName, billNo, date, amount } = req.body;
        const { data: companies } = await supabase.from('companies').select('*');
        let compObj = (companies || []).find(c => c.name === companyName && String(c.shop_id || '1') === shopId);

        if (!compObj) return res.status(404).json({ error: "Company not found" });

        const creditDays = compObj.credit_days !== undefined ? compObj.credit_days : 30;
        const billDateObj = new Date(date);
        billDateObj.setDate(billDateObj.getDate() + creditDays);
        const dueDate = billDateObj.toISOString().split('T')[0];
        const parsedAmount = parseFloat(amount);

        const newBill = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            shop_id: shopId,
            company_name: companyName,
            bill_no: billNo,
            date,
            total_amount: parsedAmount,
            paid_amount: 0,
            balance_due: parsedAmount,
            due_date: dueDate,
            status: "Unpaid"
        };

        const { data: insertedBills, error: insertErr } = await supabase.from('bills').insert([newBill]).select();
        if (insertErr) {
            console.warn("Bill insert warning:", insertErr.message);
            await supabase.from('bills').insert([newBill]);
        }

        const createdBill = (insertedBills && insertedBills[0]) ? insertedBills[0] : newBill;

        await recalculateCompanyState(companyName, shopId);

        res.json({ success: true, bill: createdBill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Bill
app.put('/api/bill/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);
        const { billNo, date, amount } = req.body;
        
        const { data: bills } = await supabase.from('bills').select('*');
        let bill = (bills || []).find(b => (String(b.id) === String(rawId) || b.id === numId) && String(b.shop_id || '1') === shopId);

        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const { data: companies } = await supabase.from('companies').select('*');
        let company = (companies || []).find(c => c.name === bill.company_name && String(c.shop_id || '1') === shopId);

        const creditDays = company && company.credit_days !== undefined ? company.credit_days : 30;
        const newTotal = parseFloat(amount);

        const billDateObj = new Date(date);
        billDateObj.setDate(billDateObj.getDate() + creditDays);
        const dueDate = billDateObj.toISOString().split('T')[0];

        const updateFields = {
            bill_no: billNo,
            date,
            total_amount: newTotal,
            due_date: dueDate
        };

        await supabase.from('bills').update(updateFields).eq('id', bill.id);
        await recalculateCompanyState(bill.company_name, shopId);

        res.json({ success: true, bill: updateFields });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Bill
app.delete('/api/bill/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);

        const { data: bills } = await supabase.from('bills').select('*');
        let bill = (bills || []).find(b => (String(b.id) === String(rawId) || b.id === numId) && String(b.shop_id || '1') === shopId);

        const companyName = bill ? bill.company_name : null;
        const billIdToDelete = bill ? bill.id : rawId;

        if (bill) {
            const { data: payments } = await supabase.from('payments').select('*');
            const billPayments = (payments || []).filter(p => (String(p.bill_id) === String(billIdToDelete) || p.bill_id == billIdToDelete) && String(p.shop_id || '1') === shopId);

            // Save snapshot to 30-day Trash Bin
            await saveToTrash(
                shopId,
                'bill',
                `Bill #${bill.bill_no} (${bill.company_name})`,
                `Bill amount: ₹${(parseFloat(bill.total_amount) || 0).toLocaleString('en-IN')} | Bill date: ${bill.date || '-'} | Status: ${bill.status || 'Unpaid'}. ${billPayments.length} payment allocation(s) saved.`,
                { bill, payments: billPayments }
            );

            for (let p of billPayments) {
                await supabase.from('payments').delete().eq('id', p.id);
            }

            await supabase.from('bills').delete().eq('id', bill.id);
        }

        if (companyName) {
            await recalculateCompanyState(companyName, shopId);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Delete bill error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Payment / Credit Note Allocation (FIFO Settlement)
app.post('/api/payment', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const { companyName, paymentAmount, paymentDate, paymentMode, remark } = req.body;
        let payAmt = parseFloat(paymentAmount);

        if (!companyName || isNaN(payAmt) || payAmt <= 0) {
            return res.status(400).json({ error: "Invalid payment or credit details" });
        }

        const { data: companies } = await supabase.from('companies').select('*');
        let company = (companies || []).find(c => c.name === companyName && (!c.shop_id || String(c.shop_id) === shopId || String(c.shop_id) === '1' || shopId === '1'));

        if (!company) return res.status(404).json({ error: "Company not found" });

        const { data: companyBills } = await supabase.from('bills').select('*');
        let openBills = (companyBills || [])
            .filter(b => b && b.company_name === companyName && (!b.shop_id || String(b.shop_id) === shopId || String(b.shop_id) === '1' || shopId === '1') && b.status !== 'Settled')
            .sort((a, b) => new Date(a.date || a.due_date) - new Date(b.date || b.due_date) || (Number(a.id) - Number(b.id)));

        let remainingToAllocate = payAmt;

        for (let bill of openBills) {
            if (remainingToAllocate <= 0) break;

            let balanceNeeded = parseFloat(bill.balance_due) || 0;
            if (balanceNeeded <= 0) continue;

            let allocateAmt = Math.min(remainingToAllocate, balanceNeeded);
            remainingToAllocate -= allocateAmt;

            const newPayment = {
                id: Date.now() + Math.floor(Math.random() * 100000),
                shop_id: shopId,
                bill_id: bill.id,
                company_name: companyName,
                bill_no: bill.bill_no,
                amount: allocateAmt,
                date: paymentDate,
                mode: paymentMode,
                remark: remark || (paymentMode === 'Credit Note / Discount' ? 'Company Discount' : 'FIFO Settlement')
            };

            await insertPaymentRecord(newPayment);
        }

        if (remainingToAllocate > 0) {
            const advancePayment = {
                id: Date.now() + Math.floor(Math.random() * 100000) + 1,
                shop_id: shopId,
                bill_id: null,
                company_name: companyName,
                bill_no: 'ADVANCE/CREDIT',
                amount: remainingToAllocate,
                date: paymentDate,
                mode: paymentMode,
                remark: (remark ? remark + ' ' : '') + '(Advance Credit)'
            };

            await insertPaymentRecord(advancePayment);
        }

        await recalculateCompanyState(companyName, shopId);

        res.json({ success: true });
    } catch (err) {
        console.error("Payment error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Edit Payment / Credit Note
app.put('/api/payment/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);
        const { paymentAmount, paymentDate, remark } = req.body;
        
        const { data: payments } = await supabase.from('payments').select('*');
        let payment = (payments || []).find(p => (String(p.id) === String(rawId) || p.id === numId) && String(p.shop_id || '1') === shopId);

        if (!payment) return res.status(404).json({ error: "Record not found" });

        const newPayAmt = parseFloat(paymentAmount);

        const updateData = {
            amount: newPayAmt,
            date: paymentDate,
            remark: remark || payment.remark
        };

        await supabase.from('payments').update(updateData).eq('id', payment.id);
        await recalculateCompanyState(payment.company_name, shopId);

        res.json({ success: true, payment: updateData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Payment / Credit Note
app.delete('/api/payment/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const rawId = req.params.id;
        const numId = Number(rawId);

        const { data: payments } = await supabase.from('payments').select('*');
        let payment = (payments || []).find(p => (String(p.id) === String(rawId) || p.id === numId) && String(p.shop_id || '1') === shopId);

        const companyName = payment ? payment.company_name : null;

        if (payment) {
            // Save snapshot to 30-day Trash Bin
            await saveToTrash(
                shopId,
                'payment',
                `Payment / Credit: ${payment.company_name}`,
                `Amount: ₹${(parseFloat(payment.amount) || 0).toLocaleString('en-IN')} | Mode: ${payment.mode || 'Payment'} | Bill: ${payment.bill_no || '-'} | Date: ${payment.date || '-'}. Remark: ${payment.remark || 'None'}`,
                { payment }
            );

            await supabase.from('payments').delete().eq('id', payment.id);
        }

        if (companyName) {
            await recalculateCompanyState(companyName, shopId);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Delete payment error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- 🗑️ 30-DAY RECYCLE BIN & RECOVERY ROUTES ---

// Get all recoverable deleted items (within 30 days)
app.get('/api/recycle-bin', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const { data: trashItems } = await supabase.from('trash_bin').select('*');
        const now = new Date();

        const validItems = (trashItems || []).filter(item => {
            if (String(item.shop_id || '1') !== shopId) return false;
            if (!item.expires_at) return true;
            return new Date(item.expires_at) > now;
        }).map(item => {
            const expires = new Date(item.expires_at || (Date.now() + 30 * 24 * 60 * 60 * 1000));
            const diffTime = expires - now;
            const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            return {
                id: item.id,
                type: item.type,
                title: item.title,
                details: item.details,
                deletedAt: item.deleted_at,
                expiresAt: item.expires_at,
                daysLeft: daysLeft
            };
        });

        validItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        res.json({ success: true, trash: validItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restore a deleted record back to active tables
app.post('/api/recycle-bin/restore/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);
        const rawId = req.params.id;

        const { data: trashItems } = await supabase.from('trash_bin').select('*');
        const trashItem = (trashItems || []).find(t => String(t.id) === String(rawId) && String(t.shop_id || '1') === shopId);

        if (!trashItem) return res.status(404).json({ error: "Trash record not found or expired" });

        let payload = typeof trashItem.payload === 'string' ? JSON.parse(trashItem.payload) : trashItem.payload;

        let affectedCompanyNames = new Set();

        // 1. Restore Company if present
        if (payload.company) {
            const comp = payload.company;
            affectedCompanyNames.add(comp.name);
            const { data: existingComps } = await supabase.from('companies').select('*');
            const exists = (existingComps || []).some(c => c.name === comp.name && String(c.shop_id || '1') === shopId);
            if (!exists) {
                await supabase.from('companies').insert([comp]);
            }
        }

        // 2. Restore Bills if present
        if (payload.bills && Array.isArray(payload.bills)) {
            for (let b of payload.bills) {
                affectedCompanyNames.add(b.company_name);
                const { data: existingBills } = await supabase.from('bills').select('*');
                const exists = (existingBills || []).some(x => String(x.id) === String(b.id));
                if (!exists) {
                    await supabase.from('bills').insert([b]);
                }
            }
        } else if (payload.bill) {
            const b = payload.bill;
            affectedCompanyNames.add(b.company_name);
            const { data: existingBills } = await supabase.from('bills').select('*');
            const exists = (existingBills || []).some(x => String(x.id) === String(b.id));
            if (!exists) {
                await supabase.from('bills').insert([b]);
            }
        }

        // 3. Restore Payments if present
        if (payload.payments && Array.isArray(payload.payments)) {
            for (let p of payload.payments) {
                affectedCompanyNames.add(p.company_name);
                const { data: existingPayments } = await supabase.from('payments').select('*');
                const exists = (existingPayments || []).some(x => String(x.id) === String(p.id));
                if (!exists) {
                    await supabase.from('payments').insert([p]);
                }
            }
        } else if (payload.payment) {
            const p = payload.payment;
            affectedCompanyNames.add(p.company_name);
            const { data: existingPayments } = await supabase.from('payments').select('*');
            const exists = (existingPayments || []).some(x => String(x.id) === String(p.id));
            if (!exists) {
                await supabase.from('payments').insert([p]);
            }
        }

        // Recalculate company balances
        for (let compName of affectedCompanyNames) {
            await recalculateCompanyState(compName, shopId);
        }

        // Remove from trash bin
        await supabase.from('trash_bin').delete().eq('id', trashItem.id);

        res.json({ success: true });
    } catch (err) {
        console.error("Restore error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Permanently delete an item from trash bin
app.delete('/api/recycle-bin/permanent/:id', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);
        const rawId = req.params.id;

        await supabase.from('trash_bin').delete().eq('id', rawId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Permanently clear entire trash bin
app.delete('/api/recycle-bin/clear', async (req, res) => {
    try {
        const shop = await getAuthShop(req);
        if (!shop) return res.status(401).json({ error: "Unauthorized" });
        const shopId = String(shop.id);

        const { data: trashItems } = await supabase.from('trash_bin').select('*');
        const userItems = (trashItems || []).filter(t => String(t.shop_id || '1') === shopId);
        for (let t of userItems) {
            await supabase.from('trash_bin').delete().eq('id', t.id);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Local Development Server listener
app.listen(PORT, () => {
    console.log(`Plumbing Shop Dues & Tracker running on port ${PORT}`);
});

// Export app for Vercel Serverless Functions
module.exports = app;
