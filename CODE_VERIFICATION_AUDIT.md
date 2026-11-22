# MANGAL ROYAL STUDIO — COMPLETE CODE-VERIFIED DOCUMENTATION & IMPLEMENTATION AUDIT

**Audit Date:** 2026-11-05  
**Scope:** Full source-code, configuration, database schema, migration, test suite, build output, and documentation verification across all workspaces.  
**Audit Standard:** Zero assumptions. Every claim in the 13 project documentation files has been cross-checked against actual files and runtime behavior and classified as:
- **`VERIFIED`** — Confirmed in source code, tests, and build output.
- **`PARTIALLY IMPLEMENTED`** — Code or UI exists for part of the feature, or backend exists without UI (or vice versa).
- **`SIMULATED`** — Implemented as a deterministic local/in-memory mock or fallback without live external network/database execution.
- **`NOT IMPLEMENTED`** — Claimed in documentation or schema, but absent from active application code.
- **`UNVERIFIED`** — Requires external credentials, live database, or visual browser inspection not yet executed.

---

## 1. Executive Summary

1. **Build & Test Health (`VERIFIED`):**
   - All 4 TypeScript workspaces (`@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront`) pass `npm run typecheck` (`tsc --noEmit`) with **0 errors**.
   - All **10 automated tests** (`3` in `@mrs/shared` + `7` in `@mrs/api`) pass (`npm test` via Vitest `v2.1.9`).
   - All 4 workspaces compile cleanly for production (`npm run build`).
2. **Original Theme Backup Integrity (`VERIFIED`):**
   - [`jewellery-theme-backup/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/jewellery-theme-backup) contains **378 files** (`377` Shopify theme files across `assets/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/` + `1` root `AGENTS.md`). No file in `jewellery-theme-backup/` has been modified since initial extraction (`2026-11-05 15:03:36`).
3. **Critical Discrepancies Uncovered Between Previous Documentation & Actual Code:**
   - **Database Persistence (`NOT IMPLEMENTED` at runtime / `VERIFIED` at schema level):** [`services/api/prisma/schema.prisma`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma) defines **40 relational models** (not 35) and has a generated SQL migration ([`migration.sql`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql)), but `@prisma/client` is **never imported** in `services/api/src/`. All API state is persisted via [`services/api/src/store/data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts) to a local JSON file (`.data/platform-state.json`).
   - **Admin Dashboard Structure (`PARTIALLY IMPLEMENTED`):** [`apps/admin`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx) runs on port **`3001`** (not `3000`) and is a single-page application (`src/app/page.tsx`) with 19 tab views switched in React state. Separate route files (`/login`, `/products`, `/pricing`, `/imports`, etc.) and `AdminShell.tsx` claimed in `ADMIN_MODULES.md` do not exist. Of the 19 tabs, 6 have interactive mutation forms/buttons wired to the API, while 13 are read-only tables/views.
   - **Security & Auth Gaps (`PARTIALLY IMPLEMENTED`):**
     - Passwords use a static-prefix SHA-256 hash (`crypto.createHash('sha256').update('mrs_salt_' + password)`) in [`data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts#L433-L435), **not `bcryptjs`**.
     - [`auth.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/middleware/auth.ts#L77-L92) allows an unauthenticated `x-mrs-admin-role` header to bypass JWT verification in all environments.
     - Customer login (`POST /api/auth/customer/login` in [`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1688-L1721)) checks email existence but **does not verify the customer's password**.
     - `POST /api/payments/razorpay/verify` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2082-L2085)) has `process.env.NODE_ENV !== 'production'` in its signature acceptance condition, meaning invalid signatures are accepted whenever `NODE_ENV !== 'production'`.
     - `helmet` and `express-rate-limit` are not installed or used.

---

## 2. Repository Structure (`VERIFIED`)

| Workspace / Directory | Package Name | Port / Role | File Count / Key Files | Status |
|---|---|---|---|---|
| [`jewellery-theme-backup/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/jewellery-theme-backup) | N/A (Read-only backup) | Original Shopify Dawn 15.5.0 theme | **378 files** (`191` assets, `2` config, `2` layout, `51` locales, `71` sections, `39` snippets, `21` templates, `1` `AGENTS.md`) | `VERIFIED` (Untouched) |
| [`apps/shopify-theme/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/shopify-theme) | N/A (Liquid working copy) | Previewed on `http://127.0.0.1:9292` | **382 files** (377 theme files + 5 added Liquid/JSON files for wishlist, order-tracking, price-breakup) | `VERIFIED` |
| [`packages/shared/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared) | `@mrs/shared` | Shared library | 5 source files: [`index.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/index.ts), [`types.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/types.ts), [`schemas.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/schemas.ts), [`pricing-engine.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.ts), [`pricing-engine.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.test.ts) | `VERIFIED` |
| [`services/api/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api) | `@mrs/api` | Express REST API on `http://localhost:4000` | 10 source files in `src/` + [`prisma/schema.prisma`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma) + [`migration.sql`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql) | `VERIFIED` |
| [`apps/admin/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin) | `@mrs/admin` | Next.js Admin UI on `http://localhost:3001` | 3 source files: [`layout.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/layout.tsx), [`page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx), [`globals.css`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/globals.css) | `VERIFIED` |
| [`apps/storefront/`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront) | `@mrs/storefront` | Next.js Storefront on `http://localhost:3000` | 25 source files (`21` in `src/app/`, `2` in `src/components/`, `1` in `src/lib/`) | `VERIFIED` |

---

## 3. Verified Technology Stack (`VERIFIED`)

| Package / Tool | Declared in `package.json` | Installed in `node_modules` | Verification Notes |
|---|---|---|---|
| **Next.js** | `^15.1.3` | `15.5.29` | Used by `@mrs/admin` and `@mrs/storefront` |
| **React / React DOM** | `^19.0.0` | `19.3.1` | Used by `@mrs/admin` and `@mrs/storefront` |
| **TypeScript** | `^5.7.2` | `5.9.3` | Strict mode enabled across all 4 `tsconfig.json` files |
| **Express** | `^4.21.2` | `4.22.3` | Used by `@mrs/api` |
| **Decimal.js** | `^10.4.3` | `10.6.0` | Configured with `precision: 28, rounding: ROUND_HALF_UP` in [`pricing-engine.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.ts#L14) |
| **Zod** | `^3.24.1` | `3.25.76` | Shared request schemas in [`packages/shared/src/schemas.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/schemas.ts) |
| **Prisma / `@prisma/client`** | `^6.1.0` | `6.19.3` | Schema & client generated; **not wired into Express routes** |
| **Vitest** | `^2.1.8` | `2.1.9` | **Correction:** Previously misdocumented as `v3.0.7` in `TESTING_REPORT.md` |
| **Supertest** | `^7.0.0` | `7.3.1` | Installed in `devDependencies`, though [`app.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.test.ts#L19-L129) uses a custom in-memory `invokeApp` dispatcher |
| **SheetJS (`xlsx`)** | `^0.18.5` | `0.18.5` | Used in [`excel-importer.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/excel-importer.ts) and [`generate-sample-excel.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/scripts/generate-sample-excel.ts) |
| **LiquidJS** | `^10.30.1` | `10.30.1` | Used by [`storefront-preview-server.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/scripts/storefront-preview-server.ts) |
| **Multer** | `^1.4.5-lts.1` | `1.4.5-lts.1` | Used for multipart `.xlsx` upload on `POST /api/admin/imports/excel` |
| **`bcryptjs` / `helmet` / `express-rate-limit`** | *Not in `package.json`* | *Not installed* | **Correction:** Previously misclaimed in `SECURITY.md` |

---

## 4. Database & Prisma Verification

### 4.1 Schema & Models ([`services/api/prisma/schema.prisma`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma))
- **Model Count (`VERIFIED`):** Contains **40 `model` definitions** and **1 `enum` (`RoleName`)**, not 35. Previously, `DATABASE_SCHEMA.md` grouped the last 6 models (`Banner`, `Content`, `Notification`, `StoreSetting`, `IntegrationEvent`, `AuditLog`) into a single numbered bullet (`#35`).
- **All 40 Models Verified in `schema.prisma`:**
  1. `Role` (line 20)
  2. `Permission` (line 30)
  3. `AdminUser` (line 38)
  4. `RefreshToken` (line 53)
  5. `Category` (line 73)
  6. `Collection` (line 88)
  7. `CollectionProduct` (line 101)
  8. `ProductMetadata` (line 112)
  9. `ProductVariant` (line 150)
  10. `ProductImage` (line 169)
  11. `JewellerySpecification` (line 185)
  12. `DiamondComponent` (line 212)
  13. `InventoryRecord` (line 235)
  14. `InventoryMovement` (line 249)
  15. `GoldRate` (line 271)
  16. `DiamondRate` (line 287)
  17. `PricingRule` (line 309)
  18. `PricingRun` (line 330)
  19. `PricingRunItem` (line 351)
  20. `PricingSnapshot` (line 370)
  21. `ImportJob` (line 394)
  22. `ImportError` (line 414)
  23. `Customer` (line 432)
  24. `CustomerAddress` (line 454)
  25. `Cart` (line 474)
  26. `CartItem` (line 487)
  27. `Wishlist` (line 507)
  28. `WishlistItem` (line 517)
  29. `OrderMetadata` (line 534)
  30. `OrderItem` (line 573)
  31. `PaymentRecord` (line 594)
  32. `RefundRecord` (line 616)
  33. `Shipment` (line 632)
  34. `Discount` (line 659)
  35. `Banner` (line 678)
  36. `Content` (line 694)
  37. `Notification` (line 707)
  38. `StoreSetting` (line 721)
  39. `IntegrationEvent` (line 729)
  40. `AuditLog` (line 742)
- **Decimal Precision (`VERIFIED`):**
  - Monetary amounts (`currentShopifyPrice`, `priceInr`, `makingChargeValue`, `certificationFeeInr`, `hallmarkFeeInr`, `publishedPriceInr`, `totalPriceInr`, `amountInr`, etc.): `@db.Decimal(14, 2)`
  - Bullion and diamond rates (`ratePerGramInr`, `rateInr`): `@db.Decimal(14, 4)`
  - Metal & diamond weights (`grossWeightGrams`, `netMetalWeightGrams`, `wastageValue`, `totalCaratWeight`): `@db.Decimal(10, 3)`
  - Carat brackets (`sizeMinCarat`, `sizeMaxCarat`): `@db.Decimal(10, 4)`
  - Stone-to-gram factor (`stoneWeightToGramsFactor`): `@db.Decimal(8, 4)`
  - Percentages (`gstRatePercent`, `maxPriceDeltaPercentThreshold`, `priceDeltaPercent`): `@db.Decimal(6, 2)` and `@db.Decimal(8, 2)`

### 4.2 Migration vs. Runtime Persistence Status
- **Migration SQL (`VERIFIED` — Generated Only):** [`services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql) (`36,308` bytes) contains complete PostgreSQL `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, and `ADD CONSTRAINT ... FOREIGN KEY` statements for all 40 models.
- **Database Application Status (`NOT IMPLEMENTED` / `UNVERIFIED`):** The migration has **not** been applied to a running PostgreSQL instance (`prisma migrate deploy` has not been run against a live DB).
- **Runtime API Persistence (`SIMULATED` via JSON File Store):** [`services/api/src/store/data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts) stores all runtime data in memory (`PlatformState`) and persists changes synchronously to `.data/platform-state.json` (`lines 1807–1865`). `@prisma/client` is not yet connected to the Express route handlers.

---

## 5. API Verification ([`services/api/src/app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts))

### 5.1 Prefix Routing (`VERIFIED`)
Lines `81–88` of [`services/api/src/app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L81-L88) rewrite `/api/v1/health` to `/health` and `/api/v1/*` to `/api/*`, so every endpoint works under both `/api/...` and `/api/v1/...`.

### 5.2 Complete Verified Endpoint Inventory (42 Routes in `app.ts`)

| Method & Route (also available under `/api/v1/...`) | Auth Middleware | Persistence | Status |
|---|---|---|---|
| `GET /health` (`/api/v1/health`) | Public | Reads `dbStore` | `VERIFIED` |
| `POST /api/auth/login` | Public | Reads `dbStore.users`, writes `auditLogs` | `VERIFIED` |
| `GET /api/auth/me` | `requireAuth` | Reads `req.adminUser` | `VERIFIED` |
| `POST /api/auth/register` | Public | Writes `dbStore.customers` | `VERIFIED` |
| `POST /api/auth/customer/login` | Public | Reads `dbStore.customers` & `orders` | `PARTIALLY IMPLEMENTED` (Missing password check — see Section 11) |
| `GET /api/roles` | `requireAuth` | Reads `ROLE_PERMISSIONS` | `VERIFIED` |
| `GET /api/public/pricing/:handleOrSku` | Public | Reads `dbStore`, runs `calculateJewelleryPrice` | `VERIFIED` |
| `GET /api/public/orders/track` | Public | Reads `dbStore.orders` & `shipments` | `VERIFIED` |
| `GET /api/admin/overview` | `requireAuth` | Reads `dbStore` | `VERIFIED` |
| `GET /api/admin/analytics` | `requireAuth` | Reads `dbStore` | `VERIFIED` |
| `GET /api/admin/products` | `requireAuth` | Reads `dbStore.products` + live breakdown | `VERIFIED` |
| `PUT /api/admin/pricing/products/:sku/attributes` | `requireAuth`, `PRODUCTS_WRITE` | Mutates `dbStore.products` | `VERIFIED` |
| `POST /api/admin/products` & `POST /api/products` | `requireAuth`, `PRODUCTS_WRITE` | Writes `dbStore.products` & `inventoryMovements` | `VERIFIED` |
| `DELETE /api/admin/products/:sku` & `DELETE /api/products/:sku` | `requireAuth`, `PRODUCTS_WRITE` | Deletes from `dbStore.products` (blocks if in active order) | `VERIFIED` |
| `GET /api/products` | Public | Filters/sorts `dbStore.products` | `VERIFIED` |
| `GET /api/products/:handleOrSku` | Public | Reads product, breakdown, related items | `VERIFIED` |
| `GET /api/collections` | Public | Reads `dbStore.collections` & `categories` | `VERIFIED` |
| `GET /api/collections/:handle` | Public | Reads collection & matching products | `VERIFIED` |
| `GET /api/admin/categories` | `requireAuth` | Reads `dbStore.categories` | `VERIFIED` |
| `GET /api/admin/inventory` | `requireAuth` | Reads `dbStore.products` stock levels | `VERIFIED` |
| `POST /api/admin/inventory/adjust` & `POST /api/inventory/adjust` | `requireAuth`, `PRODUCTS_WRITE` | Updates `inventoryQuantity`, logs `InventoryMovement` | `VERIFIED` |
| `GET /api/admin/inventory/movements` | `requireAuth` | Reads `dbStore.inventoryMovements` | `VERIFIED` |
| `GET /api/admin/orders` | `requireAuth` | Reads `dbStore.orders` | `VERIFIED` |
| `GET /api/admin/customers` | `requireAuth` | Reads `dbStore.customers` | `VERIFIED` |
| `GET /api/admin/rates/metals` | `requireAuth` | Reads `dbStore.metalRates` | `VERIFIED` |
| `POST /api/admin/rates/metals` | `requireAuth`, `RATES_WRITE` | Upserts `dbStore.metalRates` | `VERIFIED` |
| `GET /api/admin/rates/diamonds` | `requireAuth` | Reads `dbStore.diamondRates` | `VERIFIED` |
| `POST /api/admin/rates/diamonds` | `requireAuth`, `RATES_WRITE` | Prepends `dbStore.diamondRates` | `VERIFIED` |
| `GET /api/admin/pricing/rules` | `requireAuth` | Reads `pricingRules`, `pricingRuns`, `pricingSnapshots` | `VERIFIED` |
| `POST /api/admin/pricing/rules` | `requireAuth`, `PRICING_VALIDATE` | Creates new draft `PricingFormulaRule` | `VERIFIED` |
| `POST /api/admin/pricing/preview` | `requireAuth`, `PRICING_PREVIEW` | Creates `PREVIEWED` run in `dbStore.pricingRuns` | `VERIFIED` |
| `POST /api/admin/pricing/runs/:runId/validate` | `requireAuth`, `PRICING_VALIDATE` | Transitions run to `VALIDATED` | `VERIFIED` |
| `POST /api/admin/pricing/runs/:runId/approve` | `requireAuth`, `requireOwnerRole` | Transitions run to `APPROVED` (`OWNER` only) | `VERIFIED` |
| `POST /api/admin/pricing/runs/:runId/publish` | `requireAuth`, `requireOwnerRole` | Updates product prices, saves `PricingSnapshot`s, simulates Shopify sync | `VERIFIED` |
| `GET /api/admin/imports` | `requireAuth` | Lists 11 supported sheets & `importJobs` | `VERIFIED` |
| `POST /api/admin/imports/excel` | `requireAuth`, `IMPORTS_RUN` | Parses 11-sheet workbook in `DRY_RUN` or `COMMIT` mode | `VERIFIED` |
| `GET /api/admin/imports/:jobId/errors.csv` | `requireAuth` | Exports row errors as CSV | `VERIFIED` |
| `POST /api/admin/imports/:jobId/sync-shopify` | `requireAuth`, `requireOwnerRole` | Marks job `SYNCED_TO_SHOPIFY` | `SIMULATED` |
| `POST /api/admin/imports/:jobId/rollback` | `requireAuth`, `requireOwnerRole` | Removes valid SKUs of `jobId` from `dbStore.products` | `PARTIALLY IMPLEMENTED` (Does not update `job.status`) |
| `GET /api/admin/discounts`, `/banners`, `/content` | `requireAuth` | Reads `discounts`, `banners`, `contents` | `VERIFIED` (Read-only; no POST/PUT/DELETE endpoints) |
| `GET /api/admin/shipping/shipments` | `requireAuth` | Reads `dbStore.shipments` | `VERIFIED` |
| `POST /api/admin/orders/:orderId/shipments` | `requireAuth`, `SHIPMENTS_MANAGE` | Generates simulated Shiprocket AWB | `SIMULATED` |
| `GET /api/admin/payments` | `requireAuth` | Reads `dbStore.payments` | `VERIFIED` |
| `GET /api/admin/users` | `requireAuth` | Reads `dbStore.users` | `VERIFIED` (Read-only) |
| `GET /api/admin/settings` & `PUT /api/admin/settings` | `requireAuth` (`PUT`: `requireOwnerRole`) | Reads/updates `dbStore.settings` | `VERIFIED` |
| `GET /api/admin/audit-logs` | `requireAuth` | Reads `dbStore.auditLogs` | `VERIFIED` |
| `POST /api/webhooks/shopify` | HMAC header check | Verifies `x-shopify-hmac-sha256` & writes audit log | `PARTIALLY IMPLEMENTED` (No `IntegrationEvent` idempotency table check) |
| `POST /api/webhooks/razorpay` | HMAC header check | Verifies `x-razorpay-signature` | `PARTIALLY IMPLEMENTED` (No `IntegrationEvent` idempotency check) |
| `GET /api/cart/:cartId`, `POST /api/cart/:cartId/items`, `DELETE /api/cart/:cartId/items/:itemId`, `POST /api/cart/:cartId/discount` | Public | Manages cart state in `dbStore.carts` | `VERIFIED` |
| `GET /api/wishlist/:wishlistId`, `POST /api/wishlist/:wishlistId/toggle` | Public | Manages wishlist SKUs in `dbStore.wishlists` | `VERIFIED` |
| `POST /api/checkout/create-order` | Public | Stock check, snapshot lock, stock deduction, order creation | `VERIFIED` |
| `POST /api/payments/razorpay/verify` | Public | Marks order `PAID`, records `PaymentRecord` | `PARTIALLY IMPLEMENTED` (Signature bypass in non-prod — see Section 9) |
| `POST /api/admin/orders/:orderId/refund` & `POST /api/payments/refund` | `requireAuth`, `ORDERS_VIEW` | Creates `RefundRecord`, updates order status, optional restock | `VERIFIED` |
| `POST /api/admin/orders/:orderId/cancel` & `POST /api/orders/:orderId/cancel` | Admin or Public | Cancels order and restores line item stock | `VERIFIED` |
| `GET /api/orders/:orderId/invoice` | Public | Generates JSON GST invoice (`HSN 711319`, 3% GST) | `VERIFIED` |
| `GET /api/shipping/serviceability` | Public | Validates 6-digit PIN & returns simulated couriers | `SIMULATED` |
| `GET /api/admin/reports/export.csv` | `requireAuth` | Exports `orders` or `products`/`inventory` CSV | `VERIFIED` |
| `GET /api/docs.json` | Public | Returns OpenAPI 3.1 JSON summary | `VERIFIED` |

---

## 6. Admin Dashboard Verification ([`apps/admin/src/app/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx))

### Architectural Reality
- **Port:** Runs on `http://localhost:3001` (`next dev -p 3001`), **not** `http://localhost:3000`.
- **Single-Page Architecture:** The entire Admin Dashboard is implemented inside [`apps/admin/src/app/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/admin/src/app/page.tsx) (`2,407` lines). There are **no** separate route directories (`/login`, `/products`, `/pricing`, `/imports`, `/orders`, `/customers`, `/reports`, `/settings`) and **no** `AdminShell.tsx` component.
- **Authentication in UI:** Instead of a login screen, the top header provides an "Active RBAC Session" `<select>` switcher (`OWNER`, `MANAGER`, `PRICING_OPERATOR`) that automatically calls `POST /api/auth/login` using the role's seeded credentials (`<set via MRS_SEED_OWNER_PASSWORD>`, `<set via MRS_SEED_MANAGER_PASSWORD>`, `<set via MRS_SEED_PRICING_PASSWORD>`). If the backend API at `:4000` is unreachable, the UI falls back to `seedLocalFallbackState()`.

### Module-by-Module Real Status Table (All 19 Modules)

| # | Module Key & Label | Working UI | Working API Integration | Actual DB Persistence | CRUD / Action Functionality in UI | Validation & Error Handling | Classification |
|---|---|---|---|---|---|---|---|
| 1 | `overview` — Overview Dashboard | Yes (KPI cards, Metal Rate table, Quick Launcher) | `GET /api/admin/overview` | JSON Store (`.data/platform-state.json`) | Read-only KPIs + navigation shortcuts | Fallback to local seed if API offline | `VERIFIED` (Read-Only UI) |
| 2 | `products` — Product & Jewellery Specs | Yes (Search, Category filter, Table, Price Breakup Inspector) | `GET /api/admin/products` | JSON Store | **Read & Inspect only in UI** (No Create/Edit/Delete modal exists in `page.tsx`, even though backend has POST/PUT/DELETE) | Client search/filter | `PARTIALLY IMPLEMENTED` |
| 3 | `categories` — Category Management | Yes (11-category mapping table) | `GET /api/admin/categories` | JSON Store | Read-only table in UI | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 4 | `inventory` — Inventory Management | Yes (Stock table & low-stock badges) | Reads `products` state | JSON Store | **Read-only in UI** (No stock adjustment form in `page.tsx`, even though `POST /api/v1/inventory/adjust` exists on backend) | Low stock badge (`<= 2`) | `PARTIALLY IMPLEMENTED` |
| 5 | `orders` — Order Management | Yes (Order table + "Generate Shiprocket AWB" button) | `GET /api/admin/orders`, `POST /api/admin/orders/:id/shipments` | JSON Store | Can dispatch unfulfilled orders (`handleGenerateShiprocketAwb`); **no** refund modal or invoice modal in Admin UI | Toast error display | `PARTIALLY IMPLEMENTED` |
| 6 | `customers` — Customer Management | Yes (Customer directory table) | `GET /api/admin/customers` | JSON Store | Read-only table | N/A | `VERIFIED` (Read-Only UI) |
| 7 | `pricing-engine` — Jewellery Pricing Engine | Yes (Interactive `Decimal.js` Simulator + 4-stage Governance table) | `GET /api/admin/pricing/rules`, `POST /api/admin/pricing/preview`, `POST .../validate`, `approve`, `publish` | JSON Store | **Full workflow in UI:** Live simulator + Preview, Validate, Owner Approve, and Publish buttons | Client & server RBAC guard (`OWNER` required for Approve/Publish) | `VERIFIED` |
| 8 | `gold-rates` — Gold & Metal Rates | Yes (Rate table + "Update Daily Bullion Rate" form) | `GET /api/admin/rates/metals`, `POST /api/admin/rates/metals` | JSON Store | **Full Create/Update in UI** (`handleUpdateMetalRate`) | HTML5 `required` + server Zod schema | `VERIFIED` |
| 9 | `diamond-rates` — Diamond Rate Matrix | Yes (Matrix table + "Update Diamond Matrix Slab" form) | `GET /api/admin/rates/diamonds`, `POST /api/admin/rates/diamonds` | JSON Store | **Full Create/Update in UI** (`handleUpdateDiamondRate`) | HTML5 `required` + server Zod schema | `VERIFIED` |
| 10 | `excel-import` — Bulk Excel/CSV Import | Yes (Dry-Run & Commit buttons, Job summary, Error table, CSV download link) | `GET /api/admin/imports`, `POST /api/admin/imports/excel`, `GET .../errors.csv` | JSON Store | **Dry-Run, Commit & Error CSV Download in UI** (`handleRunExcelImport`); no file picker input (uses server's `MANGAL JEWELLERY.xlsx`) and no Rollback button in UI | Displays row-level errors table | `PARTIALLY IMPLEMENTED` |
| 11 | `discounts` — Discount Management | Yes (Coupons table) | `GET /api/admin/discounts` | JSON Store | Read-only table in UI (no create/edit coupon form) | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 12 | `banners` — Banner Management | Yes (Banners table) | `GET /api/admin/banners` | JSON Store | Read-only table in UI | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 13 | `content` — Content & Policies | Yes (Content table) | `GET /api/admin/content` | JSON Store | Read-only table in UI | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 14 | `shipping` — Shipping (Shiprocket) | Yes (Shipments table + Label/Manifest links) | `GET /api/admin/shipping/shipments` | JSON Store | View shipments & trigger AWB from Orders tab | Simulated URLs | `SIMULATED` |
| 15 | `payments` — Payment (Razorpay) | Yes (Payments ledger table) | `GET /api/admin/payments` | JSON Store | Read-only ledger in UI | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 16 | `analytics` — Reports & Analytics | Yes (3 KPI cards: Catalog Valuation, Total Net Gold, Pricing Snapshots) | Computed from `products` & `pricingSnapshots` | JSON Store | Read-only KPI cards in UI (no CSV export buttons in UI, though `GET /api/admin/reports/export.csv` exists) | N/A | `PARTIALLY IMPLEMENTED` |
| 17 | `users-roles` — Admin Users & RBAC | Yes (Role & Permission matrix table) | Rendered from `ROLE_CREDENTIALS` & `ROLE_PERMISSIONS` | Static/JSON Store | Read-only table in UI | N/A | `VERIFIED` (Read-Only UI) |
| 18 | `settings` — Store & API Settings | Yes (4 read-only inputs) | `GET /api/admin/settings` | JSON Store | **Read-only in UI** (`readOnly` inputs; no save button wired to `PUT /api/admin/settings`) | N/A | `PARTIALLY IMPLEMENTED` (Read-Only) |
| 19 | `audit-logs` — Activity & Audit Logs | Yes (Chronological audit log table) | `GET /api/admin/audit-logs` | JSON Store | Read-only table updated on every mutation | N/A | `VERIFIED` |

---

## 7. Storefront Verification (`apps/storefront`)

### 7.1 Build & Routes (`VERIFIED`)
- **Port:** Runs on `http://localhost:3000` (`next dev -p 3000`).
- **All 19 Next.js App Router Routes Verified in Production Build:**
  - `/` ([`src/app/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/page.tsx))
  - `/_not-found` ([`src/app/not-found.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/not-found.tsx))
  - `/collections` ([`src/app/collections/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/collections/page.tsx))
  - `/collections/[handle]` ([`src/app/collections/[handle]/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/collections/%5Bhandle%5D/page.tsx))
  - `/products/[handle]` ([`src/app/products/[handle]/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/products/%5Bhandle%5D/page.tsx))
  - `/search` ([`src/app/search/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/search/page.tsx))
  - `/cart` ([`src/app/cart/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/cart/page.tsx))
  - `/checkout` ([`src/app/checkout/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/checkout/page.tsx))
  - `/about-us` & `/pages/about-us` ([`src/app/pages/about-us/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/pages/about-us/page.tsx))
  - `/contact` & `/pages/contact` ([`src/app/pages/contact/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/pages/contact/page.tsx))
  - `/wishlist` & `/pages/wishlist` ([`src/app/pages/wishlist/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/pages/wishlist/page.tsx))
  - `/order-tracking` & `/pages/order-tracking` ([`src/app/pages/order-tracking/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/pages/order-tracking/page.tsx))
  - `/pages/[slug]` ([`src/app/pages/[slug]/page.tsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/pages/%5Bslug%5D/page.tsx))
  - `/account`, `/account/login`, `/account/register`

### 7.2 Design Token & Visual Differences Identified (`PARTIALLY IMPLEMENTED` / `UNVERIFIED` pending visual diff)
- **Actual CSS Tokens in [`apps/storefront/src/app/globals.css`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/apps/storefront/src/app/globals.css#L3-L24):**
  - Uses the authentic Mangal Royal Studio burgundy & warm peach palette (`--mrs-burgundy: #7D132A`, `--mrs-burgundy-bar: #7A1023`, `--mrs-burgundy-shape: #86142C`, `--mrs-burgundy-trust: #8B0D2B`, `--mrs-peach: #F8E1CF`, `--mrs-peach-warm: #FBE8DB`, `--mrs-ink: #190303`, card aspect ratio `285 / 397`).
  - **Correction to `STOREFRONT_MIGRATION.md`:** `STOREFRONT_MIGRATION.md` previously described non-existent dark charcoal (`#1A1A1A`), cream (`#FAF7F2`), espresso (`#2C1810`), and `4 / 5` aspect ratio tokens, and referenced non-existent `mrs-*` Liquid section names (`mrs-announcement-bar.liquid` instead of `announcement-bar.liquid`, etc.).
- **Visual Differences Between `apps/storefront` and `jewellery-theme-backup` (To Be Fixed in Next Milestone):**
  1. **Shop by Shape (`src/app/page.tsx` lines 9–18 vs `sections/shop-by-shape.liquid`):** `apps/storefront` lists 8 shapes (`Round`, `Heart`, `Radiant`, `Princess`, `Pear`, `Oval`, `Marquise`, `Emerald`), whereas the original Shopify theme has 7 shapes (`Round`, `Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart`).
  2. **Hero Slideshow (`src/app/page.tsx` lines 70–91 vs `sections/slideshow.liquid`):** Renders 1 static slide without the bottom-right circular prev/next navigation buttons present in the Shopify theme.
  3. **Bestsellers (`src/app/page.tsx` lines 94–134 vs `sections/featured-collection.liquid`):** Eyebrow text in `apps/storefront` is `"Handpicked for you"` instead of `"The most loved"`, and CTA is `"Explore All Bestsellers"` instead of `"View All →"` with circular side carousel arrows.
  4. **Testimonials (`src/app/page.tsx` lines 37–59 vs `sections/testimonals.liquid`):** Renders a 3-column static grid instead of the horizontal drag/autoplay carousel with top-right circular prev/next buttons.

---

## 8. Excel Importer Verification (`VERIFIED`)

- **Workbook Files:** [`./MANGAL JEWELLERY.xlsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/MANGAL%20JEWELLERY.xlsx) and [`./samples/MANGAL JEWELLERY.xlsx`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/samples/MANGAL%20JEWELLERY.xlsx).
- **Generator:** [`services/api/src/scripts/generate-sample-excel.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/scripts/generate-sample-excel.ts).
- **Importer Service:** [`services/api/src/services/excel-importer.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/excel-importer.ts).
- **Verified Sheet & Row Counts (296 Total Rows across 11 Sheets):**
  - `Rings`: 42 rows (41 valid + 1 invalid weight row at Excel row 43: `MRS-RNG-ERR-WEIGHT`, `Gross Weight = 3.2g`, `Net Weight = 4.1g` -> `NET_EXCEEDS_GROSS_WEIGHT`)
  - `Earrings`: 36 rows (36 valid)
  - `Pendants`: 30 rows (30 valid)
  - `Necklaces`: 24 rows (24 valid)
  - `Bracelets`: 26 rows (26 valid)
  - `Bangles`: 24 rows (24 valid)
  - `Mangalsutra`: 24 rows (24 valid)
  - `Solitaires`: 24 rows (24 valid)
  - `Nose Pins`: 22 rows (22 valid)
  - `Chains`: 22 rows (22 valid)
  - `Antique`: 22 rows (21 valid + 1 duplicate SKU row at Excel row 23: `MRS-RNG-101` duplicating `Rings` row 1 -> `DUPLICATE_SKU`)
  - **Totals:** `296` total rows, `294` valid rows, `2` failed rows (`1` weight error + `1` duplicate SKU).
- **Dry-Run & Error CSV (`VERIFIED`):** Tested in [`services/api/src/app.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.test.ts#L225-L310).
- **Rollback (`PARTIALLY IMPLEMENTED`):** `POST /api/admin/imports/:jobId/rollback` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1596-L1631)) filters out products matching `job.previewItems` with `status === 'VALID'` from `dbStore.products`, but does not check whether `job.dryRun` was `false` before removing SKUs and does not update `job.status`.

---

## 9. Payment Verification — Razorpay (`SIMULATED` / `PARTIALLY IMPLEMENTED`)

- **File Location:** There is **no** `services/api/src/services/razorpay-service.ts`. `verifyRazorpaySignature()` is defined in [`services/api/src/services/shiprocket-service.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L51-L65).
- **Order Creation (`SIMULATED`):** `POST /api/checkout/create-order` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1889-L2055)) calculates totals server-side, deducts stock, locks a `PricingSnapshot`, and generates a simulated Razorpay order ID (`order_MrsRzp${Date.now()}`). No live call to Razorpay's `/v1/orders` API is made.
- **Signature Verification Flaw (`PARTIALLY IMPLEMENTED`):** In `POST /api/payments/razorpay/verify` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2076-L2093)):
  ```ts
  const isTestSignatureAccepted =
    razorpaySignature === expectedHmac ||
    razorpaySignature.startsWith('sig_verified_') ||
    process.env.NODE_ENV !== 'production';
  ```
  Because `process.env.NODE_ENV !== 'production'` is `true` during development and testing, **any signature string is accepted** unless `NODE_ENV=production`. Additionally, it compares `razorpaySignature === expectedHmac` with `===` instead of `crypto.timingSafeEqual`.
- **Webhook Handler (`PARTIALLY IMPLEMENTED`):** `POST /api/webhooks/razorpay` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1160-L1177)) properly uses `verifyRazorpaySignature()` (`crypto.timingSafeEqual`), but does not check or insert into `dbStore.integrationEvents` for idempotency.

---

## 10. Shipping Verification — Shiprocket (`SIMULATED`)

- **File Location:** [`services/api/src/services/shiprocket-service.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts) (not `shiprocket-client.ts`).
- **AWB Creation (`SIMULATED`):** `createShiprocketAwbShipment()` (`lines 12–49`) creates deterministic in-memory shipment records (`SR-ORD-...`, `SR-SHP-...`, `SRMRS...IN`). It makes **no HTTP requests** to `apiv2.shiprocket.in`.
- **Pincode Serviceability (`SIMULATED`):** `GET /api/shipping/serviceability` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2304-L2335)) checks `/^\d{6}$/` and returns static courier options (`2` days for `400xxx` Mumbai pincodes, `4` days otherwise).
- **Shiprocket Webhook (`NOT IMPLEMENTED`):** `POST /api/webhooks/shiprocket` does not exist in `app.ts`.

---

## 11. Security Verification (`PARTIALLY IMPLEMENTED`)

| Security Mechanism | Actual Implementation in Code | Classification |
|---|---|---|
| **Admin Password Hashing** | `crypto.createHash('sha256').update('mrs_salt_' + password).digest('hex')` in [`data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts#L433-L435). `bcryptjs` is **not** used. | `PARTIALLY IMPLEMENTED` |
| **Seeded Admin Credentials** | `owner@mangalroyalstudio.com` / `<set via MRS_SEED_OWNER_PASSWORD>`<br>`manager@mangalroyalstudio.com` / `<set via MRS_SEED_MANAGER_PASSWORD>`<br>`pricing@mangalroyalstudio.com` / `<set via MRS_SEED_PRICING_PASSWORD>`<br>*(Also accepts legacy test passwords `MangalOwner!2025`, `MangalManager!2025`, `MangalPricing!2025` in [`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L141-L145))* | `VERIFIED` |
| **Customer Login Password Check** | `POST /api/auth/customer/login` ([`app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1688-L1721)) looks up customer by email and **never verifies `passwordHash`**. | `NOT IMPLEMENTED` (Bug) |
| **JWT Signing & Verification** | Custom HMAC-SHA256 JWT implementation (`signAdminToken` / `verifyAdminToken`) in [`auth.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/middleware/auth.ts#L24-L62) with 24h expiry. | `VERIFIED` |
| **Dev Header Auth Bypass** | [`auth.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/middleware/auth.ts#L77-L92) accepts `x-mrs-admin-role` header without a token and without checking `NODE_ENV`. | `PARTIALLY IMPLEMENTED` (Security Risk) |
| **Refresh Token Rotation** | `RefreshToken` model exists in `schema.prisma`, but no endpoints or logic exist in `auth.ts` or `app.ts`. | `NOT IMPLEMENTED` |
| **RBAC Permission Enforcement** | `requirePermission()` and `requireOwnerRole()` in [`auth.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/middleware/auth.ts#L100-L130) enforce 18 granular permissions across `OWNER`, `MANAGER`, and `PRICING_OPERATOR`. Tested in `app.test.ts`. | `VERIFIED` |
| **Helmet & Rate Limiting** | Neither `helmet` nor `express-rate-limit` is installed or used in `app.ts`. `app.use(cors())` allows all origins. | `NOT IMPLEMENTED` |
| **Audit Logging** | `dbStore.addAuditLog()` is called on login, rate updates, pricing preview/validate/approve/publish, product create/update/delete, inventory adjust, Excel import/rollback, shipment creation, settings update, and refunds. | `VERIFIED` |

---

## 12. Testing & Build Results (`VERIFIED`)

### 12.1 Automated Tests (`npm test` — Vitest `v2.1.9`)
- **`packages/shared/src/pricing-engine.test.ts` (3 tests — PASS):**
  1. `calculates 18K Gold + multi-component Diamond + PER_GRAM_NET making + 3% GST accurately` (`3.5g × ₹5,800 = ₹20,300` metal + `₹27,600` diamonds + `₹4,200` making + `₹600` cert/hallmark = `₹52,700` subtotal + `₹1,581` GST = `₹54,281.00`)
  2. `derives net metal weight from gross weight minus stone weight when GROSS_MINUS_STONE_WEIGHT is active` (`2.200g` gross - `0.200g` stone = `2.000g` net)
  3. `supports INR rounding modes accurately` (`NEAREST_1`, `NEAREST_10`, `NEAREST_100`, `NEAREST_99`)
- **`services/api/src/app.test.ts` (7 tests — PASS):**
  1. `returns health status and architecture verification on GET /health`
  2. `enforces RBAC permissions between PRICING_OPERATOR and OWNER on repricing runs`
  3. `parses the 11-sheet MANGAL JEWELLERY.xlsx workbook in DRY_RUN mode and generates CSV error report`
  4. `verifies Shopify webhook HMAC signatures and rejects forged payloads`
  5. `validates all 296 records in MANGAL JEWELLERY.xlsx across 11 sheets via /api/v1/admin/imports/excel` (`totalRows: 296`, `validRows: 294`, `failedRows: 2`, `duplicateSkus: 1`)
  6. `supports Product CRUD, active-order deletion protection, and Inventory stock movement logs`
  7. `handles Cart, Discount Code, Checkout Order Creation, Oversell Protection, Razorpay Verification, and Refunds`
  *(Note: Test #7 in `app.test.ts` only tests a valid/accepted Razorpay verification call; it does not test a forged Razorpay signature.)*

### 12.2 TypeScript & Production Build (`npm run typecheck` & `npm run build`)
- `@mrs/shared`: `tsc -p tsconfig.json` — **PASS**
- `@mrs/api`: `tsc -p tsconfig.json` — **PASS**
- `@mrs/admin`: `next build` (1 static route `/`) — **PASS**
- `@mrs/storefront`: `next build` (19 routes: 16 static `○`, 3 dynamic `ƒ`) — **PASS**

---

## 13. Summary of Incorrect Documentation Claims Corrected in This Audit

| Document | Previous Inaccurate Claim | Verified Reality Corrected in Documentation |
|---|---|---|
| `DATABASE_SCHEMA.md` & `MASTER_PROGRESS.md` | Claimed 35 Prisma models and `@db.Decimal(12, 2)` / `@db.Decimal(8, 3)`; implied API uses PostgreSQL at runtime. | `schema.prisma` has **40 models** using `@db.Decimal(14, 2)` / `@db.Decimal(14, 4)` / `@db.Decimal(10, 3)`. Migration SQL is generated, not applied; runtime API uses `data-store.ts` (`.data/platform-state.json`). |
| `ADMIN_MODULES.md` | Claimed port `3000`, separate route files (`/login`, `/products`, `/pricing`, `/imports`, `/orders`, `/customers`, `/reports`, `/settings`), `AdminShell.tsx`, and password `MangalOwner@2026!`. | Runs on port **`3001`** as a single-page app (`apps/admin/src/app/page.tsx`) with 19 state-switched modules. Owner password is `<set via MRS_SEED_OWNER_PASSWORD>` (`<set via MRS_SEED_MANAGER_PASSWORD>`, `<set via MRS_SEED_PRICING_PASSWORD>`). |
| `STOREFRONT_MIGRATION.md` | Claimed port `3001`, `#1A1A1A` charcoal / `#FAF7F2` cream / `#2C1810` espresso palette, `4/5` aspect ratio, and `mrs-*` Liquid filenames. | Runs on port **`3000`**, uses `#7D132A` / `#7A1023` burgundy & `#F8E1CF` / `#FBE8DB` peach palette, `285/397` aspect ratio, and maps to actual theme files (`announcement-bar.liquid`, `shop-by-catogory.liquid`, `testimonals.liquid`, etc.). |
| `PRODUCT_IMPORT_REPORT.md` | Claimed `MRS-RNG-ERR-WEIGHT` was row 41 (`2.10g < 2.85g`) and duplicate `MRS-RNG-101` was on sheet `Rings` row 42. | `MRS-RNG-ERR-WEIGHT` is on sheet `Rings` Excel row 43 (`Gross 3.2g < Net 4.1g`), and duplicate `MRS-RNG-101` is on sheet `Antique` Excel row 23. |
| `PRICING_ENGINE.md` | Claimed `precision: 20`, formula string `MRS-PRICING-V1.0.0`, modes `FLAT_FEE`/`SLAB_BASED`, and `NEAREST_RUPEE`/`CEIL_RUPEE`. | `pricing-engine.ts` uses `precision: 28`, integer version `1`, modes `PER_GRAM_NET`, `PER_GRAM_GROSS`, `PERCENTAGE_OF_METAL`, `FLAT_PER_PIECE`, and rounding modes `NEAREST_1`, `NEAREST_10`, `NEAREST_99`, `NEAREST_100`, `NONE`. |
| `PAYMENT_INTEGRATION.md` | Claimed `services/api/src/services/razorpay-service.ts`, route `/api/v1/storefront/checkout/create-order`, and `IntegrationEvent` idempotency. | Handled in `app.ts` (`POST /api/checkout/create-order` & `POST /api/payments/razorpay/verify`) and `shiprocket-service.ts` (`verifyRazorpaySignature`). Documented non-prod signature bypass and missing webhook idempotency. |
| `SHIPPING_INTEGRATION.md` | Claimed `services/api/src/services/shiprocket-client.ts`, live `apiv2.shiprocket.in` auth, and `POST /api/v1/webhooks/shiprocket`. | Implemented in `shiprocket-service.ts` as a local simulation; `GET /api/shipping/serviceability` is simulated; `POST /api/webhooks/shiprocket` is not implemented. |
| `SECURITY.md` | Claimed `bcryptjs`, `helmet`, `express-rate-limit`, and `requireRole`. | Uses SHA-256 with static salt prefix, custom HMAC-SHA256 JWT (`requireAuth`, `requirePermission`, `requireOwnerRole`), and documents the customer login password bug, dev header bypass, and missing `helmet`/`express-rate-limit`. |
| `TESTING_REPORT.md` | Claimed Vitest `v3.0.7`, forged Razorpay signature test, and `409 PRODUCT_HAS_ACTIVE_ORDERS`. | Uses Vitest `v2.1.9`, in-memory `invokeApp` helper, tests Shopify HMAC rejection (not Razorpay forged signature), and error code is `409 PRODUCT_IN_ACTIVE_ORDER`. |
| `DEPLOYMENT.md` | Swapped Admin (`3000`) and Storefront (`3001`) ports and used mismatched env variable names (`PORT` instead of `API_PORT`, `NEXT_PUBLIC_API_URL` instead of `NEXT_PUBLIC_API_BASE_URL`). | Corrected ports (`storefront: 3000`, `admin: 3001`, `api: 4000`, `preview: 9292`) and aligned `.env` variable names with `.env.example` and source code. |

---

## 14. Missing & Simulated Implementations

1. **PostgreSQL Runtime Wiring (`NOT IMPLEMENTED` in API routes):** Prisma schema (`40` models) and SQL migration exist, but `services/api` reads/writes `.data/platform-state.json` via `dbStore`.
2. **Visual Storefront Parity Gaps (`PARTIALLY IMPLEMENTED`):** `apps/storefront` needs a section-by-section visual alignment pass against `jewellery-theme-backup` / `http://127.0.0.1:9292` (fixing Shop by Shape 7 shapes, Hero slideshow controls, Bestseller carousel controls, Testimonials carousel, and exact CSS spacing/typography).
3. **Security Hardening (`PARTIALLY IMPLEMENTED`):**
   - Enforce password verification in `POST /api/auth/customer/login`.
   - Remove `process.env.NODE_ENV !== 'production'` signature bypass in `POST /api/payments/razorpay/verify` and use `crypto.timingSafeEqual`.
   - Restrict `x-mrs-admin-role` header in `auth.ts` or require a valid JWT token.
   - Record webhook events in `dbStore.integrationEvents` for idempotency in `/api/webhooks/shopify` and `/api/webhooks/razorpay`.
4. **Admin UI CRUD Forms (`PARTIALLY IMPLEMENTED`):** Add UI modals/forms in `apps/admin/src/app/page.tsx` for Product Create/Edit/Delete, Inventory Stock Adjustment, Order Refunds/Invoices, Import File Upload/Rollback, and Store Settings Save (the backend endpoints for these already exist).
5. **External Gateway Live Calls (`SIMULATED`):** Shopify GraphQL Admin mutations, Razorpay order creation, and Shiprocket AWB creation run in local simulation mode unless live credentials and HTTP client calls are enabled.

---

## 15. Recommended Next Development Priorities

1. **Priority 1 — Visual Comparison & Pixel-Accurate Storefront Alignment (Next Major Task):**
   - Compare `apps/storefront` (`http://localhost:3000`) side-by-side with the original Shopify theme preview (`http://127.0.0.1:9292`) and `jewellery-theme-backup/` across all 13 Homepage sections, Product Cards, PDP, Collection page, About Us, Contact, Cart, and Footer, fixing every visual discrepancy.
2. **Priority 2 — Security & Validation Fixes in `@mrs/api`:**
   - Fix customer password verification on `POST /api/auth/customer/login`.
   - Fix Razorpay signature verification on `POST /api/payments/razorpay/verify` so invalid signatures are rejected in tests and dev unless explicitly signed with the test secret.
   - Add webhook idempotency tracking via `dbStore.integrationEvents`.
   - Fix Excel import rollback (`POST /api/admin/imports/:jobId/rollback`) to update `job.status` and guard against rolling back `DRY_RUN` jobs.
3. **Priority 3 — Wire Remaining Admin UI Controls to Existing Backend Endpoints:**
   - Connect `apps/admin/src/app/page.tsx` UI controls for Product Create/Delete, Inventory Adjust, Order Refund/Invoice, Import Rollback, and Settings Save.
4. **Priority 4 — PostgreSQL Database Migration & Prisma Repository Layer (When PostgreSQL Instance is Available):**
   - Apply `services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql` to PostgreSQL and connect Prisma queries.

