# Phase 3 Admin User Guide: Mangal Royal Studio Operations

**Status:** PROMPT 1 COMPLETED. Comprehensive Administrative Operations Guide.

---

## 1. Authentication, Sessions & Role Navigation

1. **Sign-In:** Navigate to the Admin Dashboard (`http://localhost:3001` in local development). Authenticate with your administrative credentials.
2. **Session Security:** The platform issues an HttpOnly, cryptographically signed administrative session cookie. Sessions expire automatically after the configured TTL (default: 24 hours).
3. **Role-Based Navigation:** The left sidebar dynamically displays only modules permitted for your server-resolved role:
   - **`OWNER`**: Complete access to all 22 operational and governance modules.
   - **`MANAGER`**: Access to Catalogue, Inventory, Orders, Customers (masked PII), Shipments, Discounts, and Customization.
   - **`PRICING_OPERATOR`**: Access to Catalogue, Vault Inventory, Bullion Rates, Diamond Matrix, Pricing Simulator, and Preview Import runs.

---

## 2. Executive Overview & Financial Reporting

1. **Date Range Selection:** Use the toolbar buttons (`7D`, `30D`, `90D`, `1Y`, `ALL`) at the top of the Overview module to filter operational metrics and order timelines.
2. **Executive Financial Summary Card:**
   - **Net Revenue (INR):** Total settled customer payments minus processed refunds within the selected range.
   - **Gross Captured (INR):** Sum of all captured transaction payments.
   - **Total Refunded (INR):** Authoritative sum of all completed refund operations.
   - **Paid Orders Total (INR):** Purchase-time line price snapshot total of orders marked `PAID`.
   - **Disclaimer:** Clarifies transaction vs snapshot data boundaries.
3. **Status Distribution & Alerts:** Review order status counts and vault inventory items that have reached low-stock thresholds (<= 2 units).

---

## 3. Product Catalogue & Pricing Breakup Inspection

1. **Browsing & Search:** Use the search bar to locate products by SKU, title, or description. Filter by category, metal purity, or price brackets.
2. **Pagination:** Navigate through catalogue pages using the `[← Prev]` and `[Next →]` buttons, or adjust page density (`5`, `10`, `25`, `50` items per page).
3. **Price Breakup Inspector:** Click the **“Breakup”** button on any SKU to view the itemized price composition calculated by the versioned jewellery pricing engine:
   - Pure metal weight & purity rate per gram
   - Wastage grams & value
   - Multi-component diamond valuation
   - Making charge mode & value
   - Certification and hallmark fees
   - 3% GST computation
   - INR rounding rules

---

## 4. Order Management & Fulfillment Workflows

1. **Order List & PII Protection:**
   - Owners view complete customer contact details.
   - Managers view masked customer identities (`A**** S*****`, `+91 ********01`) to protect customer privacy.
2. **Advancing Order Status:**
   - Click **“Advance →”** to step orders through the fulfillment pipeline (`UNFULFILLED` → `CONFIRMED` → `PROCESSING` → `DELIVERED`).
   - Each transition prompts for an operational reason and logs an immutable audit trail.
3. **Order Cancellation & Stock Restoration:**
   - If an order is cancelled, the system automatically restores vault inventory for each line item.
   - Orders already in `CANCELLED` status cannot be transitioned to active states.
4. **GST Tax Invoice:**
   - Click **“GST Invoice”** on any order row to generate a printable, compliant GST invoice showing HSN codes, billing/shipping addresses, net jewellery value, and 3% GST breakup.
5. **Shipments & Logistics:**
   - Shipment booking is held fail-closed (`503 SHIPMENT_PROVIDER_NOT_CONFIGURED`) pending owner approval of provider credentials.

---

## 5. Vault Inventory & Concurrency Protection

1. **Stock Health Inspection:** Review available units and low stock badges.
2. **Locked Baseline Record (`MRS-EAR-2001`):**
   - SKU `MRS-EAR-2001` carries the badge `PROTECTED (9 PROVISIONAL)`.
   - Manual modification of this SKU is strictly forbidden by system policy and will return a `403` error.
3. **Adjusting Stock with Concurrency Protection:**
   - When updating stock on authorized SKUs, specify the adjustment delta and the current expected quantity.
   - If another operator changed the quantity concurrently, the adjustment is rejected with `409 STALE_INVENTORY_UPDATE` to prevent race conditions.
4. **Movement Audit Ledger:** Access the Activity & Audit Logs module to review immutable records of all stock additions, deductions, and reservation cancellations.

---

## 6. Two-Step Safe Excel Workbook Import

1. **Step 1: Dry-Run Preview Upload (`POST /api/admin/imports/excel`):**
   - Click **“Run Dry-Run Preview on MANGAL JEWELLERY.xlsx”**.
   - The importer parses all 11 category sheets, validates weight constraints (`net <= gross`), checks SKU uniqueness, and calculates proposed prices.
   - The system computes a SHA-256 `workbookHash` and stores the preview job in status `'PREVIEWED'` for 24 hours.
   - If any rows fail validation, download the diagnostic CSV report via **“Download Error CSV”**.
2. **Step 2: Hash-Bound Owner Commit (`POST /api/admin/imports/:jobId/commit`):**
   - Only administrative users with the `OWNER` role can commit imports.
   - Inspect the generated `workbookHash` and expiration timestamp displayed on the preview job card.
   - Click **“✓ Commit Job (Hash Bound)”**.
   - The server verifies that the workbook hash matches the preview, excludes all test artifacts (`TEST-*`, `test-*`), protects `MRS-EAR-2001`, and persists valid new products into the live catalog.
   - Committing is idempotent; repeating a commit safely returns existing results without duplicating catalog records.

---

## 7. Administrative Staff & Role Management

1. **Staff Directory:** Owners can review all administrative users and active roles in the Admin Users & RBAC module.
2. **Role Reassignment:**
   - Owners can reassign roles (`OWNER`, `MANAGER`, `PRICING_OPERATOR`).
   - **Protection:** The system enforces that the last active Owner account cannot be downgraded or disabled (`409 CANNOT_DOWNGRADE_LAST_OWNER`).
3. **Audit Immutability:** All administrative role updates are permanently recorded in the immutable audit log.
