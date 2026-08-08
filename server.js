const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: companies, error: compErr } = await supabase.from('companies').select('*');
        if (compErr) throw compErr;

        const { data: bills, error: billErr } = await supabase.from('bills').select('*');
        if (billErr) throw billErr;

        const { data: payments, error: payErr } = await supabase.from('payments').select('*');
        if (payErr) throw payErr;

        let totalOutstanding = 0;
        let currentDue = 0;
        let overdueAmount = 0;

        companies.forEach(comp => {
            totalOutstanding += comp.outstanding;
        });

        bills.forEach(bill => {
            if (bill.status !== 'Settled') {
                if (bill.due_date < today) {
                    overdueAmount += bill.balance_due;
                } else {
                    currentDue += bill.balance_due;
                }
            }
        });

        // Map snake_case database columns to camelCase expected by the frontend
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
        const id = parseInt(req.params.id);
        const { data: comp } = await supabase.from('companies').select('*').eq('id', id).single();
        if (comp) {
            await supabase.from('bills').delete().eq('company_name', comp.name);
            await supabase.from('payments').delete().eq('company_name', comp.name);
            await supabase.from('companies').delete().eq('id', id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Bill
app.post('/api/bill', async (req, res) => {
    try {
        const { companyName, billNo, date, amount } = req.body;
        const { data: compObj, error: compErr } = await supabase.from('companies').select('*').eq('name', companyName).single();
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

        const newOutstanding = compObj.outstanding + parsedAmount;
        await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', companyName);

        res.json({ success: true, bill: newBill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Bill
app.put('/api/bill/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { billNo, date, amount } = req.body;
        
        const { data: bill, error: billErr } = await supabase.from('bills').select('*').eq('id', id).single();
        if (billErr || !bill) return res.status(404).json({ error: "Bill not found" });

        const { data: company } = await supabase.from('companies').select('*').eq('name', bill.company_name).single();
        const creditDays = company && company.credit_days !== undefined ? company.credit_days : 30;
        const newTotal = parseFloat(amount);
        const diff = newTotal - bill.total_amount;

        const billDateObj = new Date(date);
        billDateObj.setDate(billDateObj.getDate() + creditDays);
        const dueDate = billDateObj.toISOString().split('T')[0];

        let balanceDue = newTotal - bill.paid_amount;
        let status = "Unpaid";
        if (balanceDue <= 0) {
            balanceDue = 0;
            status = "Settled";
        } else if (bill.paid_amount > 0) {
            status = "Partial";
        }

        const updateFields = {
            bill_no: billNo,
            date,
            total_amount: newTotal,
            due_date: dueDate,
            balance_due: balanceDue,
            status
        };

        await supabase.from('bills').update(updateFields).eq('id', id);

        if (company) {
            let newOutstanding = company.outstanding + diff;
            if (newOutstanding < 0) newOutstanding = 0;
            await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', company.name);
        }

        res.json({ success: true, bill: updateFields });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Bill
app.delete('/api/bill/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { data: bill } = await supabase.from('bills').select('*').eq('id', id).single();
        if (bill) {
            const { data: company } = await supabase.from('companies').select('*').eq('name', bill.company_name).single();
            if (company) {
                let newOutstanding = company.outstanding - bill.balance_due;
                if (newOutstanding < 0) newOutstanding = 0;
                await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', company.name);
            }
            await supabase.from('payments').delete().eq('bill_id', bill.id);
            await supabase.from('bills').delete().eq('id', id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Payment / Credit Note Allocation
app.post('/api/payment', async (req, res) => {
    try {
        const { companyName, paymentAmount, paymentDate, paymentMode, remark } = req.body;
        let payAmt = parseFloat(paymentAmount);

        if (!companyName || isNaN(payAmt) || payAmt <= 0) {
            return res.status(400).json({ error: "Invalid payment or credit details" });
        }

        const { data: company, error: compErr } = await supabase.from('companies').select('*').eq('name', companyName).single();
        if (compErr || !company) return res.status(404).json({ error: "Company not found" });

        let { data: companyBills, error: billsErr } = await supabase
            .from('bills')
            .select('*')
            .eq('company_name', companyName)
            .neq('status', 'Settled');

        if (billsErr) throw billsErr;

        companyBills.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        let totalPaidApplied = payAmt;

        for (let bill of companyBills) {
            if (payAmt <= 0) break;

            let allocateAmt = Math.min(payAmt, bill.balance_due);
            let newPaidAmount = bill.paid_amount + allocateAmt;
            let newBalanceDue = bill.balance_due - allocateAmt;
            payAmt -= allocateAmt;

            let status = "Partial";
            if (newBalanceDue <= 0) {
                newBalanceDue = 0;
                status = "Settled";
            }

            await supabase.from('bills').update({
                paid_amount: newPaidAmount,
                balance_due: newBalanceDue,
                status: status
            }).eq('id', bill.id);

            const newPayment = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                bill_id: bill.id,
                company_name: companyName,
                bill_no: bill.bill_no,
                amount: allocateAmt,
                date: paymentDate,
                mode: paymentMode,
                remark: remark || (paymentMode === 'Credit Note / Discount' ? 'Company Discount' : 'Auto-allocated (FIFO)')
            };
            await supabase.from('payments').insert([newPayment]);
        }

        let newOutstanding = company.outstanding - totalPaidApplied;
        if (newOutstanding < 0) newOutstanding = 0;
        await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', companyName);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Payment / Credit Note
app.put('/api/payment/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { paymentAmount, paymentDate, remark } = req.body;
        
        const { data: payment, error: payErr } = await supabase.from('payments').select('*').eq('id', id).single();
        if (payErr || !payment) return res.status(404).json({ error: "Record not found" });

        const { data: bill } = await supabase.from('bills').select('*').eq('id', payment.bill_id).single();
        const newPayAmt = parseFloat(paymentAmount);
        const diff = newPayAmt - payment.amount;

        if (bill) {
            let newPaidAmount = bill.paid_amount + diff;
            let newBalanceDue = bill.balance_due - diff;
            let status = "Unpaid";
            if (newBalanceDue <= 0) {
                newBalanceDue = 0;
                status = "Settled";
            } else if (newPaidAmount > 0) {
                status = "Partial";
            }

            await supabase.from('bills').update({
                paid_amount: newPaidAmount,
                balance_due: newBalanceDue,
                status: status
            }).eq('id', bill.id);
        }

        const { data: company } = await supabase.from('companies').select('*').eq('name', payment.company_name).single();
        if (company) {
            let newOutstanding = company.outstanding - diff;
            if (newOutstanding < 0) newOutstanding = 0;
            await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', company.name);
        }

        const updateData = {
            amount: newPayAmt,
            date: paymentDate,
            remark: remark || payment.remark
        };
        await supabase.from('payments').update(updateData).eq('id', id);

        res.json({ success: true, payment: updateData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Payment / Credit Note
app.delete('/api/payment/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { data: payment, error: payErr } = await supabase.from('payments').select('*').eq('id', id).single();
        if (payErr || !payment) return res.status(404).json({ error: "Record not found" });

        const { data: bill } = await supabase.from('bills').select('*').eq('id', payment.bill_id).single();

        if (bill) {
            let newPaidAmount = bill.paid_amount - payment.amount;
            let newBalanceDue = bill.balance_due + payment.amount;
            let status = "Unpaid";
            if (newBalanceDue > 0 && newPaidAmount > 0) {
                status = "Partial";
            } else if (newPaidAmount === 0) {
                status = "Unpaid";
            }

            await supabase.from('bills').update({
                paid_amount: newPaidAmount,
                balance_due: newBalanceDue,
                status: status
            }).eq('id', bill.id);
        }

        const { data: company } = await supabase.from('companies').select('*').eq('name', payment.company_name).single();
        if (company) {
            let newOutstanding = company.outstanding + payment.amount;
            await supabase.from('companies').update({ outstanding: newOutstanding }).eq('name', company.name);
        }

        await supabase.from('payments').delete().eq('id', id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Local Development Server listener
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Karippurath Agencies Tracker running on port ${PORT}`);
    });
}

// Export app for Vercel Serverless Functions
module.exports = app;