# Mangal Royal Studio — Phase 1, Step 1.2.2 Security Hardening Report
## Customer Authentication, Order Privacy & Payment Security Hardening

**Date:** 2026-11-07  
**Project Root:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Baseline Commit:** `c7de1bc0bdb3630d4bc9e18912e110dc3d13f89c`  
**Phase / Step:** Phase 1, Step 1.2.2 — Customer Authentication, Order Privacy & Payment Security Hardening  
**Status:** COMPLETED & VERIFIED

---

## 1. Executive Summary

Phase 1, Step 1.2.2 remediated four critical storefront, order, and payment security vulnerabilities identified in the Phase 0 and Step 1.2.1 security audits:

1. **Passwordless Customer Login & Missing Customer Session Tokens (`POST /api/auth/customer/login`, `POST /api/auth/register`):**
   - Previously, `POST /api/auth/customer/login` accepted `password` in `LoginInputSchema` and completely ignored it—returning the customer profile and full order history for any matching email address without verifying `customer.passwordHash` or issuing a token.
   - Customer login now verifies `customer.isActive !== false`, `Boolean(customer.passwordHash)`, and `verifyPassword(password, customer.passwordHash)` (`scrypt` + migration-compatible legacy SHA-256 verification), returning a generic `401 INVALID_CREDENTIALS` response on any failure and issuing a signed HS256 Customer JWT (`purpose: 'CUSTOMER'`) on success.
2. **Strict Token Domain Separation (`ADMIN` vs `CUSTOMER` vs `ORDER_ACCESS`):**
   - Admin JWTs now carry `purpose: 'ADMIN'`, Customer JWTs carry `purpose: 'CUSTOMER'`, and Guest Checkout Order Tokens carry `purpose: 'ORDER_ACCESS'`.
   - `verifyAdminToken` explicitly rejects any token where `purpose !== 'ADMIN'` (if `purpose` is present), and `verifyCustomerToken` requires `purpose === 'CUSTOMER'` and `role === undefined`. Customer tokens can never authenticate against `/api/admin/*`, and Admin tokens can never authenticate against customer-only routes (`/api/auth/customer/me`, `/api/customer/orders`).
3. **Unauthenticated Order Cancellation (`POST /api/orders/:orderId/cancel`):**
   - Previously, `POST /api/orders/:orderId/cancel` was completely unauthenticated and allowed anyone to cancel any order and inflate product inventory.
   - `POST /api/orders/:orderId/cancel` is now protected by `requireCustomerAuth` and verifies server-side ownership (`order.customerId === customer.id || order.customerEmail.toLowerCase() === customer.email.toLowerCase()`), blocks cancellation of already shipped/fulfilled orders (`409 ORDER_NOT_CANCELLABLE`), and keeps repeated cancellation idempotent (`idempotent: true`) so stock is never restored more than once. Admin cancellation remains on `POST /api/admin/orders/:orderId/cancel` protected by `requireAuth` and `requirePermission('ORDERS_MANAGE')`.
4. **Razorpay Signature Bypass (`POST /api/payments/razorpay/verify`):**
   - Previously, `services/api/src/app.ts` contained `razorpaySignature.startsWith('sig_verified_') || process.env.NODE_ENV !== 'production'`, allowing any forged signature with `sig_verified_*` in production and any arbitrary string in non-production to mark orders `PAID`.
   - Both bypasses have been completely removed. Payment verification now requires a valid server-side `RAZORPAY_KEY_SECRET` (failing with `503 PAYMENT_CONFIGURATION_ERROR` if unset/empty or placeholder in production), verifies `HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, secret)` via `crypto.timingSafeEqual`, validates `razorpayOrderId` against the order's recorded checkout Razorpay order ID (`400 ORDER_PAYMENT_MISMATCH`), validates optional `amountPaise` and `currency` integrity (`400 PAYMENT_AMOUNT_MISMATCH` / `400 PAYMENT_CURRENCY_MISMATCH`), and enforces idempotent replay safety (`idempotent: true` on identical `razorpayPaymentId`, `409 ORDER_ALREADY_PAID` on conflicting `razorpayPaymentId`).
5. **Public GST Invoice & Order Tracking PII Exposure (`GET /api/orders/:orderId/invoice`, `GET /api/public/orders/track`):**
   - `GET /api/orders/:orderId/invoice` now requires either an authenticated Admin with `ORDERS_VIEW`, an authenticated Customer who owns the order (`403 FORBIDDEN_NOT_ORDER_OWNER` for other customers), or a signed order-scoped `x-mrs-order-token` (`purpose: 'ORDER_ACCESS'`) issued at checkout creation. Unauthenticated sequential lookups are rejected with `401 UNAUTHORIZED`.
   - `GET /api/public/orders/track` no longer returns the raw `order` object or any customer PII (`customerName`, `customerEmail`, `customerPhone`, `shippingCity`, `shippingState`, `shippingPincode`, `lineItems`, `razorpayPaymentId`). It returns only sanitized shipment tracking metadata (`tracking` and sanitized `shipment`).

---

## 2. Pre-Implementation Verification Results

1. **Working Directory:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`
2. **Git Baseline Commit (`HEAD`):** `c7de1bc0bdb3630d4bc9e18912e110dc3d13f89c`
3. **External State File Backup Created Prior to Edits:**
   - `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/step-1-2-2-state-backup/root-data/platform-state.json`
   - `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/step-1-2-2-state-backup/api-data/platform-state.json`
4. **Pre-Implementation JSON State Checksums:**
   - `.data/platform-state.json`: `70,127` bytes | `mtime=2026-11-05T16:50:54+0530` | SHA-256 `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`
   - `services/api/.data/platform-state.json`: `3,112,142` bytes | `mtime=2026-11-07T15:29:38+0530` | SHA-256 `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f`
5. **Shopify Theme Directories Status:** `0` modified files in `jewellery-theme-backup/` and `apps/shopify-theme/`.

---

## 3. Vulnerabilities Found in Customer Auth, Orders, Payments & Privacy

| ID | Area | Location | Vulnerability Found | Risk | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **V-1.2.2-01** | Customer Auth | `services/api/src/app.ts` (`POST /api/auth/customer/login`) | Accepted password in request body but never called `verifyPassword`, allowing login with any password for any customer email and returning all matching orders without issuing a token. | Critical | **FIXED** |
| **V-1.2.2-02** | Token Separation | `services/api/src/middleware/auth.ts` | No customer token verification middleware or token `purpose` claim separation existed. | High | **FIXED** |
| **V-1.2.2-03** | Order Cancellation | `services/api/src/app.ts` (`POST /api/orders/:orderId/cancel`) | Completely unauthenticated endpoint allowed any caller to cancel any order and restore product stock. | Critical | **FIXED** |
| **V-1.2.2-04** | Razorpay Verification | `services/api/src/app.ts` (`POST /api/payments/razorpay/verify`) & `apps/storefront/src/app/checkout/page.tsx` | Accepted synthetic `sig_verified_*` signatures in all environments and bypassed HMAC verification whenever `NODE_ENV !== 'production'`. Did not verify that `razorpayOrderId` belonged to the target order. | Critical | **FIXED** |
| **V-1.2.2-05** | Invoice Privacy | `services/api/src/app.ts` (`GET /api/orders/:orderId/invoice`) | Unauthenticated sequential lookup (`ord-1041`, `MRS-1041`) exposed buyer name, email, phone, city/state/pincode, GST details, and line items. | High | **FIXED** |
| **V-1.2.2-06** | Public Order Tracking | `services/api/src/app.ts` (`GET /api/public/orders/track`) | Returned the full `order` record (buyer PII, email, phone, address, payment ID, line items) alongside `shipment`. | High | **FIXED** |

---

## 4. Customer Authentication Implementation Details

- **Password Hashing & Verification (`services/api/src/store/data-store.ts`, `services/api/src/app.ts`):**
  - `POST /api/auth/register` hashes customer passwords using `hashPassword` (`scrypt` with 16-byte random salt and 64-byte derived key, `scrypt$<saltHex>$<keyHex>`), stores `isActive: true`, strips `passwordHash` from the response, and returns a signed customer JWT (`token`).
  - `DataStore` constructor hydrates missing `passwordHash` and `isActive` fields in memory for the 3 seeded demo accounts (`cust-001`, `cust-002`, `cust-003`) from `createInitialSeedState()` without mutating the physical JSON state files on disk.
  - `POST /api/auth/customer/login` verifies `customer && customer.isActive !== false && Boolean(customer.passwordHash) && verifyPassword(parsed.data.password, customer.passwordHash)`. Any failure returns a uniform `401 INVALID_CREDENTIALS` (`"Invalid email or password."`) to prevent email enumeration.
- **Customer JWT & Token Domain Separation (`services/api/src/middleware/auth.ts`):**
  - `signCustomerToken({ id, email })` signs an HS256 JWT containing `{ id, email, purpose: 'CUSTOMER', iat, exp }`.
  - `verifyCustomerToken(token)` validates the 3-part JWT format, `alg === 'HS256'`, constant-time HMAC-SHA256 signature (`crypto.timingSafeEqual`), `decoded.purpose === 'CUSTOMER'`, `decoded.role === undefined`, mandatory `exp > nowSec`, and active server-side customer record (`serverCustomer.isActive !== false && Boolean(serverCustomer.passwordHash)`).
  - `verifyAdminToken(token)` rejects any token where `decoded.purpose !== undefined && decoded.purpose !== 'ADMIN'`.
- **Authenticated Customer Routes:**
  - `GET /api/auth/customer/me` and `GET /api/customer/orders` (protected by `requireCustomerAuth`) return the authenticated customer's sanitized profile and only orders owned by that customer (`o.customerId === customer.id || o.customerEmail.toLowerCase() === customer.email.toLowerCase()`).
- **Rate Limiting:**
  - Added `createRateLimiter` in `services/api/src/middleware/auth.ts` and bound it to `/api/auth/login`, `/api/auth/register`, `/api/auth/customer/login`, `/api/public/orders/track`, and `/api/payments/razorpay/verify`.

---

## 5. Order Cancellation Security Details

- **Admin Order Cancellation (`POST /api/admin/orders/:orderId/cancel`):**
  - Protected by `requireAuth` and `requirePermission('ORDERS_MANAGE')` (`OWNER` and `MANAGER` only; `PRICING_OPERATOR` denied with `403`).
- **Customer Order Cancellation (`POST /api/orders/:orderId/cancel`):**
  - Protected by `requireCustomerAuth`. Unauthenticated requests are rejected with `401 UNAUTHORIZED`.
  - Verifies server-side order ownership (`order.customerId === customer.id || order.customerEmail.toLowerCase() === customer.email.toLowerCase()`). Cross-customer cancellation attempts are rejected with `403 FORBIDDEN_NOT_ORDER_OWNER`.
  - Prevents self-cancellation of orders already in `IN_TRANSIT` or `FULFILLED` status (`409 ORDER_NOT_CANCELLABLE`).
  - **Idempotent Stock Restoration:** `executeOrderCancellation` only transitions `order.fulfillmentStatus = 'CANCELLED'`, restores `prod.inventoryQuantity`, creates `CANCELLATION_RESTORE` inventory movements, and appends an `ORDER_CANCELLED` audit log when `order.fulfillmentStatus !== 'CANCELLED'`. Subsequent calls return `{ order, idempotent: true }` without restoring stock a second time.

---

## 6. Razorpay Verification Security Details

- **Complete Removal of Bypasses (`services/api/src/services/shiprocket-service.ts`, `services/api/src/app.ts`):**
  - Removed `razorpaySignature.startsWith('sig_verified_')` and `process.env.NODE_ENV !== 'production'` from `POST /api/payments/razorpay/verify`.
  - Removed the synthetic `razorpaySignature: \`sig_verified_${Date.now()}\`` call from `apps/storefront/src/app/checkout/page.tsx`.
- **Secret Configuration & Constant-Time HMAC Verification:**
  - `getRazorpayKeySecret()` validates that `RAZORPAY_KEY_SECRET` is configured and rejects empty or placeholder secrets (`replace_me_rzp_secret`, `changeme`, `secret`), returning `503 PAYMENT_CONFIGURATION_ERROR` if missing.
  - `verifyRazorpayCheckoutSignature` computes `HMAC-SHA256("${razorpayOrderId}|${razorpayPaymentId}", secret)` in hex and compares buffers using `crypto.timingSafeEqual`.
- **Order Binding, Amount/Currency Integrity & Replay Safety:**
  - Verifies `razorpayOrderId` matches the order's recorded `razorpayOrderId` (`400 ORDER_PAYMENT_MISMATCH` on mismatch).
  - Verifies optional `amountPaise === Math.round(Number(order.totalPriceInr) * 100)` (`400 PAYMENT_AMOUNT_MISMATCH`) and `currency === 'INR'` (`400 PAYMENT_CURRENCY_MISMATCH`).
  - If `order.financialStatus === 'PAID'` with the same `razorpayPaymentId`, returns `200 OK` with `{ verified: true, idempotent: true, order, payment }` without creating duplicate `PaymentRecordItem` or `NotificationRecord` entries. If already `PAID` with a different `razorpayPaymentId`, rejects with `409 ORDER_ALREADY_PAID`.

---

## 7. Invoice & Order Tracking Privacy Details

- **GST Tax Invoices (`GET /api/orders/:orderId/invoice`):**
  - Requires one of:
    1. Valid Admin Bearer JWT with `ORDERS_VIEW` permission (`OWNER` or `MANAGER`),
    2. Valid Customer Bearer JWT whose server-side record owns the order (`403 FORBIDDEN_NOT_ORDER_OWNER` if another customer attempts access), or
    3. Valid signed order-scoped token (`x-mrs-order-token` header or `?token=` query parameter, `purpose: 'ORDER_ACCESS'`) issued by `POST /api/checkout/create-order`.
  - Unauthenticated requests are rejected with `401 UNAUTHORIZED`.
- **Public Order Tracking (`GET /api/public/orders/track`):**
  - Strips the raw `order` object and all buyer PII (`customerName`, `customerEmail`, `customerPhone`, `shippingCity`, `shippingState`, `shippingPincode`, `lineItems`, `razorpayPaymentId`, `totalPriceInr`).
  - Returns only sanitized tracking metadata (`tracking: { orderNumber, fulfillmentStatus, awbCode, courierName, status, latestMilestone, isInsured, trackingHistory }` and sanitized `shipment`).

---

## 8. Storefront Compatibility Changes

All storefront visual designs, layouts, colors, typography, and components remain 100% unchanged. Minimal state/fetch updates were applied to:

- [`apps/storefront/src/components/StorefrontShell.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx): Added `customerToken` state persisted in `sessionStorage` (`mrs_customer_token_v1`) alongside `mrs_customer_v1`, cleared on sign-out.
- [`apps/storefront/src/app/account/login/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/account/login/page.tsx): Stores `(data.customer, data.token)` on valid `200 OK` login and displays an error message on `401` instead of fabricating an unauthenticated fallback profile.
- [`apps/storefront/src/app/account/register/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/account/register/page.tsx): Stores `(data.customer, data.token)` returned by `POST /api/auth/register`.
- [`apps/storefront/src/app/checkout/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/checkout/page.tsx): Attaches `Authorization: Bearer ${customerToken}` when logged in, stores `data.orderAccessToken` in `sessionStorage`, and removes the synthetic `sig_verified_*` call.
- [`apps/storefront/src/app/pages/order-tracking/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/pages/order-tracking/page.tsx): Reads the sanitized `data.tracking` and `data.shipment` payload returned by `GET /api/public/orders/track`.

---

## 9. Updated Route Authorization Summary for Affected Endpoints

| HTTP Method & Route | Auth Middleware / Verification | Required Permission / Ownership | Operation | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/register` | `authRateLimit` (public registration) | Public | Modifies (`customers`) | Hashes password (`scrypt`), strips `passwordHash`, issues `CUSTOMER` JWT |
| `POST /api/auth/customer/login` | `authRateLimit` (public login) | Valid customer email + password (`verifyPassword`) | Reads (`customers`, `orders`) | Rejects wrong password, unknown email, inactive, or passwordless accounts with `401` |
| `GET /api/auth/customer/me` | `requireCustomerAuth` | Authenticated `CUSTOMER` JWT | Reads (`customers`, `orders`) | Returns own customer profile + own orders only |
| `GET /api/customer/orders` | `requireCustomerAuth` | Authenticated `CUSTOMER` JWT | Reads (`orders`) | Returns own orders only (`401` for Admin tokens or unauthenticated callers) |
| `POST /api/checkout/create-order` | `optionalCustomerAuth` | Public / Optional Customer | Modifies (`orders`, `products`, `pricingSnapshots`) | Binds `customerId` if authenticated, records `razorpayOrderId`, issues `orderAccessToken` |
| `POST /api/payments/razorpay/verify` | `paymentVerifyRateLimit` + HMAC-SHA256 verification | Valid Razorpay HMAC signature + matching `razorpayOrderId` | Modifies (`orders`, `payments`, `notifications`) | `sig_verified_*` and non-prod bypasses removed; idempotent replay protection |
| `POST /api/orders/:orderId/cancel` | `requireCustomerAuth` | Authenticated Customer owning `order` | Modifies (`orders`, `products`, `inventoryMovements`, `auditLogs`) | `401` unauthenticated, `403` cross-customer, `409` shipped/fulfilled, idempotent stock restore |
| `POST /api/admin/orders/:orderId/cancel` | `requireAuth`, `requirePermission('ORDERS_MANAGE')` | `ORDERS_MANAGE` (`OWNER`, `MANAGER`) | Modifies (`orders`, `products`, `inventoryMovements`, `auditLogs`) | Idempotent stock restore + audit log |
| `GET /api/orders/:orderId/invoice` | Admin JWT (`ORDERS_VIEW`) OR Customer JWT (owner) OR `x-mrs-order-token` | `ORDERS_VIEW` or Order Owner | Reads (`orders`, `settings`) | Rejects unauthenticated sequential lookups (`401`) and cross-customer access (`403`) |
| `GET /api/public/orders/track` | `publicTrackingRateLimit` | Public (`orderNumber` or `awb`) | Reads (`orders`, `shipments`) | Returns sanitized milestone tracking only; all customer PII stripped |

---

## 10. Automated Tests Added & Updated

Updated [`services/api/src/app.test.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.test.ts) with 8 comprehensive multi-assertion security tests in `Phase 1, Step 1.2.2 — Customer Authentication, Order Privacy & Payment Security Hardening` (bringing the total test suite to **31 passing tests**: `3` in `@mrs/shared` + `28` in `@mrs/api`):

1. **Test 1:** Verifies customer registration hashes passwords (`scrypt$...`), never exposes `passwordHash`, and returns a valid customer JWT.
2. **Test 2:** Verifies customer login succeeds with the valid password and fails with `401 INVALID_CREDENTIALS` for wrong password, unknown email, deactivated (`isActive: false`) account, or passwordless account.
3. **Test 3:** Verifies strict token separation—customer JWTs are rejected (`401`) on `/api/admin/overview` and `/api/admin/orders/:id/cancel`, and admin JWTs are rejected (`401`) on `/api/auth/customer/me` and `/api/customer/orders`.
4. **Test 4:** Verifies `GET /api/customer/orders` scopes returned orders strictly to the authenticated customer (`ananya.sharma@example.com` vs `rohan.mehta@example.com`).
5. **Test 5:** Verifies `POST /api/orders/:orderId/cancel` rejects unauthenticated callers (`401`), rejects cross-customer cancellation (`403 FORBIDDEN_NOT_ORDER_OWNER`), allows the owning customer to cancel an unfulfilled order once (restoring stock), and keeps repeated cancellation idempotent (`idempotent: true`, no duplicate stock restoration).
6. **Test 6:** Verifies `POST /api/payments/razorpay/verify` rejects `sig_verified_*` (`401`), rejects invalid HMAC signatures in non-production (`401`), fails securely (`503 PAYMENT_CONFIGURATION_ERROR`) when `RAZORPAY_KEY_SECRET` is empty, rejects valid signatures signed for a different `razorpayOrderId` (`400 ORDER_PAYMENT_MISMATCH`), rejects tampered `amountPaise` (`400 PAYMENT_AMOUNT_MISMATCH`), succeeds on a valid HMAC-SHA256 signature, handles replay idempotently (`idempotent: true`), and rejects a second conflicting `razorpayPaymentId` (`409 ORDER_ALREADY_PAID`).
7. **Test 7:** Verifies `GET /api/orders/:orderId/invoice` rejects unauthenticated callers (`401`), rejects cross-customer access (`403 FORBIDDEN_NOT_ORDER_OWNER`), and permits the owning customer (`200`), guest with signed `x-mrs-order-token` (`200`), or admin with `ORDERS_VIEW` (`200`).
8. **Test 8:** Verifies `GET /api/public/orders/track` returns sanitized shipment milestones (`tracking`, `shipment`) and omits `order`, customer name, email, phone, pincode, and payment ID.

---

## 11. Verification Command Results

| Command | Result | Details |
| :--- | :--- | :--- |
| `npm run build --workspace=@mrs/shared` | **PASS** (`exit 0`) | Compiled updated `RazorpayVerifyPaymentSchema` to `packages/shared/dist` |
| `npm run typecheck` | **PASS** (`exit 0`) | `@mrs/shared`, `@mrs/api`, `@mrs/admin`, and `@mrs/storefront` all passed `tsc --noEmit` with `0` errors |
| `npm test` | **PASS** (`exit 0`) | `3/3` passed in `@mrs/shared`, `28/28` passed in `@mrs/api` (**31/31 total**) |
| `npm run build --workspace=@mrs/api` | **PASS** (`exit 0`) | TypeScript build succeeded cleanly |
| `npm run build --workspace=@mrs/admin` | **PASS** (`exit 0`) | Next.js 15.5.29 production build succeeded (`4/4` static pages) |
| `npm run build --workspace=@mrs/storefront` | **PASS** (`exit 0`) | Next.js 15.5.29 production build succeeded (`19/19` static/dynamic routes) |

---

## 12. Data File Integrity Verification (Before vs After Checksums)

| File Path | Pre-Step-1.2.2 Size | Post-Step-1.2.2 Size | Pre-Step-1.2.2 SHA-256 | Post-Step-1.2.2 SHA-256 | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `.data/platform-state.json` | `70,127` bytes | `70,127` bytes | `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` | `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` | **IDENTICAL (UNTOUCHED)** |
| `services/api/.data/platform-state.json` | `3,112,142` bytes | `3,112,142` bytes | `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` | `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` | **IDENTICAL (UNTOUCHED)** |

---

## 13. Shopify Theme Untouched Verification

- `git status --short jewellery-theme-backup apps/shopify-theme` returned empty output (`0` modified, added, or deleted files).

---

## 14. Files Created or Modified

### Modified Files
- [`packages/shared/src/schemas.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/schemas.ts) — Added optional `amountPaise` and `currency` fields to `RazorpayVerifyPaymentSchema`.
- [`services/api/src/store/data-store.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/store/data-store.ts) — Added `razorpayOrderId?: string` on `OrderRecord`, expanded `AuditLogRecord.actorRole` union to include `'CUSTOMER' | 'SYSTEM'`, and hydrated missing `passwordHash` and `isActive` on seeded demo customers in memory without mutating disk files.
- [`services/api/src/middleware/auth.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/middleware/auth.ts) — Added `AuthenticatedCustomer`, `signCustomerToken`, `verifyCustomerToken`, `requireCustomerAuth`, `optionalCustomerAuth`, `signOrderAccessToken`, `verifyOrderAccessToken`, `createRateLimiter`, and strict `purpose` domain separation between `ADMIN`, `CUSTOMER`, and `ORDER_ACCESS` tokens.
- [`services/api/src/services/shiprocket-service.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/services/shiprocket-service.ts) — Added `getRazorpayKeySecret` and `verifyRazorpayCheckoutSignature` (constant-time HMAC-SHA256 verification, rejecting `sig_verified_*` and placeholder secrets).
- [`services/api/src/app.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts) — Hardened `/api/auth/register`, `/api/auth/customer/login`, `/api/auth/customer/me`, `/api/customer/orders`, `/api/checkout/create-order`, `/api/payments/razorpay/verify`, `/api/orders/:orderId/cancel`, `/api/admin/orders/:orderId/cancel`, `/api/orders/:orderId/invoice`, and `/api/public/orders/track`.
- [`services/api/src/app.test.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.test.ts) — Updated checkout integration test to use real HMAC-SHA256 signature + `x-mrs-order-token` and added 8 Step 1.2.2 security test suites.
- [`apps/storefront/src/components/StorefrontShell.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx) — Added `customerToken` session management in `sessionStorage`.
- [`apps/storefront/src/app/account/login/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/account/login/page.tsx) — Connected login page to store customer JWT and display error state on invalid credentials.
- [`apps/storefront/src/app/account/register/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/account/register/page.tsx) — Connected registration page to store issued customer JWT.
- [`apps/storefront/src/app/checkout/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/checkout/page.tsx) — Removed synthetic `sig_verified_*` call, passed customer Bearer token when authenticated, and stored `orderAccessToken`.
- [`apps/storefront/src/app/pages/order-tracking/page.tsx`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/pages/order-tracking/page.tsx) — Updated to read sanitized `tracking` and `shipment` payload.
- [`PROGRESS.md`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PROGRESS.md) — Recorded Phase 1, Step 1.2.2 completion.

### Created Files
- [`PHASE_1_STEP_1_2_2_SECURITY_HARDENING_REPORT.md`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PHASE_1_STEP_1_2_2_SECURITY_HARDENING_REPORT.md) — This report.

---

## 15. Remaining Security Limitations Deferred to Later Steps

1. **Browser Token Storage (`sessionStorage`):** Both Admin (`mrs_admin_session_v2`) and Customer (`mrs_customer_token_v1`) JWTs are stored in browser `sessionStorage`. Moving to `HttpOnly; Secure; SameSite=Lax` cookies with CSRF double-submit tokens and reverse-proxy origin alignment is deferred to production deployment hardening.
2. **In-Memory Rate Limiting & Persistence:** Rate limiting buckets (`createRateLimiter`) and application state currently reside in memory / JSON state files until PostgreSQL + Prisma runtime migration is executed in Phase 1, Step 1.3.
3. **Live Razorpay Order Creation API:** Checkout currently generates deterministic local `order_MrsRzp*` order IDs and verifies `HMAC-SHA256(razorpayOrderId|razorpayPaymentId, RAZORPAY_KEY_SECRET)` server-side. Server-to-server `orders.create` calls against the live Razorpay REST API require live merchant credentials in `.env`.

---

## 16. Readiness Confirmation for Phase 1, Step 1.2.3

Phase 1, Step 1.2.2 is complete, tested (`31/31` tests passing), typechecked (`4/4` workspaces passing), built (`4/4` workspaces passing), and verified with zero changes to physical JSON state files or Shopify theme directories. The repository is ready for **Phase 1, Step 1.2.3** upon your explicit approval.
