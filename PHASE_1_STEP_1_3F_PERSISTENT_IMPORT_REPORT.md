# Mangal Royal Studio — Phase 1, Step 1.3F
## Persistent Development Import Execution Report

**Date:** 2026-11-12  
**Status:** **COMPLETED & VERIFIED** (Isolated Development Database `mangal_royal_studio_dev` Populated; `DATA_BACKEND` Still JSON Pending Next Milestone)  

---

## 1. Pre-Import Backup & Database Identity

- **Database Identity Verified (`psql`):**
  - `current_database`: `mangal_royal_studio_dev`
  - `inet_server_port`: `5432`
  - `version`: `PostgreSQL 18.6 (Postgres.app) on aarch64-apple-darwin23.6.0`
- **Custom-Format Backup Created:**
  - Path: `/tmp/mangal_royal_studio_dev_pre_import_20261112_1633.dump`
  - Size: `95K` (non-zero, verified via `ls -lh`)
  - TOC Verification: `pg_restore --list` succeeded (`220` TOC entries, `Archive created at 2026-11-12 16:34:11 IST`).

---

## 2. Import Command & Exit Code

```bash
DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" \
npx --workspace=@mrs/api tsx src/scripts/import-json-to-postgres.ts --commit --exclude-test-artifacts --provisional-inventory MRS-EAR-2001=9
```

- **Exit Code:** `0` (`Mode: COMMITTED`, `Test Artifacts Classified: 78`, `Unresolved References: 0`, `Discrepancies: 0`).

---

## 3. Imported Row Counts & Pre-Existing Records Preserved

Verified via `psql` after commit across all 25 importer tables:

| Table | Post-Import Count | Breakdown |
| :--- | ---: | :--- |
| `AuditLog` | `100` | `99` original non-test logs + `1` `PROVISIONAL_INVENTORY_OVERRIDE` log |
| `Banner` | `4` | `4` imported |
| `Category` | `11` | `11` imported |
| `Collection` | `9` | `9` imported |
| `Content` | `4` | `4` imported |
| `Customer` | `3` | `3` imported (`cust-001`..`cust-003`) |
| `DiamondComponent` | `10` | `10` imported |
| `DiamondRate` | `5` | `5` imported |
| `Discount` | `2` | `2` imported |
| `GoldRate` | `6` | `6` imported |
| `IntegrationEvent` | `0` | `0` in source |
| `InventoryMovement` | `9` | `8` initial vault movements + `1` `PROVISIONAL_IMPORT_OVERRIDE` |
| `InventoryRecord` | `8` | `8` imported |
| `JewellerySpecification` | `8` | `8` imported |
| `Notification` | `2` | `2` non-test notifications (`6` test notifications excluded) |
| `OrderItem` | `17` | `3` imported (`MRS-1041`–`MRS-1043`) + `14` pre-existing `TEST-ORD-*` items preserved |
| `OrderMetadata` | `17` | `3` imported (`MRS-1041`–`MRS-1043`) + `14` pre-existing `TEST-ORD-*` rows preserved |
| `PaymentRecord` | `3` | `3` imported (`6` test payments excluded) |
| `PricingRule` | `1` | `1` imported (`version: 1`) |
| `PricingRun` | `8` | `8` imported (`run-initial-001` + `7` `run-179*` runs with test notes preserved) |
| `PricingRunItem` | `64` | `64` imported |
| `PricingSnapshot` | `59` | `59` imported (`6` orphan `checkout-immutable-lock` snapshots excluded) |
| `ProductMetadata` | `8` | `8` imported |
| `RefundRecord` | `0` | `0` (`6` test refunds excluded) |
| `Shipment` | `2` | `2` imported (`shp-2001`, `shp-2002`) |

---

## 4. Inventory Override Evidence (`MRS-EAR-2001`)

Verified via `psql`:
- `ProductMetadata` + `InventoryRecord`: `sku = MRS-EAR-2001`, `availableQuantity = 9`.
- `InventoryMovement`: `id = mov-provisional-import-mrs-ear-2001`, `movementType = PROVISIONAL_IMPORT_OVERRIDE`, `quantityDelta = 6`, `previousQuantity = 3`, `newQuantity = 9`, `reason = "Provisional pre-test-deduction inventory (9 units; pending physical vault confirmation)"`.
- `AuditLog`: `id = aud-provisional-import-mrs-ear-2001`, `action = PROVISIONAL_INVENTORY_OVERRIDE`, `entityType = InventoryRecord`, `entityId = MRS-EAR-2001`.

---

## 5. Price Handling

- All 8 product prices were imported verbatim from `services/api/.data/platform-state.json` without inventing or publishing replacement prices.
- `run-initial-001` (`status: VALIDATED`, `approvedBy: null`) and `run-179*` (`notes: "Automated test repricing preview"`) were preserved as historical records without misrepresenting test runs as commercially approved.

---

## 6. Foreign-Key & Duplicate Checks

- **Pricing Snapshot Relationships:** `SELECT count(*) FROM "PricingSnapshot" s JOIN "PricingRun" r ON r.id = s."pricingRunId" JOIN "PricingRule" pr ON pr.id = s."pricingRuleId"` returned **`59`** (100% of imported snapshots have valid `PricingRun` and `PricingRule` FKs).
- **Pre-Existing Orders Preserved:** `SELECT count(*) FROM "OrderMetadata" WHERE "orderNumber" LIKE 'TEST-ORD-%'` returned **`14`** (intact).
- **Zero Test Artifacts Imported:** `SELECT count(*) FROM "OrderMetadata" WHERE "customerEmail" = 'buyer@example.com' OR "customerId" = 'cust-guest'` returned **`0`**.
- **Duplicate Check:** Unique constraints on `sku`, `orderNumber`, `providerPaymentId`, `slug`, `handle`, `version`, and `id` prevented any duplicate rows.

---

## 7. Protected Checksums & Themes Verification

- `.data/platform-state.json` SHA-256: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (**UNCHANGED**)
- `services/api/.data/platform-state.json` SHA-256: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (**UNCHANGED**)
- `jewellery-theme-backup/` and `apps/shopify-theme/`: `git diff --stat` empty (**UNCHANGED**).

---

## 8. Remaining Risks

1. `MRS-EAR-2001 = 9` remains provisional until physically confirmed in the Mumbai studio vault.
2. Product prices in `mangal_royal_studio_dev` remain unapproved for live Shopify publishing until the owner approves a real gold/diamond rate card.
3. Express API runtime (`services/api/src/app.ts`) remains on `DataStore` (JSON) until `DATA_BACKEND=postgres` is wired in the next milestone.
