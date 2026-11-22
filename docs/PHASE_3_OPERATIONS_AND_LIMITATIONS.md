# Phase 3 Operations and Limitations

**Status:** PROMPT 1 COMPLETED. Operating Boundaries & Known System Limitations.

---

## 1. Active Operational Boundaries & Safeguards

The Phase 3 Admin Business Operations system enforces strict operational invariants:

1. **Authentication & Session Lifecycle:** Administrative operations require an authenticated HttpOnly cookie session or signed Bearer token. Expired sessions or tokens with altered role claims are immediately rejected with `401 UNAUTHORIZED`.
2. **Authoritative Role Gating:** Frontend link visibility is cosmetic; the Express API enforces RBAC middleware on every route. Owner-only actions (`IMPORTS_COMMIT`, `USERS_MANAGE`, `CUSTOMERS_PII_VIEW`, `PRICING_APPROVE`, `PRICING_PUBLISH`) strictly require the `OWNER` role.
3. **Honest Financial Semantics:**
   - The executive overview differentiates between `grossCapturedInr` (transaction payments), `totalRefundedInr` (authoritative refunds), `netRevenueInr` (net difference), and `paidOrdersTotalInr` (purchase-time order snapshot sum).
   - Order-level paid totals do not reflect post-purchase partial refunds.
4. **Locked Baseline Inventory (`MRS-EAR-2001`):**
   - In accordance with the Owner decision, `MRS-EAR-2001` has a provisional vault stock of 9 units.
   - Any manual adjustment request targeting `MRS-EAR-2001` is rejected with `403 PROTECTED_INVENTORY_RECORD`.
5. **Two-Step Import Hash Binding:**
   - Workbook uploads are dry-run previews that compute an immutable SHA-256 `workbookHash` and expire after 24 hours.
   - Commits are restricted to Owners and require explicit confirmation (`confirmCommit: true`) and matching hash.
   - All test artifacts (`TEST-*`, `test-*`) are automatically excluded from catalog ingestion.
6. **CSV Injection Defense:** All cell values in exported CSV reports pass through `escapeCsvValue`, neutralizing formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`).

---

## 2. Documented System Limitations & Deferred Items

### Limitation 1: Local PostgreSQL Target Database Verification Blocker
- **Current State:** The active environment variable in `.env` is configured as:
  `DATABASE_URL=postgresql://macbook@localhost:5432/mangal_royal_studio`
- **Safeguard Rule:** The approved development database is `mangal_royal_studio_dev`. Prompt Pack instructions strictly forbid guessing, connecting to, or executing migrations against an unverified or potentially shared database.
- **Operating Mode:** The system runs safely in verified JSON mode (`DATA_BACKEND=json`), which satisfies all API, business operations, and unit test requirements.
- **Next Step:** Prompt 2 will safely verify, inspect, and connect to `mangal_royal_studio_dev`.

### Limitation 2: External Shipping Carrier Integration (Shiprocket)
- **Current State:** No third-party carrier credentials or webhook signing secrets are configured.
- **Enforcement:** `POST /api/admin/orders/:orderId/shipments` fails closed with `503 SHIPMENT_PROVIDER_NOT_CONFIGURED`. No synthetic tracking numbers or third-party network calls are executed.

### Limitation 3: Live Shopify Admin API Publishing
- **Current State:** Live catalog writes to Shopify remain disabled (`SHOPIFY_LIVE_WRITES_ENABLED=false`).
- **Enforcement:** Mass price updates and product creations do not push to a live Shopify store.

### Limitation 4: Bullion & Diamond Commercial Rates
- **Current State:** Metal rates (e.g. 18K @ ₹5,820/g) and diamond bracket rates in the development store are configurable placeholders.
- **Policy:** They must not be treated as commercially approved live pricing. Commercial formula approval remains reserved for the store Owner.

### Limitation 5: 3D Model Asset Storage
- **Current State:** Validated 3D `.glb` assets are stored on the local filesystem in `services/api/uploads/models/`.
- **Roadmap:** Production deployment will require transition to cloud object storage (AWS S3 or Google Cloud Storage) with signed CDN URLs.
