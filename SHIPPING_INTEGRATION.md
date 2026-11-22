# Shipping & Logistics Integration Audit (`services/api/src/services/shiprocket-service.ts`)

> **Code-Verified Audit Status:** Audited against `services/api/src/services/shiprocket-service.ts` (lines 1–67) and `services/api/src/app.ts` (lines 1089–1140, 1906–1929). See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. File Location & Classification

> **Correction Note:** Earlier documentation referenced `services/api/src/services/shiprocket-client.ts` and claimed live token caching against `https://apiv2.shiprocket.in/v1/external`.
> - The actual file is [`services/api/src/services/shiprocket-service.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L1-L67).
> - **Classification:** **SIMULATED** — No live HTTP requests to `apiv2.shiprocket.in` are made anywhere in the codebase.

---

## 2. Simulated Shiprocket AWB & Shipment Creation (`shiprocket-service.ts`)

[`createShiprocketAwbShipment(order: OrderRecord)`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/shiprocket-service.ts#L19-L46) deterministically generates an insured jewellery shipment object in memory:

- **Courier Selection:**
  - Selects `'BlueDart Priority Insured Jewellery'` if `order.shippingAddress.pincode` starts with `'40'`, `'11'`, or `'56'` (Mumbai/Delhi/Bengaluru metro prefixes).
  - Selects `'Delhivery Insured Express'` for all other pincodes.
- **Generated Identifiers:**
  - `shiprocketOrderId`: `SR-ORD-${timestampSuffix}`
  - `shipmentId`: `SR-SHP-${timestampSuffix}`
  - `awbCode`: `SRMRS${timestampSuffix}IN`
  - `trackingUrl`: `https://shiprocket.co/tracking/${awbCode}`
  - `labelUrl`: `https://shiprocket.co/labels/${awbCode}.pdf`
  - `manifestUrl`: `https://shiprocket.co/manifests/MANIFEST-${timestampSuffix}.pdf`
- **Initial Tracking History:**
  1. `MANIFESTED` — `'Manifested & Insured Vault Pickup Scheduled'` (`Mumbai Seepz / Zaveri Bazaar Hub`)
  2. `PICKUP_SCHEDULED` — `'Executive Assigned with Tamper-Evident Security Bag'` (`Mumbai Hub`)

---

## 3. Verified Shipping Endpoints in `services/api/src/app.ts`

| Endpoint | Classification | Verified Implementation Details |
| :--- | :--- | :--- |
| `GET /api/shipping/serviceability?pincode=400001` (and `/api/v1/...`) | **SIMULATED** | Validates `/^\d{6}$/` (`app.ts` lines 1906–1929). Returns `serviceable: true`, `codAvailable: true`, `insuredDelivery: true`, and simulated courier options (`BlueDart Priority Insured Jewellery` and `Sequel / Delhivery High-Value Logistics`). |
| `POST /api/admin/orders/:orderId/shiprocket` (and `/api/v1/...`) | **SIMULATED** | Restricted to `OWNER` and `MANAGER` (`app.ts` lines 1089–1140). Calls `createShiprocketAwbShipment(order)`, sets `order.shipment`, updates `order.orderStatus = 'PROCESSING'`, and writes an `'ORDER_SHIPROCKET_DISPATCHED'` audit log. |
| `GET /api/orders/track?orderNumber=...` (and `/api/v1/...`) | **VERIFIED** | Looks up order by `orderNumber` or `orderId` (`app.ts` lines 2219–2254) and returns `order.shipment` tracking timeline and AWB details. |
| `POST /api/webhooks/shiprocket` | **NOT IMPLEMENTED** | Not present in `services/api/src/app.ts`. |
