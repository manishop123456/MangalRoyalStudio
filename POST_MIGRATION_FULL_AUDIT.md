# MANGAL ROYAL STUDIO — COMPLETE POST-MIGRATION TECHNICAL RE-AUDIT (`POST_MIGRATION_FULL_AUDIT.md`)

**Audit Date:** November 7, 2026  
**Target Environment:** MacBook Retina (12-inch, 2017) — Intel Core m3-7Y32 CPU @ 1.10 GHz (1.2 GHz nominal), 8 GB RAM, macOS Ventura 13.7.8 (Build `22H730`)  
**Runtime Toolchain:** Node.js `v26.13.0` (via NVM), npm `11.20.0`  
**Audit Scope:** Full-stack monorepo (`@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront`), Shopify themes (`jewellery-theme-backup`, `apps/shopify-theme`), Prisma schema & migrations (`services/api/prisma`), and all 28 root documentation files.  
**Audit Mode:** Strict Read-Only Code, Build & Runtime Verification (Zero application source code or configuration files modified).

---

## 1. Executive Summary

Mangal Royal Studio has been migrated from a Windows development environment (`C:\Users\manis\...`) to macOS Ventura 13.7.8 on an Intel MacBook Retina 2017. All four npm workspaces (`@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront`) pass TypeScript strict compilation (`npm run typecheck`), automated tests (`npm test` — 10/10 passing), and production builds (`npm run build` — Next.js 15.5.29 static/dynamic compilation).

However, a deep-dive line-by-line inspection reveals a sharp divide between **local prototype/demo readiness (~68%)** and **production e-commerce readiness (~38%)**:

1. **Mac Migration Defects:**
   - The `.git` repository directory was lost during migration (`fatal: not a git repository`).
   - `node_modules` was copied from Windows and only partially updated on macOS: `@prisma/engines` and `.prisma/client` contain **only Windows binaries** (`query_engine-windows.dll.node`, `schema-engine-windows.exe`) and lack macOS Darwin (`darwin`) query/schema engines.
   - PostgreSQL (`psql`, `postgres`, `pg_isready`) and Homebrew (`brew`) are not installed on this Mac, and no `.env` file exists (only `.env.example`).
   - Node.js (`v26.13.0`) resides exclusively inside `~/.nvm/versions/node/v26.13.0/bin` and is missing from non-interactive GUI/IDE shells unless `PATH` is exported.
2. **Critical Security & Persistence Blockers:**
   - The Express API (`services/api`) does **not** use PostgreSQL or Prisma at runtime (`0` imports of `@prisma/client`). All runtime data is stored via `fs.writeFileSync` in `.data/platform-state.json` (`services/api/src/store/data-store.ts`), which has split into two separate files (`/.data/platform-state.json` at 70 KB and `/services/api/.data/platform-state.json` at 2.62 MB / 85,083 lines) due to `process.cwd()` path resolution.
   - Multiple **P0 authentication and payment bypasses** are active in production code: an unguarded `x-mrs-admin-role` header grants instant `OWNER` access without a token (`services/api/src/middleware/auth.ts:76-92`), hardcoded legacy passwords unlock any admin account (`services/api/src/app.ts:141-150`), customer login (`POST /api/auth/customer/login`, `app.ts:1688-1721`) never verifies passwords, Razorpay verification accepts any signature prefixed with `sig_verified_` even in production (`app.ts:2082-2085`), and `apps/admin` embeds plaintext admin passwords in the client bundle (`apps/admin/src/app/page.tsx:105-109`).
3. **Admin Dashboard & Storefront Status:**
   - `apps/admin` (`page.tsx`, 2,407 lines) actually contains **19 modules** (not 14), but only 5 modules have mutation forms; 14 modules are read-only or disconnected from existing backend endpoints. Several interactive features are broken (e.g., Excel Import has no `<input type="file">`, Error CSV download fails with `401 UNAUTHORIZED`, Diamond Rate updates overwrite the matrix with a `0.01–5.00 ct` catch-all slab, and Analytics inflates valuation on zero-stock items).
   - `apps/storefront` has progressed from the earlier single-page view-state prototype into a **multi-route Next.js App Router application** (19 routes), with working Mobile Navigation Drawer, Cart Drawer, PDP Lightbox, and Live Price Breakup. However, major visual and functional discrepancies remain against the original Shopify Dawn 15.5.0 theme (`jewellery-theme-backup`), including static grids instead of carousels (Hero Slideshow, Bestsellers, Shop by Category, Trust Bar, Shop by Price, Testimonials), missing custom font files (`Battlemade`, `Begum`, `Gotham`), missing About Us sections (Brand Promise 5-image collage and 6 Mangal Group sister company cards), and desktop inline padding (`70px`) that squeezes mobile viewports.

---

## 2. Current Project Structure & Historical Audit Re-Verification

### 2.1 Workspace & Directory Layout

```text
mangalroyalstudio/
├── .data/platform-state.json                 # Root runtime JSON state (70 KB, 1,957 lines)
├── .env.example                              # Template env file (53 lines; no .env exists)
├── MANGAL JEWELLERY.xlsx                     # Sample 11-sheet, 296-row Excel workbook (388 KB)
├── package.json & package-lock.json          # Root npm workspaces config
├── jewellery-theme-backup/                   # Read-only original Shopify Dawn 15.5.0 theme (378 files)
├── apps/
│   ├── shopify-theme/                        # Working Shopify Liquid theme copy (382 files)
│   ├── admin/                                # Next.js 15 Admin Dashboard on port 3001 (6 source files)
│   └── storefront/                           # Next.js 15 Customer Storefront on port 3000 (28 source files)
├── packages/
│   └── shared/                               # Shared TypeScript types, Zod schemas & Decimal.js Pricing Engine
└── services/
    └── api/                                  # Express 4 TypeScript Backend API on port 4000 + Prisma schema
        ├── .data/platform-state.json         # Workspace runtime JSON state (2.62 MB, 85,083 lines)
        ├── prisma/schema.prisma              # 40 relational models + 1 enum (RoleName)
        ├── prisma/migrations/                # 1 SQL migration (1,007 lines, unapplied)
        └── src/                              # Express app, middleware, services, scripts, tests
```

### 2.2 Re-Verification of All 22 Previous Windows Audit Claims

Every claim from Section 2 of the prompt was independently re-verified against the current files on macOS:

| # | Previous Windows Audit Claim | Current Mac Codebase Reality | Verification Status | Evidence |
|---|---|---|---|---|
| 1 | Original Shopify theme backup: 378 files | **378 files** (`377` theme files + `1` `AGENTS.md`). | **VERIFIED TRUE** | `jewellery-theme-backup/` directory traversal |
| 2 | Working Shopify theme: 382 files | **382 files** (`AGENTS.md` removed; 5 files added: `sections/main-wishlist.liquid`, `sections/order-tracking.liquid`, `snippets/product-price-breakup.liquid`, `templates/page.order-tracking.json`, `templates/page.wishlist.json`). | **VERIFIED TRUE** | `apps/shopify-theme/` directory traversal |
| 3 | Prisma schema: 40 models and `RoleName` enum | **40 `model` blocks** and **1 `enum RoleName`** (`OWNER`, `MANAGER`, `PRICING_OPERATOR`). | **VERIFIED TRUE** | [schema.prisma](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/prisma/schema.prisma#L14-L758) |
| 4 | Database migration generated but not applied to a real PostgreSQL database | 1 SQL migration (`1,007` lines) exists on disk; PostgreSQL is not installed on this Mac and the migration has never been applied. | **VERIFIED TRUE** | [migration.sql](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql#L1-L1007) |
| 5 | API currently uses JSON file-based persistence through `data-store.ts` | `DataStore` reads/writes `.data/platform-state.json` via `fs.readFileSync` / `fs.writeFileSync`. | **VERIFIED TRUE** | [data-store.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/store/data-store.ts#L1803-L1879) |
| 6 | Prisma is not yet integrated into the API runtime | Zero imports or usages of `@prisma/client` exist anywhere in `services/api/src/`. | **VERIFIED TRUE** | `services/api/src/` full search |
| 7 | Authentication uses custom HMAC-SHA256 tokens | Custom 2-part token `base64url(payload).base64url(hmac)` signed with `crypto.createHmac('sha256', JWT_SECRET)`. | **VERIFIED TRUE** | [auth.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts#L24-L66) |
| 8 | Password hashing uses salted SHA-256 instead of bcrypt | `crypto.createHash('sha256').update('mrs_salt_' + password).digest('hex')` with static hardcoded salt. | **VERIFIED TRUE** | [data-store.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/store/data-store.ts#L433-L435) |
| 9 | Customer login password verification was incomplete | `POST /api/auth/customer/login` looks up the customer by email and **never checks `customer.passwordHash`**. | **VERIFIED TRUE** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1688-L1721) |
| 10 | Unauthenticated `x-mrs-admin-role` development header bypass existed | `requireAuth` checks `req.headers['x-mrs-admin-role']` and grants full role access without a Bearer token or `NODE_ENV` check. | **VERIFIED TRUE** | [auth.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts#L76-L92) |
| 11 | Razorpay verification contained a development bypass | Accepts `razorpaySignature.startsWith('sig_verified_') \|\| process.env.NODE_ENV !== 'production'`. | **VERIFIED TRUE** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2082-L2085) |
| 12 | Shiprocket integration was simulated rather than connected to real API | `createShiprocketAwbShipment()` fabricates IDs (`SRMRS...IN`) in memory; zero HTTP calls are made. | **VERIFIED TRUE** | [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L12-L49) |
| 13 | Admin dashboard was a single-page application with 14 modules | Still a single-page app in `apps/admin/src/app/page.tsx`, but it actually implements **19 modules** (`ADMIN_MODULES` length = 19), not 14. | **CHANGED (19 MODULES)** | [apps/admin/src/app/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L47-L67) |
| 14 | Storefront was a single-page application with a view-state system | **No longer a single-page view-state app.** Refactored into **19 Next.js App Router route pages** wrapped by `StorefrontShell.tsx`. | **CHANGED (MULTI-PAGE APP ROUTER)** | [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx#L1-L892) |
| 15 | Excel importer processed 11 sheets and 296 rows | Processes 11 sheets and 296 rows in `MANGAL JEWELLERY.xlsx`. | **VERIFIED TRUE** | [excel-importer.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/excel-importer.ts#L24-L41) |
| 16 | 294 rows were valid and 2 intentionally invalid | 294 valid rows + 2 intentional error rows (`MRS-RNG-ERR-WEIGHT` on `Rings` row 43; duplicate `MRS-RNG-101` on `Antique` row 23). | **VERIFIED TRUE** | [generate-sample-excel.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/scripts/generate-sample-excel.ts#L362-L375) |
| 17 | Import rollback had incomplete safeguards | `POST /api/admin/imports/:jobId/rollback` does not check if `job.dryRun` was true, does not check active orders, and does not update `job.status`. | **VERIFIED TRUE** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1596-L1631) |
| 18 | 10 tests passed in the previous audit | **10/10 tests pass** (`3` in `@mrs/shared` + `7` in `@mrs/api`). | **VERIFIED TRUE** | `npm test` execution output |
| 19 | TypeScript checks and production builds passed | `npm run typecheck` (0 errors) and `npm run build` (all 4 workspaces) pass on macOS. | **VERIFIED TRUE** | `npm run typecheck` & `npm run build` |
| 20 | Visual discrepancies: missing slideshow controls, incomplete product shape selection, missing mobile nav, missing carousel controls | Mobile nav drawer is now implemented (`StorefrontShell.tsx:419-518`), and PDP shape selector exists (`products/[handle]/page.tsx:210-241`), but homepage `Shop by Shape` omits `Cushion` and adds `Radiant`/`Marquise`, and **all slideshow/carousel controls remain missing**. | **PARTIALLY CHANGED** | [apps/storefront/src/app/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L9-L18) |
| 21 | Previous audit identified 13 documentation files plus a code verification audit | There are **28 Markdown documentation files** in the root directory (the 13 Milestone-16 docs + `CODE_VERIFICATION_AUDIT.md` + 14 earlier phase/audit docs). | **CHANGED (28 MD FILES TOTAL)** | Root directory listing |

---

## 3. Mac Migration Verification

**System Verified:**
- **OS:** macOS Ventura `13.7.8` (Build `22H730`)
- **CPU:** `Intel(R) Core(TM) m3-7Y32 CPU @ 1.10GHz` (2 physical cores / 4 threads)
- **Memory:** `8,589,934,592` bytes (`8 GB` RAM)
- **Node.js / npm:** `v26.13.0` / `11.20.0` installed at `/Users/macbook/.nvm/versions/node/v26.13.0/bin`

### 3.1 Migration Findings Matrix

| Inspection Area | Status | Confidence | Evidence & Technical Details |
|---|---|---|---|
| **1. Git Repository Status** | **BROKEN / MISSING** | Verified (100%) | Running `git status` fails with `fatal: not a git repository (or any of the parent directories): .git`. The project was copied from Windows without its `.git` directory, leaving zero local version control history or rollback safety. |
| **2. Prisma Engine Compatibility (macOS Intel)** | **BROKEN** | Verified (100%) | `node_modules/@prisma/engines/` and `node_modules/.prisma/client/` contain **only Windows binaries** copied from the old machine (`query_engine-windows.dll.node`, `query_engine-windows.dll.node.tmp3456`, `schema-engine-windows.exe` dated Nov 5). No `darwin` query/schema engines exist on disk. Running `./node_modules/.bin/prisma -v` attempts to download `darwin/schema-engine.gz`. |
| **3. PostgreSQL & Homebrew Availability** | **MISSING** | Verified (100%) | `which psql postgres brew pg_isready` returns `not found` for all four binaries. No local PostgreSQL server is installed on this Mac. |
| **4. Environment Variable Files (`.env`)** | **MISSING** | Verified (100%) | Only `.env.example` exists in the workspace root; no `.env` or `.env.local` exists in root, `services/api`, `apps/admin`, or `apps/storefront`. Also, `services/api` does not install or call `dotenv`, so even if a `.env` file is created, `services/api` will not load it unless started with `node --env-file=.env` or `tsx --env-file=.env`! |
| **5. Windows Hardcoded Links in Docs** | **BROKEN LINKS** | Verified (100%) | All root Markdown files (`ADMIN_MODULES.md`, `MASTER_PROGRESS.md`, `CODE_VERIFICATION_AUDIT.md`, etc.) contain hardcoded Windows `file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/...` links that do not resolve on macOS. |
| **6. NVM PATH in Non-Interactive Shells** | **RISK** | Verified (100%) | `node` and `npm` are installed in `/Users/macbook/.nvm/versions/node/v26.13.0/bin` and are not symlinked into `/usr/local/bin`. GUI tools, IDE task runners, or launchd scripts that do not source `~/.zshrc` / `nvm.sh` fail with `command not found: node`. |
| **7. Native Dependencies (`swc`, `esbuild`, `rollup`)** | **WORKING** | Verified (100%) | `npm install` on Nov 7 15:00 installed macOS Intel (`darwin-x64`) optional packages: `node_modules/@next/swc-darwin-x64`, `node_modules/@esbuild/darwin-x64`, and `node_modules/@rollup/rollup-darwin-x64`. |
| **8. `node_modules/.bin` Executable Permissions** | **WORKING (WITH ARTIFACTS)** | Verified (100%) | Unix scripts in `node_modules/.bin` (`next`, `tsc`, `tsx`, `vitest`, `prisma`) have `-rwxrw-rw-` (`0766`, owner-executable, group/world writable) alongside leftover Windows `.cmd` and `.ps1` wrappers from the Windows copy. A clean `rm -rf node_modules && npm ci` has not been performed. |
| **9. CRLF Line Endings** | **MINOR** | Verified (100%) | Only 1 application file (`apps/admin/next-env.d.ts`), 13 Liquid section files in `jewellery-theme-backup/sections/`, and several files in `node_modules/` have `CRLF` line terminators. All `.ts`/`.tsx` source files in `apps/`, `packages/`, and `services/` use `LF`. |
| **10. Case-Sensitive & Windows Paths in Code** | **CLEAN** | Verified (100%) | Zero Windows backslash paths or case-mismatched imports exist in `packages/shared`, `services/api`, `apps/admin`, or `apps/storefront`. `path.resolve` / `path.join` are used in `services/api`. |
| **11. Hardware & Performance on 2017 Core m3 / 8GB RAM** | **HIGH CONCERN** | Verified (100%) | Running two Next.js 15 dev servers (`apps/storefront` on 3000, `apps/admin` on 3001), the Express API (`services/api` on 4000), and the Liquid preview server (`9292`) concurrently on a dual-core Core m3-7Y32 (1.10 GHz) with 8 GB RAM causes heavy swap pressure and CPU throttling, compounded by `data-store.ts` synchronously stringifying a 2.62 MB JSON file on every API write. |

---

## 4. Verified Completed Features

The following features are **fully implemented in code and verified via tests or build execution**:

1. **Shared Decimal.js Jewellery Pricing Engine Core (`packages/shared/src/pricing-engine.ts:1-338`):**
   - High-precision (`precision: 28`, `ROUND_HALF_UP`) calculation of metal value (`24K`, `22K`, `18K`, `14K`, `925_SILVER`, `950_PLATINUM`), net weight derivation (`EXPLICIT_NET_WEIGHT`, `GROSS_MINUS_STONE_WEIGHT`), 4 wastage modes, multi-component diamond pricing, 4 making charge modes, certification/hallmark fees, fixed adjustments, 5 INR rounding modes (`NEAREST_1`, `NEAREST_10`, `NEAREST_99`, `NEAREST_100`, `NONE`), and manual price overrides. Verified by 3 unit tests in `packages/shared/src/pricing-engine.test.ts`.
2. **11-Sheet Excel Importer Parser & Validator (`services/api/src/services/excel-importer.ts:1-488`):**
   - Parses all 11 Mangal Royal Studio sheets (`Rings`, `Earrings`, `Pendants`, `Necklaces`, `Bracelets`, `Bangles`, `Mangalsutra`, `Solitaires`, `Nose Pins`, `Chains`, `Antique`), validates SKU presence, title presence, SKU uniqueness (within workbook and against existing catalog), purity enum, positive gross/net weights, and `netWeight <= grossWeight`, computes preview prices for valid rows, and generates a downloadable CSV error report (`formatImportErrorsCsv`). Verified on 296 rows (`294` valid + `2` errors) by `services/api/src/app.test.ts`.
3. **Product CRUD & Active-Order Deletion Guard (`services/api/src/app.ts:1320-1477`):**
   - Creates products with live price calculation, blocks duplicate SKUs (`409 DUPLICATE_SKU`), and prevents deleting any SKU referenced in a non-cancelled order (`409 PRODUCT_IN_ACTIVE_ORDER`). Verified by `app.test.ts`.
4. **Inventory Adjustment & Movement Ledger API (`services/api/src/app.ts:1522-1593`):**
   - Supports `deltaQuantity` and `setQuantity` stock adjustments, prevents negative stock (`400 NEGATIVE_STOCK_FORBIDDEN`), and records `InventoryMovementRecord` entries (`RESTOCK`, `SALE_DEDUCTION`, `MANUAL_ADJUSTMENT`, `RETURN_RESTORE`, `CANCELLATION_RESTORE`). Verified by `app.test.ts`.
5. **Checkout Oversell Prevention, Stock Deduction & Purchase-Time Pricing Snapshot (`services/api/src/app.ts:1889-2055`):**
   - Recomputes line item prices on the server, blocks checkout when `inventoryQuantity < item.quantity` (`409 INSUFFICIENT_STOCK`), locks an immutable `PricingSnapshotRecord` per order line item, deducts inventory, validates coupons (`ENGAGEMENT10`, `ROYALMAKING0`), and generates GST tax invoices (`GET /api/orders/:orderId/invoice`). Verified by `app.test.ts`.
6. **Shopify Webhook HMAC-SHA256 Signature Verification (`services/api/src/services/shopify-service.ts:40-62`):**
   - Verifies `x-shopify-hmac-sha256` against raw request body using `crypto.timingSafeEqual` and rejects forged requests with `401 INVALID_WEBHOOK_SIGNATURE`. Verified by `app.test.ts`.

---

## 5. Partially Completed Features

1. **PostgreSQL & Prisma Database Layer (`services/api/prisma/schema.prisma`):**
   - 40 models and 1 initial SQL migration (`1,007` lines) are written, but Prisma is **not connected to `services/api` runtime**, Darwin engines are missing in `node_modules`, and PostgreSQL is not installed on the Mac.
2. **Authentication & RBAC (`services/api/src/middleware/auth.ts`):**
   - Custom HMAC-SHA256 JWT signing and `requirePermission` exist, but password hashing uses static-salt SHA-256 (`mrs_salt_`), customer login ignores passwords, `x-mrs-admin-role` bypasses auth in all environments, and `GET /api/admin/*` endpoints do not check role permissions.
3. **Next.js Storefront (`apps/storefront`):**
   - Multi-page App Router structure (19 routes), cart drawer, wishlist, search page, collection filters, PDP price breakup, and checkout UI exist, but homepage/collection/PDP layouts have numerous visual and structural discrepancies vs `jewellery-theme-backup`, carousels/slideshows are static grids, custom fonts are missing from `public/fonts/`, and offline fallback only has 8 products.
4. **Next.js Admin Dashboard (`apps/admin/src/app/page.tsx`):**
   - Renders 19 sidebar modules, but only 5 modules have mutation forms; 14 modules are read-only or disconnected from backend APIs, and there is no login screen (credentials are hardcoded in client code).
5. **Razorpay Payment Integration (`services/api/src/app.ts:2048-2130`):**
   - Signature verification logic and refund state transitions exist locally, but order creation (`order_MrsRzp...`) and refunds (`rfnd_MrsRzp...`) do not call Razorpay's API, client checkout does not load Razorpay `checkout.js`, verification has a `sig_verified_` bypass, and the Razorpay webhook (`app.ts:1160-1177`) only checks the signature without updating order state.

---

## 6. Features Not Implemented

1. **Live PostgreSQL Runtime Persistence (`services/api/src/`):** Zero Prisma client queries or database transactions in the API.
2. **Refresh Token Issuance & Rotation:** `RefreshToken` model exists in `schema.prisma:53`, but no refresh token logic exists in `services/api`.
3. **Customer Forgot/Reset Password & Account Address Management:** No API routes or storefront pages (`/account/addresses`, `/account/orders/[id]`, password reset).
4. **Live Shiprocket API Integration:** Zero HTTP calls to Shiprocket (`shiprocket-service.ts` is 100% in-memory string generation); no `/api/webhooks/shiprocket` endpoint; no shipment cancellation on order cancel.
5. **Live Razorpay SDK / Orders & Refunds API Calls:** Zero HTTP calls to `api.razorpay.com`; no payment failure (`payment.failed`) stock-restoration handler.
6. **Live Shopify Admin GraphQL Price/Product Sync:** `syncApprovedPricesToShopify()` (`shopify-service.ts:64-92`) only builds a dry-run GraphQL mutation string in memory and never executes `fetch()` against Shopify Admin API; `POST /api/admin/imports/:jobId/sync-shopify` (`app.ts:961-994`) only flips a status string.
7. **Cloudinary / Media Upload Integration:** No Cloudinary SDK, credentials, or image upload endpoints exist anywhere in the codebase.
8. **Admin CRUD Endpoints for Categories, Discounts, Banners, Content, and Admin Users:** Backend only provides `GET` routes for these entities (`app.ts:426, 999-1009, 1075`).
9. **API Security Hardening (`helmet`, `express-rate-limit`, structured logging):** Not installed or configured.

---

## 7. Storefront Issues (`apps/storefront` vs `jewellery-theme-backup`)

### 7.1 Visual, Structural & Functional Discrepancies

| # | Area / Section | Original Shopify Theme (`jewellery-theme-backup`) | Current Next.js Storefront (`apps/storefront`) | Severity | Evidence (`apps/storefront`) |
|---|---|---|---|---|---|
| **SF-01** | **Custom Brand Fonts** | Loads `Battlemade` (`400`), `Begum` (`400`, `600`), and `Gotham` (`400`, `500`, `700`). | `apps/storefront/public/fonts/` is **empty (0 files)**. `globals.css:1-24` only loads Google Fonts (`Allura`, `Great Vibes`, `Cormorant Garamond`, `Inter`, `Lato`), falling back unless custom fonts are installed locally on the user's OS. | **High** | [globals.css](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/globals.css#L1-L24) |
| **SF-02** | **Hero Slideshow** | 2-slide interactive `<slideshow-component>` (`templates/index.json:12-102`) with bottom-left copy (`Fifty years of heritage...`), `0%` overlay, and `64px` circular prev/next buttons at `bottom: 60px; right: 70px`. | Single static `<img>` with altered copy (`Every creation is designed...`), dark left gradient overlay, vertically centered text, and **no prev/next slideshow buttons or slide state**. | **High** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L70-L91), [globals.css](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/globals.css#L496-L581) |
| **SF-03** | **Our Bestsellers Carousel** | 8-product interactive `<pc-carousel>` (`templates/index.json:103-163`) with eyebrow `"The most loved"`, left/right circular arrow buttons, 2-column mobile grid, and inline `"View All →"` link. | Static 4-product grid (`products.slice(0, 4)`), eyebrow `"Handpicked for you"`, **no carousel arrows**, 1-column mobile collapse below `520px`, and outlined box button `"Explore All Bestsellers"`. | **High** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L65-L134) |
| **SF-04** | **Shop by Shape** | 7 borderless shapes in `templates/index.json:164-257`: `Round`, `Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart` with `80x80px` icons and white subtitle `"Crafter for you"`. | 8 bordered box cards (`Round`, `Heart`, `Radiant`, `Princess`, `Pear`, `Oval`, `Marquise`, `Emerald`) — **omits `Cushion`**, adds `Radiant`/`Marquise` (which match 0 fallback products and aren't in the collection filter dropdown!), uses `54x54px` icons and `"Pick your perfect cut"`. | **High** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L9-L18), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L136-L220) |
| **SF-05** | **Shop by Category** | 7 categories in a single horizontal flex row (`.sbc__row`, `sections/shop-by-catogory.liquid:196-209`) with alternating `-48px` vertical offsets on items 2, 4, 6 (`Bracelets`, `Bangles`, `Necklaces`), centered `16px` Gotham labels, and mobile scroll-snap carousel. | 4-column CSS grid (`grid-template-columns: repeat(4, 1fr)`, leaving an empty 4th slot on row 2), no alternating vertical offset, `26px` uppercase serif labels with bottom border + arrow icon, and no mobile carousel. | **High** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L20-L28), [globals.css](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/globals.css#L586-L662) |
| **SF-06** | **Brand Story Section** | White `#ffffff` background (`templates/index.json:455`), `114px` `#190303` script `"Build for today."`, single paragraph, no CTA button (`show_button: false`), and scroll-reveal animations. | Peach `#FBE8DB` background, `88px` `#7D132A` script, two rewritten paragraphs, and an added `"Discover Our Story"` burgundy CTA button. | **Medium** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L250-L351) |
| **SF-07** | **Trust Bar** | Horizontal flex items with `26x26px` custom stroke SVG icons (`certificate`, `exchange`, `shipping`, `resizing`) on the left, Gotham headings, and a continuous `@keyframes tb-marquee-scroll` on mobile (`sections/trust-bar.liquid:115-238`). | Centered text with **zero SVG icons**, serif headings in `#F8E1CF`, and vertical stacking on mobile instead of infinite marquee scroll. | **Medium** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L353-L404) |
| **SF-08** | **Shop by Price** | `1/1` square images (which already contain price text in the image artwork) with no HTML overlay, `28px` `#7d132a` bottom strip (`UNDER ₹15K`, etc.), and draggable carousel + mobile pagination dots (`sections/shop-by-price.liquid`). | `285/380` aspect ratio with a dark gradient + duplicate HTML text overlaid on top of the baked-in image text, static grid, and no carousel/dots. | **Medium** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L406-L479) |
| **SF-09** | **Why Lab Grown & Testimonials** | Why Lab Grown has `40x40px` custom SVG icons (`flower`, `leaf`, `gem`) and `"Shop now"`. Testimonials (`sections/testimonals.liquid`) has `"Loved by families"`, top-right Prev/Next circular arrows, 5s autoplay sliding track, and bold review titles. | Why Lab Grown omits icons and uses numbered titles (`01.`, `02.`, `03.`). Testimonials renders 3 static cards with **no Prev/Next buttons, no review title headings, and no carousel**. | **Medium** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L523-L651) |
| **SF-10** | **Header & Footer Layout** | Header has desktop dropdown menus (`header-group.json:52`) and centered mobile logo (`130px`). Footer (`footer-group.json:14-149`) has centered `"Join the mailing list"` newsletter, a 5th **Social** column (`Instagram`, `LinkedIn`, `Facebook`), hidden desktop column headings, and mobile footer accordions. | Header has flat links (no dropdowns) and left-aligned mobile logo (`110px`). Footer has side-by-side `"Join The Royal Circle"`, **omits Social links completely**, shows desktop column headings, and lacks mobile accordions. | **Medium** | [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx#L265-L349), [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx#L748-L888) |
| **SF-11** | **Product Detail Page (PDP)** | 2-column asymmetric 4-media collage (`main-product.liquid:101-132`), sticky right column, quantity `[ - | 1 | + ]` selector, 2×2 `.pp-meta-grid`, 4 `<details>` accordions (`Descriptions`, `Care instructions`, `Shipping`, `Returns & cancellations`), followed by Trust Bar, Our Bestsellers, and Physical Store CTA (`templates/product.json:352-359`). Invalid handle returns 404. | Single main image + 4 thumbnails, non-sticky right column, **no quantity selector**, **no 2×2 meta grid**, **none of the 4 product accordions**, **omits Trust Bar**, replaces Bestsellers with `YOU MAY ALSO LOVE`, adds About Us's `READY TO FIND YOUR FOREVER PIECE?`, and silently falls back to `products[0]` on invalid product URLs! | **High** | [products/[handle]/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/products/%5Bhandle%5D/page.tsx#L21-L653) |
| **SF-12** | **About Us Page (`/pages/about-us`)** | 6 distinct editorial sections in `templates/page.about-us.json` (`749` lines), including Section 4 (`visionaries-editorial-collage-fixed.liquid` — 5-image Brand Promise collage) and Section 5 (`mangal-group-legacy.liquid` — 6 Mangal Group sister company cards). | Only 4 simplified sections (`157` lines) — **completely omits Section 4 (Brand Promise 5-Image Collage) and Section 5 (The Mangal Group 6 Sister Companies)**, omits Core Values SVG icons/mobile slider, and replaces Section 1's 2-column split with a dark banner. | **High** | [pages/about-us/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/pages/about-us/page.tsx#L1-L157) |
| **SF-13** | **Mobile Inline Padding Overflow** | Responsive CSS media queries reduce horizontal padding to `18px–20px` on mobile (`<=749px`). | Hardcoded React inline styles (`padding: '70px 70px'` on Bestsellers `page.tsx:98`, `'64px 70px 90px'` on Shop by Price `page.tsx:411`, `'90px 70px'` + `minmax(340px, 1fr)` on Why Lab Grown `page.tsx:527-535`, and `minmax(360px, 1fr)` on PDP `products/[handle]/page.tsx:79`) squeeze or overflow `375px` mobile screens. | **High** | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx#L98-L535), [products/[handle]/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/products/%5Bhandle%5D/page.tsx#L68-L79) |
| **SF-14** | **Account Sign-Out, Order Tracking & Search State Bugs** | Standard customer auth guards, query-param order lookup, and predictive search. | 1) On `/account` (`account/page.tsx:11-19`), `activeCustomer = customer \|\| { name: 'Ananya Sharma'... }` renders a hardcoded customer when logged out, so clicking `"Sign Out"` does nothing visually. 2) On `/pages/order-tracking` (`pages/order-tracking/page.tsx:6-8`), `?orderNumber=` URL query params from `/checkout` and `/account` are ignored. 3) On `/search` (`search/page.tsx:10-11`), searching again from the header modal while already on `/search` does not update `query` state. | **High** | [account/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/account/page.tsx#L11-L45), [pages/order-tracking/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/pages/order-tracking/page.tsx#L6-L8), [search/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/search/page.tsx#L10-L11) |

---

## 8. Admin Dashboard Issues (`apps/admin`)

### 8.1 Status of All 19 Implemented Admin Modules (`apps/admin/src/app/page.tsx`)

*(Note: All 19 modules reside inside a single 2,407-line file `apps/admin/src/app/page.tsx`.)*

| # | Module ID | Module Name | Lines (`page.tsx`) | Working Features | Broken / Missing Features & API Mismatches |
|---|---|---|---|---|---|
| 01 | `overview` | Overview Dashboard | 1021–1169 | 4 KPI cards, Metal Rate table, quick module switcher buttons. | "Paid Order Revenue" sums all orders including `PENDING`/`REFUNDED` (`line 1047`); discards `kpis`, `shopifyStatus`, `recentOrders`, `recentPricingRuns`, `recentAuditLogs` returned by `GET /api/admin/overview` (`lines 236-240`). |
| 02 | `products` | Product & Jewellery Specs | 1171–1342 | Search by SKU/title, category filter, specs table, bottom price breakup card. | Completely read-only: **no Create Product (`POST /api/admin/products`), Edit Spec (`PUT /api/admin/pricing/products/:sku/attributes`), or Delete Product (`DELETE /api/admin/products/:sku`) UI**. Breakup card omits diamond components & warnings. |
| 03 | `categories` | Category Management | 1344–1382 | Table of 11 categories with mapped Excel sheet names. | Read-only (no CRUD); Status badge hardcoded to `ACTIVE` (`line 1375`); `productCount` is static seed data that does not update after imports/product creation. |
| 04 | `inventory` | Inventory Management | 1384–1423 | Read-only stock table with low-stock badge (`<= 2`). | **Calls none of the 3 backend inventory endpoints** (`GET /api/admin/inventory`, `POST /api/admin/inventory/adjust`, `GET /api/admin/inventory/movements`). Cannot adjust stock or view stock movements. |
| 05 | `orders` | Order Management | 1989–2041 | Lists orders; generates simulated Shiprocket AWB for `UNFULFILLED` orders. | `financialStatus` badge is hardcoded green (`mrs-badge-success`, `line 2016`); **no order detail/line-item snapshot viewer, no Refund button (`POST /api/admin/orders/:id/refund`), no Cancel button (`POST /api/admin/orders/:id/cancel`), no GST Invoice button (`GET /api/orders/:id/invoice`)**. |
| 06 | `customers` | Customer Management | 2043–2082 | Read-only table of customers. | No search, tag filter, address viewer, or customer order history modal. |
| 07 | `pricing-engine` | Jewellery Pricing Engine | 1425–1674 | Live `Decimal.js` simulator; 4-step repricing run buttons (`Preview`, `Validate`, `Owner Approve`, `Publish`). | Step 2 (`Validate`) can be bypassed directly to `3. Owner Approve` (`line 1641`); **no SKU-level price delta or threshold violation viewer** before approving; no UI for `POST /api/admin/pricing/rules` or viewing `pricingSnapshots`; orphaned `simCertFee` state (`line 178`). |
| 08 | `gold-rates` | Gold & Metal Rates | 1676–1775 | Displays metal rates and submits rate updates (`POST /api/admin/rates/metals`). | Changing `editPurity` dropdown does not update `editMetalRateInr` (`'5820.00'`), risking overwriting Silver/24K with 18K rate (`lines 1720-1742`); no `min="0.01"` validation. |
| 09 | `diamond-rates` | Diamond Rate Matrix | 1777–1874 | Displays diamond rate matrix and submits new slab (`POST /api/admin/rates/diamonds`). | **Critical bug (`lines 646-655`):** Form lacks inputs for `sizeMinCarat`/`sizeMaxCarat` and hardcodes `0.010` to `5.000 ct`, prepending a catch-all slab at index 0 that shadows all specific sieve brackets! Dropdown only lists 5 of 13 diamond shapes. |
| 10 | `excel-import` | Bulk Excel/CSV Import | 1876–1987 | Triggers Dry-Run or Commit on server's default `MANGAL JEWELLERY.xlsx`; displays errors. | **No `<input type="file">` to upload a workbook (`lines 1888-1905`)**; `"⬇ Download Error CSV"` link (`line 1937`) fails with **`401 UNAUTHORIZED`** because it is an unauthenticated `<a href>`; no buttons for `sync-shopify` or `rollback`; `previewItems` not rendered. |
| 11 | `discounts` | Discount Management | 2164–2198 | Read-only coupon table. | Read-only (no CRUD in UI or API); `d.value` displayed without `%` or `₹` unit (`line 2188`). |
| 12 | `banners` | Banner Management | 2200–2230 | Read-only banner table. | Read-only (no CRUD in UI or API); Status badge hardcoded to `ACTIVE` (`line 2223`). |
| 13 | `content` | Content & Policies | 2232–2260 | Read-only content table. | Read-only (no CRUD in UI or API); Status badge hardcoded to `PUBLISHED` (`line 2253`). |
| 14 | `shipping` | Shipping (Shiprocket) | 2084–2126 | Lists shipments and AWB codes. | Label/Manifest links point to dead URLs (`https://shiprocket.co/labels/...`); status badge hardcoded green (`line 2111`); no pincode serviceability tool or tracking timeline drawer. |
| 15 | `payments` | Payment (Razorpay) | 2128–2161 | Read-only payment ledger table. | Hardcodes `HMAC VERIFIED` (`line 2153`, ignoring `p.signatureVerified`) and green status badge (`line 2154`); no Refund UI or refunds history table. |
| 16 | `analytics` | Reports & Analytics | 2262–2301 | Renders 3 KPI summary cards. | **Never calls `GET /api/admin/analytics` or `GET /api/admin/reports/export.csv`**; math bug `(p.inventoryQuantity \|\| 1)` (`lines 2274, 2287`) counts `0`-stock items as `1` unit; "Total Net Gold" sums Silver and Platinum weights too; fakes snapshot count when `0` (`line 2296`). |
| 17 | `users-roles` | Admin Users & RBAC | 2303–2340 | Renders static RBAC role table. | **Never calls `GET /api/admin/users`**; renders client-side `ROLE_CREDENTIALS` constant (`lines 2320-2336`). |
| 18 | `settings` | Store & API Settings | 2342–2367 | Renders 4 `readOnly` inputs. | **Never calls `GET /api/admin/settings` or `PUT /api/admin/settings`**; settings cannot be edited or saved (`lines 2342-2367`), and 15 of 19 setting fields are omitted. |
| 19 | `audit-logs` | Activity & Audit Logs | 2369–2402 | Chronological audit log table. | Flooded with bogus `AUTH_LOGIN` entries because `syncWithBackend` re-logs in on every refresh and mutation (`lines 192-199`); no filtering or `beforeData`/`afterData` diff inspector. |

### 8.2 Cataloged Admin Dashboard Issues (`ADM-001` to `ADM-023`)

| Issue ID | Module | Severity | Description | Evidence (File & Line) | Recommended Correction | Dependencies |
|---|---|---|---|---|---|---|
| **ADM-001** | Auth / Shell | **Critical** | Hardcoded plaintext admin credentials (`<set via MRS_SEED_OWNER_PASSWORD>`, `<set via MRS_SEED_MANAGER_PASSWORD>`, `<set via MRS_SEED_PRICING_PASSWORD>`) embedded in client bundle (`ROLE_CREDENTIALS`) with automatic login and unauthenticated role switching. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L105-L109), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L958-L974) | Remove `ROLE_CREDENTIALS` from client bundle; build a dedicated Admin Login screen calling `POST /api/auth/login`, persist token, validate with `GET /api/auth/me`, and add Logout. | `/api/auth/login` & `/api/auth/me` exist |
| **ADM-002** | Global Data / `audit-logs` | **Critical** | `syncWithBackend()` calls `POST /api/auth/login` on every mount, refresh, and mutation, polluting `auditLogs` with `AUTH_LOGIN` events and triggering a 15-request waterfall every time any button is clicked. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L189-L299) | Authenticate once per session, reuse `authToken`, and refresh only the affected module endpoint after mutations. | Fix with `ADM-001` |
| **ADM-003** | `excel-import` | **Critical** | No `<input type="file">` exists in the Excel Import UI. Clicking Dry-Run or Commit only sends `{ mode }` in JSON, forcing the server to always re-import the hardcoded sample file on disk. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L770-L781), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1888-L1905) | Add a file upload input (`multipart/form-data` with field `file`) and send `FormData` to `POST /api/admin/imports/excel`. | Backend `upload.single('file')` exists (`app.ts:870`) |
| **ADM-004** | `excel-import` | **High** | Clicking `"⬇ Download Error CSV"` uses a plain `<a href="...">` without an `Authorization: Bearer` header, always failing with `401 UNAUTHORIZED`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1936-L1945) | Fetch CSV via authenticated `fetch()` with `Authorization: Bearer ${authToken}`, create a `Blob` URL, and trigger download. | `authToken` state |
| **ADM-005** | `diamond-rates` | **Critical** | `handleUpdateDiamondRate` hardcodes `sizeMinCarat: '0.010'` and `sizeMaxCarat: '5.000'` and prepends to `diamondRates[0]`, shadowing all specific melee/pointer/solitaire slabs in the pricing engine. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L646-L655), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L539-L588) | Add form inputs for `sizeMinCarat`, `sizeMaxCarat`, `cutGrade`, `pricingType`, `isPlaceholder`, all 13 shapes, and update matching slabs in place rather than prepending a catch-all slab. | Update `POST /api/admin/rates/diamonds` |
| **ADM-006** | `pricing-engine` | **High** | Step 2 (`Validate`) in Repricing Governance can be bypassed because `"3. Owner Approve"` renders when `run.status === 'PREVIEWED'` (`line 1641`) and backend `approve` allows unvalidated runs. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1633-L1650), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L741-L762) | Render `"3. Owner Approve"` only when `run.status === 'VALIDATED'` and enforce `target.status === 'VALIDATED'` in `app.ts`. | Update `app.ts:750` |
| **ADM-007** | `pricing-engine` | **High** | Owner cannot view SKU-level proposed prices, deltas (`priceDeltaPercent`), or threshold flags (`exceedsThreshold`) in a Pricing Run before approving/publishing. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1601-L1671) | Add an expandable run items drawer/table showing `run.summary` and `run.items`. | Data already returned by API |
| **ADM-008** | `products` | **High** | Products module has no Create Product, Edit Jewellery Spec / Manual Override, or Delete Product UI despite backend endpoints existing. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1171-L1342) | Add Create Product modal (`POST /api/admin/products`), Edit Spec modal (`PUT /api/admin/pricing/products/:sku/attributes`), and Delete action (`DELETE /api/admin/products/:sku`). | Endpoints exist in `app.ts:361, 1320, 1434` |
| **ADM-009** | `inventory` | **High** | Inventory module ignores `GET /api/admin/inventory`, `POST /api/admin/inventory/adjust`, and `GET /api/admin/inventory/movements`; admins cannot adjust stock or view stock movement logs. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1384-L1423) | Wire up Stock Adjustment modal (`POST /api/admin/inventory/adjust`) and Inventory Movements ledger table (`GET /api/admin/inventory/movements`). | Endpoints exist in `app.ts:430, 1522, 1591` |
| **ADM-010** | `orders` | **High** | Orders module has no order line-item / pricing-snapshot drawer, no Refund action (`POST /api/admin/orders/:id/refund`), no Cancel Order action (`POST /api/admin/orders/:id/cancel`), and no GST Invoice viewer (`GET /api/orders/:id/invoice`). | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1989-L2041) | Add Order Detail modal showing line items + `pricingSnapshotId`, and wire Refund, Cancel, and GST Invoice actions. | Endpoints exist in `app.ts:2133, 2221, 2264` |
| **ADM-011** | `analytics` | **High** | Analytics uses `(p.inventoryQuantity \|\| 1)` (`lines 2274, 2287`), counting `0`-stock items as `1` unit; includes Silver & Platinum in "Total Net Gold"; fakes snapshot count when `0` (`line 2296`); ignores `/api/admin/analytics` and `/api/admin/reports/export.csv`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2262-L2301) | Fix `(p.inventoryQuantity ?? 0)` and `p.metalType === 'GOLD'` filter, and wire `GET /api/admin/analytics` + CSV export download buttons. | Endpoints exist in `app.ts:295, 2338` |
| **ADM-012** | `settings` | **High** | Settings module renders 4 `readOnly` inputs and never calls `GET /api/admin/settings` or `PUT /api/admin/settings`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2342-L2367) | Render editable form for all `StoreSettingsRecord` fields and submit to `PUT /api/admin/settings`. | Endpoints exist in `app.ts:1088-1119` |
| **ADM-013** | `users-roles` | **Medium** | Users & Roles module never calls `GET /api/admin/users`; displays hardcoded client constant `ROLE_CREDENTIALS`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2303-L2340) | Fetch `GET /api/admin/users` and add admin user management endpoints/UI. | `GET /api/admin/users` exists (`app.ts:1075`) |
| **ADM-014** | `overview` | **Medium** | "Paid Order Revenue" KPI sums unpaid/refunded orders (`line 1047`) and discards `kpis`, `shopifyStatus`, `recentOrders`, `recentPricingRuns`, `recentAuditLogs` from `GET /api/admin/overview`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L236-L240), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1045-L1050) | Render `ov.kpis.totalRevenueInr`, `ov.shopifyStatus`, and recent activity tables from `/api/admin/overview`. | None |
| **ADM-015** | `excel-import` | **Medium** | Missing UI buttons for `POST /api/admin/imports/:jobId/sync-shopify` and `POST /api/admin/imports/:jobId/rollback`, plus missing preview items table (`job.previewItems`). | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1913-L1984) | Wire Rollback and Shopify Sync buttons and display `job.detectedSheets` and `job.previewItems`. | Endpoints exist in `app.ts:961, 1596` |
| **ADM-016** | `gold-rates` | **Medium** | Switching `editPurity` does not update `editMetalRateInr` (`'5820.00'`), risking saving an 18K gold rate onto 925 Silver or 24K Gold. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1719-L1764) | Sync form state with current rate for selected `editPurity` on change and add `min="0.01"`. | None |
| **ADM-017** | `pricing-engine` | **Medium** | Simulator has orphaned `simCertFee` state (`line 178`), hardcodes `wastageMode`, silently clamps `netWeight <= grossWeight`, and lacks UI for `POST /api/admin/pricing/rules` and `pricingSnapshots`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L178), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L473-L496) | Add simulator inputs for `simCertFee` and `wastageMode`, show warning on `net > gross`, wire `POST /api/admin/pricing/rules`, and render `pricingSnapshots`. | `POST /api/admin/pricing/rules` exists |
| **ADM-018** | RBAC UI & API | **High** | All 19 sidebar modules and action buttons remain visible/enabled for `PRICING_OPERATOR` and `MANAGER`, and backend `GET /api/admin/*` routes omit `requirePermission(...)`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L879-L902), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L264-L1123) | Enforce `ROLE_PERMISSIONS` in sidebar/buttons and add `requirePermission(...)` to `GET /api/admin/*` routes. | `ROLE_PERMISSIONS` in `@mrs/shared` |
| **ADM-019** | `payments` & `orders` | **Medium** | Status badges are hardcoded green (`mrs-badge-success`): Payments hardcodes `HMAC VERIFIED` (ignoring `p.signatureVerified`) and `p.status`; Orders hardcodes `o.financialStatus` green even when `PENDING`/`REFUNDED`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2016), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2153-L2154) | Map status to semantic badge classes (`success`, `warning`, `danger`) and inspect `p.signatureVerified`. | None |
| **ADM-020** | `categories`, `discounts`, `banners`, `content` | **Medium** | Status badges ignore `isActive`/`isPublished` booleans (`lines 1375, 2223, 2253`), discount values omit `%`/`₹` units (`line 2188`), and all 4 modules lack CRUD forms and backend write routes. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L1375), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2164-L2260) | Add backend `POST`/`PUT`/`DELETE` routes and admin CRUD modals for Categories, Discounts, Banners, and Content. | New API routes needed |
| **ADM-021** | `shipping` & `orders` | **Medium** | `"Generate Shiprocket AWB"` button lacks `disabled={loadingAction}` (`line 2026`), and Shipping module lacks Pincode Serviceability checker (`GET /api/shipping/serviceability`) and tracking drawer. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2025-L2032), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L2084-L2126) | Disable button while loading, prevent duplicate AWB generation, and expose serviceability/tracking tools in Shipping. | `/api/shipping/serviceability` exists |
| **ADM-022** | Responsive CSS | **Medium** | At `<=1024px`, `.mrs-admin-shell` collapses to 1 column while `.mrs-sidebar` retains `position: sticky; top: 0; height: 100vh`, blocking the main workspace below it. | [globals.css](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/globals.css#L56-L73), [globals.css](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/globals.css#L384-L388) | Set `.mrs-sidebar { position: relative; height: auto; }` or convert to a collapsible drawer below `1024px`. | None |
| **ADM-023** | Navigation & Error UX | **Medium** | Sidebar module numbers render out of order (`01..04, 07..10, 05..06, 14..15, 11..13, 16..19`), `activeModule` is not synced to URL query/hash, and `syncWithBackend` silently swallows errors into `seedLocalFallbackState()`. | [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L47-L67), [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L295-L298) | Renumber modules sequentially in sidebar order, sync `activeModule` with URL search params, and surface connection error banners. | None |

---

## 9. Backend Issues (`services/api`)

1. **Draft Pricing Rule Immediately Becomes Active Storewide (`services/api/src/app.ts:602-635`):**
   - `POST /api/admin/pricing/rules` requires only `PRICING_VALIDATE` (allowing `PRICING_OPERATOR` to call it), creates a rule with `status: 'DRAFT'`, and runs `state.pricingRules.unshift(newRule)` (`line 630`). Because every pricing endpoint (`/api/products`, `/api/public/pricing/:sku`, `/api/admin/pricing/preview`, `/api/checkout/create-order`) unconditionally reads `state.pricingRules[0]`, creating a `DRAFT` rule immediately changes live storefront and checkout pricing without Owner approval!
2. **`pricingEnabled` Product Flag Ignored (`services/api/src/app.ts:646, 817` & `pricing-engine.ts`):**
   - `JewelleryProductSpec.pricingEnabled` (`packages/shared/src/types.ts:221`) is never checked during `POST /api/admin/pricing/preview` or `POST /api/admin/pricing/runs/:runId/publish`, so products excluded from dynamic repricing are overwritten anyway.
3. **Diamond Rate Updates Never Deactivate Overlapping Slabs (`services/api/src/app.ts:535-588`):**
   - `POST /api/admin/rates/diamonds` always `unshift`s a new active `DiamondRateMatrixEntry` (`version: 1`) without deactivating prior matching entries or validating `sizeMinCarat <= sizeMaxCarat`.
4. **Razorpay Webhook Handler Does Not Update Orders (`services/api/src/app.ts:1160-1177`):**
   - `POST /api/webhooks/razorpay` verifies `x-razorpay-signature` and immediately returns `200 { received: true, eventId }` without updating `order.financialStatus`, recording `PaymentRecordItem`, checking `IntegrationEvent` idempotency, or writing an audit log.
5. **Shopify Webhook Handler Does Not Process Events (`services/api/src/app.ts:1128-1158`):**
   - `POST /api/webhooks/shopify` verifies `x-shopify-hmac-sha256` and writes an `AuditLog` entry, but does not deduplicate `IntegrationEvent` or sync orders/inventory.
6. **Cumulative Partial Refunds Exceed Order Total (`services/api/src/app.ts:2148-2158`):**
   - `handleCreateRefund` checks `if (refundAmt > orderTotal)` for a single refund request, but never sums existing `state.refunds` for that `orderId`, allowing unlimited partial refunds each `<= orderTotal`.
7. **Unvalidated Settings Mutation (`services/api/src/app.ts:1096-1119`):**
   - `PUT /api/admin/settings` spreads `...req.body` directly into `state.settings` (`line 1104`) without Zod validation, allowing arbitrary properties or invalid types to corrupt `state.settings`.
8. **Missing `.env` Loader in `services/api` (`services/api/src/index.ts:1-13`):**
   - `dotenv` is not installed in `services/api/package.json`, and `npm run dev:api` runs `tsx watch src/index.ts` without `--env-file`, so `.env` files are ignored unless loaded by the parent shell.

---

## 10. Database Status (`services/api/prisma` & `data-store.ts`)

1. **Prisma Schema Inventory (`services/api/prisma/schema.prisma`):**
   - **Models:** **40 models** (`Role`, `Permission`, `AdminUser`, `RefreshToken`, `Category`, `Collection`, `CollectionProduct`, `ProductMetadata`, `ProductVariant`, `ProductImage`, `JewellerySpecification`, `DiamondComponent`, `InventoryRecord`, `InventoryMovement`, `GoldRate`, `DiamondRate`, `PricingRule`, `PricingRun`, `PricingRunItem`, `PricingSnapshot`, `ImportJob`, `ImportError`, `Customer`, `CustomerAddress`, `Cart`, `CartItem`, `Wishlist`, `WishlistItem`, `OrderMetadata`, `OrderItem`, `PaymentRecord`, `RefundRecord`, `Shipment`, `Discount`, `Banner`, `Content`, `Notification`, `StoreSetting`, `IntegrationEvent`, `AuditLog`).
   - **Enums:** **1 enum** (`RoleName`: `OWNER`, `MANAGER`, `PRICING_OPERATOR`).
   - **Constraints & Indexes:** 30 unique constraints (`@unique` / `@@unique`), 16 explicit `@@index` definitions, and 35 foreign key relations. (Minor schema naming defect: `Banner.Placement` at `schema.prisma:683` is capitalized).
2. **Migration Status:**
   - One migration file exists at `services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql` (`1,007` lines).
   - **Applied Status:** **NOT APPLIED.** PostgreSQL is not installed on this Mac, and no database exists.
3. **Runtime Persistence & Critical Data-Loss Risks (`services/api/src/store/data-store.ts:1803-1879`):**
   - **Prisma is NOT used at runtime.** All reads and writes go through `DataStore` (`dbStore`) backed by `.data/platform-state.json`.
   - **Split-Brain State Files:** Because `data-store.ts:1808` resolves `path.resolve(process.cwd(), '.data', 'platform-state.json')`, running commands from root vs `services/api` created **two diverging database files**:
     - `/.data/platform-state.json` (`70,127` bytes, `1,957` lines)
     - `/services/api/.data/platform-state.json` (`2,617,154` bytes, `85,083` lines)
   - **Catastrophic Auto-Wipe on Parse Failure (`data-store.ts:1845-1848`):** `fs.writeFileSync` writes directly to `platform-state.json` non-atomically (`line 1861`). If a crash or power loss interrupts a write, `JSON.parse` throws on next boot and the `catch` block **silently resets the entire database to `createInitialSeedState()` and overwrites the file**, destroying all production data!
   - **Silent Write Error Swallowing (`data-store.ts:1862-1864`):** Disk write errors are caught and ignored with an empty `catch {}`.

---

## 11. Pricing Engine Status (`packages/shared/src/pricing-engine.ts`)

| Requirement / Calculation | Status | Evidence & Audit Notes |
|---|---|---|
| **Gold & Metal Purity Rates** | **VERIFIED** | `pricing-engine.ts:100-110` — Matches `metalType` + `purity` (`24K`, `22K`, `18K`, `14K`, `925_SILVER`, `950_PLATINUM`). Emits warning if rate is missing. |
| **Net & Gross Weight Derivation** | **VERIFIED** | `pricing-engine.ts:113-137` — Supports `EXPLICIT_NET_WEIGHT` and `GROSS_MINUS_STONE_WEIGHT` (`stoneCarats * 0.2g`). Emits warning if `net > gross`. |
| **Wastage Modes** | **VERIFIED** | `pricing-engine.ts:145-165` — Supports `PERCENT_METAL_VALUE`, `PERCENT_METAL_WEIGHT`, `FLAT_GRAMS`, and `NONE`. |
| **Making Charge Modes** | **VERIFIED** | `pricing-engine.ts:215-231` — Supports `PER_GRAM_NET`, `PER_GRAM_GROSS`, `PERCENTAGE_OF_METAL` (computed on `payableMetalValueInr`), and `FLAT_PER_PIECE`. |
| **Diamond Rate Matrix Lookup** | **BUG IN TIER-3 FALLBACK** | `pricing-engine.ts:47-88` — Tier 1 matches exact shape + carat bracket + color + clarity; Tier 2 matches shape + carat bracket. **Defect at line 87:** Tier 3 returns `activeRates[0] ?? null` without checking shape or carat bracket and **without emitting any warning**! Thus an out-of-range 6.00 ct diamond silently gets priced at whatever rate is at `activeRates[0]`, and the warning at `lines 194-198` is unreachable dead code whenever `activeRates.length > 0`. |
| **GST Mode (`INCLUSIVE` vs `EXCLUSIVE`)** | **DEFECT IN MODE HANDLING** | `pricing-engine.ts:247-250` — Always computes `gstAmount = subtotalBeforeTax * gstRatePercent / 100` and `unroundedTotal = subtotalBeforeTax + gstAmount` (exclusive addition), **ignoring `rule.gstMode`** even when `rule.gstMode === 'INCLUSIVE'`. |
| **Certification & Hallmark Fee Zero Override** | **MINOR DEFECT** | `pricing-engine.ts:234-237` — Uses `product.certificationFeeInr \|\| rule.defaultCertificationFeeInr`. Because `'0.00'` is a truthy string in JS, `'0.00'` overrides the rule default, whereas `''` falls back to the rule default. |
| **INR Rounding & Manual Overrides** | **VERIFIED** | `pricing-engine.ts:16-45, 258-272` — `NEAREST_1`, `NEAREST_10`, `NEAREST_99`, `NEAREST_100`, `NONE`, and `manualPriceOverrideInr` work accurately with `Decimal.js`. |

---

## 12. Excel Importer Status (`services/api/src/services/excel-importer.ts`)

1. **Supported Sheets (11/11 Verified):** `Rings`, `Earrings`, `Pendants`, `Necklaces`, `Bracelets`, `Bangles`, `Mangalsutra`, `Solitaires`, `Nose Pins`, `Chains`, `Antique` (`excel-importer.ts:24-41`).
   - *Defect (`lines 152-153`):* Any unrecognized sheet name in an uploaded workbook silently falls back to `args.categories[0]` (`Rings`) instead of reporting an unknown-sheet error.
2. **Sample Workbook Verification (`MANGAL JEWELLERY.xlsx`):**
   - Verified 296 total rows across 11 sheets: **294 valid rows** and **2 intentional error rows** (`Rings` row 43 `MRS-RNG-ERR-WEIGHT` where net `4.1g` > gross `3.2g`; `Antique` row 23 `MRS-RNG-101` duplicate SKU).
3. **Importer Defects & Data Corruption Risks:**
   - **Unhandled Crash on Non-Numeric Making/Wastage/Cert Cells (`excel-importer.ts:360-375`):** While `grossWeight` and `netWeight` are checked with `Number.isNaN()`, `makingValueStr`, `wastagePercentStr`, `certFeeStr`, and `stockQtyStr` are not! If an Excel cell contains text (e.g., `"N/A"`), `Number(makingValueStr).toFixed(2)` yields `"NaN"`, causing `new Decimal("NaN")` inside `calculateJewelleryPrice` to throw an uncaught `[DecimalError]` that aborts the entire import request with `500 INTERNAL_SERVER_ERROR`.
   - **Intra-Workbook Handle Collision (`excel-importer.ts:334-336`):** `existingHandles` is checked against existing DB products, but handles generated for earlier rows in the *same* workbook are never added to `existingHandles`.
   - **Diamond Shape & Sieve Coercion (`excel-importer.ts:299, 318, 325-326`):** The importer's shape whitelist omits `'HEART'`, `'RADIANT'`, and `'ASSCHER'`, silently converting `'HEART'` diamonds in `MANGAL JEWELLERY.xlsx` into `'ROUND'`, and hardcodes Diamond 2 quality to `'EF'` / `'VVS'`.
   - **Unsafe Rollback (`services/api/src/app.ts:1596-1631`):** `POST /api/admin/imports/:jobId/rollback` does not check if `job.dryRun === true` (rolling back a dry-run job deletes live catalog products matching those SKUs!), does not check if those SKUs are in active customer orders, and does not update `job.status` to `'ROLLED_BACK'`.

---

## 13. Payment Integration Status (Razorpay)

| Feature | Classification | Evidence (File & Line) | Verification Notes |
|---|---|---|---|
| **Razorpay SDK / HTTP API Usage** | **Not Implemented** | `services/api/package.json` | Neither `razorpay` npm SDK nor `fetch('https://api.razorpay.com/...')` is used anywhere in `services/api`. |
| **Order Creation (`/api/checkout/create-order`)** | **Simulated** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2016), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2048-L2053) | Generates synthetic ID `order_MrsRzp${Date.now()}` in memory. |
| **Client Checkout Modal (`apps/storefront`)** | **Simulated** | [checkout/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/checkout/page.tsx#L63-L79) | Does not load `https://checkout.razorpay.com/v1/checkout.js`; immediately posts fake `pay_MrsRzp_${Date.now()}` and `sig_verified_${Date.now()}` to `/api/payments/razorpay/verify`. |
| **Payment Signature Verification** | **Partially Implemented (With Critical Bypass)** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2075-L2093) | Computes HMAC-SHA256, but `line 2084` (`razorpaySignature.startsWith('sig_verified_') \|\| process.env.NODE_ENV !== 'production'`) bypasses verification even in production! |
| **Payment Status Updates** | **Partially Implemented** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2095-L2129) | Marks `order.financialStatus = 'PAID'` and appends `PaymentRecordItem` in local JSON state. |
| **Webhook Handler (`/api/webhooks/razorpay`)** | **Partially Implemented (Signature Only)** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1160-L1177), [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L51-L65) | Verifies `x-razorpay-signature` via `crypto.timingSafeEqual`, but **does not update orders, payments, idempotency records, or audit logs**. |
| **Refund Handling (`/api/admin/orders/:id/refund`)** | **Simulated** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2133-L2218) | Generates synthetic `rfnd_MrsRzp${Date.now()}`, updates local order status, and optionally restores stock. No Razorpay API call is made. |
| **Payment Failure Handling** | **Not Implemented** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1889-L2130) | Stock is deducted at `create-order` (`line 1965`) and is never automatically released if payment fails or is abandoned. |

---

## 14. Shipping Integration Status (Shiprocket)

| Feature | Classification | Evidence (File & Line) | Verification Notes |
|---|---|---|---|
| **Authentication (Token Login)** | **Not Implemented** | [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L1-L65) | `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` are never read in code; zero HTTP calls to `apiv2.shiprocket.in`. |
| **Pincode Serviceability (`/api/shipping/serviceability`)** | **Simulated** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2304-L2335) | Validates `/^\d{6}$/` and returns hardcoded JSON (`2` days for `400xxx`, `4` days otherwise, with static BlueDart & Sequel courier objects). |
| **Shipment Creation & AWB Generation** | **Simulated** | [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L12-L49), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1018-L1063) | Generates fake `SR-ORD-...`, `SR-SHP-...`, and `SRMRS...IN` strings in memory. |
| **Label & Manifest Generation** | **Simulated** | [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L33-L35) | Returns fake URLs `https://shiprocket.co/labels/${awbCode}.pdf` that 404 when clicked. |
| **Order & AWB Tracking (`/api/public/orders/track`)** | **Simulated** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L229-L259) | Returns in-memory `ShipmentRecord` from `.data/platform-state.json`. |
| **Shiprocket Webhooks** | **Not Implemented** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1128-L1177) | No `/api/webhooks/shiprocket` endpoint exists. |
| **Shipment Cancellation** | **Not Implemented** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2221-L2261) | Cancelling an order does not cancel or update its `ShipmentRecord`. |

---

## 15. Security Vulnerabilities

*(Note: All seed/fallback strings referenced below are public development constants in source control; no live production keys exist in the repo.)*

| ID | Severity | Vulnerability | Exact File & Line Evidence | Technical Impact & Remediation |
|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | **Unconditional Admin Auth Bypass via `x-mrs-admin-role` Header** | [auth.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts#L76-L92) | Any unauthenticated HTTP request sending `x-mrs-admin-role: OWNER` receives full `OWNER` privileges in all environments (no `NODE_ENV` guard). **Fix:** Remove the header bypass completely (or strictly restrict to `NODE_ENV === 'test'`). |
| **SEC-02** | **CRITICAL** | **Plaintext Admin Passwords Embedded in Client Bundle (`apps/admin`)** | [apps/admin/src/app/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L105-L109) | `ROLE_CREDENTIALS` ships plaintext admin emails and passwords to every browser visiting the admin dashboard. **Fix:** Delete `ROLE_CREDENTIALS` from client code and require interactive login. |
| **SEC-03** | **CRITICAL** | **Hardcoded Universal Backdoor Passwords in `/api/auth/login`** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L141-L150) | `isLegacyTestPassword` accepts 3 hardcoded strings for **any** active admin user account regardless of their actual `passwordHash`. **Fix:** Remove `isLegacyTestPassword` from `app.ts`. |
| **SEC-04** | **CRITICAL** | **Passwordless Customer Login (`/api/auth/customer/login`)** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1688-L1721) | Looks up customer by `email` and returns full customer PII and order history **without checking `customer.passwordHash`**. **Fix:** Verify `customer.passwordHash` using `bcrypt`/`argon2id` and return a signed customer session token. |
| **SEC-05** | **CRITICAL** | **Razorpay Payment Signature Bypass in Production** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2082-L2085) | `razorpaySignature.startsWith('sig_verified_') \|\| process.env.NODE_ENV !== 'production'` allows any attacker to mark any unpaid order as `PAID` in production by sending `"sig_verified_1"`. **Fix:** Require `crypto.timingSafeEqual` against `expectedHmac`. |
| **SEC-06** | **HIGH** | **Unauthenticated Order Cancellation Endpoint (`POST /api/orders/:orderId/cancel`)** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2261) | Mounted without `requireAuth` (unlike `/api/admin/orders/:orderId/cancel` on line 2260). Anyone can cancel any order and restock inventory. **Fix:** Require authentication and ownership verification. |
| **SEC-07** | **HIGH** | **Unauthenticated Customer PII Exposure on Invoice & Order Tracking** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L229-L259), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2264-L2301) | `GET /api/orders/:orderId/invoice` and `GET /api/public/orders/track?orderNumber=MRS-1041` return customer full name, email, phone, address, and items without requiring matching email/phone or auth token. |
| **SEC-08** | **HIGH** | **Weak Static-Salt SHA-256 Password Hashing & Hash Exposure** | [data-store.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/store/data-store.ts#L433-L435), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L454-L456) | Uses a single fast SHA-256 hash with static salt `'mrs_salt_'`, and `GET /api/admin/customers` returns `customer.passwordHash` in the JSON response. **Fix:** Use `bcryptjs` (cost >= 12) and strip `passwordHash` from customer responses. |
| **SEC-09** | **HIGH** | **Hardcoded Fallback Secrets for JWT, Shopify & Razorpay** | [auth.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts#L22), [shopify-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shopify-service.ts#L41), [shiprocket-service.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L54) | If env vars are unset in production, the server falls back to hardcoded dev strings instead of failing fast at startup. |
| **SEC-10** | **MEDIUM** | **Missing `requirePermission` on `GET /api/admin/*` & Draft Pricing Rule Activation** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L450-L1123), [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L602-L635) | `PRICING_OPERATOR` can read all orders, customers, payments, settings, and users, and can post a `DRAFT` pricing rule that immediately becomes `state.pricingRules[0]`. |
| **SEC-11** | **MEDIUM** | **Wildcard CORS (`*`), No Rate Limiting, No `helmet` Headers, Non-Timing-Safe JWT Check** | [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L70), [auth.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts#L44) | `app.use(cors())` allows all origins; login/checkout endpoints have no rate limiting; `verifyAdminToken` uses `sig !== expectedSig` instead of `crypto.timingSafeEqual`. |

---

## 16. Test and Build Results

All verification commands were executed on the MacBook Retina 2017 using Node.js `v26.13.0` and npm `11.20.0`:

### 16.1 Command Execution Summary

| Command | Result | Duration | Details |
|---|---|---|---|
| `npm run typecheck` | **PASSED (Exit 0)** | ~38s | Zero TypeScript errors across `@mrs/shared`, `@mrs/api`, `@mrs/admin`, and `@mrs/storefront`. |
| `npm test` | **PASSED (Exit 0)** | ~9.1s | **10/10 tests passed**: `3/3` in `@mrs/shared` (`src/pricing-engine.test.ts` in 1.95s) and `7/7` in `@mrs/api` (`src/app.test.ts` in 7.18s). |
| `npm run build` | **PASSED (Exit 0)** | ~2m 14s | Compiled `@mrs/shared` (`tsc`), `@mrs/api` (`tsc`), `@mrs/admin` (Next.js 15.5.29 — 4 static pages in 12.3s), and `@mrs/storefront` (Next.js 15.5.29 — 19 static/dynamic routes in 6.6s). |
| `./node_modules/.bin/prisma -v` | **FAILED (Missing Darwin Engine)** | ~19s | Attempted to download Darwin `schema-engine.gz` because only Windows `.dll.node` / `.exe` binaries exist in `node_modules/@prisma/engines`. |

### 16.2 Test Coverage Gaps & Missing Tests
- **`apps/admin` (`@mrs/admin`):** **0 tests** (no test runner or test files configured).
- **`apps/storefront` (`@mrs/storefront`):** **0 tests** (no unit, component, or Playwright E2E visual regression tests).
- **`packages/shared` (`3` tests):** Missing unit tests for `PERCENTAGE_OF_METAL` and `FLAT_PER_PIECE` making charges, `PERCENT_METAL_WEIGHT` and `FLAT_GRAMS` wastage, `INCLUSIVE` vs `EXCLUSIVE` GST mode, out-of-bracket diamond carat fallback (`Tier 3`), manual price overrides, and negative `fixedAdjustmentInr` boundary cases.
- **`services/api` (`7` tests):** Note that executing `npm test` in `services/api` mutates `services/api/.data/platform-state.json` directly! Missing tests for customer registration/login password rejection, deactivated admin token rejection, concurrent order stock contention, cumulative partial refunds, and import rollback on dry-run vs committed jobs.

---

## 17. Documentation Accuracy Audit

All **28 Markdown files** in the root directory and `.env.example` were audited against actual source code:

1. **Outdated Architecture & SPA Claims in `STOREFRONT_MIGRATION.md` (`lines 14-16, 44-74`):**
   - Falsely states `apps/storefront` is an 889-line single-page application in `src/app/page.tsx` using a `view` state machine with no App Router pages and no mobile drawer. In reality, `apps/storefront` uses 19 Next.js App Router pages wrapped by `StorefrontShell.tsx` (which includes a mobile drawer at `lines 419-518`).
   - Lists wrong announcement bar copy, wrong category count (`6` instead of `7`), wrong price tiers (`Under ₹20K / 40K / 60K` instead of `15K / 25K / 50K`), and wrong pillar count (`5` instead of `3`).
2. **False Security Claims in `SECURITY.md` (`lines 11-19`):**
   - Line 11 claims `verifyAdminToken` in `auth.ts` uses `crypto.timingSafeEqual` and a `12 hours` expiry. Actual `auth.ts:31, 44` uses `24 hours` and standard `!==` string comparison.
   - Line 13 claims `POST /api/auth/customer/login` is at `app.ts:222-247` and returns a signed token. Actual `app.ts:1688-1721` returns `{ customer, orders }` with **no token**.
3. **False Webhook Implementation Claims in `PAYMENT_INTEGRATION.md` (`lines 21, 56-68`):**
   - Claims `POST /api/webhooks/razorpay` is at `app.ts:2144-2192` and updates order status to `PAID`, creates a `PaymentRecord`, and logs an `AuditLog`. In actual `app.ts:1160-1177`, the webhook handler is only 18 lines long and **does none of those actions** (only verifies HMAC and returns `{ received: true, eventId }`).
4. **Environment Variable Mismatches Between `.env.example`, `DEPLOYMENT.md`, and Source Code:**
   - `apps/admin/src/app/page.tsx:69` and `apps/storefront/src/lib/storefront-data.ts:12` read **`process.env.NEXT_PUBLIC_API_URL`**, whereas `.env.example:52` defines **`NEXT_PUBLIC_ADMIN_API_URL`** (which is never read anywhere in code!).
   - `DEPLOYMENT.md:22-42` describes a completely different `.env.example` file (referencing `PORT`, `NEXT_PUBLIC_API_BASE_URL`, `SESSION_SECRET`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN` that do not exist in `.env.example`).
5. **Broken Windows Absolute Links Across Documentation:**
   - `ADMIN_MODULES.md`, `MASTER_PROGRESS.md`, `CODE_VERIFICATION_AUDIT.md`, `DEPLOYMENT.md`, `SECURITY.md`, `PRICING_ENGINE.md`, `PRODUCT_IMPORT_REPORT.md`, `PAYMENT_INTEGRATION.md`, `SHIPPING_INTEGRATION.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `SYSTEM_ARCHITECTURE.md`, and `TESTING_REPORT.md` contain hardcoded `file:///c:/Users/manis/...` links from the old Windows machine.
6. **Missing macOS Setup Instructions:**
   - Neither `README.md` nor `DEPLOYMENT.md` documents installing PostgreSQL on macOS, regenerating Prisma Darwin engines (`npx prisma generate`), configuring NVM in `PATH`, or loading `.env` into `services/api`.

---

## 18. Performance Concerns (Especially on MacBook Retina 2017 — Core m3 / 8GB RAM)

1. **Synchronous Multi-Megabyte JSON Serialization (`services/api/src/store/data-store.ts:1861`):**
   - `services/api/.data/platform-state.json` has already grown to **2.62 MB (85,083 lines)** because every test run and preview run prepends full 296-row `previewItems` and `PricingRunItem` arrays into state without pruning. Every mutation calls `fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))` on the main thread, blocking the Node.js event loop and spiking CPU/disk I/O on the 1.10 GHz Core m3 processor.
2. **15-Request Admin Fetch Waterfall on Every Action (`apps/admin/src/app/page.tsx:189-299`):**
   - Every mutation in `apps/admin` re-runs `POST /api/auth/login` (triggering a synchronous 2.62 MB disk write for the `AUTH_LOGIN` audit log) followed by 14 concurrent `GET` requests (including `/api/admin/products` which recalculates `Decimal.js` prices across all products on every GET at `app.ts:346-354`).
3. **Live `Decimal.js` Price Recalculation on Every Product List Request (`services/api/src/app.ts:346-354, 1191-1200`):**
   - Both `GET /api/products` and `GET /api/admin/products` run `calculateJewelleryPrice` for every product on every HTTP request rather than caching or reading published prices until rates/rules change.
4. **Unpaginated Tables & Grids for 600+ SKUs:**
   - Neither `GET /api/products`, `GET /api/admin/products`, `apps/storefront/src/app/collections/[handle]/page.tsx`, nor `apps/admin/src/app/page.tsx` implements pagination. Rendering 600+ complex DOM rows/cards simultaneously will degrade browser responsiveness on 8 GB RAM hardware.

---

## 19. Critical Blockers Before Production Delivery

1. **B1 — No Real Database Connected (JSON File Persistence with Auto-Wipe Risk):** `services/api` runs entirely on `.data/platform-state.json`, which splits across working directories and wipes itself to seed data if a write is interrupted (`data-store.ts:1845-1848`).
2. **B2 — Critical Authentication & Payment Bypasses Active in Production:** `x-mrs-admin-role` header bypass (`auth.ts:76-92`), hardcoded admin backdoor passwords (`app.ts:141-150`), passwordless customer login (`app.ts:1688-1721`), plaintext admin credentials in client bundle (`apps/admin/src/app/page.tsx:105-109`), unauthenticated order cancellation (`app.ts:2261`), and `sig_verified_` Razorpay bypass (`app.ts:2082-2085`).
3. **B3 — Simulated Payment, Shipping & Shopify Sync Integrations:** Razorpay order creation/refunds, Shiprocket AWB/serviceability/tracking, and Shopify Admin GraphQL price publishing are simulated in memory and do not communicate with live external APIs.
4. **B4 — Broken Admin Operations:** Admin cannot upload Excel files from the UI (`ADM-003`), cannot download error CSVs (`401 UNAUTHORIZED`, `ADM-004`), corrupts the diamond matrix when adding a diamond rate (`ADM-005`), and lacks UI controls for Product CRUD, Stock Adjustment, Order Refunds/Invoices, and Settings saving (`ADM-008`–`ADM-012`).
5. **B5 — Storefront Visual Parity & Mobile Layout Regressions:** Missing carousels/slideshows on Homepage, missing custom fonts (`Battlemade`, `Begum`, `Gotham`), missing About Us sections (Brand Promise collage & Mangal Group 6 sister companies), missing PDP accordions/Trust Bar/quantity selector, and hardcoded `70px` inline mobile padding (`SF-01`–`SF-14`).
6. **B6 — Mac Environment Incomplete:** Missing `.git` repository, missing Prisma Darwin engines in `node_modules`, and PostgreSQL not installed locally.

---

## 20. Prioritized Development Roadmap (P0 – P4)

### P0 — Critical Blockers, Mac Environment Repair & Security Vulnerabilities (Estimated Effort: 36 – 46 hours)

| ID | Task Description | Target Files | Est. Effort |
|---|---|---|---|
| **P0-1** | **Restore Git, Clean Mac `node_modules` & Install PostgreSQL + Prisma Darwin Engines:** Initialize/restore `.git`, install PostgreSQL 16 on macOS, run clean `npm install` + `npx prisma generate` to fetch Darwin engines, configure `.env` Loader (`--env-file` or `dotenv`), and align `NEXT_PUBLIC_API_URL` in `.env.example`. | Root `.git`, `.env.example`, `services/api/package.json` | 4 – 6h |
| **P0-2** | **Eliminate All Authentication, Authorization & Payment Bypasses (`SEC-01`–`SEC-09`):** Remove `x-mrs-admin-role` header bypass (`auth.ts:76-92`), remove `isLegacyTestPassword` (`app.ts:141-150`), enforce password hash check + JWT issuance on `POST /api/auth/customer/login` (`app.ts:1688`), replace static-salt SHA-256 with `bcryptjs` (`data-store.ts:433`), remove `sig_verified_` bypass (`app.ts:2082-2085`), protect `POST /api/orders/:orderId/cancel` (`app.ts:2261`), require email/token verification on `/invoice` and `/orders/track`, strip `passwordHash` from `/api/admin/customers`, and enforce `requirePermission` across all `/api/admin/*` routes. | `services/api/src/middleware/auth.ts`, `services/api/src/app.ts`, `services/api/src/store/data-store.ts` | 8 – 10h |
| **P0-3** | **Replace Hardcoded Admin Credentials with Real Login & Fix Audit Log Flood (`ADM-001`, `ADM-002`):** Remove `ROLE_CREDENTIALS` from `apps/admin/src/app/page.tsx`, build a real Admin Login view + session storage + Logout button, and stop calling `POST /api/auth/login` inside `syncWithBackend()`. | `apps/admin/src/app/page.tsx` | 6 – 8h |
| **P0-4** | **Migrate Runtime Persistence from `.data/platform-state.json` to PostgreSQL + Prisma:** Apply `20261105000000_init_complete_platform/migration.sql`, create a Prisma seed script from `createInitialSeedState()`, and refactor `services/api` routes/store to use `@prisma/client` with database transactions for checkout, inventory adjustments, pricing runs, and Excel imports. | `services/api/src/store/`, `services/api/src/app.ts`, `services/api/prisma/` | 18 – 22h |

### P1 — Core E-Commerce & Pricing/Import Reliability (Estimated Effort: 28 – 36 hours)

| ID | Task Description | Target Files | Est. Effort |
|---|---|---|---|
| **P1-1** | **Fix Pricing Engine & Governance Bugs (`ADM-005`, `ADM-006`):** Fix Tier-3 diamond rate fallback so out-of-bracket carats emit a warning instead of silently using `activeRates[0]` (`pricing-engine.ts:87`), implement true `INCLUSIVE` vs `EXCLUSIVE` GST calculation (`pricing-engine.ts:247-250`), respect `product.pricingEnabled` during preview/publish, stop `POST /api/admin/pricing/rules` (`DRAFT`) from overwriting the active rule until approved/published (`app.ts:630`), and enforce `VALIDATED` status before `approve` (`app.ts:750`). | `packages/shared/src/pricing-engine.ts`, `services/api/src/app.ts` | 8 – 10h |
| **P1-2** | **Fix Excel Importer & Rollback Bugs (`ADM-003`, `ADM-004`, `ADM-015`):** Validate numeric strings (`makingValue`, `wastagePercent`, `certFee`, `stockQty`) before `new Decimal()` (`excel-importer.ts:360`), add `'HEART'`, `'RADIANT'`, `'ASSCHER'` to shape whitelist (`lines 299, 318`), track generated handles within the same workbook (`line 334`), flag unknown sheet names (`line 152`), block rollback on `dryRun === true` or SKUs in active orders (`app.ts:1596`), add `<input type="file">` upload in `apps/admin`, and fix Error CSV download to send `Authorization: Bearer` header. | `services/api/src/services/excel-importer.ts`, `services/api/src/app.ts`, `apps/admin/src/app/page.tsx` | 10 – 12h |
| **P1-3** | **Fix Storefront Customer Auth, Checkout, Order Tracking & PDP 404 Bugs (`SF-11`, `SF-14`):** Remove hardcoded `Ananya Sharma` fallback when logged out on `/account` (`account/page.tsx:11-19`), read `?orderNumber=` search params on `/pages/order-tracking` (`pages/order-tracking/page.tsx:6-8`), sync `initialQ` to `query` on `/search` (`search/page.tsx:10-11`), and render proper not-found state on invalid `/products/[handle]` (`products/[handle]/page.tsx:21-27`). | `apps/storefront/src/app/account/page.tsx`, `pages/order-tracking/page.tsx`, `search/page.tsx`, `products/[handle]/page.tsx` | 6 – 8h |
| **P1-4** | **Fix Cumulative Partial Refunds & Unvalidated Settings API:** Track cumulative refunded amounts per order (`app.ts:2148`) and validate `PUT /api/admin/settings` with a Zod schema (`app.ts:1096`). | `services/api/src/app.ts`, `packages/shared/src/schemas.ts` | 4 – 6h |

### P2 — Admin Dashboard Corrections & Storefront Visual Parity (Estimated Effort: 48 – 64 hours)

| ID | Task Description | Target Files | Est. Effort |
|---|---|---|---|
| **P2-1** | **Wire Disconnected Admin Modules & Fix Admin UI Bugs (`ADM-007`–`ADM-023`):** Add Product Create/Edit/Delete modals (`products`), Stock Adjustment & Movements ledger (`inventory`), Order Detail/Snapshot drawer + Refund/Cancel/GST Invoice actions (`orders`), Pricing Run SKU delta drawer + Rule editor + Snapshots viewer (`pricing-engine`), full Diamond Rate slab inputs (`diamond-rates`), Purity-synced Metal Rate form (`gold-rates`), editable Settings form (`settings`), live Admin Users table (`users-roles`), CRUD for Categories/Discounts/Banners/Content, accurate Analytics math + CSV export buttons (`analytics`), dynamic status badges, sequential sidebar numbering, URL routing sync, and mobile sidebar layout (`<=1024px`). | `apps/admin/src/app/page.tsx` (refactor into modular components), `apps/admin/src/app/globals.css`, `services/api/src/app.ts` | 24 – 32h |
| **P2-2** | **Restore Storefront Homepage Visual Parity with Shopify Theme (`SF-01`–`SF-10`):** Bundle `Battlemade`, `Begum`, and `Gotham` font files in `apps/storefront/public/fonts/`; implement interactive 2-slide Hero Slideshow with prev/next arrows and exact copy/positioning; convert Bestsellers (`8` products), Shop by Price, and Testimonials to interactive carousels with prev/next arrows; fix Shop by Shape (`7` borderless shapes including `Cushion`); fix Shop by Category (`7` items in a horizontal flex row with `-48px` alternating offsets and mobile scroll-snap); restore Brand Story `#ffffff` background and `114px` script; add custom SVG icons + mobile marquee to Trust Bar; add SVG icons to Why Lab Grown; and restore Footer newsletter layout, Social links column, and mobile accordions. | `apps/storefront/src/app/page.tsx`, `apps/storefront/src/components/StorefrontShell.tsx`, `apps/storefront/src/app/globals.css`, `apps/storefront/public/fonts/` | 16 – 20h |
| **P2-3** | **Restore PDP, About Us & Responsive Mobile Layouts (`SF-11`–`SF-13`):** On PDP (`products/[handle]/page.tsx`), implement the 4-media asymmetric collage, sticky right column, quantity selector, 2×2 `.pp-meta-grid`, 4 `<details>` accordions (`Descriptions`, `Care instructions`, `Shipping`, `Returns & cancellations`), Trust Bar, and Our Bestsellers carousel. On About Us (`pages/about-us/page.tsx`), implement Section 1 split layout, Section 2 overlapping images, Section 3 SVG icons + mobile slider, Section 4 (5-image Brand Promise collage), and Section 5 (6 Mangal Group sister company cards). Replace hardcoded `70px` inline paddings with responsive CSS classes. | `apps/storefront/src/app/products/[handle]/page.tsx`, `apps/storefront/src/app/pages/about-us/page.tsx`, `apps/storefront/src/app/globals.css` | 8 – 12h |

### P3 — Live Third-Party Integrations, Testing & Production Readiness (Estimated Effort: 30 – 40 hours)

| ID | Task Description | Target Files | Est. Effort |
|---|---|---|---|
| **P3-1** | **Integrate Live Razorpay Orders, Checkout.js, Webhooks & Refunds:** Connect `POST /api/checkout/create-order` and `POST /api/admin/orders/:id/refund` to Razorpay REST API (`api.razorpay.com/v1/orders` & `/refunds`), integrate Razorpay `checkout.js` modal in `apps/storefront/src/app/checkout/page.tsx`, implement full event handling + `IntegrationEvent` idempotency in `POST /api/webhooks/razorpay` (`app.ts:1160`), and release reserved stock on `payment.failed`. | `services/api/src/app.ts`, `apps/storefront/src/app/checkout/page.tsx` | 10 – 14h |
| **P3-2** | **Integrate Live Shiprocket API & Webhooks:** Implement token authentication, live pincode serviceability (`apiv2.shiprocket.in/v1/external/courier/serviceability/`), order/AWB creation, label/manifest generation, tracking, cancellation, and `POST /api/webhooks/shiprocket`. | `services/api/src/services/shiprocket-service.ts`, `services/api/src/app.ts` | 8 – 10h |
| **P3-3** | **Integrate Live Shopify Admin GraphQL Sync (Gated by `SHOPIFY_LIVE_WRITES_ENABLED`):** Implement real `fetch()` calls in `shopify-service.ts` (`productVariantsBulkUpdate`, bulk product staged uploads) when `SHOPIFY_LIVE_WRITES_ENABLED === 'true'`. | `services/api/src/services/shopify-service.ts` | 6 – 8h |
| **P3-4** | **Add Security Middleware (`helmet`, `express-rate-limit`, CORS) & Expand Automated Test Suite:** Configure `helmet`, `express-rate-limit`, strict `CORS_ORIGIN`, isolate test DB from dev DB, and add unit/integration/E2E tests for `@mrs/shared`, `@mrs/api`, `@mrs/admin`, and `@mrs/storefront`. | `services/api/src/app.ts`, test suites across workspaces | 6 – 8h |

### P4 — Performance Optimization & Documentation Polish (Estimated Effort: 12 – 16 hours)

| ID | Task Description | Target Files | Est. Effort |
|---|---|---|---|
| **P4-1** | **Server-Side Pagination, Price Caching & Bundle Splitting:** Add cursor/offset pagination (`limit`, `page`) to `/api/products`, `/api/admin/products`, `/api/admin/orders`, and `/api/admin/audit-logs`; cache calculated price breakups on product records until rates/rules change; split `apps/admin/src/app/page.tsx` (2,407 lines) into lazy-loaded module components. | `services/api/src/app.ts`, `apps/admin/src/`, `apps/storefront/src/` | 8 – 10h |
| **P4-2** | **Documentation Synchronization:** Update `STOREFRONT_MIGRATION.md`, `SECURITY.md`, `PAYMENT_INTEGRATION.md`, `DEPLOYMENT.md`, and `README.md` to remove broken Windows `file:///c:/Users/...` URLs, document macOS PostgreSQL/Prisma setup, and reflect actual endpoints and env vars. | Root `.md` files | 4 – 6h |

---

## 21. Estimated Remaining Development Time

| Priority Tier | Scope Summary | Estimated Hours | Estimated Calendar Time (1 Senior Full-Stack Engineer) |
|---|---|---|---|
| **P0** | Mac Environment Repair, Security Fixes, Real Admin Auth & PostgreSQL/Prisma Wiring | **36 – 46 hours** | ~1.0 – 1.2 weeks |
| **P1** | Pricing Engine Fixes, Excel Importer Hardening & Storefront Functional Bug Fixes | **28 – 36 hours** | ~0.8 – 1.0 week |
| **P2** | Admin Dashboard Full CRUD Wiring (19 Modules) & Storefront 1:1 Shopify Visual Parity | **48 – 64 hours** | ~1.2 – 1.6 weeks |
| **P3** | Live Razorpay, Shiprocket & Shopify GraphQL Integrations + Security/Test Suite | **30 – 40 hours** | ~0.8 – 1.0 week |
| **P4** | Pagination, Performance Optimization for 600+ SKUs & Documentation Sync | **12 – 16 hours** | ~0.3 – 0.4 weeks |
| **TOTAL** | **Complete Production-Ready Platform Delivery** | **154 – 202 hours** | **~4.0 – 5.0 weeks (1 Engineer) or ~2.0 – 2.5 weeks (2 Engineers)** |

---

## 22. Overall Completion Percentage & Calculation Methodology

To avoid arbitrary estimates, completion is calculated across **10 weighted platform domains**, explicitly distinguishing **Code Prototype / Local Demo Implementation** from **Production Readiness** (which requires real PostgreSQL persistence, live API integrations, production security hardening, full Admin CRUD, and 1:1 Shopify visual parity):

| # | Platform Domain | Weight | Code / Local Prototype % | Production Readiness % | Evidence-Based Justification |
|---|---|---|---|---|---|
| 1 | **Database Schema & Runtime Persistence** | 12% | 50% | 15% | 40-model Prisma schema & SQL migration exist (`50%`), but PostgreSQL is not installed, Darwin engines are missing, and `0%` of runtime routes use Prisma (`data-store.ts` JSON file has auto-wipe & split-brain bugs). |
| 2 | **Jewellery Pricing Engine & Governance** | 12% | 88% | 72% | `Decimal.js` engine & 4-step workflow work (`88%`), but Tier-3 diamond fallback bug, ignored `INCLUSIVE` GST mode, ignored `pricingEnabled`, and `DRAFT` rule auto-activation must be fixed before production (`72%`). |
| 3 | **Excel Bulk Import System (11 Sheets)** | 10% | 82% | 60% | 11-sheet parser, SKU/weight validation, and CSV error generator work (`82%`), but UI has no file upload input, CSV download returns `401`, non-numeric making/cert cells crash with `DecimalError`, and rollback lacks dry-run/active-order guards (`60%`). |
| 4 | **Backend API, Catalog, Cart & Checkout** | 12% | 80% | 55% | 65 route handlers cover catalog, cart, wishlist, checkout, oversell guard, snapshots, and GST invoices (`80%`), but lack pagination, rate limiting, `helmet`, Prisma transactions, and CRUD routes for categories/discounts/banners/content (`55%`). |
| 5 | **Authentication, RBAC & Security** | 10% | 45% | 15% | Custom JWT and `requirePermission` exist (`45%`), but `x-mrs-admin-role` bypass, plaintext client credentials, backdoor passwords, passwordless customer login, static-salt SHA-256, and unauthenticated order cancel are critical P0 blockers (`15%`). |
| 6 | **Storefront Architecture & Functional Flows** | 12% | 75% | 55% | 19 Next.js App Router routes, cart drawer, wishlist, filters, and PDP breakup work (`75%`), but `/account` sign-out bug, `/pages/order-tracking` query param bug, `/search` state sync bug, PDP invalid-handle fallback bug, and 8-item offline fallback remain (`55%`). |
| 7 | **Storefront 1:1 Visual Parity with Shopify Theme** | 10% | 58% | 42% | Brand colors and page routes exist (`58%`), but custom fonts are missing from `public/fonts/`, all 6 homepage/PDP carousels are static grids, Shop by Shape/Category layouts differ, About Us misses 2 major sections, PDP misses 4 accordions + Trust Bar, and `70px` inline mobile padding overflows (`42%`). |
| 8 | **Admin Dashboard (19 Modules)** | 10% | 55% | 32% | All 19 modules render (`55%`), but 14 of 19 modules are read-only or disconnected from existing backend APIs, diamond rate form corrupts the matrix, error CSV download fails with `401`, and analytics math is flawed (`32%`). |
| 9 | **Payments (Razorpay) & Shipping (Shiprocket)** | 7% | 40% | 10% | Local state transitions and HMAC helpers exist (`40%`), but Razorpay order/refund APIs, `checkout.js`, Razorpay webhook state updates, and all Shiprocket APIs are simulated (`10%`). |
| 10 | **Automated Testing, Build & Mac DevOps** | 5% | 70% | 35% | `typecheck`, `build`, and 10/10 API/shared tests pass (`70%`), but `.git` is missing, Prisma Darwin binaries are missing, `apps/admin` and `apps/storefront` have 0 tests, and `npm test` mutates the runtime JSON file (`35%`). |
| | **WEIGHTED OVERALL COMPLETION** | **100%** | **65.8% (~66%)** | **41.1% (~41%)** | **~66% Code/Prototype Implemented \| ~41% Production-Ready** |
