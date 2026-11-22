# Security, Authentication & RBAC Audit (`services/api/src/middleware/auth.ts`)

> **Code-Verified Audit Status:** Audited against `services/api/src/middleware/auth.ts` (lines 1–128), `services/api/src/store/data-store.ts` (lines 431–434, 470–512), `services/api/src/app.ts` (lines 72–76, 129–175, 198–247, 2144–2192, 2299–2384), and `services/api/src/services/shopify-service.ts` (lines 40–62). See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Security Features Matrix (Verified vs Simulated / Missing)

| Security Control | Source File & Lines | Classification | Code-Verified Reality |
| :--- | :--- | :--- | :--- |
| **Token Signing & Verification** | `services/api/src/middleware/auth.ts` (`lines 19–65`) | **VERIFIED** | Custom HMAC-SHA256 stateless token (`base64url(payload).base64url(hmac)`) with `crypto.timingSafeEqual` verification and `exp` timestamp enforcement (`12 hours`). |
| **Password Hashing** | `services/api/src/store/data-store.ts` (`line 433`) | **PARTIALLY IMPLEMENTED** | Uses salted SHA-256 (`crypto.createHash('sha256').update('mrs_salt_' + password).digest('hex')`). **`bcryptjs` is NOT installed or used.** |
| **Customer Login Password Verification** | `services/api/src/app.ts` (`lines 222–247`) | **PARTIALLY IMPLEMENTED** | `POST /api/auth/customer/login` checks if the customer email exists (or auto-creates a customer) and returns a signed token **without comparing `customer.passwordHash`**. |
| **Admin Header Role Bypass** | `services/api/src/middleware/auth.ts` (`lines 77–92`) | **SECURITY RISK (DEV FALLBACK)** | `requireAuth` checks `req.headers['x-mrs-admin-role']`; if set to `'OWNER'`, `'MANAGER'`, or `'PRICING_OPERATOR'`, it synthesizes `req.authUser` **without requiring a Bearer token**. Must be removed before production deployment. |
| **Refresh Token Rotation** | `services/api/prisma/schema.prisma` (`RefreshToken` model) | **NOT IMPLEMENTED** | `RefreshToken` exists in `schema.prisma`, but no refresh token issuance, cookie storage, or rotation endpoint exists in `services/api/src/`. |
| **RBAC Role Guard (`requireRole`)** | `services/api/src/middleware/auth.ts` (`lines 97–115`) | **VERIFIED** | Enforces `UserRole` (`OWNER`, `MANAGER`, `PRICING_OPERATOR`, `CUSTOMER`) and returns `403 FORBIDDEN_ROLE` when unauthorized. |
| **RBAC Permission Guard (`requirePermission`)** | `services/api/src/middleware/auth.ts` (`lines 117–127`) | **PARTIALLY IMPLEMENTED** | Helper is exported in `auth.ts` with `ROLE_PERMISSIONS`, but `app.ts` routes use `requireRole(...)` directly. |
| **Shopify Webhook HMAC-SHA256** | `services/api/src/services/shopify-service.ts` (`lines 40–62`) | **VERIFIED** | Uses `crypto.createHmac('sha256', secret).update(rawBody).digest('base64')` + `crypto.timingSafeEqual`. Tested and verified (`401 INVALID_WEBHOOK_SIGNATURE`). |
| **Razorpay Webhook HMAC-SHA256** | `services/api/src/app.ts` (`lines 2144–2192`) | **VERIFIED** | Uses `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` + `crypto.timingSafeEqual`. |
| **Razorpay Client Verify Endpoint** | `services/api/src/app.ts` (`lines 2082–2085`) | **PARTIALLY IMPLEMENTED** | Contains `|| razorpaySignature.startsWith('sig_verified_') || process.env.NODE_ENV !== 'production'` fallback bypass. |
| **HTTP Security Headers (`helmet`)** | `services/api/src/app.ts` | **NOT IMPLEMENTED** | `helmet` is not installed in `package.json`. |
| **Rate Limiting (`express-rate-limit`)** | `services/api/src/app.ts` | **NOT IMPLEMENTED** | `express-rate-limit` is not installed in `package.json`. |
| **Immutable Audit Trail** | `services/api/src/store/data-store.ts` (`addAuditLog`) | **VERIFIED** | Logs pricing rate updates, pricing run approvals/publications, Excel imports/rollbacks, product CRUD, inventory adjustments, order updates, refunds, and CMS edits. |

---

## 2. Verified Admin Demo Credentials (`data-store.ts` & `app.ts`)

> **Correction Note:** Earlier documentation listed inconsistent passwords across different files. Below are the **exact verified credentials** seeded in [`services/api/src/store/data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts#L470-L512) and accepted by [`POST /api/auth/login` in `app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L129-L175):

| Role | Email | Seeded Password (`data-store.ts`) | Legacy Alias Password (`app.ts` lines 141–145) | Assigned Role Permissions (`auth.ts`) |
| :--- | :--- | :--- | :--- | :--- |
| **`OWNER`** | `owner@mangalroyalstudio.com` | `<set via MRS_SEED_OWNER_PASSWORD>` | `MangalOwner!2025` | `['*']` (Full access including Pricing Run Approval/Publish, Staff & Role Mgmt, Settings) |
| **`MANAGER`** | `manager@mangalroyalstudio.com` | `<set via MRS_SEED_MANAGER_PASSWORD>` | `MangalManager!2025` | Products, Inventory, Orders, Refunds, Customers, Coupons, Excel Imports, CMS, Audit Logs |
| **`PRICING_OPERATOR`** | `pricing@mangalroyalstudio.com` | `<set via MRS_SEED_PRICING_PASSWORD>` | `MangalPricing!2025` | Metal/Diamond Rate Updates, Pricing Preview Generation (Blocked from Approving/Publishing Runs with `403 FORBIDDEN_ROLE`) |

---

## 3. Production Hardening Checklist (Pre-Launch Blockers)

1. Remove the `x-mrs-admin-role` unauthenticated header bypass in [`services/api/src/middleware/auth.ts` (lines 77–92)](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/middleware/auth.ts#L77-L92).
2. Remove `|| razorpaySignature.startsWith('sig_verified_') || process.env.NODE_ENV !== 'production'` from [`services/api/src/app.ts` (lines 2082–2085)](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2082-L2085).
3. Enforce `hashPassword(password) === customer.passwordHash` in `POST /api/auth/customer/login` (`app.ts` lines 222–247).
4. Replace `hashPassword()` in `data-store.ts` with `bcryptjs` (`cost >= 12`).
5. Install and configure `helmet` and `express-rate-limit` on `/api/auth/*`, `/api/checkout/*`, and `/api/webhooks/*`.
