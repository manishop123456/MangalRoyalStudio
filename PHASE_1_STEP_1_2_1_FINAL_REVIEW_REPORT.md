# Mangal Royal Studio (MRS) — Phase 1, Step 1.2.1 Final Security Review Report

**Date:** 2026-11-07  
**Project Root:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Baseline Commit:** `c7de1bc0bdb3630d4bc9e18912e110dc3d13f89c`  
**Scope:** Final Security Review of Phase 1, Step 1.2.1 (Admin Authentication & Role-Based Authorization Hardening)  

---

## 1. Order Cancellation & Refund Authorization Review

### 1.1 Finding in Initial Step 1.2.1 Implementation
During inspection of [`services/api/src/app.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts):
- `POST /api/admin/orders/:orderId/cancel` ([`app.ts:2391`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2391-L2396)) was bound to `requireAuth, requirePermission('ORDERS_VIEW')`.
- `POST /api/admin/orders/:orderId/refund` ([`app.ts:2328`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2328-L2333)) and `POST /api/payments/refund` ([`app.ts:2334`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2334-L2339)) were also bound to `requireAuth, requirePermission('ORDERS_VIEW')`.
- **Why this was a security flaw:**
  1. `ORDERS_VIEW` is a **read-only** permission intended for viewing orders (`GET /api/admin/orders`), customers (`GET /api/admin/customers`), and order reports (`GET /api/admin/reports/export.csv`).
  2. Cancelling an order (`handleCancelOrder`) mutates `order.fulfillmentStatus = 'CANCELLED'` and increments `prod.inventoryQuantity` across every line item (`CANCELLATION_RESTORE`).
  3. Refunding an order (`handleOrderRefund`) mutates `order.financialStatus` (`REFUNDED` / `PARTIALLY_REFUNDED`), creates a financial `RefundRecord`, and optionally restores stock (`RETURN_RESTORE`).
  4. Any administrator or future role granted read-only `ORDERS_VIEW` could therefore cancel orders, alter vault inventory, or issue financial refunds.
  5. Additionally, `handleCancelOrder` previously did not write an `ORDER_CANCELLED` entry to `dbStore.addAuditLog(...)`.

### 1.2 Inspection of `packages/shared/src/types.ts` & Permission Model Fix
Inspection of [`packages/shared/src/types.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/types.ts#L3-L72) showed that `PermissionCode` previously included `ORDERS_VIEW`, `PAYMENTS_VIEW`, and `SHIPMENTS_MANAGE`, but lacked a dedicated order-mutation permission (`ORDERS_MANAGE`).

We implemented the smallest justified permission-model change:
1. Added `'ORDERS_MANAGE'` to `PermissionCode` in [`packages/shared/src/types.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/types.ts#L15).
2. Granted `'ORDERS_MANAGE'` to `OWNER` and `MANAGER` in `ROLE_PERMISSIONS` (and excluded it from `PRICING_OPERATOR` and any read-only `ORDERS_VIEW` configuration).
3. Updated `POST /api/admin/orders/:orderId/cancel`, `POST /api/admin/orders/:orderId/refund`, and `POST /api/payments/refund` in [`services/api/src/app.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2328-L2396) to require `requirePermission('ORDERS_MANAGE')`.
4. Added audit logging (`action: 'ORDER_CANCELLED'`) inside `handleCancelOrder` when invoked by an authenticated administrator.
5. Also bound explicit `requirePermission('PRICING_APPROVE')`, `requirePermission('PRICING_PUBLISH')`, and `requirePermission('IMPORTS_SYNC_SHOPIFY')` alongside `requireOwnerRole` on the three Owner-only mutation routes (`POST /api/admin/pricing/runs/:runId/approve`, `POST /api/admin/pricing/runs/:runId/publish`, and `POST /api/admin/imports/:jobId/sync-shopify`).

### 1.3 Automated Test Proof
Added **Test #13** in [`services/api/src/app.test.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.test.ts#L816-L868):
- Verifies `PRICING_OPERATOR` receives `403 FORBIDDEN_INSUFFICIENT_ROLE` (`requiredPermission: 'ORDERS_MANAGE'`) on `POST /api/admin/orders/:orderId/cancel`.
- Verifies an account holding only `ORDERS_VIEW` (without `ORDERS_MANAGE`) can read `GET /api/admin/orders` (`200 OK`) but is denied `POST /api/admin/orders/:orderId/cancel` (`403 FORBIDDEN_INSUFFICIENT_ROLE`).
- Verifies `MANAGER` (holding `ORDERS_MANAGE`) can cancel an order (`200 OK`, `fulfillmentStatus === 'CANCELLED'`).

---

## 2. Token Storage Security Review (`sessionStorage` vs. `HttpOnly` Cookie)

### 2.1 Current Implementation & XSS Risk Analysis
In [`apps/admin/src/app/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L113-L250):
- After authenticating via `POST /api/auth/login`, the signed HS256 JWT is stored in `window.sessionStorage.getItem('mrs_admin_token')` and sent in `Authorization: Bearer <token>` headers.
- **Improvement over `localStorage`:** `sessionStorage` is scoped to a single browser tab and cleared automatically when the tab closes, reducing persistent at-rest exposure on shared workstations.
- **Residual XSS Risk:** Because `sessionStorage` is accessible to JavaScript running in the `apps/admin` origin, any successful Cross-Site Scripting (XSS) vulnerability in the admin dashboard, a compromised npm dependency, or a malicious browser extension could read `window.sessionStorage.getItem('mrs_admin_token')` and exfiltrate the Bearer token.

### 2.2 Evaluation of `HttpOnly`, `Secure`, `SameSite` Cookies in Current Architecture
Can an `HttpOnly; Secure; SameSite` cookie be dropped in without further architectural changes?
- **Current Topology:** The Admin UI runs as a standalone Next.js server on `http://localhost:3001` (`apps/admin`), while the Express API runs on `http://localhost:4000` (`services/api`).
- **Requirements for a Safe `HttpOnly` Cookie Migration:**
  1. **CORS Configuration (`services/api/src/app.ts:70`):** Currently `app.use(cors())` sets `Access-Control-Allow-Origin: *`. Browsers reject `Set-Cookie` and `credentials: 'include'` when `Access-Control-Allow-Origin` is `*`. The API must bind `cors({ origin: allowedOrigins, credentials: true })` and every frontend `fetch()` call must include `credentials: 'include'`.
  2. **CSRF Protection (Mandatory for Cookie Auth):** Bearer tokens in `Authorization` headers are immune to Cross-Site Request Forgery (CSRF) because browsers never attach custom headers automatically on cross-origin requests. Switching to cookie-based authentication without adding server-side CSRF protection (such as a Double-Submit CSRF token header `x-mrs-csrf-token` + strict `Origin`/`Referer` validation on all `POST`/`PUT`/`DELETE` routes) would introduce a CSRF vulnerability across all admin mutation endpoints.
  3. **Local Development vs. Production Cookie Flags:**
     - In production (HTTPS behind a shared domain or Next.js BFF rewrite proxy): `HttpOnly; Secure; SameSite=Strict; Path=/api`.
     - In local HTTP development (`localhost:3001` -> `localhost:4000`): `Secure` must be conditional (`process.env.NODE_ENV === 'production'`), and `SameSite=Lax` works across ports on `localhost`, whereas cross-domain staging deployments require a Next.js `/api/*` proxy rewrite to avoid `SameSite=None; Secure` third-party cookie blocking.

### 2.3 Recommendation & Documented Limitation
Per the review instruction (*"Do not switch authentication mechanisms without a complete working implementation and tests. If a safe cookie migration is beyond this step's scope, document it as a security limitation."*), `sessionStorage` Bearer JWT authentication is retained for Step 1.2.1 and documented as a known XSS token-storage limitation. A future hardening milestone can migrate `apps/admin` to an `HttpOnly; SameSite=Strict` cookie paired with a Next.js `/api` rewrite proxy and a synchronizer/double-submit CSRF token middleware.

---

## 3. Complete Route Authorization Audit (`services/api/src/app.ts`)

Note: The Express middleware at [`services/api/src/app.ts:81-88`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L81-L88) rewrites `/api/v1/*` to `/api/*` (and `/api/v1/health` to `/health`) before route matching, so every `/api/*` route below applies identically to `/api/v1/*`.

### 3.1 Full Express Route & Middleware Binding Table (All 56 Routes)

| # | Method & Route | Auth Middleware | Required Permission | Additional Role Restriction | Data Op | Authorization & Security Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `GET /health` | None (Public) | None | None | READ | Safe public health/count summary; no secrets exposed. |
| 2 | `POST /api/auth/login` | None (Public) | None | Active account + known role | MUTATION (Audit log) | **Hardened (Step 1.2.1):** Legacy backdoor removed; uses `verifyPassword` (`scrypt` + timing-safe SHA-256 fallback). Rate limiting recommended in future step. |
| 3 | `GET /api/auth/me` | `requireAuth` | Authenticated Admin | Active server user | READ | **Hardened (Step 1.2.1):** Resolves role & permissions from server state. |
| 4 | `GET /api/public/pricing/:handleOrSku` | None (Public) | None | None | READ | Public storefront price breakup for Shopify Liquid theme. |
| 5 | `GET /api/public/orders/track` | None (Public) | None | None | READ | **Flagged for Step 1.2.2 (Order Privacy):** Returns order/shipment by `orderNumber` or `awb` query without customer email/phone verification. |
| 6 | `GET /api/admin/overview` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | **Note (Low/Med):** Includes `recentOrders` (5) and `settings` summary for dashboard KPIs; full `/orders` and `/settings` routes are restricted. |
| 7 | `GET /api/admin/analytics` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Safe category & valuation aggregates. |
| 8 | `GET /api/admin/products` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 9 | `PUT /api/admin/pricing/products/:sku/attributes` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized & Zod-validated (`UpdateProductJewellerySpecSchema`). |
| 10 | `GET /api/admin/categories` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 11 | `GET /api/admin/inventory` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 12 | `GET /api/admin/orders` | `requireAuth` | `ORDERS_VIEW` | `OWNER`, `MANAGER` | READ | **Hardened (Step 1.2.1):** Blocks `PRICING_OPERATOR` (`403`). |
| 13 | `GET /api/admin/customers` | `requireAuth` | `ORDERS_VIEW` | `OWNER`, `MANAGER` | READ | **Hardened (Step 1.2.1):** Blocks `PRICING_OPERATOR` (`403`) and strips `passwordHash`. |
| 14 | `GET /api/admin/rates/metals` | `requireAuth` | `RATES_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 15 | `POST /api/admin/rates/metals` | `requireAuth` | `RATES_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized, Zod-validated, and audit-logged. |
| 16 | `GET /api/admin/rates/diamonds` | `requireAuth` | `RATES_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 17 | `POST /api/admin/rates/diamonds` | `requireAuth` | `RATES_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized, Zod-validated, and audit-logged. |
| 18 | `GET /api/admin/pricing/rules` | `requireAuth` | `PRICING_PREVIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 19 | `POST /api/admin/pricing/rules` | `requireAuth` | `PRICING_VALIDATE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Creates a `DRAFT` pricing rule (`status: 'DRAFT'`); active rule activation still requires Owner approval/publish. |
| 20 | `POST /api/admin/pricing/preview` | `requireAuth` | `PRICING_PREVIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Creates `PREVIEWED` pricing run; audit-logged. |
| 21 | `POST /api/admin/pricing/runs/:runId/validate` | `requireAuth` | `PRICING_VALIDATE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Transitions run to `VALIDATED`; audit-logged. |
| 22 | `POST /api/admin/pricing/runs/:runId/approve` | `requireAuth` | `PRICING_APPROVE` | `requireOwnerRole` (`OWNER` only) | MUTATION | **Hardened:** Enforces both `requireOwnerRole` and `PRICING_APPROVE`. |
| 23 | `POST /api/admin/pricing/runs/:runId/publish` | `requireAuth` | `PRICING_PUBLISH` | `requireOwnerRole` (`OWNER` only) | MUTATION | **Hardened:** Enforces both `requireOwnerRole` and `PRICING_PUBLISH`. |
| 24 | `GET /api/admin/imports` | `requireAuth` | `IMPORTS_RUN` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 25 | `POST /api/admin/imports/excel` | `requireAuth` | `IMPORTS_RUN` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | **Note for Step 1.2.2:** Uses `upload.single('file')` (20 MB limit); MIME/extension validation scheduled for Step 1.2.2 upload hardening. |
| 26 | `GET /api/admin/imports/:jobId/errors.csv` | `requireAuth` | `IMPORTS_RUN` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ (Export) | Properly authorized. |
| 27 | `POST /api/admin/imports/:jobId/sync-shopify` | `requireAuth` | `IMPORTS_SYNC_SHOPIFY` | `requireOwnerRole` (`OWNER` only) | MUTATION | **Hardened:** Bound to both `requireOwnerRole` and `IMPORTS_SYNC_SHOPIFY`. |
| 28 | `GET /api/admin/discounts` | `requireAuth` | `DISCOUNTS_MANAGE` | `OWNER`, `MANAGER` | READ | Properly authorized. |
| 29 | `GET /api/admin/banners` | `requireAuth` | `CONTENT_MANAGE` | `OWNER`, `MANAGER` | READ | Properly authorized. |
| 30 | `GET /api/admin/content` | `requireAuth` | `CONTENT_MANAGE` | `OWNER`, `MANAGER` | READ | Properly authorized. |
| 31 | `GET /api/admin/shipping/shipments` | `requireAuth` | `SHIPMENTS_MANAGE` | `OWNER`, `MANAGER` | READ | Properly authorized. |
| 32 | `POST /api/admin/orders/:orderId/shipments` | `requireAuth` | `SHIPMENTS_MANAGE` | `OWNER`, `MANAGER` | MUTATION | Properly authorized, Zod-validated, and audit-logged. |
| 33 | `GET /api/admin/payments` | `requireAuth` | `PAYMENTS_VIEW` | `OWNER`, `MANAGER` | READ | Properly authorized. |
| 34 | `GET /api/admin/users` | `requireAuth` | `USERS_MANAGE` | `OWNER` only | READ | **Hardened (Step 1.2.1):** Restricted to `OWNER`; `passwordHash` omitted. |
| 35 | `GET /api/admin/settings` | `requireAuth` | `SETTINGS_MANAGE` | `OWNER` only | READ | **Hardened (Step 1.2.1):** Restricted to `OWNER`. |
| 36 | `PUT /api/admin/settings` | `requireAuth` | `SETTINGS_MANAGE` | `requireOwnerRole` (`OWNER` only) | MUTATION | **Hardened (Step 1.2.1):** Restricted to `OWNER`; audit-logged. |
| 37 | `GET /api/admin/audit-logs` | `requireAuth` | `AUDIT_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 38 | `POST /api/webhooks/shopify` | Webhook HMAC | `verifyShopifyWebhookHmac` | Server HMAC-SHA256 | MUTATION | Verifies `x-shopify-hmac-sha256` against raw body. |
| 39 | `POST /api/webhooks/razorpay` | Webhook HMAC | `verifyRazorpaySignature` | Server HMAC-SHA256 | READ/ACK | Verifies `x-razorpay-signature` against raw body. |
| 40 | `GET /api/products` | None (Public) | None | None | READ | Public storefront catalog listing & filtering. |
| 41 | `GET /api/products/:handleOrSku` | None (Public) | None | None | READ | Public storefront product detail. |
| 42 | `POST /api/admin/products` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized & Zod-validated (`CreateProductSchema`). |
| 43 | `POST /api/products` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Alias for `handleCreateProduct`; protected by `requireAuth` + `PRODUCTS_WRITE`. |
| 44 | `DELETE /api/admin/products/:sku` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized; includes active-order deletion guard. |
| 45 | `DELETE /api/products/:sku` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Alias for `handleDeleteProduct`; protected by `requireAuth` + `PRODUCTS_WRITE`. |
| 46 | `GET /api/collections` | None (Public) | None | None | READ | Public storefront collections list. |
| 47 | `GET /api/collections/:handle` | None (Public) | None | None | READ | Public storefront collection detail. |
| 48 | `POST /api/admin/inventory/adjust` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Properly authorized, Zod-validated, and audit-logged. |
| 49 | `POST /api/inventory/adjust` | `requireAuth` | `PRODUCTS_WRITE` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | MUTATION | Alias for `handleAdjustInventory`; protected by `requireAuth` + `PRODUCTS_WRITE`. |
| 50 | `GET /api/admin/inventory/movements` | `requireAuth` | `PRODUCTS_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Properly authorized. |
| 51 | `POST /api/admin/imports/:jobId/rollback` | `requireAuth` | `IMPORTS_RUN` | `requireOwnerRole` (`OWNER` only) | MUTATION | Properly restricted to `OWNER` with audit logging. |
| 52 | `POST /api/auth/register` | None (Public) | None | None | MUTATION | Customer registration (`scrypt` password hash stored; `passwordHash` omitted from response). |
| 53 | `POST /api/auth/customer/login` | None (Public) | None | None | READ | **CRITICAL (Queued for Step 1.2.2):** Currently looks up customer by email without verifying `customer.passwordHash` and returns customer profile + orders without issuing a customer token. |
| 54 | `GET /api/cart/:cartId` | None (Public) | None | Possession of `cartId` | READ/INIT | Public storefront cart lookup. |
| 55 | `POST /api/cart/:cartId/items` | None (Public) | None | Possession of `cartId` | MUTATION | Public storefront cart item addition with stock check. |
| 56 | `DELETE /api/cart/:cartId/items/:itemId` | None (Public) | None | Possession of `cartId` | MUTATION | Public storefront cart item removal. |
| 57 | `POST /api/cart/:cartId/discount` | None (Public) | None | Possession of `cartId` | MUTATION | Public storefront coupon application. |
| 58 | `GET /api/wishlist/:wishlistId` | None (Public) | None | Possession of `wishlistId` | READ | Public storefront wishlist lookup. |
| 59 | `POST /api/wishlist/:wishlistId/toggle` | None (Public) | None | Possession of `wishlistId` | MUTATION | Public storefront wishlist toggle. |
| 60 | `POST /api/checkout/create-order` | None (Public) | None | None | MUTATION | Storefront guest/customer order creation with stock deduction & immutable pricing snapshot. |
| 61 | `POST /api/payments/razorpay/verify` | None (Public) | None | Signature check | MUTATION | **CRITICAL (Queued for Step 1.2.2):** Accepts `razorpaySignature.startsWith('sig_verified_')` bypass (`app.ts:2199`). Must enforce strict HMAC-SHA256 verification in Step 1.2.2. |
| 62 | `POST /api/admin/orders/:orderId/refund` | `requireAuth` | `ORDERS_MANAGE` | `OWNER`, `MANAGER` | MUTATION | **Fixed in Final Review:** Upgraded from `ORDERS_VIEW` to `ORDERS_MANAGE`. |
| 63 | `POST /api/payments/refund` | `requireAuth` | `ORDERS_MANAGE` | `OWNER`, `MANAGER` | MUTATION | **Fixed in Final Review:** Upgraded from `ORDERS_VIEW` to `ORDERS_MANAGE`. |
| 64 | `POST /api/admin/orders/:orderId/cancel` | `requireAuth` | `ORDERS_MANAGE` | `OWNER`, `MANAGER` | MUTATION | **Fixed in Final Review:** Upgraded from `ORDERS_VIEW` to `ORDERS_MANAGE` + added `ORDER_CANCELLED` audit log. |
| 65 | `POST /api/orders/:orderId/cancel` | None (Public!) | None | None | MUTATION | **CRITICAL (Queued for Step 1.2.2):** Unauthenticated storefront route bound to `handleCancelOrder` (`app.ts:2397`). Any caller knowing `:orderId` (e.g., `MRS-1041`) can cancel an order without authentication. |
| 66 | `GET /api/orders/:orderId/invoice` | None (Public!) | None | None | READ | **HIGH (Queued for Step 1.2.2):** Unauthenticated invoice route (`app.ts:2400`) returns buyer PII (name, email, phone, address) for any `:orderId`. |
| 67 | `GET /api/shipping/serviceability` | None (Public) | None | None | READ | Safe public 6-digit PIN code courier serviceability check. |
| 68 | `GET /api/admin/reports/export.csv` | `requireAuth` | `ORDERS_VIEW` | `OWNER`, `MANAGER` | READ (Export) | Protected by `requireAuth` + `ORDERS_VIEW`. |
| 69 | `GET /api/docs.json` | None (Public) | None | None | READ | Static OpenAPI 3.1 route summary metadata. |
| 70 | `GET /api/roles` | `requireAuth` | `AUDIT_VIEW` | `OWNER`, `MANAGER`, `PRICING_OPERATOR` | READ | Returns static `ROLE_PERMISSIONS` matrix to authenticated admins. |

*(Note: Counting multi-path aliases `/api/admin/products` + `/api/products`, `/api/admin/inventory/adjust` + `/api/inventory/adjust`, `/api/admin/orders/:orderId/refund` + `/api/payments/refund`, and `/api/admin/orders/:orderId/cancel` + `/api/orders/:orderId/cancel`, there are 56 `app.<method>` registrations covering 70 total route bindings including aliases.)*

### 3.2 Summary of Critical / High Findings Outside Step 1.2.1 Scope (Queued for Step 1.2.2)
All **Admin** routes (`/api/admin/*`, `/api/auth/login`, `/api/auth/me`, `/api/roles`) are now properly authenticated and authorized. The complete route audit confirmed **four critical/high storefront/payment issues** that belong to **Phase 1, Step 1.2.2**:
1. **`POST /api/auth/customer/login` ([`app.ts:1796`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L1796-L1829)) — CRITICAL:** Does not verify `customer.passwordHash` and does not issue a signed customer token.
2. **`POST /api/orders/:orderId/cancel` ([`app.ts:2397`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2397)) — CRITICAL:** Unauthenticated public endpoint allowing anyone to cancel any order by ID/number and restore stock.
3. **`POST /api/payments/razorpay/verify` ([`app.ts:2199`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2199)) — CRITICAL:** Accepts `sig_verified_*` test prefix bypass instead of strict HMAC-SHA256 verification.
4. **`GET /api/orders/:orderId/invoice` ([`app.ts:2400`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L2400)) & `GET /api/public/orders/track` ([`app.ts:231`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts#L231)) — HIGH:** Expose customer PII and order details by sequential order number (`MRS-1041`) without customer authentication or ownership verification.

---

## 4. Verification Results

### 4.1 Automated Security Tests & Typechecks
- `npm run build --workspace=@mrs/shared`: **PASSED** (0 errors)
- `npm run typecheck` (`@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront`): **PASSED** (0 errors)
- `npm test`: **23/23 tests PASSED** (`3` in `@mrs/shared`, `20` in `@mrs/api`, including all **13** Step 1.2.1 security tests)
- `npm run build --workspace=@mrs/api`: **PASSED**
- `npm run build --workspace=@mrs/admin`: **PASSED** (Next.js 15.5.29 production build)

### 4.2 Physical JSON State File Checksum Verification
| File Path | Size (Bytes) | Modification Timestamp | SHA-256 Checksum | Status |
| :--- | :--- | :--- | :--- | :--- |
| `.data/platform-state.json` | `70127` | `2026-11-05 16:50:54 +0530` | `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` | **IDENTICAL TO BASELINE** |
| `services/api/.data/platform-state.json` | `3112142` | `2026-11-07 15:29:38 +0530` | `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` | **IDENTICAL TO BASELINE** |

### 4.3 Shopify Theme Directories Verification
- `git status --short -- jewellery-theme-backup apps/shopify-theme` returned empty (`0` modified, added, or deleted files). Both `jewellery-theme-backup/` and `apps/shopify-theme/` remain 100% untouched.

### 4.4 Final Git Diff Summary
```
 PROGRESS.md                          |   4 +-
 apps/admin/src/app/page.tsx          | 408 ++++++++++++++++++++++++++---------
 packages/shared/src/types.ts         |   3 +
 services/api/src/app.test.ts         | 375 ++++++++++++++++++++++++++++++++
 services/api/src/app.ts              | 368 +++++++++++++++++++++----------
 services/api/src/index.ts            |   3 +
 services/api/src/middleware/auth.ts  | 240 ++++++++++++++++-----
 services/api/src/store/data-store.ts |  60 +++++-
 8 files changed, 1191 insertions(+), 270 deletions(-)
```

---

## 5. Conclusion & Sign-Off Gate

Phase 1, Step 1.2.1 (including the `ORDERS_MANAGE` mutation permission hardening and complete 70-binding route audit) is complete and verified.

Stopping here and awaiting explicit approval before proceeding to **Phase 1, Step 1.2.2**.
