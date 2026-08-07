const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load or Initialize Database
let db = { companies: [], bills: [], payments: [] };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
        console.error("Error reading database file, starting fresh.");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Dashboard API
app.get('/api/dashboard', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    let totalOutstanding = 0;
    let currentDue = 0;
    let overdueAmount = 0;

    db.companies.forEach(comp => {
        totalOutstanding += comp.outstanding;
    });

    db.bills.forEach(bill => {
        if (bill.status !== 'Settled') {
            if (bill.dueDate < today) {
                overdueAmount += bill.balanceDue;
            } else {
                currentDue += bill.balanceDue;
            }
        }
    });

    res.json({
        companies: db.companies,
        bills: db.bills,
        payments: db.payments,
        metrics: { totalOutstanding, currentDue, overdueAmount }
    });
});

// Add Company
app.post('/api/company', (req, res) => {
    const { name, creditDays, openingBalance, bankName, accountNo, ifsc, upi } = req.body;
    const parsedCreditDays = parseInt(creditDays) || 0;
    const parsedOpeningBal = parseFloat(openingBalance) || 0;
    
    const newComp = { 
        id: Date.now(), 
        name, 
        creditDays: parsedCreditDays, 
        outstanding: parsedOpeningBal, 
        bankName, 
        accountNo, 
        ifsc, 
        upi 
    };
    db.companies.push(newComp);

    if (parsedOpeningBal > 0) {
        const today = new Date().toISOString().split('T')[0];
        db.bills.push({
            id: Date.now() + 1,
            companyName: name,
            billNo: "OPENING-BAL",
            date: today,
            totalAmount: parsedOpeningBal,
            paidAmount: 0,
            balanceDue: parsedOpeningBal,
            dueDate: today,
            status: "Unpaid"
        });
    }

    saveDB();
    res.json({ success: true, company: newComp });
});

// Edit Company Details
app.put('/api/company/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, creditDays, bankName, accountNo, ifsc, upi } = req.body;
    const company = db.companies.find(c => c.id === id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const oldName = company.name;
    const newName = name || oldName;

    if (oldName !== newName) {
        db.bills.forEach(b => { if (b.companyName === oldName) b.companyName = newName; });
        db.payments.forEach(p => { if (p.companyName === oldName) p.companyName = newName; });
    }

    company.name = newName;
    company.creditDays = parseInt(creditDays) !== undefined ? parseInt(creditDays) : company.creditDays;
    company.bankName = bankName || company.bankName;
    company.accountNo = accountNo || company.accountNo;
    company.ifsc = ifsc || company.ifsc;
    company.upi = upi || company.upi;

    saveDB();
    res.json({ success: true, company });
});

// Delete Company
app.delete('/api/company/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const comp = db.companies.find(c => c.id === id);
    if (comp) {
        db.bills = db.bills.filter(b => b.companyName !== comp.name);
        db.payments = db.payments.filter(p => p.companyName !== comp.name);
        db.companies = db.companies.filter(c => c.id !== id);
        saveDB();
    }
    res.json({ success: true });
});

// Add Bill
app.post('/api/bill', (req, res) => {
    const { companyName, billNo, date, amount } = req.body;
    const company = db.companies.find(c => c.name === companyName);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const creditDays = company.creditDays !== undefined ? company.creditDays : 30;
    const billDateObj = new Date(date);
    billDateObj.setDate(billDateObj.getDate() + creditDays);
    const dueDate = billDateObj.toISOString().split('T')[0];

    const newBill = {
        id: Date.now(),
        companyName,
        billNo,
        date,
        totalAmount: parseFloat(amount),
        paidAmount: 0,
        balanceDue: parseFloat(amount),
        dueDate,
        status: "Unpaid"
    };

    db.bills.push(newBill);
    company.outstanding += parseFloat(amount);
    saveDB();

    res.json({ success: true, bill: newBill });
});

// Edit Bill
app.put('/api/bill/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { billNo, date, amount } = req.body;
    const bill = db.bills.find(b => b.id === id);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const company = db.companies.find(c => c.name === bill.companyName);
    const creditDays = company && company.creditDays !== undefined ? company.creditDays : 30;
    const newTotal = parseFloat(amount);
    const diff = newTotal - bill.totalAmount;

    const billDateObj = new Date(date);
    billDateObj.setDate(billDateObj.getDate() + creditDays);
    const dueDate = billDateObj.toISOString().split('T')[0];

    bill.billNo = billNo;
    bill.date = date;
    bill.totalAmount = newTotal;
    bill.dueDate = dueDate;
    bill.balanceDue = newTotal - bill.paidAmount;

    if (bill.balanceDue <= 0) {
        bill.balanceDue = 0;
        bill.status = "Settled";
    } else if (bill.paidAmount > 0) {
        bill.status = "Partial";
    } else {
        bill.status = "Unpaid";
    }

    if (company) {
        company.outstanding += diff;
        if (company.outstanding < 0) company.outstanding = 0;
    }

    saveDB();
    res.json({ success: true, bill });
});

// Delete Bill
app.delete('/api/bill/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const bill = db.bills.find(b => b.id === id);
    if (bill) {
        const company = db.companies.find(c => c.name === bill.companyName);
        if (company) {
            company.outstanding -= bill.balanceDue;
            if (company.outstanding < 0) company.outstanding = 0;
        }
        db.payments = db.payments.filter(p => p.billId !== bill.id);
        db.bills = db.bills.filter(b => b.id !== id);
        saveDB();
    }
    res.json({ success: true });
});

// Payment / Credit Note Allocation
app.post('/api/payment', (req, res) => {
    const { companyName, paymentAmount, paymentDate, paymentMode, remark } = req.body;
    let payAmt = parseFloat(paymentAmount);

    if (!companyName || isNaN(payAmt) || payAmt <= 0) {
        return res.status(400).json({ error: "Invalid payment or credit details" });
    }

    const company = db.companies.find(c => c.name === companyName);
    if (!company) return res.status(404).json({ error: "Company not found" });

    let companyBills = db.bills
        .filter(b => b.companyName === companyName && b.status !== 'Settled')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    let totalPaidApplied = payAmt;

    for (let bill of companyBills) {
        if (payAmt <= 0) break;

        let allocateAmt = Math.min(payAmt, bill.balanceDue);
        bill.paidAmount += allocateAmt;
        bill.balanceDue -= allocateAmt;
        payAmt -= allocateAmt;

        if (bill.balanceDue <= 0) {
            bill.balanceDue = 0;
            bill.status = "Settled";
        } else {
            bill.status = "Partial";
        }

        db.payments.push({
            id: Date.now() + Math.floor(Math.random() * 10000),
            billId: bill.id,
            companyName: companyName,
            billNo: bill.billNo,
            amount: allocateAmt,
            date: paymentDate,
            mode: paymentMode,
            remark: remark || (paymentMode === 'Credit Note / Discount' ? 'Company Discount' : 'Auto-allocated (FIFO)')
        });
    }

    company.outstanding -= totalPaidApplied;
    if (company.outstanding < 0) company.outstanding = 0;

    saveDB();
    res.json({ success: true });
});

// Edit Payment / Credit Note
app.put('/api/payment/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { paymentAmount, paymentDate, remark } = req.body;
    const payment = db.payments.find(p => p.id === id);
    if (!payment) return res.status(404).json({ error: "Record not found" });

    const bill = db.bills.find(b => b.id === payment.billId);
    const newPayAmt = parseFloat(paymentAmount);
    const diff = newPayAmt - payment.amount;

    if (bill) {
        bill.paidAmount += diff;
        bill.balanceDue -= diff;
        if (bill.balanceDue <= 0) {
            bill.balanceDue = 0;
            bill.status = "Settled";
        } else if (bill.paidAmount > 0) {
            bill.status = "Partial";
        } else {
            bill.status = "Unpaid";
        }
    }

    const company = db.companies.find(c => c.name === payment.companyName);
    if (company) {
        company.outstanding -= diff;
        if (company.outstanding < 0) company.outstanding = 0;
    }

    payment.amount = newPayAmt;
    payment.date = paymentDate;
    payment.remark = remark || payment.remark;

    saveDB();
    res.json({ success: true, payment });
});

// Delete Payment / Credit Note
app.delete('/api/payment/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const paymentIndex = db.payments.findIndex(p => p.id === id);
    if (paymentIndex === -1) return res.status(404).json({ error: "Record not found" });

    const payment = db.payments[paymentIndex];
    const bill = db.bills.find(b => b.id === payment.billId);

    if (bill) {
        bill.paidAmount -= payment.amount;
        bill.balanceDue += payment.amount;
        if (bill.balanceDue > 0 && bill.paidAmount > 0) {
            bill.status = "Partial";
        } else if (bill.paidAmount === 0) {
            bill.status = "Unpaid";
        }
    }

    const company = db.companies.find(c => c.name === payment.companyName);
    if (company) {
        company.outstanding += payment.amount;
    }

    db.payments.splice(paymentIndex, 1);
    saveDB();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Karippurath Agencies Tracker running on port ${PORT}`);
});