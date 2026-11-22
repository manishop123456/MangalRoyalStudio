# Payment Integration & GST Invoicing Audit (`Razorpay` & `COD`)

> **Code-Verified Audit Status:** Audited against `services/api/src/app.ts` (lines 1143–1223, 1931–2216) and `services/api/src/services/shiprocket-service.ts` (lines 51–65). See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Implementation Locations & File Correction

> **Correction Note:** Earlier documentation referenced `services/api/src/services/razorpay-service.ts`. **No `razorpay-service.ts` file exists in the repository.**
> - `verifyRazorpaySignature()` is implemented in [`services/api/src/services/shiprocket-service.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L51-L65).
> - Order checkout, payment verification, webhook handling, refunds, and GST invoice generation are implemented directly in [`services/api/src/app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1931-L2216).

---

## 2. Checkout & Razorpay Order Creation (`POST /api/checkout/create-order`)

- **Route:** `POST /api/checkout/create-order` (also mounted at `POST /api/v1/checkout/create-order`, [`app.ts` lines 1931–2056](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1931-L2056)).
- **Classification:** **PARTIALLY IMPLEMENTED / SIMULATED**
- **Verified Behavior:**
  1. Validates stock availability for every item; returns `409 INSUFFICIENT_STOCK` (`Order item quantity exceeds available inventory`) if `requestedQty > product.stockQuantity`.
  2. Deducts `product.stockQuantity` and records an `'ORDER_RESERVED'` movement in `dbStore.inventoryMovements`.
  3. Snapshots each item's `priceBreakup` into `OrderLineSnapshot` (`unitPriceInr`, `taxAmountInr`, `lineTotalInr`, `priceBreakup`) so future metal/diamond rate changes never alter historical orders.
  4. Generates sequential order number (`MRS-2026-XXXX`) and GST invoice number (`MRS/2026-27/INV-XXXX`) with `HSN 711319`.
  5. **Simulated Razorpay Order ID:** Generates `razorpayOrderId = order_MrsRzp${Date.now()}` in memory (`line 1990`) rather than calling Razorpay's live `POST https://api.razorpay.com/v1/orders` API.

---

## 3. Payment Signature Verification (`POST /api/payments/razorpay/verify`)

- **Route:** `POST /api/payments/razorpay/verify` (also mounted at `POST /api/v1/payments/razorpay/verify`, [`app.ts` lines 2060–2140](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2060-L2140)).
- **Classification:** **PARTIALLY IMPLEMENTED (Contains Non-Production Bypass)**
- **HMAC Calculation (`app.ts` lines 2076–2085):**
  ```ts
  const secret = process.env.RAZORPAY_KEY_SECRET || 'mrs_razorpay_test_secret_2025';
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const isSignatureValid =
    razorpaySignature === expectedHmac ||
    razorpaySignature.startsWith('sig_verified_') ||
    process.env.NODE_ENV !== 'production';
  ```
- **Security Audit Finding:**
  - While `expectedHmac` is computed using `HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, secret)`, the condition `|| razorpaySignature.startsWith('sig_verified_') || process.env.NODE_ENV !== 'production'` means invalid signatures are **not rejected** when `NODE_ENV !== 'production'` or when prefixed with `sig_verified_`.
  - Additionally, [`verifyRazorpaySignature()` in `shiprocket-service.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L51-L65) is not called by `app.ts`.
  - Upon verification, the handler transitions `order.paymentStatus = 'PAID'`, `order.orderStatus = 'CONFIRMED'`, and automatically generates a simulated Shiprocket AWB shipment via `createShiprocketAwbShipment()`.

---

## 4. Razorpay Webhook (`POST /api/webhooks/razorpay`)

- **Route:** `POST /api/webhooks/razorpay` ([`app.ts` lines 2144–2192](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2144-L2192)).
- **Classification:** **PARTIALLY IMPLEMENTED**
- **Verified Behavior:**
  - Reads `x-razorpay-signature` header and computes `HMAC-SHA256(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET || 'mrs_razorpay_webhook_secret_2025')`.
  - Uses `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))` and returns `401 INVALID_WEBHOOK_SIGNATURE` on mismatch.
  - Handles `payment.captured` and `order.paid` events by marking the matching order `PAID` / `CONFIRMED`.
- **Missing Feature:** Does not check or record webhook event IDs in an `IntegrationEvent` store for replay idempotency.

---

## 5. Refunds & GST Tax Invoices (`VERIFIED`)

- **Partial & Full Refunds (`POST /api/admin/orders/:orderId/refund`, [`app.ts` lines 1143–1223](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L1143-L1223)):**
  - Restricted to `OWNER` and `MANAGER` roles.
  - Validates `amountInr <= remainingRefundable`.
  - Transitions `order.paymentStatus` to `'PARTIALLY_REFUNDED'` or `'REFUNDED'`.
  - Optional `restockItems: true` restores product inventory and logs `'RETURN_RESTOCK'`.
  - Generates a simulated gateway refund ID (`rfnd_Mrs${Date.now()}`).
- **GST Invoice Generation (`GET /api/orders/:orderId/invoice` & `GET /api/admin/orders/:orderId/invoice`, [`app.ts` lines 2195–2216](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts#L2195-L2216)):**
  - Returns structured GST invoice JSON containing seller GSTIN (`27AABCM1975R1Z5`), HSN code (`711319`), 3% GST breakup, and immutable item-level price snapshots.
