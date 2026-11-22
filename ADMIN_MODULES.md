# ADMIN MODULES — MANGAL ROYAL STUDIO (Code-Verified)

**Application:** `apps/admin` (`@mrs/admin`)  
**Default Port:** `http://localhost:3001` (`next dev -p 3001` in [`apps/admin/package.json`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/package.json))  
**Implementation File:** Single-Page Application at [`apps/admin/src/app/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx) (`2,407` lines)  
**Audit Reference:** [`CODE_VERIFICATION_AUDIT.md`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md)

---

## 1. Architecture & Authentication Behavior (`VERIFIED`)

- **Single Route (`/`):** All 19 admin modules are rendered inside [`apps/admin/src/app/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx) and switched via React state (`activeModule`). Separate sub-route files (`/login`, `/products`, `/pricing`, etc.) do not exist.
- **RBAC Role Switcher & Auto-Login:** The top bar includes an `Active RBAC Session` `<select>` dropdown (`OWNER`, `MANAGER`, `PRICING_OPERATOR`) that logs into `POST /api/auth/login` automatically using the seeded credentials defined in `ROLE_CREDENTIALS` ([lines 105–109](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx#L105-L109)):
  - **`OWNER`:** `owner@mangalroyalstudio.com` / `<set via MRS_SEED_OWNER_PASSWORD>` (`Aarav Mangal`)
  - **`MANAGER`:** `manager@mangalroyalstudio.com` / `<set via MRS_SEED_MANAGER_PASSWORD>` (`Meera Rathore`)
  - **`PRICING_OPERATOR`:** `pricing@mangalroyalstudio.com` / `<set via MRS_SEED_PRICING_PASSWORD>` (`Rohan Zaveri`)
- **Offline Fallback:** If the Express API on `http://localhost:4000` is unreachable, `syncWithBackend()` falls back to `seedLocalFallbackState()` ([lines 301–458](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx#L301-L458)) so the UI remains interactive in standalone mode.

---

## 2. Verified Status of All 19 Admin Modules

| # | Module ID | Label | UI Status | Backend API Integration | Persistence | UI CRUD / Mutation Capability | Classification |
|---|---|---|---|---|---|---|---|
| 01 | `overview` | Overview Dashboard | Working UI | `GET /api/admin/overview` | JSON Store (`.data/platform-state.json`) | Read-only KPIs + module navigation buttons | `VERIFIED` |
| 02 | `products` | Product & Jewellery Specs | Working UI | `GET /api/admin/products` | JSON Store | Search, category filter, and SKU Price Breakup Inspector. *(Note: Backend has POST/PUT/DELETE, but UI has no Create/Edit/Delete product modal).* | `PARTIALLY IMPLEMENTED` |
| 03 | `categories` | Category Management | Working UI | `GET /api/admin/categories` | JSON Store | Read-only table of the 11 categories | `PARTIALLY IMPLEMENTED` |
| 04 | `inventory` | Inventory Management | Working UI | Uses `products` state | JSON Store | Read-only stock table with low-stock badges (`<= 2`). *(Note: Backend has `POST /api/v1/inventory/adjust`, but UI has no stock adjustment form).* | `PARTIALLY IMPLEMENTED` |
| 05 | `orders` | Order Management | Working UI | `GET /api/admin/orders`, `POST /api/admin/orders/:id/shipments` | JSON Store | Displays orders and triggers **"Generate Shiprocket AWB"** (`handleGenerateShiprocketAwb`) for unfulfilled orders. *(No refund or invoice modal in UI).* | `PARTIALLY IMPLEMENTED` |
| 06 | `customers` | Customer Management | Working UI | `GET /api/admin/customers` | JSON Store | Read-only customer directory table | `VERIFIED` |
| 07 | `pricing-engine` | Jewellery Pricing Engine | Working UI | `GET /api/admin/pricing/rules`, `POST /api/admin/pricing/preview`, `validate`, `approve`, `publish` | JSON Store | **Full interactive `Decimal.js` Price Simulator + 4-step Governance workflow buttons** (`Preview`, `Validate`, `Owner Approve`, `Publish & Snapshot`) | `VERIFIED` |
| 08 | `gold-rates` | Gold & Metal Rates | Working UI | `GET /api/admin/rates/metals`, `POST /api/admin/rates/metals` | JSON Store | **Full rate table + "Update Daily Bullion Rate" form** (`handleUpdateMetalRate`) | `VERIFIED` |
| 09 | `diamond-rates` | Diamond Rate Matrix | Working UI | `GET /api/admin/rates/diamonds`, `POST /api/admin/rates/diamonds` | JSON Store | **Full matrix table + "Update Diamond Matrix Slab" form** (`handleUpdateDiamondRate`) | `VERIFIED` |
| 10 | `excel-import` | Bulk Excel/CSV Import | Working UI | `GET /api/admin/imports`, `POST /api/admin/imports/excel`, `GET .../errors.csv` | JSON Store | **Dry-Run & Commit buttons** (`handleRunExcelImport`), row-level error table, and **Download Error CSV** link. *(Uses server workbook; no file upload input or rollback button in UI).* | `PARTIALLY IMPLEMENTED` |
| 11 | `discounts` | Discount Management | Working UI | `GET /api/admin/discounts` | JSON Store | Read-only table of promotional coupons (`ENGAGEMENT10`, `ROYALMAKING0`) | `PARTIALLY IMPLEMENTED` |
| 12 | `banners` | Banner Management | Working UI | `GET /api/admin/banners` | JSON Store | Read-only table of hero and editorial banners | `PARTIALLY IMPLEMENTED` |
| 13 | `content` | Content & Policies | Working UI | `GET /api/admin/content` | JSON Store | Read-only table of editorial and policy content | `PARTIALLY IMPLEMENTED` |
| 14 | `shipping` | Shipping (Shiprocket) | Working UI | `GET /api/admin/shipping/shipments` | JSON Store | Displays shipments, AWB codes, and simulated label/manifest links | `SIMULATED` |
| 15 | `payments` | Payment (Razorpay) | Working UI | `GET /api/admin/payments` | JSON Store | Read-only payment ledger table | `PARTIALLY IMPLEMENTED` |
| 16 | `analytics` | Reports & Analytics | Working UI | Computed from `products` & `pricingSnapshots` | JSON Store | Displays 3 KPI cards (Catalog Valuation, Total Net Gold, Pricing Snapshots). *(No CSV export button in UI).* | `PARTIALLY IMPLEMENTED` |
| 17 | `users-roles` | Admin Users & RBAC | Working UI | Uses `ROLE_CREDENTIALS` & `ROLE_PERMISSIONS` | Static/JSON Store | Read-only RBAC permission matrix table | `VERIFIED` |
| 18 | `settings` | Store & API Settings | Working UI | `GET /api/admin/settings` | JSON Store | 4 `readOnly` inputs (Store Domain, API Version, Default GST, Live Writes Guard). *(No save button wired to `PUT /api/admin/settings`).* | `PARTIALLY IMPLEMENTED` |
| 19 | `audit-logs` | Activity & Audit Logs | Working UI | `GET /api/admin/audit-logs` | JSON Store | Live chronological audit log table updated after every admin action | `VERIFIED` |
