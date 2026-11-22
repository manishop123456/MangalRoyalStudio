# Phase 3 API Reference: Admin Business Operations & Hardening

**Status:** PROMPT 1 COMPLETED. Full Admin Operations API Reference.

All endpoints require administrative session authentication (`ADMIN_SESSION_COOKIE` HttpOnly cookie or `Authorization: Bearer <jwt>`) and server-side RBAC permission verification.

---

## 1. Common Pagination & Sorting Query Parameters

Endpoints returning lists implement the following standard query structure:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | 1-based page index. Clamped to `1 <= page <= totalPages`. |
| `pageSize` | `integer` | `25` | Number of items per page (`limit` accepted as alias). Max `100`. |
| `search` | `string` | `""` | Case-insensitive substring search across relevant fields. |
| `sortBy` | `string` | (varies) | Field to sort by (e.g., `sku`, `title`, `placedAt`, `createdAt`). |
| `sortDirection` | `'asc' \| 'desc'` | `'desc'` | Sort order (`sortOrder` accepted as alias). |

Response schema:
```json
{
  "items": [ ... ],
  "total": 42,
  "page": 1,
  "pageSize": 25,
  "totalPages": 2
}
```

---

## 2. Executive Overview & Analytics

### `GET /api/admin/overview`
- **Permissions:** `PRODUCTS_VIEW`
- **Query Parameters:**
  - `range`: `'7d' | '30d' | '90d' | '1y' | 'all' | 'custom'` (default: `'all'`).
  - `dateFrom`: ISO 8601 string (when `range=custom`).
  - `dateTo`: ISO 8601 string (when `range=custom`).
- **Response Structure:**
  ```json
  {
    "range": "30d",
    "kpis": {
      "activeProductsCount": 8,
      "categoriesCount": 11,
      "ordersCount": 3,
      "customersCount": 3,
      "lowStockCount": 1,
      "pendingPricingRuns": 0
    },
    "financialMetrics": {
      "grossCapturedInr": "125000.00",
      "totalRefundedInr": "0.00",
      "netRevenueInr": "125000.00",
      "paidOrdersTotalInr": "125000.00",
      "currency": "INR",
      "disclaimer": "Payment and refund totals are derived from authoritative transaction records..."
    },
    "orderStatusDistribution": {
      "PENDING": 0,
      "CONFIRMED": 1,
      "PROCESSING": 1,
      "SHIPPED": 0,
      "DELIVERED": 1,
      "CANCELLED": 0
    },
    "topSellingProducts": [
      {
        "sku": "MRS-RNG-1001",
        "title": "Aura Round Brilliant Solitaire Ring",
        "totalUnitsSold": 1,
        "totalRevenueInr": "45000.00"
      }
    ],
    "timeSeriesTrends": [
      { "period": "2026-11-05", "orderCount": 1, "revenueInr": "45000.00" }
    ],
    "inventoryAlerts": [
      { "sku": "MRS-EAR-2001", "title": "...", "inventoryQuantity": 9, "status": "LOW_STOCK" }
    ],
    "recentOrders": [ ... ],
    "metalRates": [ ... ],
    "settings": { ... }
  }
  ```
- **Privacy Gating:** In `recentOrders`, customer names and emails are masked unless the caller possesses `CUSTOMERS_PII_VIEW` (Owner only).

---

## 3. Product Catalogue Operations

### `GET /api/admin/products`
- **Permissions:** `PRODUCTS_VIEW`
- **Query Parameters:** `page`, `pageSize`, `search`, `category`, `metalType`, `purity`, `minPrice`, `maxPrice`, `sortBy`, `sortDirection`.
- **Response:** Paginated products with attached `latestBreakdown` computed via active versioned jewellery pricing formula (`calculateJewelleryPrice`).

### `GET /api/admin/products/:sku`
- **Permissions:** `PRODUCTS_VIEW`
- **Response:** Single product specification, multi-component diamond specs, making charge mode, wastage mode, active rates, and full itemized pricing breakdown. Returns `404 PRODUCT_NOT_FOUND` if SKU does not exist.

### `PUT /api/admin/products/:sku`
- **Permissions:** `PRODUCTS_WRITE`
- **Request Body:** Partial product fields (`makingChargeMode`, `makingChargeValue`, `manualPriceOverrideInr`, etc.).
- **Audit:** Records `PRODUCT_METADATA_UPDATED` in the immutable audit log.

---

## 4. Order Management & Operational State Transitions

### `GET /api/admin/orders`
- **Permissions:** `ORDERS_VIEW`
- **Query Parameters:** `page`, `pageSize`, `search`, `financialStatus`, `fulfillmentStatus`, `customerId`, `dateFrom`, `dateTo`.
- **Privacy:** Customer PII is masked unless the caller has `CUSTOMERS_PII_VIEW`.

### `GET /api/admin/orders/:orderId`
- **Permissions:** `ORDERS_VIEW`
- **Response:** Complete order metadata, line items with immutable customization snapshots, payment records, refund history, and shipment tracking.

### `POST /api/admin/orders/:orderId/transition`
- **Permissions:** `ORDERS_MANAGE`
- **Request Body:** `{ "status": "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED", "reason": "string" }`
- **Rules:**
  - Validates allowed state machine transitions.
  - Transitions from `CANCELLED` are illegal (`409 ILLEGAL_ORDER_TRANSITION`).
  - Transitions to `CANCELLED` trigger automatic vault inventory restoration for each line item.
  - Records an `ORDER_STATUS_TRANSITION` audit log entry.

### `GET /api/admin/orders/:orderId/invoice`
- **Permissions:** `ORDERS_VIEW`
- **Response:** Printable GST invoice data: store GSTIN, billing/shipping address, itemized line items with HSN codes, net value, 3% GST breakup, and total INR amount.

### `POST /api/admin/orders/:orderId/shipments`
- **Status:** **Fail-closed.** Returns `503 SHIPMENT_PROVIDER_NOT_CONFIGURED`. No synthetic tracking numbers or third-party API writes occur.

---

## 5. Customer Privacy & Management

### `GET /api/admin/customers`
- **Permissions:** `ORDERS_VIEW`
- **Query Parameters:** `page`, `pageSize`, `search`, `city`, `state`, `sortBy`, `sortDirection`.
- **PII Guard:** Caller without `CUSTOMERS_PII_VIEW` receives masked contact and identity data.

### `GET /api/admin/customers/:customerId`
- **Permissions:** `ORDERS_VIEW`
- **Response:** Customer profile, order history, and saved designs. Owner receives full PII; Manager/Operator receives masked PII.

---

## 6. Inventory Concurrency & Safety

### `GET /api/admin/inventory`
- **Permissions:** `PRODUCTS_VIEW`
- **Query Parameters:** `page`, `pageSize`, `search`, `lowStockOnly=true|false`, `category`.
- **Response:** Paginated stock health view with available units and threshold warnings.

### `POST /api/admin/inventory/adjust`
- **Permissions:** `PRODUCTS_WRITE`
- **Request Body:**
  ```json
  {
    "sku": "MRS-RNG-1001",
    "deltaQuantity": 5,
    "expectedQuantity": 12,
    "reason": "Vault physical intake verified against challan #8821"
  }
  ```
- **Guards:**
  - **`MRS-EAR-2001` Lock:** Manual adjustment of `MRS-EAR-2001` is strictly forbidden (`403 PROTECTED_INVENTORY_RECORD`).
  - **Concurrency Check:** If `expectedQuantity` is provided and differs from the current available quantity, fails with `409 STALE_INVENTORY_UPDATE`.
  - **Audit Trail:** Appends an immutable record to `inventoryMovements`.

### `GET /api/admin/inventory/movements`
- **Permissions:** `AUDIT_VIEW`
- **Response:** Paginated audit history of all vault stock additions, deductions, order reservations, and order cancellation returns.

---

## 7. Two-Step Safe Excel Workbook Import

### `POST /api/admin/imports/excel`
- **Permissions:** `IMPORTS_RUN`
- **Headers:** Multipart file upload or JSON dry-run command.
- **Protocol:**
  - Detects all 11 category sheets.
  - Computes `workbookHash` (SHA-256).
  - Validates weights (`net <= gross`), flags duplicates, and computes dry-run proposed prices.
  - Persists job with `status = 'PREVIEWED'` and `expiresAt` (24h).
  - Returns `jobId`, `workbookHash`, `previewItems`, and `errors`.

### `POST /api/admin/imports/:jobId/commit`
- **Permissions:** `OWNER` role required (`403 OWNER_APPROVAL_REQUIRED`).
- **Request Body:**
  ```json
  {
    "jobId": "job-1731456000000",
    "workbookHash": "8f3b...e7a1",
    "confirmCommit": true
  }
  ```
- **Validations:**
  - Requires `confirmCommit: true` (`400 IMPORT_COMMIT_CONFIRMATION_REQUIRED`).
  - Validates `workbookHash` matches the previewed job (`400 WORKBOOK_HASH_MISMATCH`).
  - Rejects expired preview jobs (`400 IMPORT_JOB_EXPIRED`).
  - Idempotent: re-committing returns `{ alreadyCommitted: true }`.
  - Automatically filters test artifacts (`TEST-*`, `test-*`).
  - Strictly preserves baseline `MRS-EAR-2001`.

### `GET /api/admin/imports/:jobId/errors.csv`
- **Permissions:** `IMPORTS_RUN`
- **Response:** Downloadable CSV report with row-level validation errors, escaped against CSV injection.

---

## 8. User Management & Owner Protection

### `GET /api/admin/users`
- **Permissions:** `USERS_MANAGE`
- **Response:** Paginated list of administrative staff accounts with roles and active status.

### `PUT /api/admin/users/:userId/role`
- **Permissions:** `OWNER` role required (`403 FORBIDDEN` for non-owners).
- **Request Body:** `{ "role": "MANAGER" | "PRICING_OPERATOR" }`
- **Protection:** Prevents downgrading the last active `OWNER` in the system (`409 CANNOT_DOWNGRADE_LAST_OWNER`).
- **Audit:** Records `ADMIN_ROLE_UPDATED` in the audit log.

---

## 9. Reports & CSV Export

### `GET /api/admin/reports/export.csv`
- **Permissions:**
  - `type=products` or `type=inventory`: requires `PRODUCTS_VIEW`.
  - `type=orders`: requires `ORDERS_VIEW` AND `CUSTOMERS_PII_VIEW` (Owner only).
- **Security:** Formula injection protection via `escapeCsvValue`. All fields starting with `=`, `+`, `-`, `@`, `\t`, `\r` are prefixed with an apostrophe.
