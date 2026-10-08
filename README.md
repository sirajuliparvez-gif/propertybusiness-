<div align="center">
  <img src="./public/logo.jpg" alt="Reshmi Enterprise" width="96" height="96" />

  # Reshmi Enterprise

  **One operational command center for properties, tenants, stays, staff, and cash flow.**

  A bilingual, mobile-ready property management platform built for the realities of running residential, commercial, and short-stay properties in Bangladesh.

  ![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
  ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
  ![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
</div>

---

## Why this exists

Property operations rarely fit into a tidy rent-collection spreadsheet. Owners are paid under different agreements. Tenants pay rent, advances, service charges, and utilities. Some units run as long-term rentals, some as nightly stays, and staff costs need to land in the same financial picture.

Reshmi Enterprise brings those workflows together without flattening their accounting differences. It tracks the operational reality **and** keeps pass-through cash movements separate from genuine income and expenses.

## What it can do

| Area | Capabilities |
| --- | --- |
| **Portfolio** | Manage owners, properties, unit types, individual units, occupancy, and vacancies |
| **Owner agreements** | Track fixed whole-property rent or per-unit obligations, advances, renewals, and owner payments |
| **Tenants** | Manage individual and business tenants, leases, documents, service charges, deposits, and move-outs |
| **Rent collection** | Record full, partial, overdue, and advance rent; settle old debt oldest-first; adjust from tenant advances |
| **Guest stays** | Reserve rooms, check guests in and out, collect payments, handle deposits, and retain identity records |
| **Utilities** | Record property or unit bills, allocate tenant shares, track reimbursements, and print invoices |
| **People & payroll** | Manage property-level and company-level staff, salary obligations, partial payments, and termination |
| **Finance** | Maintain a unified transaction ledger, monthly/yearly reporting, property profitability, and cash-flow forecasts |
| **Operations** | Surface overdue rent, payroll, utilities, expiring agreements, vacancies, missing documents, and guest movements |
| **Data portability** | Import operational data from structured Excel workbooks and export monthly entry sheets |

The interface is responsive, includes dedicated mobile views, supports light/dark themes, and ships in both **বাংলা** and **English**. Bengali is the default locale.

## The financial model

The app intentionally distinguishes profit-and-loss activity from money that merely passes through the business.

```text
Operating income
├── Tenant rent
├── Guest-stay revenue
├── Service charges
└── Utility profit

Operating expenses
├── Rent paid to owners
├── Payroll
├── Company-absorbed utilities
├── Maintenance
└── Other operating costs

Tracked, but excluded from P&L
├── Tenant and owner advances
├── Advance refunds and adjustments
├── Utility reimbursements
├── Guest-deposit refunds
└── Owner withdrawals
```

This shared classification powers the dashboard, reports, charts, and transaction views so the same period does not produce contradictory totals.

## Core data model

```text
PropertyOwner
└── Property
    ├── OwnerLeaseAgreement
    │   └── OwnerRentPayment
    ├── UnitType
    │   └── Unit
    │       ├── TenantLease
    │       │   ├── RentPayment
    │       │   └── DownpaymentAdjustment
    │       └── GuestStay
    ├── Employee
    │   └── PayrollRecord
    ├── UtilityBill
    └── Transaction
```

A physical unit is not locked to one business model: it can host long-term leases and short stays at different points in its lifetime. Owner-side pricing can be fixed for an entire property or resolved from unit-type and per-unit values. Tenant-side defaults can also be overridden for individual units and leases.

## Architecture

```text
Browser
  ↓
Next.js App Router
  ├── Server Components for data-heavy screens
  ├── Client Components for dialogs and interactive tables
  ├── Server Actions for mutations
  └── Route Handlers for uploads and workbook exports
  ↓
Supabase Auth ─── authenticated admin/manager sessions
  ↓
Prisma Client + PostgreSQL
  ↓
Transactions, ledgers, operational records, and reporting data
```

### Technology

- **Application:** Next.js 16, React 19, TypeScript
- **Database:** PostgreSQL with Prisma 7 and the Prisma PostgreSQL adapter
- **Authentication:** Supabase Auth with server-validated sessions
- **UI:** Tailwind CSS 4, Base UI, shadcn-style components, Lucide icons
- **Localization:** `next-intl` with Bengali and English message catalogs
- **Files:** UploadThing for supporting documents
- **Reporting:** Recharts and ExcelJS
- **Deployment:** Vercel, pinned to the Singapore region (`sin1`)

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm
- A PostgreSQL database
- A Supabase project with Auth enabled
- An UploadThing application if document uploads are required

### 1. Install dependencies

```bash
npm install
```

The post-install hook applies the local `next-themes` patch and generates the Prisma client.

### 2. Configure the environment

```bash
cp .env.example .env
```

Populate the following values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | Public URL of the Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase administration key |
| `UPLOADTHING_TOKEN` | UploadThing API token |

> [!IMPORTANT]
> Keep `.env` private. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `UPLOADTHING_TOKEN` to client-side code.

### 3. Prepare the database

For a new or disposable database, synchronize the Prisma schema:

```bash
npx prisma generate
npx prisma db push
```

For an established production database, review schema changes before applying them and use your normal migration process.

### 4. Create an application user

Authentication and application profiles are deliberately separate:

1. Create the user in **Supabase Auth**.
2. Create the matching record in the Prisma `User` table.
3. Use the exact Supabase Auth user ID as `User.id`.
4. Assign either the `ADMIN` or `MANAGER` role.

Without the matching database row, Supabase can authenticate the account but the dashboard will still reject it.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to the Bengali experience at `/bn`; English is available at `/en`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server with webpack |
| `npm run build` | Create a production build and run TypeScript checks |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint across the project |
| `npx prisma generate` | Regenerate the Prisma client |
| `npx prisma db push` | Synchronize the schema to a development database |
| `npx prisma studio` | Inspect and edit database records locally |

## Project map

```text
src/
├── app/[locale]/
│   ├── (auth)/                 # Login experience
│   └── (dashboard)/            # Protected product pages
├── app/api/                    # UploadThing and workbook endpoints
├── components/
│   ├── dashboard/              # Charts, performance, and action-required UI
│   ├── mobile/                 # Purpose-built mobile screens and navigation
│   ├── properties/             # Domain dialogs, tables, forms, and invoices
│   └── ui/                     # Reusable design-system primitives
├── i18n/                       # Locale routing and request configuration
├── lib/
│   ├── actions/                # Authenticated server-side mutations
│   ├── import-export/          # Excel templates, parsing, and exports
│   ├── auth/                   # Session and application-user resolution
│   └── *-data.ts               # Read models for pages and reports
└── generated/prisma/           # Generated Prisma client

messages/                       # Bengali and English translations
prisma/schema.prisma            # Domain model and database constraints
patches/                        # Reproducible dependency patches
public/                         # Brand and static assets
```

## Important domain rules

- Tenant rent and utility bills are due on the **10th** of each month.
- Payroll becomes overdue after the **15th**.
- Financial mutations that touch multiple records use database transactions.
- Rent and salary rows preserve the amount due at creation time, protecting historical records from later price changes.
- Deposit adjustments always write an audit record; balances are not silently mutated.
- Property deletion is soft deletion, preserving historical financial relationships.
- API routes enforce authentication independently because the locale middleware intentionally excludes `/api`.
- Date-sensitive business logic is evaluated in **Asia/Dhaka** time.

## Deployment

The repository is ready for Vercel deployment:

1. Import the GitHub repository into Vercel.
2. Add every variable from `.env.example` to the Vercel project.
3. Ensure the database accepts connections from the deployment environment.
4. Add the deployed site URL to the allowed redirect URLs in Supabase Auth.
5. Deploy and verify login, document uploads, and one read/write financial workflow.

Vercel runs this app in `sin1` to keep the application close to users and infrastructure in South Asia.

## Security notes

- Sessions are validated with `supabase.auth.getUser()` rather than trusting an unverified cookie.
- Protected dashboard layouts repeat the auth check as defense in depth.
- Sensitive database and service credentials remain server-only.
- Uploaded documents should be treated as private business records and governed accordingly.
- Financial write operations should always preserve their linked ledger and transaction records.

## Contributing

Before opening a pull request:

```bash
npm run lint
npm run build
```

Keep changes focused, preserve Bengali and English message parity, and update the Prisma schema and dependent financial classifications together whenever introducing a new transaction type.

---

<div align="center">
  Built for the day-to-day work of running real properties—not just displaying them.
</div>
