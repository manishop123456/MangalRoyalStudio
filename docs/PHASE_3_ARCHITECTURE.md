# Phase 3 Architecture: Admin Business Operations & Hardening

**Status:** Prompt 1 Completed — Full Business Operations System & Hardening Delivered.

---

## 1. System Topology & Architectural Invariants

The Mangal Royal Studio Phase 3 architecture delivers a hardened, production-grade business operations system across `apps/admin/`, `services/api/`, and `@mrs/shared`.

```
                    ┌───────────────────────────────────────────────┐
                    │               apps/admin (Next.js)            │
                    │  • HttpOnly Cookie Admin Session              │
                    │  • Server-resolved RBAC navigation            │
                    │  • Range Filter Executive Dashboard           │
                    │  • Server/Client Paginated Operations Lists   │
                    │  • Two-step Hash-Bound Import UI              │
                    └───────────────────────┬───────────────────────┘
                                            │ Authenticated HTTP / JSON
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │            services/api (Express API)         │
                    │  • Authoritative Auth & Permission Middleware │
                    │  • Executive Aggregation & Trend Engine       │
                    │  • Server-Side Pagination & Search Utilities  │
                    │  • Safe CSV Export & Formula Sanitizer        │
                    │  • Order State Machine & Snapshot Inspector   │
                    │  • Concurrency & Locked Baseline Stock Guard  │
                    │  • Two-Step Hash-Bound Excel Importer         │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │           RuntimeBackend Boundary             │
                    │  ┌─────────────────────┐ ┌──────────────────┐  │
                    │  │ JsonRuntimeBackend  │ │ PostgresBackend  │  │
                    │  │ (Active / Verified) │ │ (Blocker noted)  │  │
                    │  └─────────────────────┘ └──────────────────┘  │
                    └───────────────────────────────────────────────┘
```

### Uncompromised Safeguards

- **Protected Theme Files:** `jewellery-theme-backup/` and `apps/shopify-theme/` remain strictly untouched and read-only.
- **Protected State Checksums:**
  - Root: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`
  - API: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f`
- **Baseline Product Data:** 8 baseline products, commercial pricing, and `MRS-EAR-2001` (inventory: 9 provisional, manual modification strictly forbidden with `403 PROTECTED_INVENTORY_RECORD`).
- **External Integration Safety:** No live writes to Shopify Admin API, Razorpay, Shiprocket, or Resend. Fail-closed `503 SHIPMENT_PROVIDER_NOT_CONFIGURED` on shipment booking.

---

## 2. Executive Dashboard Architecture (`GET /api/admin/overview`)

### Range Filtering
The overview endpoint accepts `?range=7d|30d|90d|1y|all|custom` (with optional `dateFrom` and `dateTo` ISO strings). Time filtering evaluates order `placedAt` timestamps to compute:
- Filtered orders subset
- Trend time-series bucketed by day, week, or month
- Order status distribution across `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- Top selling products ranked by unit volume and gross revenue

### Honest Financial Reconciliation
Financial metrics are cleanly separated from raw paid order sums:
- `grossCapturedInr`: Sum of all captured/authorized payment transaction records.
- `totalRefundedInr`: Sum of all processed refund transaction records.
- `netRevenueInr`: Exact difference (`grossCapturedInr - totalRefundedInr`).
- `paidOrdersTotalInr`: Sum of `totalPriceInr` on orders with `financialStatus === 'PAID'` (order line price purchase-time record).
- `disclaimer`: Transparent disclosure of data source boundaries.

---

## 3. Server-Side Pagination, Filtering & Search Contracts

All admin list endpoints implement uniform pagination contracts typed by `@mrs/shared`:

```typescript
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

The server-side utility `paginateList<T>` provides deterministic in-memory slicing, sorting, and boundary clamping across JSON and PostgreSQL backends:
- `GET /api/admin/products`: Search by SKU, title, handle, description; filter by category, metalType, purity, minPrice, maxPrice.
- `GET /api/admin/categories`: Paginated list of 11 jewellery categories.
- `GET /api/admin/orders`: Filter by financial status, fulfillment status, customer, date range. PII gated by `CUSTOMERS_PII_VIEW`.
- `GET /api/admin/customers`: Search by name, email, city; sort by spend, order count. PII masked for non-owners.
- `GET /api/admin/inventory`: Filter by `lowStockOnly`, category, metal type.
- `GET /api/admin/inventory/movements`: Immutable stock audit trail.
- `GET /api/admin/audit-logs`: Search by actor, action, entity type, date range.
- `GET /api/admin/users`: Administrative user list.
- `GET /api/admin/imports`: Historical and active import jobs.

---

## 4. Customer Privacy & Owner-Only PII Architecture

Customer personal data (`firstName`, `lastName`, `email`, `phone`, `addresses`, `totalSpentInr`) is strictly guarded by the `CUSTOMERS_PII_VIEW` permission:
- **Owner Role:** Full unmasked visibility into customer contact details and transaction history.
- **Manager & Pricing Operator Roles:** Customer identities are systematically masked (e.g., `A**** S*****`, `a***@example.com`, `+91 ********01`).
- **Reports Export:** `GET /api/admin/reports/export.csv` strictly forbids order exports to any user lacking `CUSTOMERS_PII_VIEW`, returning `403 CUSTOMERS_PII_PERMISSION_REQUIRED`.

---

## 5. Safe Excel Import Architecture: Preview → Hash Binding → Commit

The workbook import system enforces a fail-safe, two-step persisted preview job protocol:

1. **Preview Step (`POST /api/admin/imports/excel` with `dryRun: true`):**
   - Parses all 11 category sheets.
   - Computes SHA-256 hash of the workbook buffer (`workbookHash`).
   - Validates weights (net ≤ gross), flags missing fields, and blocks duplicate SKUs.
   - Persists the job in status `'PREVIEWED'` with a 24-hour expiration (`expiresAt`).
   - Produces a downloadable CSV error report (`GET /api/admin/imports/:jobId/errors.csv`).

2. **Commit Step (`POST /api/admin/imports/:jobId/commit`):**
   - **Authorization:** Enforces `OWNER` role (`403 OWNER_APPROVAL_REQUIRED`).
   - **Hash Binding:** Validates that the provided `workbookHash` matches the previewed job (`400 WORKBOOK_HASH_MISMATCH`).
   - **Freshness Check:** Rejects expired preview jobs (`400 IMPORT_JOB_EXPIRED`).
   - **Explicit Confirmation:** Requires `confirmCommit: true` (`400 IMPORT_COMMIT_CONFIRMATION_REQUIRED`).
   - **Test Artifact Exclusion:** Automatically skips all test SKUs (`TEST-*`, `test-*`).
   - **Baseline Protection:** Blocks any modification or overwrite of `MRS-EAR-2001`.
   - **Idempotency:** Re-committing an already committed job returns cached statistics without duplicating records.

---

## 6. Concurrency Protection & Inventory Safety

- **Stale Update Prevention:** `POST /api/admin/inventory/adjust` accepts optional `expectedQuantity`. If current vault quantity does not match, it fails with `409 STALE_INVENTORY_UPDATE`.
- **Locked Baseline Stock:** `MRS-EAR-2001` cannot be modified via manual adjustment endpoints; requests fail with `403 PROTECTED_INVENTORY_RECORD`.
- **Immutable Movement Ledger:** Every valid adjustment creates an append-only `InventoryMovementRecord` with actor, quantity delta, reason, and timestamp.

---

## 7. CSV Security & Formula Injection Sanitization

All CSV exports (`/api/admin/reports/export.csv`, `/api/admin/imports/:jobId/errors.csv`) pass through `escapeCsvValue`:
- Values starting with risky spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are prepended with an apostrophe `'`.
- Existing quotes are escaped, and values with commas or newlines are quoted according to RFC 4180.

---

## 8. Database Runtime & Blocker Status

- Development runtime currently operates safely against `DATA_BACKEND=json` (`JsonRuntimeBackend`).
- Environment variable `DATABASE_URL` references database `mangal_royal_studio` on port 5432, which is not verified as the designated `mangal_royal_studio_dev` database.
- Per Prompt Pack Section C, database access is gated, no destructive operations were executed, and the blocker is systematically documented in `docs/PHASE_3_OPERATIONS_AND_LIMITATIONS.md`.
