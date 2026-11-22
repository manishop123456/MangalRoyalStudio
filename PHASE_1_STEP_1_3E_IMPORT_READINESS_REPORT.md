# Mangal Royal Studio — Phase 1, Step 1.3E
## Safe Development Import Readiness Report

**Date:** 2026-11-12  
**Import Readiness Verdict:** **PASS** (Ready for Owner-Authorized Persistent Import into `mangal_royal_studio_dev`)  
**Target Database:** `mangal_royal_studio_dev` (`postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public`)

---

## 1. Final Source & Exclusion Decisions

- **Canonical Source:** `services/api/.data/platform-state.json` (SHA-256: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f`, untouched).
- **Test Artifact Exclusions (`--exclude-test-artifacts`):** All **78** classified test artifacts are explicitly excluded:
  - `orders`: `6` (`ord-1044`–`ord-1049`, `cust-guest`, `buyer@example.com`)
  - `orderItems`: `6` (line items of `ord-1044`–`ord-1049`)
  - `payments`: `6` (`pay-179*` sharing `pay_test_verified_001`)
  - `refunds`: `6` (`rfnd-179*` referencing `pay_test_verified_001`)
  - `pricingSnapshots`: `6` (orphan `checkout-immutable-lock` snapshots)
  - `inventoryMovements`: `18` (`MRS-TST-*` and `buyer@example.com` checkout deductions)
  - `notifications`: `6` (`buyer@example.com` / `pay_test_verified_001`)
  - `auditLogs`: `24` (referencing `MRS-TST-*`, `ord-1044`–`ord-1049`, `rfnd-179*`, `pay_test_verified_001`)
  - `carts`: `6` (`cart-test-*`, not imported by relational importer)

---

## 2. Provisional Inventory Treatment (`MRS-EAR-2001`)

- **Source JSON Value:** `3` units (untouched in `services/api/.data/platform-state.json`).
- **Movement Evidence:** `mov-init-3` (`2026-11-05T10:00:00.000Z`, `owner@mangalroyalstudio.com`) established `9` units; all 6 subsequent deductions (`9 → 3`) were test checkouts by `buyer@example.com`.
- **Explicit Override & Audit Trail:** Implemented `--provisional-inventory MRS-EAR-2001=9` in [`import-json-to-postgres.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/scripts/import-json-to-postgres.ts). Inside the same transaction, this:
  1. Sets `InventoryRecord.availableQuantity = 9` for `MRS-EAR-2001` without modifying the source JSON.
  2. Records `InventoryMovement` (`mov-provisional-import-mrs-ear-2001`, `PROVISIONAL_IMPORT_OVERRIDE`, `delta: +6`, `3 -> 9`, `"Provisional pre-test-deduction inventory (9 units; pending physical vault confirmation)"`).
  3. Records `AuditLog` (`aud-provisional-import-mrs-ear-2001`, `OWNER`, `PROVISIONAL_INVENTORY_OVERRIDE`).
- **Physical Verification Status:** **Not physically verified**; remains provisional pending Mumbai studio vault count.

---

## 3. Eight Product Price Discrepancies (No Commercial Approval)

Source prices from `services/api/.data/platform-state.json` are preserved as-is without inventing replacement prices. **Neither Root JSON nor API JSON prices have genuine commercial approval** (`run-initial-001` is `VALIDATED` with `approvedBy: null`; all 7 `run-179*` runs preserve `notes: "Automated test repricing preview"` so they are never represented as commercially approved):

| SKU | Root Price (INR) | API Price (INR) | Delta (INR / %) | Commercial Approval |
| :--- | ---: | ---: | ---: | :--- |
| `MRS-ANT-7001` | 198,000.00 | 222,556.00 | +24,556.00 (+12.40%) | **None** |
| `MRS-BNG-5001` | 128,500.00 | 130,301.00 | +1,801.00 (+1.40%) | **None** |
| `MRS-BRC-3001` | 142,000.00 | 145,061.00 | +3,061.00 (+2.16%) | **None** |
| `MRS-EAR-2001` | 34,500.00 | 40,648.00 | +6,148.00 (+17.82%) | **None** |
| `MRS-NCK-6001` | 264,000.00 | 282,603.00 | +18,603.00 (+7.05%) | **None** |
| `MRS-PND-4001` | 14,800.00 | 15,131.00 | +331.00 (+2.24%) | **None** |
| `MRS-RNG-1001` | 68,500.00 | 70,336.00 | +1,836.00 (+2.68%) | **None** |
| `MRS-RNG-1002` | 56,900.00 | 56,634.00 | -266.00 (-0.47%) | **None** |

---

## 4. Existing Database Row Counts (`mangal_royal_studio_dev`)

- **Pre-Existing Rows:** `OrderMetadata: 14`, `OrderItem: 14` (all `TEST-ORD-1794*` / `test.buyer@example.com` / `PENDING` from prior integration tests, with zero `orderNumber` or `id` overlap with `MRS-1041`–`MRS-1043`).
- **All Other 23 Importer Tables:** `0` rows.

---

## 5. Dry-Run Verification Results

- **Command Executed:**
  ```bash
  DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" \
  npx --workspace=@mrs/api tsx src/scripts/import-json-to-postgres.ts --dry-run --exclude-test-artifacts --provisional-inventory MRS-EAR-2001=9
  ```
- **Exit Code:** `0` (`Mode: DRY-RUN (Rolled Back)`, `Test Artifacts Classified: 78`, `Unresolved References: 0`, `Discrepancies: 0`).
- **Staged Counts:** `categories: 11`, `collections: 9`, `products: 8`, `jewellerySpecs: 8`, `diamondComponents: 10`, `inventoryRecords: 8`, `goldRates: 6`, `diamondRates: 5`, `pricingRules: 1`, `pricingRuns: 8`, `pricingRunItems: 64`, `pricingSnapshots: 59`, `customers: 3`, `orders: 3`, `orderItems: 3`, `payments: 3`, `shipments: 2`, `refunds: 0`, `inventoryMovements: 9` (`8` + `1` provisional override), `discounts: 2`, `banners: 4`, `contents: 4`, `notifications: 2`, `integrationEvents: 0`, `auditLogs: 100` (`99` + `1` provisional override).
- **Post-Rollback `psql` Check:** `ProductMetadata: 0`, `InventoryRecord: 0`, `InventoryMovement: 0`, `AuditLog: 0`, `OrderMetadata: 14` (unchanged).
- **Typecheck:** `npm run typecheck --workspace=@mrs/api` exited `0`.

---

## 6. Pre-Import Backup & Recovery Checklist

1. **Verify Target DB:** Confirm `DATABASE_URL` points strictly to `mangal_royal_studio_dev` on `localhost:5432`.
2. **Take Pre-Import `pg_dump` Backup:**
   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump \
     -h localhost -p 5432 -U macbook -Fc \
     -f "/tmp/mangal_royal_studio_dev_pre_import_$(date +%Y%m%d_%H%M%S).dump" \
     mangal_royal_studio_dev
   ```
3. **Execute Persistent Import** (Section 8 below, only after explicit authorization).
4. **Verify Post-Import Counts & Foreign Keys** via `psql`.
5. **Recovery Procedure:** Before any `pg_restore`, export any post-import records (`pg_dump --data-only`) so newly created development records are preserved.

---

## 7. Remaining Risks

- **Commercial Pricing:** Prices in `mangal_royal_studio_dev` remain unapproved for live Shopify publishing until the owner approves a real gold/diamond rate card and executes the 4-step pricing governance workflow.
- **Physical Inventory:** `MRS-EAR-2001 = 9` is provisional until physically counted in the Mumbai studio vault.
- **Pre-Existing Test Rows:** `14` `TEST-ORD-*` rows remain in `OrderMetadata`/`OrderItem` in `mangal_royal_studio_dev` because database reset/truncation is prohibited.

---

## 8. Exact Persistent Import Command (**DO NOT EXECUTE WITHOUT AUTHORIZATION**)

```bash
DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" \
npx --workspace=@mrs/api tsx src/scripts/import-json-to-postgres.ts --commit --exclude-test-artifacts --provisional-inventory MRS-EAR-2001=9
```

---

## 9. Readiness Determination

**PASS** — All safeguards, dry-run checks, provisional inventory auditing, and rollback verifications passed with `0` errors. Awaiting explicit authorization to execute the backup and persistent import command.
