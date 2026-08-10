const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client with In-Memory Mock Fallback for local run without env
function createMockSupabase() {
    console.log('[AI Studio] Initializing in-memory store for Supabase.');
    const store = {
        companies: [
            {
                id: 1,
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
                            items.forEach(item => store[table].push({ ...item }));
                            return resolve({ data: items, error: null });
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

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [
            { data: companies, error: compErr },
            { data: bills, error: billErr },
            { data: payments, error: payErr }
        ] = await Promise.all([
            supabase.from('companies').select('*'),
            supabase.from('bills').select('*'),
            supabase.from('payments').select('*')
        ]);

        if (compErr) throw compErr;
        if (billErr) throw billErr;
        if (payErr) throw payErr;

        let totalOutstanding = 0;
        let currentDue = 0;
        let overdueAmount = 0;

        (companies || []).forEach(comp => {
            totalOutstanding += (parseFloat(comp.outstanding) || 0);
        });

        (bills || []).forEach(bill => {
            if (bill.status !== 'Settled') {
                const bal = parseFloat(bill.balance_due) || 0;
                if (bill.due_date < today) {
                    overdueAmount += bal;
                } else {
                    currentDue += bal;
                }
            }
        });

        const formattedCompanies = (companies || []).map(c => ({
            id: c.id,
            name: c.name,
            creditDays: c.credit_days,
            outstanding: c.outstanding,
            bankName: c.bank_name,
            accountNo: c.account_no,
            ifsc: c.ifsc,
            upi: c.upi
        }));

        const formattedBills = (bills || []).map(b => ({
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

        const formattedPayments = (payments || []).map(p => ({
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
        const { name, creditDays, openingBalance, bankName, accountNo, ifsc, upi } = req.body;
        const parsedCreditDays = parseInt(creditDays) || 0;
        const parsedOpeningBal = parseFloat(openingBalance) || 0;
        const compId = Date.now();
        
        const newComp = { 
            id: compId, 
            name, 
            credit_days: parsedCreditDays, 
            outstanding: parsedOpeningBal, 
            bank_name: bankName, 
            account_no: accountNo, 
            ifsc, 
            upi 
        };

        const { error: insertErr } = await supabase.from('companies').insert([newComp]);
        if (insertErr) throw insertErr;

        if (parsedOpeningBal > 0) {
            const today = new Date().toISOString().split('T')[0];
            const newBill = {
                id: Date.now() + 1,
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
            if (billErr) throw billErr;
        }

        res.json({ success: true, company: { id: compId, name, creditDays: parsedCreditDays, outstanding: parsedOpeningBal, bankName, accountNo, ifsc, upi } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Company Details
app.put('/api/company/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, creditDays, bankName, accountNo, ifsc, upi } = req.body;
        
        const { data: existing, error: fetchErr } = await supabase.from('companies').select('*').eq('id', id).single();
        if (fetchErr || !existing) return res.status(404).json({ error: "Company not found" });

        const oldName = existing.name;
        const newName = name || oldName;

        if (oldName !== newName) {
            await supabase.from('bills').update({ company_name: newName }).eq('company_name', oldName);
            await supabase.from('payments').update({ company_name: newName }).eq('company_name', oldName);
        }

        const updatedData = {
            name: newName,
            credit_days: creditDays !== undefined ? parseInt(creditDays) : existing.credit_days,
            bank_name: bankName || existing.bank_name,
            account_no: accountNo || existing.account_no,
            ifsc: ifsc || existing.ifsc,
            upi: upi || existing.upi
        };

        const { error: updateErr } = await supabase.from('companies').update(updatedData).eq('id', id);
        if (updateErr) throw updateErr;

        res.json({ success: true, company: { id, ...updatedData } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Company
app.delete('/api/company/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = Number(rawId);

        let { data: comp } = await supabase.from('companies').select('*').eq('id', rawId).single();
        if (!comp && !isNaN(numId)) {
            let resObj = await supabase.from('companies').select('*').eq('id', numId).single();
            comp = resObj.data;
        }
        if (!comp) {
            const { data: companies } = await supabase.from('companies').select('*');
            comp = (companies || []).find(c => String(c.id) === String(rawId));
        }

        const compName = comp ? comp.name : null;
        const deletePromises = [];

        if (compName) {
            deletePromises.push(supabase.from('payments').delete().eq('company_name', compName));
            deletePromises.push(supabase.from('bills').delete().eq('company_name', compName));
        }

        if (comp) {
            deletePromises.push(supabase.from('companies').delete().eq('id', comp.id));
        }
        deletePromises.push(supabase.from('companies').delete().eq('id', rawId));
        if (!isNaN(numId)) {
            deletePromises.push(supabase.from('companies').delete().eq('id', numId));
        }

        await Promise.all(deletePromises);

        res.json({ success: true });
    } catch (err) {
        console.error("Delete company error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Recalculate company bills and outstanding balance
async function recalculateCompanyState(companyName) {
    if (!companyName) return;

    try {
        const [
            { data: companyData },
            { data: rawBills },
            { data: rawPayments }
        ] = await Promise.all([
            supabase.from('companies').select('*').eq('name', companyName),
            supabase.from('bills').select('*').eq('company_name', companyName),
            supabase.from('payments').select('*').eq('company_name', companyName)
        ]);

        let company = (companyData || [])[0];
        if (!company) {
            const { data: companies } = await supabase.from('companies').select('*');
            company = (companies || []).find(c => c.name === companyName);
        }
        if (!company) return;

        let bills = (rawBills || []).filter(b => b && b.company_name === companyName);

        // Sort bills FIFO: oldest date/due_date first
        bills.sort((a, b) => new Date(a.date || a.due_date) - new Date(b.date || b.due_date) || (Number(a.id) - Number(b.id)));

        let payments = (rawPayments || []).filter(p => p && p.company_name === companyName);

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

        const updatePromises = [];

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

            if (bill.paid_amount !== paid || bill.balance_due !== balanceDue || bill.status !== status) {
                updatePromises.push(
                    supabase.from('bills').update({
                        paid_amount: paid,
                        balance_due: balanceDue,
                        status: status
                    }).eq('id', bill.id)
                );
            }
        }

        let totalBillAmount = bills.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        let totalPaymentAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        let calculatedOutstanding = Math.max(0, totalBillAmount - totalPaymentAmount);

        if (company.outstanding !== calculatedOutstanding) {
            updatePromises.push(
                supabase.from('companies').update({
                    outstanding: calculatedOutstanding
                }).eq('id', company.id)
            );
        }

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }
    } catch (err) {
        console.error("Error in recalculateCompanyState:", err);
    }
}

// Add Bill
app.post('/api/bill', async (req, res) => {
    try {
        const { companyName, billNo, date, amount } = req.body;
        let { data: compObj, error: compErr } = await supabase.from('companies').select('*').eq('name', companyName).single();
        if (!compObj) {
            const { data: companies } = await supabase.from('companies').select('*');
            compObj = (companies || []).find(c => c.name === companyName);
        }
        if (compErr || !compObj) return res.status(404).json({ error: "Company not found" });

        const creditDays = compObj.credit_days !== undefined ? compObj.credit_days : 30;
        const billDateObj = new Date(date);
        billDateObj.setDate(billDateObj.getDate() + creditDays);
        const dueDate = billDateObj.toISOString().split('T')[0];
        const parsedAmount = parseFloat(amount);

        const newBill = {
            id: Date.now(),
            company_name: companyName,
            bill_no: billNo,
            date,
            total_amount: parsedAmount,
            paid_amount: 0,
            balance_due: parsedAmount,
            due_date: dueDate,
            status: "Unpaid"
        };

        const { error: insertErr } = await supabase.from('bills').insert([newBill]);
        if (insertErr) throw insertErr;

        await recalculateCompanyState(companyName);

        res.json({ success: true, bill: newBill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Bill
app.put('/api/bill/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = Number(rawId);
        const { billNo, date, amount } = req.body;
        
        let { data: bill } = await supabase.from('bills').select('*').eq('id', rawId).single();
        if (!bill && !isNaN(numId)) {
            let resObj = await supabase.from('bills').select('*').eq('id', numId).single();
            bill = resObj.data;
        }
        if (!bill) {
            const { data: bills } = await supabase.from('bills').select('*');
            bill = (bills || []).find(b => String(b.id) === String(rawId));
        }
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        let { data: company } = await supabase.from('companies').select('*').eq('name', bill.company_name).single();
        if (!company) {
            const { data: companies } = await supabase.from('companies').select('*');
            company = (companies || []).find(c => c.name === bill.company_name);
        }

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
        await recalculateCompanyState(bill.company_name);

        res.json({ success: true, bill: updateFields });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Bill
app.delete('/api/bill/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = Number(rawId);

        let { data: bill } = await supabase.from('bills').select('*').eq('id', rawId).single();
        if (!bill && !isNaN(numId)) {
            let resObj = await supabase.from('bills').select('*').eq('id', numId).single();
            bill = resObj.data;
        }
        if (!bill) {
            const { data: bills } = await supabase.from('bills').select('*');
            bill = (bills || []).find(b => String(b.id) === String(rawId));
        }

        const companyName = bill ? bill.company_name : null;
        const billIdToDelete = bill ? bill.id : rawId;

        const delPromises = [
            supabase.from('payments').delete().eq('bill_id', billIdToDelete),
            supabase.from('payments').delete().eq('bill_id', String(billIdToDelete)),
            supabase.from('bills').delete().eq('id', rawId)
        ];

        if (!isNaN(Number(billIdToDelete))) {
            delPromises.push(supabase.from('payments').delete().eq('bill_id', Number(billIdToDelete)));
        }
        if (!isNaN(numId)) {
            delPromises.push(supabase.from('bills').delete().eq('id', numId));
        }

        await Promise.all(delPromises);

        if (companyName) {
            await recalculateCompanyState(companyName);
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
        const { companyName, paymentAmount, paymentDate, paymentMode, remark } = req.body;
        let payAmt = parseFloat(paymentAmount);

        if (!companyName || isNaN(payAmt) || payAmt <= 0) {
            return res.status(400).json({ error: "Invalid payment or credit details" });
        }

        let { data: company } = await supabase.from('companies').select('*').eq('name', companyName).single();
        if (!company) {
            const { data: companies } = await supabase.from('companies').select('*');
            company = (companies || []).find(c => c.name === companyName);
        }
        if (!company) return res.status(404).json({ error: "Company not found" });

        let { data: companyBills } = await supabase
            .from('bills')
            .select('*')
            .eq('company_name', companyName);

        let openBills = (companyBills || [])
            .filter(b => b.status !== 'Settled')
            .sort((a, b) => new Date(a.date || a.due_date) - new Date(b.date || b.due_date) || (Number(a.id) - Number(b.id)));

        let remainingToAllocate = payAmt;
        const paymentsToInsert = [];

        for (let bill of openBills) {
            if (remainingToAllocate <= 0) break;

            let balanceNeeded = parseFloat(bill.balance_due) || 0;
            if (balanceNeeded <= 0) continue;

            let allocateAmt = Math.min(remainingToAllocate, balanceNeeded);
            remainingToAllocate -= allocateAmt;

            paymentsToInsert.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                bill_id: bill.id,
                company_name: companyName,
                bill_no: bill.bill_no,
                amount: allocateAmt,
                date: paymentDate,
                mode: paymentMode,
                remark: remark || (paymentMode === 'Credit Note / Discount' ? 'Company Discount' : 'FIFO Settlement')
            });
        }

        if (remainingToAllocate > 0) {
            paymentsToInsert.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                bill_id: null,
                company_name: companyName,
                bill_no: 'ADVANCE/CREDIT',
                amount: remainingToAllocate,
                date: paymentDate,
                mode: paymentMode,
                remark: (remark ? remark + ' ' : '') + '(Advance Credit)'
            });
        }

        if (paymentsToInsert.length > 0) {
            await supabase.from('payments').insert(paymentsToInsert);
        }

        await recalculateCompanyState(companyName);

        res.json({ success: true });
    } catch (err) {
        console.error("Payment error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Edit Payment / Credit Note
app.put('/api/payment/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = Number(rawId);
        const { paymentAmount, paymentDate, remark } = req.body;
        
        let { data: payment } = await supabase.from('payments').select('*').eq('id', rawId).single();
        if (!payment && !isNaN(numId)) {
            let resObj = await supabase.from('payments').select('*').eq('id', numId).single();
            payment = resObj.data;
        }
        if (!payment) {
            const { data: payments } = await supabase.from('payments').select('*');
            payment = (payments || []).find(p => String(p.id) === String(rawId));
        }
        if (!payment) return res.status(404).json({ error: "Record not found" });

        const newPayAmt = parseFloat(paymentAmount);

        const updateData = {
            amount: newPayAmt,
            date: paymentDate,
            remark: remark || payment.remark
        };

        await supabase.from('payments').update(updateData).eq('id', payment.id);
        await recalculateCompanyState(payment.company_name);

        res.json({ success: true, payment: updateData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Payment / Credit Note
app.delete('/api/payment/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const numId = Number(rawId);

        let { data: payment } = await supabase.from('payments').select('*').eq('id', rawId).single();
        if (!payment && !isNaN(numId)) {
            let resObj = await supabase.from('payments').select('*').eq('id', numId).single();
            payment = resObj.data;
        }
        if (!payment) {
            const { data: payments } = await supabase.from('payments').select('*');
            payment = (payments || []).find(p => String(p.id) === String(rawId));
        }

        const companyName = payment ? payment.company_name : null;

        await supabase.from('payments').delete().eq('id', rawId);
        if (!isNaN(numId)) {
            await supabase.from('payments').delete().eq('id', numId);
        }

        if (companyName) {
            await recalculateCompanyState(companyName);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Delete payment error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Local Development Server listener
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Plumbing Shop Dues & Tracker running on port ${PORT}`);
    });
}

// Export app for Vercel Serverless Functions
module.exports = app;
