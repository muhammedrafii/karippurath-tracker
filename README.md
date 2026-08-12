# 🏪 Shop Dues & Supplier Ledger Tracker

A full-stack, multi-tenant ledger and dues management web application designed for **Retail Shops, Wholesale Outlets, Hardware Stores, Plumbing Depots, and Commercial Businesses**. Easily track distributor purchase bills, payment due dates, automated FIFO settlements, credit notes, and supplier bank/UPI payment details.

---

## 📖 How the System Works for Shop Owners

This system simplifies wholesale supplier credit and bill tracking for business owners:

1. **🏬 Multi-Tenant Shop Login**: Each shop owner registers their own account (e.g., *Rafi General Store*) with private, isolated database security.
2. **🏢 Add Distributors & Suppliers**: Store company profiles (e.g., *TATA Fasteners, Supreme Pipes, Astral Adhesives*) along with their credit terms (e.g., 30 days) and banking details (Bank Account, IFSC, UPI ID).
3. **🧾 Log Purchase Bills**: Record incoming inventory bills with bill numbers and amounts. The app automatically calculates the payment due date based on the distributor's credit limit.
4. **💸 Automated FIFO Payment Settlement**: When you make a payment to a company, the backend automatically settles your **oldest unpaid bills first** (First-In-First-Out algorithm) and carries forward any excess as advance credit.
5. **🎁 Credit Notes & Scheme Discounts**: Easily apply distributor schemes, damaged goods returns, or early payment discounts.
6. **🚨 Overdue Dues & Alerts**: Get instant color-coded status badges (`Unpaid`, `Partial`, `Paid`, `Overdue`) and automated alert popups for urgent supplier payments.
7. **🗑️ 30-Day Recycle Bin**: Accidentally deleted a company, bill, or payment? Restore it within 30 days directly from the built-in Trash Bin.

---

## 🖼️ System Screenshots & UI Walkthrough

```
========================================================================================
                          🏪 SHOP DUES & LEDGER TRACKER DASHBOARD
========================================================================================
 [ Total Outstanding: ₹1,45,000 ]  [ Overdue Balance: ₹35,000 ]  [ Active Suppliers: 12 ]
----------------------------------------------------------------------------------------
 🏢 Supplier Name     | Credit Terms | Outstanding (₹) | Overdue Bills | Action
 ---------------------+--------------+-----------------+---------------+----------------
  TATA Fasteners      | 30 Days      | ₹45,000         | 1 Overdue     | [ View Ledger ]
  Supreme Pipes       | 45 Days      | ₹60,000         | None          | [ View Ledger ]
  Astral Adhesives    | 15 Days      | ₹40,000         | 2 Overdue     | [ View Ledger ]
========================================================================================
```

### 1. 📊 Main Dashboard & Overdue Alerts
- **Metrics Summary**: Real-time view of Total Outstanding, Current Due, and Overdue Balances across all registered suppliers.
- **Overdue Warning Banner**: Highlights urgent bills that have crossed their credit duration threshold.

### 2. 📋 Company Ledger & FIFO Payment Modal
- **FIFO Auto-Settlement**: Enter a lump sum payment (e.g., ₹20,000) and watch it automatically allocate across oldest pending purchase bills.
- **Credit Notes / Discounts**: Dedicated tab to log scheme cashbacks, trade discounts, and damaged stock returns.
- **Bank & UPI Quick Copy**: Tap to copy supplier Bank AC, IFSC, or UPI ID directly for fast mobile net-banking transfers.

### 3. 🧾 Bill Logging & Due Date Calculation
- **Auto-Calculated Due Dates**: Enter bill date + bill total, and the system automatically computes the exact due date based on distributor credit days (e.g., 30 days from bill date).

### 4. 🗑️ 30-Day Recycle Bin & Recovery
- **Safe Deletions**: Deleting a supplier profile or bill moves it into a 30-day trash bin where it can be restored with a single click before permanent expiry.

---

## 🌟 Key Features

- **🔐 Multi-Tenant Authentication**: Private and isolated database scoping for each shop.
- **📲 Flexible Login Options**:
  - Email & Password Sign In
  - Username / Email Login
  - 6-Digit Email OTP Authentication
  - Password Reset via Email OTP
- **🏬 Distributor & Supplier Management**:
  - Custom credit terms (0, 15, 30, 45, 60 days)
  - Bank Account Details & UPI ID storage for fast payment transfers
  - Opening balance tracking & profile updates
- **🧾 Purchase Bills & Auto Due Date Calculation**:
  - Automatically calculates bill due dates based on credit terms
  - Tracks status (`Unpaid`, `Partial`, `Paid`) and overdue flags
- **💸 Automated FIFO Payment Settlement**:
  - Direct payments automatically clear the **oldest unpaid bills first**
  - Handles partial settlements and excess credit smoothly
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
- **Database & Auth**: Supabase (PostgreSQL)
- **Email Delivery**: Supabase Auth OTP + Nodemailer (SMTP)
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or bun

### 2. Installation
```bash
# Clone repository
git clone https://github.com/your-username/shop-dues-tracker.git

# Navigate to project directory
cd shop-dues-tracker

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
SMTP_FROM="Shop Dues Portal" <your-email@gmail.com>
```

### 4. Run the Application
```bash
# Start dev/production server
npm start
```
Open `http://localhost:3000` in your web browser.

---

## 🗄️ Supabase Database Schema Setup

To set up your database in Supabase, copy and execute the following SQL script in your **Supabase SQL Editor**:

```sql
-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id bigint NOT NULL,
  name text NOT NULL,
  credit_days integer DEFAULT 0,
  outstanding numeric DEFAULT 0,
  bank_name text,
  account_no text,
  ifsc text,
  upi text,
  shop_id text,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- 2. Create Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
  id bigint NOT NULL,
  company_name text NOT NULL,
  bill_no text NOT NULL,
  date text,
  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  due_date text,
  status text DEFAULT 'Unpaid'::text,
  shop_id text,
  CONSTRAINT bills_pkey PRIMARY KEY (id)
);

-- 3. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id bigint NOT NULL,
  bill_id bigint,
  company_name text NOT NULL,
  bill_no text,
  amount numeric DEFAULT 0,
  date text,
  mode text,
  remark text,
  shop_id text,
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

-- 4. Create Shops Table
CREATE TABLE IF NOT EXISTS public.shops (
  id text NOT NULL,
  shop_name text NOT NULL,
  owner_name text,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email text UNIQUE,
  otp_code text,
  otp_expires_at timestamp with time zone,
  CONSTRAINT shops_pkey PRIMARY KEY (id)
);

-- 5. Create Trash / Recycle Bin Table
CREATE TABLE IF NOT EXISTS public.trash_bin (
  id text NOT NULL,
  shop_id text,
  type text NOT NULL,
  title text NOT NULL,
  details text,
  deleted_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  payload text,
  CONSTRAINT trash_bin_pkey PRIMARY KEY (id)
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
git commit -m "Update README documentation with system screenshots, user workflow, and generic shop branding"

# 4. Push to GitHub
git push origin main
```

---

## 📜 License
MIT License. Free to use for personal and commercial shop management.
