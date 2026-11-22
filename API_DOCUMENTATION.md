# Mangal Royal Studio — REST API Documentation (Code-Verified)

**Implementation File:** [`services/api/src/app.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.ts)  
**Base URL:** `http://localhost:4000/api/v1` (rewritten via middleware on lines `81–88` of `app.ts` to `/api/*`; `/api/v1/health` maps to `/health`)  
**OpenAPI 3.1 JSON Spec:** `GET /api/v1/docs.json` (`/api/docs.json`)  
**Runtime Persistence:** Local JSON state store (`.data/platform-state.json` via [`services/api/src/store/data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts))  
**Audit Reference:** [`CODE_VERIFICATION_AUDIT.md`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md)

---

## 1. System Health & OpenAPI

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` (`/api/v1/health`) | Public | `VERIFIED` — Returns architecture summary, Shopify mode (`SAFE_DRY_RUN_DEFAULT`), and entity counts. |
| `GET` | `/api/v1/docs.json` | Public | `VERIFIED` — Returns OpenAPI `3.1.0` JSON specification. |

---

## 2. Authentication, Customers & RBAC

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/auth/login` | Public | `VERIFIED` — Authenticates admin users (`owner@mangalroyalstudio.com` / `<set via MRS_SEED_OWNER_PASSWORD>`, `manager@mangalroyalstudio.com` / `<set via MRS_SEED_MANAGER_PASSWORD>`, `pricing@mangalroyalstudio.com` / `<set via MRS_SEED_PRICING_PASSWORD>`). Returns JWT `token` and `user`. |
| `GET` | `/api/v1/auth/me` | `requireAuth` | `VERIFIED` — Returns current authenticated admin user and permissions. |
| `POST` | `/api/v1/auth/register` | Public | `VERIFIED` — Registers a new storefront customer in `dbStore.customers`. |
| `POST` | `/api/v1/auth/customer/login` | Public | `PARTIALLY IMPLEMENTED` — Returns customer profile and order history by email, but **does not currently verify `passwordHash`**. |
| `GET` | `/api/v1/roles` | `requireAuth` | `VERIFIED` — Lists `OWNER`, `MANAGER`, and `PRICING_OPERATOR` permission sets. |

---

## 3. Products, Collections & Storefront Discovery

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/products` | Public | `VERIFIED` — Filters by `search`, `category`, `collection`, `shape`, `metalPurity`, `metalColor`, `minPrice`, `maxPrice`, `sort` and attaches live `priceBreakup`. |
| `GET` | `/api/v1/products/:handleOrSku` | Public | `VERIFIED` — Returns product details, `priceBreakup`, and 4 `relatedProducts`. |
| `GET` | `/api/v1/public/pricing/:handleOrSku` | Public | `VERIFIED` — Bridge endpoint returning live `Decimal.js` price breakup for a SKU or handle. |
| `POST` | `/api/v1/products` (or `/api/v1/admin/products`) | `PRODUCTS_WRITE` | `VERIFIED` — Validates weight invariant (`net <= gross`), checks SKU uniqueness, calculates initial price, and logs initial `RESTOCK` movement. |
| `PUT` | `/api/v1/admin/pricing/products/:sku/attributes` | `PRODUCTS_WRITE` | `VERIFIED` — Updates jewellery specification attributes and recalculates breakdown. |
| `DELETE` | `/api/v1/products/:sku` (or `/api/v1/admin/products/:sku`) | `PRODUCTS_WRITE` | `VERIFIED` — Deletes product; blocks with `409 PRODUCT_IN_ACTIVE_ORDER` if referenced by a non-cancelled order. |
| `GET` | `/api/v1/collections` | Public | `VERIFIED` — Lists curated collections and 11 categories. |
| `GET` | `/api/v1/collections/:handle` | Public | `VERIFIED` — Returns collection metadata and matching products (`all`, `best-sellers`, price tiers, or category handles). |

---

## 4. Inventory & Stock Movements

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/admin/inventory` | `requireAuth` | `VERIFIED` — Lists SKU stock quantities and `isLowStock` (`<= 2`). |
| `POST` | `/api/v1/inventory/adjust` (or `/api/v1/admin/inventory/adjust`) | `PRODUCTS_WRITE` | `VERIFIED` — Adjusts stock via `deltaQuantity` or `setQuantity`, blocks negative stock (`400 INSUFFICIENT_STOCK`), and records an `InventoryMovement`. |
| `GET` | `/api/v1/admin/inventory/movements` | `requireAuth` | `VERIFIED` — Lists stock movement ledger entries. |

---

## 5. Jewellery Pricing Engine (`Preview -> Validate -> Approve -> Publish`)

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/admin/rates/metals` | `requireAuth` | `VERIFIED` — Lists active metal rates (`24K`, `22K`, `18K`, `14K`, `925_SILVER`, `950_PLATINUM`). |
| `POST` | `/api/v1/admin/rates/metals` | `RATES_WRITE` | `VERIFIED` — Upserts metal rate per gram and writes audit log. |
| `GET` | `/api/v1/admin/rates/diamonds` | `requireAuth` | `VERIFIED` — Lists diamond rate matrix entries. |
| `POST` | `/api/v1/admin/rates/diamonds` | `RATES_WRITE` | `VERIFIED` — Adds diamond rate slab and writes audit log. |
| `GET` | `/api/v1/admin/pricing/rules` | `requireAuth` | `VERIFIED` — Returns `pricingRules`, `pricingRuns`, and latest 50 `pricingSnapshots`. |
| `POST` | `/api/v1/admin/pricing/rules` | `PRICING_VALIDATE` | `VERIFIED` — Creates a new draft formula rule version. |
| `POST` | `/api/v1/admin/pricing/preview` | `PRICING_PREVIEW` | `VERIFIED` — Generates a `PREVIEWED` pricing run across all products. |
| `POST` | `/api/v1/admin/pricing/runs/:runId/validate` | `PRICING_VALIDATE` | `VERIFIED` — Transitions pricing run to `VALIDATED`. |
| `POST` | `/api/v1/admin/pricing/runs/:runId/approve` | `requireOwnerRole` | `VERIFIED` — Owner-only approval gate (`APPROVED`); returns `403 OWNER_APPROVAL_REQUIRED` for non-owners. |
| `POST` | `/api/v1/admin/pricing/runs/:runId/publish` | `requireOwnerRole` | `VERIFIED` — Updates product prices, saves `PricingSnapshot`s, and calls `syncApprovedPricesToShopify()` (staged dry-run by default). |

---

## 6. Bulk 11-Sheet Excel Importer (`MANGAL JEWELLERY.xlsx`)

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/admin/imports` | `requireAuth` | `VERIFIED` — Lists the 11 supported sheets and past `importJobs`. |
| `POST` | `/api/v1/admin/imports/excel` | `IMPORTS_RUN` | `VERIFIED` — Parses uploaded file, base64 payload, or default `MANGAL JEWELLERY.xlsx` (`296` rows across 11 sheets) in `DRY_RUN` or `COMMIT` mode. |
| `GET` | `/api/v1/admin/imports/:jobId/errors.csv` | `requireAuth` | `VERIFIED` — Downloads CSV error report (`Sheet Name,Row Number,SKU,Field,Severity,Message`). |
| `POST` | `/api/v1/admin/imports/:jobId/sync-shopify` | `requireOwnerRole` | `SIMULATED` — Marks job `SYNCED_TO_SHOPIFY` and logs audit entry. |
| `POST` | `/api/v1/admin/imports/:jobId/rollback` | `requireOwnerRole` | `PARTIALLY IMPLEMENTED` — Removes SKUs of valid items in `jobId` from `dbStore.products`, but does not update `job.status`. |

---

## 7. Cart, Wishlist, Checkout, Razorpay, Shiprocket & Admin Reports

| Method | Endpoint | Auth | Verification Status & Notes |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/cart/:cartId` | Public | `VERIFIED` — Returns cart with 3% GST and discount calculation. |
| `POST` | `/api/v1/cart/:cartId/items` | Public | `VERIFIED` — Verifies stock availability and adds/increments item. |
| `DELETE` | `/api/v1/cart/:cartId/items/:itemId` | Public | `VERIFIED` — Removes item from cart by line ID or SKU. |
| `POST` | `/api/v1/cart/:cartId/discount` | Public | `VERIFIED` — Validates and applies coupon code (`ENGAGEMENT10`, `ROYALMAKING0`). |
| `GET` | `/api/v1/wishlist/:wishlistId` | Public | `VERIFIED` — Returns wishlisted SKUs and product objects. |
| `POST` | `/api/v1/wishlist/:wishlistId/toggle` | Public | `VERIFIED` — Adds or removes SKU/handle from wishlist. |
| `POST` | `/api/v1/checkout/create-order` | Public | `VERIFIED` / `SIMULATED` — Checks stock, locks `PricingSnapshot`, deducts inventory, creates order, and returns simulated `razorpayOrder`. |
| `POST` | `/api/v1/payments/razorpay/verify` | Public | `PARTIALLY IMPLEMENTED` — Marks order `PAID` and creates `PaymentRecord`. *(Note: Non-production environments currently bypass strict HMAC signature rejection).* |
| `POST` | `/api/v1/admin/orders/:orderId/refund` (or `/api/v1/payments/refund`) | `ORDERS_VIEW` | `VERIFIED` — Processes partial/full refund, updates `financialStatus`, and optionally restores stock. |
| `POST` | `/api/v1/orders/:orderId/cancel` (or `/api/v1/admin/orders/:orderId/cancel`) | Public / Admin | `VERIFIED` — Cancels order and restores line item stock. |
| `GET` | `/api/v1/orders/:orderId/invoice` | Public | `VERIFIED` — Returns JSON GST Tax Invoice (`HSN 711319`, 3% GST). |
| `GET` | `/api/v1/public/orders/track` | Public | `VERIFIED` — Looks up order and shipment by `orderNumber` or `awb`. |
| `GET` | `/api/v1/shipping/serviceability` | Public | `SIMULATED` — Validates 6-digit pincode and returns static BlueDart/Sequel courier options. |
| `POST` | `/api/v1/admin/orders/:orderId/shipments` | `SHIPMENTS_MANAGE` | `SIMULATED` — Creates simulated Shiprocket AWB record (`SRMRS...IN`). |
| `GET` | `/api/v1/admin/reports/export.csv` | `requireAuth` | `VERIFIED` — Exports `orders` or `products`/`inventory` as CSV. |
| `POST` | `/api/v1/webhooks/shopify` & `/api/v1/webhooks/razorpay` | HMAC Header | `PARTIALLY IMPLEMENTED` — Verifies HMAC-SHA256 signature; does not yet record `IntegrationEvent` idempotency keys. |
