# 📦 TechIT Inventory Management System v2

A modern, full-stack inventory management system built with Next.js, Node.js, and PostgreSQL. Features a dark-themed dashboard with real-time analytics, automated low stock email alerts, a complete audit log, CSV export, and role-based access control.

![Status](https://img.shields.io/badge/Status-Live-4ade80?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Node.js%20%7C%20PostgreSQL-60a5fa?style=flat-square)
![Auth](https://img.shields.io/badge/Auth-JWT-fb923c?style=flat-square)

---

## ✨ Features

- 📊 **Real-time dashboard** — stat cards showing total products, low stock, out of stock, and total inventory value
- 📈 **Interactive charts** — pie chart for stock status breakdown, bar chart for inventory by category
- 🤖 **Low stock email alerts** — automatic Gmail notifications when items drop below a configurable threshold
- 📋 **Full audit log** — every add, edit, and delete is recorded with the username, timestamp, and what changed
- ⬇ **CSV export** — download your entire inventory in one click, compatible with Excel and Google Sheets
- 🔍 **Advanced search & filtering** — filter by keyword, category, and stock status simultaneously
- 👥 **Role-based access control** — admins can manage inventory; regular users get read-only access
- 🌙 **Dark mode UI** — professional dark-themed interface built with inline styles for zero flash

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, Recharts |
| Backend | Node.js, Express.js |
| Database | PostgreSQL via Supabase |
| Authentication | JWT + bcrypt |
| Email Alerts | Nodemailer + Gmail SMTP |
| CSV Export | json2csv |

---

## 🏗 Project Structure

```
techit-v2/
├── server/                  # Node.js + Express backend
│   ├── routes/
│   │   ├── auth.js          # Login and register endpoints
│   │   ├── items.js         # Inventory CRUD + export + metrics
│   │   └── audit.js         # Audit log endpoint
│   ├── services/
│   │   ├── supabase.js      # Supabase client
│   │   ├── audit.js         # Audit log writer
│   │   └── email.js         # Low stock email service
│   ├── middleware/
│   │   └── auth.js          # JWT + admin middleware
│   └── index.js             # Server entry point
│
└── client/                  # Next.js frontend
    └── app/
        ├── components/
        │   ├── StatCards.js  # Dashboard metric cards
        │   ├── Charts.js     # Recharts pie + bar charts
        │   ├── ItemsTable.js # Inventory table with actions
        │   ├── ItemModal.js  # Add / edit item modal
        │   ├── AuditLog.js   # Audit log modal
        │   └── Toast.js      # Toast notifications
        ├── dashboard/        # Main dashboard page
        ├── login/            # Login page
        ├── register/         # Registration page
        ├── landing/          # Public landing page
        └── page.js           # Root redirect
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js 18+](https://nodejs.org)
- [Git](https://git-scm.com)
- A free [Supabase](https://supabase.com) account
- A Gmail account with an App Password

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/justcoffeebean/techit-v2.git
cd techit-v2
```

---

### Step 2 — Set up the database

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the **SQL Editor** and run the following:

```sql
-- Users table
CREATE TABLE techit_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items table
CREATE TABLE techit_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  location TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE techit_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES techit_users(id),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  item_id UUID,
  item_name TEXT,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

3. Install server dependencies and generate the admin password hash:

```bash
cd server
npm install
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(h => console.log(h))"
```

4. Copy the hash and run this in Supabase SQL Editor (replace the hash):

```sql
INSERT INTO techit_users (username, email, password, role)
VALUES ('admin', 'admin@techit.com', 'PASTE_HASH_HERE', 'admin');
```

---

### Step 3 — Configure the server

Create a `.env` file inside the `server/` folder:

```env
PORT=3004
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=techit_jwt_secret_2024
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_char_app_password
LOW_STOCK_EMAIL=alerts@youremail.com
```

**Getting your Supabase credentials:**
1. Go to your Supabase project → **Settings** → **API**
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **anon public** key → `SUPABASE_KEY`

**Getting your Gmail App Password:**
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → Enable **2-Step Verification**
3. Search **App passwords** → create one for Mail
4. Paste the 16-character password as `EMAIL_PASS`

---

### Step 4 — Install client dependencies

```bash
cd ../client
npm install
```

---

### Step 5 — Run the app

Open **two terminal windows** and run one in each:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

Expected output:
```
TechIT server running on http://localhost:3004
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🔐 Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> **Important:** Change the admin password after your first login in a production environment.

---

## 👤 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Add, edit, delete items · View audit log · Export CSV · Receive stock alerts |
| **User** | View inventory · Search and filter · Read-only access |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and receive JWT token |
| POST | `/api/auth/register` | Register a new user account |

### Inventory
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/items` | Get all items (supports `?keyword`, `?category`, `?status`) | All users |
| GET | `/api/items/metrics` | Get dashboard stats | All users |
| GET | `/api/items/export` | Download inventory as CSV | All users |
| POST | `/api/items` | Add a new item | Admin only |
| PUT | `/api/items/:id` | Update an item | Admin only |
| DELETE | `/api/items/:id` | Delete an item | Admin only |

### Audit
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/audit` | Get last 100 audit log entries | Admin only |

---

## 🧠 Technical Highlights

### Role-Based Access Control
The backend uses two middleware functions — `authMiddleware` (verifies JWT) and `adminMiddleware` (checks role) — stacked on protected routes. This ensures non-admin users cannot modify inventory even if they bypass the UI.

### Audit Logging
Every write operation (add, update, delete) calls `logAction()` which records the user, action type, affected item, and a before/after snapshot of changed fields. This creates a tamper-evident history of all inventory changes.

### Automated Stock Alerts
When an item is added or updated, the server computes its status using `computeStatus(quantity, threshold)`. If the status changes from `In Stock` to `Low Stock` or `Out of Stock`, an HTML email is sent via Nodemailer containing a formatted table of affected items.

### Status Computation
Since Supabase's PostgreSQL does not support `GENERATED ALWAYS AS STORED` for text columns, stock status (`In Stock`, `Low Stock`, `Out of Stock`) is computed in the application layer using a shared helper function, ensuring consistency across all endpoints.

---

## 📸 Screenshots

> Dashboard, audit log, and item management screenshots can be added here.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👤 Author

**Neil Mark Waweru**
- GitHub: [@justcoffeebean](https://github.com/justcoffeebean)
- Email: neilwaweru@email.com
- University: United States International University – Africa
