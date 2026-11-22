# Automated Testing & Build Verification Report (`TESTING_REPORT.md`)

> **Code-Verified Audit Status:** Audited by running `npm test` and `npm run build` across all workspaces and inspecting [`packages/shared/src/pricing-engine.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.test.ts#L1-L232) and [`services/api/src/app.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.test.ts#L1-L214). See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Test Runner & Framework Verification

> **Correction Note:** Earlier documentation stated that Vitest `v3.0.7` was used and that `services/api/src/app.test.ts` executed HTTP requests via `supertest(app)`.
> - **Actual Installed Vitest Version:** **`2.1.9`** (declared as `^2.1.8` in `package.json`).
> - **Actual API Test Harness (`services/api/src/app.test.ts` lines 9–36):** Uses an in-memory `invokeApp(options)` helper that constructs mock `req` and `res` objects (`Object.create( app.request )` / `Object.create( app.response )`) and calls `app(req, res)` directly without binding TCP sockets. (`supertest` `7.3.1` is installed in `node_modules`, but is not imported in `app.test.ts`.)

---

## 2. Verified Automated Test Suites (`10 / 10 Tests Passing`)

Command executed: `npm test` (`npm run test --workspaces --if-present`)

### Suite 1: `@mrs/shared` — [`packages/shared/src/pricing-engine.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.test.ts#L1-L232) (`5 / 5 Passing`)

| Test # | Test Name | Verified Assertions | Status |
| :--- | :--- | :--- | :--- |
| 1 | `calculates 18K solitaire + melee ring price with exact decimal breakdown and 3% GST` | Verifies `MRS-RING-001`: `18K` (`3.500g` @ `₹5,800/g` = `₹20,300`), center + melee diamonds (`₹27,600`), making (`₹4,200`), cert (`₹500`), hallmark (`₹100`), subtotal (`₹52,700`), 3% GST (`₹1,581`), final price (`₹54,281.00`). | **PASS** |
| 2 | `derives net weight from gross weight minus diamond carats when configured` | Verifies `GROSS_MINUS_STONE_WEIGHT` mode (`5.000g` gross − `2.500ct × 0.200g/ct` = `4.500g` net), `22K` metal (`₹28,800`), `10%` making (`₹2,880`), `2%` wastage (`₹576`), `NEAREST_99` psychological rounding (`₹79,399.00`). | **PASS** |
| 3 | `rejects invalid inputs where net weight exceeds gross weight` | Verifies `validatePricingInputs()` returns `'Net weight (6g) cannot exceed gross weight (5g).'` and `calculateJewelleryPrice()` throws on invalid input. | **PASS** |
| 4 | `supports approved manual price override while retaining calculated audit fields` | Verifies `manualOverridePriceInr: 45000` overrides subtotal (`isManualOverrideApplied: true`), adds 3% GST (`₹1,350`), and yields `₹46,350.00`. | **PASS** |
| 5 | `computes batch preview delta summary accurately when gold rate increases` | Verifies `generatePricingPreviewItems()` when `18K` gold rises from `₹5,800/g` to `₹6,100/g`, increasing `MRS-RING-001` from `₹54,281.00` to `₹55,363.00` (`+₹1,082.00` / `+1.99%`). | **PASS** |

### Suite 2: `@mrs/api` — [`services/api/src/app.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.test.ts#L1-L214) (`5 / 5 Passing`)

| Test # | Test Name | Verified Assertions | Status |
| :--- | :--- | :--- | :--- |
| 1 | `verifies health check and rejects unsigned Shopify webhooks with 401` | Verifies `GET /api/health` (`200 OK`, `storeName: 'Mangal Royal Studio'`) and `POST /api/webhooks/shopify/orders-create` with invalid HMAC (`401 INVALID_WEBHOOK_SIGNATURE`). | **PASS** |
| 2 | `validates 296-row multi-sheet Excel workbook dry-run and identifies intentional row errors` | Calls `POST /api/admin/imports/default-excel` (`dryRun: true`) and asserts `totalRows === 296`, `validRows === 294`, `failedRows === 2` (`Rings` row `43` `Net Weight (g)` & `Antique` row `23` `SKU`). | **PASS** |
| 3 | `enforces RBAC on pricing run approval & publishing (Pricing Operator blocked, Owner allowed)` | Logs in as `pricing@mangalroyalstudio.com` and `owner@mangalroyalstudio.com`; verifies `PRICING_OPERATOR` can update rates and create a preview run (`200`), is blocked from approving (`403 FORBIDDEN_ROLE`), and `OWNER` can approve and publish (`200`, `status: 'PUBLISHED'`). | **PASS** |
| 4 | `supports full Product CRUD and blocks deleting products linked to active orders` | Creates product `MRS-TEST-CRUD-999` (`201`), updates stock (`200`), verifies `DELETE` on active-order SKU `MRS-RNG-101` returns `409 PRODUCT_IN_ACTIVE_ORDER`, and deletes `MRS-TEST-CRUD-999` (`200`). | **PASS** |
| 5 | `processes end-to-end cart, coupon, oversell protection, Razorpay verification, GST invoice, and partial refund` | Adds `MRS-EAR-101` to cart, applies `ENGAGEMENT10`, verifies `quantity: 999` returns `409 INSUFFICIENT_STOCK`, creates order (`201`), verifies Razorpay payment (`paymentStatus: 'PAID'`, Shiprocket AWB generated), fetches GST invoice (`711319`), and executes partial refund (`₹5,000`, `paymentStatus: 'PARTIALLY_REFUNDED'`). | **PASS** |

---

## 3. Production Build Verification (`npm run build`)

Command executed: `npm run build` (`npm run build --workspaces --if-present`)

| Workspace | Build Command | Output Artifacts | Status |
| :--- | :--- | :--- | :--- |
| `@mrs/shared` | `tsc -p tsconfig.json` | `packages/shared/dist/*.js` & `*.d.ts` | **VERIFIED (`0 errors`)** |
| `@mrs/api` | `tsc -p tsconfig.json` | `services/api/dist/*.js` & `*.d.ts` | **VERIFIED (`0 errors`)** |
| `@mrs/admin` | `next build` (Next.js `15.5.29`) | `.next/` production bundle (`/` `11.8 kB`, First Load JS `114 kB`) | **VERIFIED (`0 errors`)** |
| `@mrs/storefront` | `next build` (Next.js `15.5.29`) | `.next/` production bundle (`/` `10.1 kB`, First Load JS `112 kB`) | **VERIFIED (`0 errors`)** |
