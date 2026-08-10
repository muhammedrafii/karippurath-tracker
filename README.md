# 🔧 Plumbing Shop Dues & Ledger Tracker

A full-stack, multi-tenant ledger and dues management web application designed for plumbing shops, hardware depots, and building material suppliers. Easily track distributor purchase bills, payment due dates, FIFO auto-settlements, credit notes, and supplier bank/UPI payment details.

---

## 🌟 Key Features

- **🔐 Multi-Tenant Shop Authentication**: Private and isolated databases for each shop.
- **📲 Flexible Login Options**:
  - Email & Password Sign In
  - 6-Digit Email OTP Login
  - Password Reset via Email OTP
- **🏬 Distributor & Supplier Management**:
  - Custom credit terms (0, 15, 30, 45, 60 days)
  - Bank Account Details & UPI ID storage for fast payment transfers
  - Opening balance tracking & profile updates
- **🧾 Purchase Bills & Auto Due Date Calculation**:
  - Automatically calculates bill due dates based on distributor credit terms
  - Tracks status (`Unpaid`, `Partial`, `Paid`) and overdue flags
- **💸 Automated FIFO Payment Settlement**:
  - Direct payments automatically clear the **oldest unpaid bills first** (First-In-First-Out)
  - Handles partial settlements smoothly
- **🎁 Credit Notes & Company Discounts**:
  - Record scheme discounts, damage returns, and credit notes
- **📊 Analytics & Overdue Alerts**:
  - Total Outstanding, Current Due, and Overdue Metrics
  - Instant Overdue Warning Modal with supplier breakdown
- **📄 Data Exporting**:
  - Export distributor ledgers and payment reports to CSV or PDF
- **📱 Fully Responsive Design**:
  - Optimized for mobile screens, tablets, and desktop displays with smooth modal scrolling

---

## 🛠️ Tech Stack

- **Backend**: Node.js & Express (RESTful API Architecture)
- **Database & Auth**: Supabase (PostgreSQL) + In-memory fallback
- **Email Delivery**: Supabase Auth OTP + Nodemailer (SMTP)
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (Utility Styling)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or bun

### 2. Installation
```bash
# Clone repository
git clone https://github.com/your-username/plumbing-shop-dues-tracker.git

# Navigate to project directory
cd plumbing-shop-dues-tracker

# Install dependencies
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Supabase Configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: Custom SMTP Server for Email OTPs
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Plumbing Shop Portal" <your-email@gmail.com>
```

### 4. Run the Application
```bash
# Start dev/production server
npm start
```
Open `http://localhost:3000` in your web browser.

---

## 🗄️ Supabase Database Setup

To link your project to a real Supabase instance, execute the following SQL script in your **Supabase SQL Editor**:

```sql
-- 1. Create Shops Table
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_name TEXT NOT NULL,
    owner_name TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    otp_code TEXT,
    otp_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Companies (Distributors) Table
CREATE TABLE IF NOT EXISTS public.companies (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    credit_days INT DEFAULT 30,
    outstanding NUMERIC(12, 2) DEFAULT 0.00,
    bank_name TEXT,
    account_no TEXT,
    ifsc TEXT,
    upi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'Unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_mode TEXT DEFAULT 'NEFT',
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📧 How Email OTPs Work

The system uses a **dual-layer OTP delivery pipeline**:

1. **Supabase Native Auth**:
   If you have enabled **Email OTP** inside your Supabase Project Settings (*Project Settings -> Authentication -> Provider -> Email*), Supabase will automatically send the 6-digit OTP code directly to the user's registered inbox.

2. **Nodemailer SMTP Fallback**:
   If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are defined in your `.env` file, the backend will dispatch real emails via SMTP whenever a user requests a login or password reset OTP.

---

## 📤 How to Push Updates to GitHub

```bash
# 1. Check current status
git status

# 2. Stage all updated files
git add .

# 3. Commit your changes
git commit -m "Update application with multi-tenant auth, responsive modals, and complete README documentation"

# 4. Push to GitHub
git push origin main
```

---

## 📜 License
MIT License. Free to use for personal and commercial shop management.
