# Mangal Royal Studio — Razorpay Phase 5A Testing Report

**Date:** 2026-11-15  
**Mode:** Test Mode Only (`RAZORPAY_MODE=test`)  
**Status:** **PARTIAL** (All automated backend/unit/integration/build/checksum checks **PASS** using mocked Razorpay provider responses; end-to-end interactive Razorpay Test Mode Checkout UI with merchant `rzp_test_*` credentials remains a manual local step.)

---

## 1. Automated Test Results

| Workspace / Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| `@mrs/api` Phase 5A Razorpay | `DATA_BACKEND=json NODE_ENV=test npm --workspace=@mrs/api exec -- vitest run src/phase5a-razorpay.test.ts` | **5/5 PASS** | Mocked Razorpay HTTP API (`v1/orders`, `v1/payments`), isolated temp JSON state |
| `@mrs/api` Phase 1 Security & Hardening | `DATA_BACKEND=json NODE_ENV=test npm --workspace=@mrs/api exec -- vitest run src/app.test.ts` | **47/47 PASS** | Existing Razorpay HMAC, webhooks, concurrency, auth, and order regressions |
| `@mrs/api` Phase 3 Admin Operations | `DATA_BACKEND=json NODE_ENV=test npm --workspace=@mrs/api exec -- vitest run src/phase3-admin-operations.test.ts` | **33/33 PASS** | Admin payments, orders, refunds, inventory, audit logs |
| `@mrs/shared` | `npm run test --workspace=@mrs/shared` | **7/7 PASS** | Pricing engine and customization pricing |
| `@mrs/storefront` | `npm run test --workspace=@mrs/storefront` | **7/7 PASS** | Cart, catalog, checkout validation, live API integration |
| `@mrs/admin` | `npx vitest run apps/admin/src/lib/admin-navigation.test.ts` | **3/3 PASS** | Permission-gated admin navigation |
| `@mrs/api` Phase 2 API Security | `src/phase2-api-security.test.ts` | **BLOCKED in sandbox (0/5)** | Uses `supertest` ephemeral TCP port binding (`connect EPERM 127.0.0.1`) |

---

## 2. Typecheck & Production Build Results

- `npm run typecheck` (`@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront`): **PASS** (exit 0)
- `npm run build` (`@mrs/shared`, `@mrs/api`, `@mrs/admin` 4/4 static pages, `@mrs/storefront` 22/22 static + 4 dynamic routes): **PASS** (exit 0)

---

## 3. Protected Data & Database Safety

- `.data/platform-state.json` SHA-256: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (unchanged)
- `services/api/.data/platform-state.json` SHA-256: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (unchanged)
- PostgreSQL schema: no destructive migrations applied; existing `OrderMetadata.idempotencyKey`, `PaymentRecord`, and `IntegrationEvent` uniqueness constraints are used.

---

## 4. Manual Test Steps (Localhost with Razorpay Test Keys)

1. Set `RAZORPAY_MODE=test`, `RAZORPAY_KEY_ID=rzp_test_...`, `RAZORPAY_KEY_SECRET=...`, and `RAZORPAY_WEBHOOK_SECRET=...` in `.env` (never commit `.env`).
2. Start API (`npm run dev:api`) and Storefront (`npm run dev:storefront`).
3. Add a product to the bag on `http://localhost:3000`, proceed to `/checkout`, enter delivery details, and click **Pay & Place Order**.
4. Confirm Razorpay Standard Checkout modal opens with the server-calculated INR amount.
5. Test:
   - Dismissing modal -> UI transitions to `PAYMENT CANCELLED — ORDER PENDING` with **Retry Payment** button.
   - Simulated failure in Razorpay Test Mode -> UI transitions to `PAYMENT FAILED — ORDER PENDING` with **Retry Payment** button.
   - Simulated success in Razorpay Test Mode -> `/payments/razorpay/verify` validates HMAC-SHA256 signature and authoritative Razorpay capture + paid order status -> UI transitions to `PAYMENT SUCCESSFUL` and order history shows `PAID`.
6. Note: Real Razorpay webhook delivery cannot hit `localhost` directly without a staging URL or tunnel; webhook signature and `payment.captured`, `payment.failed`, and `order.paid` idempotency were verified via signed test fixtures in `src/phase5a-razorpay.test.ts`.
