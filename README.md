# Mangal Royal Studio — Complete E-Commerce Platform

> **Architecture Source of Truth:**
> 1. **Customer-Facing Storefront:** **Shopify Liquid Theme** ([`apps/shopify-theme/`](apps/shopify-theme/)) — cloned from [`jewellery-theme-backup/`](jewellery-theme-backup/) (Shopify Dawn 15.5.0 + 19 custom Mangal Royal Studio sections) with all audit bug fixes and enhancements applied while preserving 100% of the original visual design, colours (`#7D132A`, `#190303`, `#FBE8DB`), typography (*Cormorant Garamond* + *DM Sans*), layouts, and animations. The original [`jewellery-theme-backup/`](jewellery-theme-backup/) directory remains completely untouched.
> 2. **Commerce System of Record:** **Shopify Admin & Shopify Hosted Checkout** (with **Razorpay** as authorized Shopify payment provider).
> 3. **Custom Administrative Dashboard:** **Next.js 15 App Router** ([`apps/admin/`](apps/admin/)) — 19 specialized admin modules for Jewellery Pricing Engine, Gold & Metal Rate Cards, Diamond Quality × Sieve Matrices, 11-Sheet Excel Bulk Importer (`MANGAL JEWELLERY.xlsx`), Repricing Approval Workflows, Shiprocket Insured Logistics, Razorpay Payment Verification, RBAC, and Immutable Audit Logs.
> 4. **Custom Backend API:** **Node.js + Express + TypeScript (Strict) + Zod + Prisma PostgreSQL** ([`services/api/`](services/api/)).
> 5. **Shared Financial Core:** **TypeScript + `decimal.js` Jewellery Pricing Engine** ([`packages/shared/`](packages/shared/)).

---

## Monorepo Structure

```text
mangalroyalstudio/
├── jewellery-theme-backup/        # READ-ONLY original Shopify theme backup (377 files, untouched)
├── apps/
│   ├── shopify-theme/             # Active Customer Storefront (Shopify Liquid Theme + bug fixes & new sections)
│   └── admin/                     # Next.js 15 Custom Admin Dashboard (19 operational modules)
├── services/
│   └── api/                       # Node.js + Express + TypeScript REST API + Prisma ORM schema
├── packages/
│   └── shared/                    # Decimal.js Jewellery Pricing Engine, RBAC permissions & Zod schemas
├── samples/
│   └── MANGAL JEWELLERY.xlsx      # 11-sheet jewellery workbook for bulk import & dry-run validation
├── AUDIT_REPORT.md                # Complete audit of the original Shopify theme
├── PAGE_STRUCTURE.md              # Page templates, section order & DOM hierarchy
├── DESIGN_SYSTEM.md               # Colours, typography, spacing & tokens
├── THEME_ASSETS.md                # Fonts, images, icons & scripts inventory
├── EXISTING_FUNCTIONALITY.md      # Interactive components & technical debt fixes
├── DECISIONS.md                   # Architectural Decision Records (ADRs)
├── SYSTEM_ARCHITECTURE.md         # End-to-end architecture & data flow
├── IMPLEMENTATION_PLAN.md         # Milestone execution plan
├── PROGRESS.md                    # Milestone completion tracker
└── IMPLEMENTATION_LOG.md          # Engineering changelog & verification log
```

---

## Quick Start & Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Build All Packages & Applications
```bash
npm run build
```

### 3. Run Unit & API Integration Tests (Vitest)
```bash
npm run test
```

### 4. Run TypeScript Strict Typecheck Across All Workspaces
```bash
npm run typecheck
```

### 5. Generate / Refresh the 11-Sheet `MANGAL JEWELLERY.xlsx` Sample Workbook
```bash
npm run generate:sample-excel --workspace=@mrs/api
```

### 6. Start the Platform in Development Mode
- **Start Backend API (`http://localhost:4000`) + Admin Dashboard (`http://localhost:3001`):**
  ```bash
  npm run dev
  ```
- **Or run individually:**
  ```bash
  npm run dev:api     # Express API on http://localhost:4000
  npm run dev:admin   # Next.js Admin Dashboard on http://localhost:3001
  ```

### 7. Preview the Shopify Liquid Storefront (`apps/shopify-theme`)
> **Safety Note:** Never push or publish directly to the live production theme without explicit Owner approval.
```bash
shopify theme dev --path apps/shopify-theme
```

---

## Default RBAC Admin Credentials (Local / Staging)

| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner@mangalroyalstudio.com` | `<set via MRS_SEED_OWNER_PASSWORD>` | Full access including **Step 3 Owner Approval** and **Step 4 Publish to Shopify** |
| **MANAGER** | `manager@mangalroyalstudio.com` | `<set via MRS_SEED_MANAGER_PASSWORD>` | Catalog, 11-sheet Excel imports, Shiprocket AWB dispatch, and **Step 2 Pricing Validation** |
| **PRICING_OPERATOR** | `pricing@mangalroyalstudio.com` | `<set via MRS_SEED_PRICING_PASSWORD>` | Daily gold/diamond rate entry and **Step 1 Repricing Preview** generation |

---

## Key Safety & Governance Guardrails

1. **Configurable Placeholder Rates:** All seeded metal rates (`24K`, `22K`, `18K`, `14K`, `925_SILVER`, `950_PLATINUM`), diamond matrix rates, and formula rules are explicitly flagged with `isPlaceholder: true` (`PLACEHOLDER_PENDING_OWNER_APPROVAL`) until final commercial values are signed off by the Owner.
2. **4-Step Pricing Governance:** `Preview → Validate → Owner Approve → Publish` with immutable `PricingSnapshot` records saved on every publish.
3. **Live Store Write Lock:** `SHOPIFY_LIVE_WRITES_ENABLED=false` by default in [`.env.example`](.env.example).
4. **Duplicate SKU Protection:** The 11-sheet Excel importer (`MANGAL JEWELLERY.xlsx`) never silently overwrites existing or duplicate SKUs and provides a downloadable CSV error report (`GET /api/admin/imports/:jobId/errors.csv`).
