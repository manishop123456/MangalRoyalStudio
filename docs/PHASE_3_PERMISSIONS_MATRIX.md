# Phase 3 Permissions Matrix: Role-Based Access Control (RBAC)

**Status:** PROMPT 1 COMPLETED. Full Admin Operations RBAC Matrix.

---

## 1. Administrative Roles & Authority Hierarchy

The Mangal Royal Studio administrative platform defines three distinct roles, resolved strictly on the server via cryptographic JWT session validation:

1. **`OWNER`**: Full business governance, commercial pricing rule approvals, Shopify price publishing, import commits, staff role assignments, and unmasked customer PII access.
2. **`MANAGER`**: Daily store operations, product catalogue metadata, inventory stock adjustments, order fulfillment workflows, and customer directory access (with masked PII).
3. **`PRICING_OPERATOR`**: Bullion and diamond rate entry, pricing formula simulation, and draft pricing run preparation. No access to orders, customers, payment data, or mass catalogue publishing.

---

## 2. Granular Permissions Definition (`@mrs/shared`)

| Permission Code | Description | Authorized Roles |
| :--- | :--- | :--- |
| `RATES_VIEW` | View active metal rates and diamond rate matrix | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `RATES_WRITE` | Update gold, silver, platinum, and diamond rate cards | `OWNER`, `PRICING_OPERATOR` |
| `PRICING_PREVIEW` | Run pricing formula simulations and inspect SKU price breakdowns | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `PRICING_VALIDATE` | Validate pricing runs against max delta safety thresholds | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `PRICING_APPROVE` | Authorize a pricing run for live publication | `OWNER` |
| `PRICING_PUBLISH` | Trigger mass price updates to the Shopify Admin API | `OWNER` |
| `PRODUCTS_VIEW` | View products, categories, vault inventory, and overview dashboard | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `PRODUCTS_WRITE` | Update product specs, making charges, and adjust vault inventory | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `IMPORTS_RUN` | Upload workbook, parse sheets, and execute dry-run preview | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `IMPORTS_COMMIT` | Persist previewed workbook rows into the live catalog | `OWNER` |
| `IMPORTS_SYNC_SHOPIFY` | Sync committed catalog items directly with Shopify | `OWNER` |
| `ORDERS_VIEW` | View order history, order items, and customer directory | `OWNER`, `MANAGER` |
| `ORDERS_MANAGE` | Transition order fulfillment states (Confirmed, Processing, etc.) | `OWNER`, `MANAGER` |
| `CUSTOMERS_PII_VIEW` | View unmasked customer PII (names, phone, email, addresses, spend) | `OWNER` *(strictly gated)* |
| `SHIPMENTS_MANAGE` | View shipment records and courier tracking history | `OWNER`, `MANAGER` |
| `PAYMENTS_VIEW` | View payment records, transaction IDs, and settlement status | `OWNER`, `MANAGER` |
| `DISCOUNTS_MANAGE` | Create and update promotional discount rules | `OWNER`, `MANAGER` |
| `CONTENT_MANAGE` | Update store announcements, hero banners, and legal policies | `OWNER`, `MANAGER` |
| `USERS_MANAGE` | Manage admin staff accounts and assign administrative roles | `OWNER` |
| `SETTINGS_MANAGE` | Update store business information and operational parameters | `OWNER` |
| `AUDIT_VIEW` | Read the immutable operational and security audit log | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `CUSTOMIZATION_VIEW` | View 3D customization profiles, options, and model assets | `OWNER`, `MANAGER`, `PRICING_OPERATOR` |
| `CUSTOMIZATION_MANAGE` | Create and modify customization profiles, option groups, and rules | `OWNER`, `MANAGER` |
| `MODEL_ASSETS_MANAGE` | Upload, validate, and assign 3D `.glb` assets | `OWNER`, `MANAGER` |
| `DESIGNS_VIEW` | View customer saved bespoke custom designs | `OWNER`, `MANAGER` |

---

## 3. Operations Route Enforcement Matrix

| Endpoint | Method | Required Role / Permission | Behaviour & Fail-Safe Handling |
| :--- | :---: | :--- | :--- |
| `/api/admin/overview` | `GET` | `PRODUCTS_VIEW` | Aggregates KPIs. In `recentOrders`, customer PII is masked unless caller has `CUSTOMERS_PII_VIEW`. |
| `/api/admin/products` | `GET` | `PRODUCTS_VIEW` | Paginated product catalogue with attached versioned pricing breakdowns. |
| `/api/admin/products/:sku` | `GET` | `PRODUCTS_VIEW` | Single SKU itemized specification and active formula breakdown. |
| `/api/admin/products/:sku` | `PUT` | `PRODUCTS_WRITE` | Updates making charge, wastage, or manual override. Emits audit log. |
| `/api/admin/orders` | `GET` | `ORDERS_VIEW` | Paginated orders list. Masks customer contact/spend unless `CUSTOMERS_PII_VIEW`. |
| `/api/admin/orders/:orderId` | `GET` | `ORDERS_VIEW` | Complete order detail. Customer PII masked unless caller is `OWNER`. |
| `/api/admin/orders/:orderId/transition` | `POST` | `ORDERS_MANAGE` | Allowed state transition. Restores inventory on cancel. Illegal transitions blocked with `409`. |
| `/api/admin/orders/:orderId/invoice` | `GET` | `ORDERS_VIEW` | Printable GST invoice metadata with HSN tax breakdown. |
| `/api/admin/orders/:orderId/shipments` | `POST` | `SHIPMENTS_MANAGE` | **Fail-closed.** Returns `503 SHIPMENT_PROVIDER_NOT_CONFIGURED`. |
| `/api/admin/customers` | `GET` | `ORDERS_VIEW` | Paginated customer directory. Contact details masked unless `CUSTOMERS_PII_VIEW`. |
| `/api/admin/customers/:customerId` | `GET` | `ORDERS_VIEW` | Single customer profile with orders & saved designs. PII masked for non-owners. |
| `/api/admin/inventory` | `GET` | `PRODUCTS_VIEW` | Paginated vault inventory with stock threshold warnings. |
| `/api/admin/inventory/adjust` | `POST` | `PRODUCTS_WRITE` | Concurrency check (`expectedQuantity`). Adjustment of `MRS-EAR-2001` returns `403`. |
| `/api/admin/inventory/movements` | `GET` | `AUDIT_VIEW` | Immutable stock movement ledger. |
| `/api/admin/imports/excel` | `POST` | `IMPORTS_RUN` | Dry-run parses 11 sheets, validates weights, and stores preview job with hash. |
| `/api/admin/imports/:jobId/commit` | `POST` | **`OWNER` Role** | Validates `workbookHash`, freshness, and `confirmCommit: true`. Rejects non-owners with `403`. |
| `/api/admin/reports/export.csv` | `GET` | `PRODUCTS_VIEW` / `ORDERS_VIEW` | Formula sanitization (`escapeCsvValue`). Order export forbidden without `CUSTOMERS_PII_VIEW`. |
| `/api/admin/users/:userId/role` | `PUT` | **`OWNER` Role** | Modifies staff role. Downgrading the last active owner returns `409`. |

---

## 4. PII Protection Architecture

Customer PII masking applies server-side before response serialization:
- **Masking Rules:**
  - Name: First letter followed by asterisks (e.g. `Ananya Sharma` → `A**** S*****`).
  - Email: First letter, asterisks, domain (e.g. `ananya@example.com` → `a***@example.com`).
  - Phone: Last two digits visible (e.g. `+91 9876543210` → `+91 ********10`).
  - Street Address: Masked to `*** Confidential Address ***`. City and State remain visible for shipping zone calculation.
- **Enforcement:** Applied universally across list views, detail views, overview dashboard, and CSV reports.
