# Mangal Royal Studio — Razorpay Payment Gateway Integration Guide (Phase 5A)

**Mode:** Test Mode Only (`RAZORPAY_MODE=test`)  
**Currency:** `INR` (converted to integer paise on the server)

---

## 1. Environment Variables & Credential Placement

All Razorpay secrets belong **exclusively on the backend (`services/api`)** in the root `.env` file (never committed to Git, never placed in `NEXT_PUBLIC_*` variables, and never returned in API responses or logs).

| Variable | Location | Description |
| :--- | :--- | :--- |
| `RAZORPAY_MODE` | Server `.env` | Must be `test` during Phase 5A. Any `live` value or `rzp_live_*` key is rejected at startup and checkout. |
| `RAZORPAY_KEY_ID` | Server `.env` | Razorpay Test Key ID (`rzp_test_*`). Returned only in the checkout order response for Standard Checkout initialization. |
| `RAZORPAY_KEY_SECRET` | Server `.env` | Razorpay Test Key Secret. Used server-side for Orders API Basic Auth, Payment/Order status fetch, and HMAC-SHA256 callback signature verification. |
| `RAZORPAY_WEBHOOK_SECRET` | Server `.env` | Razorpay Webhook Secret. Used server-side to verify `X-Razorpay-Signature` against the raw request body. |

See [`.env.example`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.env.example) for placeholder formatting.

---

## 2. Local Startup Commands

```bash
# 1. Start the Express API (with PostgreSQL or JSON fallback)
npm run dev:api

# 2. Start the Customer Storefront (http://localhost:3000)
npm run dev:storefront

# 3. Start the Admin Dashboard (http://localhost:3001)
npm run dev:admin
```

---

## 3. End-to-End Payment Flow

1. **Checkout Initiation (`POST /api/v1/checkout/create-order`):**
   - Validates customer input and optional `idempotencyKey` (prevents duplicate internal orders and double inventory reservation on retry).
   - Recalculates all product, customization, discount, and GST (3%) amounts authoritatively on the server from PostgreSQL/store data.
   - Validates live inventory and reserves stock inside a database transaction.
   - Converts `finalTotal` INR to integer paise (`inrToPaise`) and creates a Razorpay Order (`currency: "INR"`, receipt `<= 40` chars) via `POST https://api.razorpay.com/v1/orders`.
   - Persists the internal order with `financialStatus: "PENDING"` and `razorpayOrderId`, and returns `orderAccessToken` + `{ id, amountPaise, currency, keyId }`.
2. **Razorpay Standard Checkout (`apps/storefront/src/app/checkout/page.tsx`):**
   - Loads `https://checkout.razorpay.com/v1/checkout.js`.
   - Tracks explicit UI states: `PREPARING`, `OPENING_CHECKOUT`, `PROCESSING`, `SUCCESS`, `FAILED`, `CANCELLED`, and `PENDING_VERIFICATION`.
   - Handles `payment.failed` events and modal dismissal (`CANCELLED`) without showing a fake success screen.
   - Provides **Retry Payment** via `POST /api/v1/checkout/orders/:orderId/razorpay-order` to issue a fresh Razorpay order for an existing `PENDING` order.
3. **Callback Signature & Authoritative Verification (`POST /api/v1/payments/razorpay/verify`):**
   - Enforces ownership (authenticated customer session or `orderAccessToken`).
   - Verifies `razorpay_signature` using constant-time HMAC-SHA256 (`crypto.timingSafeEqual`) of `${razorpayOrderId}|${razorpayPaymentId}` with `RAZORPAY_KEY_SECRET`.
   - Fetches both the authoritative Payment (`GET /v1/payments/:id`) and Order (`GET /v1/orders/:id`) from Razorpay.
   - Rejects `authorized` (uncaptured) and `failed` payments, recording the attempt status without marking the order `PAID`.
   - Marks the internal order `PAID` and records a `CAPTURED` `PaymentRecord` atomically only when `providerPayment.status === 'captured' && providerPayment.captured === true` and `providerOrder.status === 'paid'`.

---

## 4. Webhook Verification & Event Idempotency

- **Endpoint:** `POST /api/v1/webhooks/razorpay` (and `/api/webhooks/razorpay`)
- **Raw Body Verification:** Express `json` middleware captures `req.rawBody` (`Buffer`). `verifyRazorpaySignature(req.rawBody, req.headers['x-razorpay-signature'])` verifies HMAC-SHA256 against the exact raw bytes (never re-serialized JSON).
- **Idempotency:** Requires `x-razorpay-event-id` and checks `IntegrationEvent` (`@@unique([provider, eventId])`). Duplicate deliveries return `200 { received: true, duplicate: true }`.
- **Supported Events:**
  - `payment.captured`: Reconciles a `PENDING` order to `PAID` if amount, currency (`INR`), and capture flags match.
  - `payment.failed`: Records a `FAILED` payment attempt on `PENDING` orders; **never downgrades** an order that is already `PAID`.
  - `order.paid`: Reconciles a `PENDING` order to `PAID` when `amount_paid === expectedPaise` and `status === 'paid'`.

---

## 5. Test-Mode Testing & Current Limitations

- **Automated Tests:** Run `DATA_BACKEND=json NODE_ENV=test npm --workspace=@mrs/api exec -- vitest run src/phase5a-razorpay.test.ts` (uses mocked Razorpay HTTP responses; no real transactions).
- **Local Manual Testing:** Configure Razorpay Test Mode keys (`rzp_test_*`) in `.env` and use Razorpay's official test UPI/card instruments on `http://localhost:3000/checkout`.
- **Current Limitations:**
  - Localhost cannot receive live Razorpay webhook deliveries directly without a tunnel (e.g., ngrok) or staging deployment.
  - Live mode (`RAZORPAY_MODE=live`, `rzp_live_*`) is intentionally blocked during Phase 5A.

---

## 6. Staging Webhook Configuration & Later Live-Mode Transition

- **Staging Webhook Setup:** In the Razorpay Dashboard (Test Mode) -> *Settings -> Webhooks*, point the webhook URL to `https://<staging-api-domain>/api/v1/webhooks/razorpay`, set `RAZORPAY_WEBHOOK_SECRET` in staging `.env`, and subscribe to `payment.captured`, `payment.failed`, and `order.paid`.
- **Live Mode (Future Approved Milestone Only):** Live mode requires explicit owner approval, production KYC/activation on Razorpay, updating `assertRazorpayTestMode` in a dedicated release, rotating secrets into production secret management, and verifying staging end-to-end first.
