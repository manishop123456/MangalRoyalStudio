# Mangal Royal Studio — Phase 1, Step 1.3C
## PostgreSQL Importer Remediation Report

**Date:** 2026-11-12  
**Status:** **REMEDIATION & DRY-RUN VERIFICATION COMPLETE** (Persistent Import & Runtime Cutover Gated on Owner Approval)  
**Target:** [`services/api/src/scripts/import-json-to-postgres.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/scripts/import-json-to-postgres.ts)

---

## 1. Defects Found in Previous Importer

1. **Missing Pricing Runs & Snapshots:** `summary.pricingRuns` and `summary.pricingSnapshots` were initialized to `0`, and `executeImport()` never imported `pricingRuns`, `pricingRunItems`, or `pricingSnapshots`.
2. **Missing Entity Collections:** `shipments`, `refunds`, `inventoryMovements`, `notifications`, and `integrationEvents` were omitted.
3. **Arbitrary Audit Log Truncation:** `state.auditLogs` was sliced to `.slice(0, 50)`, silently dropping 73 of 123 audit log records.
4. **Non-Idempotent Writes:** `diamondComponent.create`, `goldRate.create`, `diamondRate.create`, `banner.create`, `content.create`, and `auditLog.create` failed or duplicated rows on repeated runs.
5. **Silent Foreign-Key Coercion:** Unknown `customerId` values (such as `"cust-guest"`) were silently coerced to `null` without reporting or requiring an approved mapping.
6. **IEEE-754 Float Conversion:** Financial and weight fields were converted using `Number(...)` instead of exact decimal strings.
7. **Brittle Path Resolution:** `path.resolve(process.cwd(), 'services/api/.data/platform-state.json')` failed when invoked from `services/api/`.
8. **Duplicate `providerPaymentId` Blind Spot:** Test payments sharing `pay_test_verified_001` were silently skipped without surfacing the collision.

---

## 2. Files Changed

- **Modified:** [`services/api/src/scripts/import-json-to-postgres.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/scripts/import-json-to-postgres.ts) — Full remediation (all 25 tracked counts, pre-write FK validation, test-artifact classification & policy gate, `decimal.js` exact formatting, idempotent upserts, deterministic path resolution).
- **Modified:** [`services/api/src/db/postgres-integration.test.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/db/postgres-integration.test.ts) — Updated dry-run assertions to use `testArtifactPolicy: 'EXCLUDE'` and `summary.imported` / `summary.skipped` / `summary.rolledBack`.
- **Created:** [`services/api/src/scripts/import-json-to-postgres.test.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/scripts/import-json-to-postgres.test.ts) — 7 unit/harness tests covering path resolution, exact decimal precision, test artifact classification, dry-run zero-persistence, idempotency on double-run, mid-transaction failure rollback, and fail-closed FK validation.
- **Created:** `PHASE_1_STEP_1_3C_IMPORTER_REMEDIATION_REPORT.md` — This report.

---

## 3. Importer Architecture

1. **`resolveStateFilePath(inputPath?)`:** Resolves relative/default `.data/platform-state.json` paths reliably from either monorepo root or `services/api/`.
2. **`classifyTestArtifacts(state)`:** Scans all collections for pre-isolation test records (`ord-1044`–`ord-1049`, `cart-test-*`, `rfnd-179*`, `MRS-TST-*`, `checkout-immutable-lock`, `buyer@example.com`, `pay_test_verified_001`) and returns a structured classification list.
3. **`validateStateForImport(state, options)`:** Pre-validates all foreign keys (`OrderMetadata.customerId`, `PricingRun.pricingRuleId`, `PricingSnapshot.pricingRunId`/`formulaVersion`, `Shipment.orderId`, `RefundRecord.orderId`/`paymentId`, `InventoryMovement.sku`) and detects unique-key collisions (`providerPaymentId`) before any database writes occur.
4. **Policy Gate (`TestArtifactPolicy`):**
   - `'REJECT'` (default fail-closed): Refuses commit if any classified test artifacts, unresolved FKs, or collisions exist.
   - `'EXCLUDE'`: Excludes classified test artifacts cleanly and records exact `skipped` counts per collection.
   - `'INCLUDE_WITH_MAPPING'`: Permits inclusion only when explicit `unresolvedCustomerMapping` / `orphanPricingRunMapping` are supplied.
5. **Single Transaction Execution:** All 20 Prisma entity upserts run inside `prisma.$transaction(..., { timeout: 30000 })`. In `dryRun: true`, an intentional `ROLLBACK_INTENTIONAL` error forces full transaction rollback.

---

## 4. Entity-by-Entity Import Coverage

Dry-run execution against `services/api/.data/platform-state.json` with `testArtifactPolicy: 'EXCLUDE'` accounted for **100% of records**:

| Entity Collection | Imported (Dry-Run) | Skipped (Test Artifacts) | Unique / Idempotency Key |
| :--- | ---: | ---: | :--- |
| `categories` | 11 | 0 | `slug` |
| `collections` | 9 | 0 | `handle` |
| `products` | 8 | 0 | `sku` |
| `jewellerySpecs` | 8 | 0 | `productMetadataId` |
| `diamondComponents` | 10 | 0 | Deterministic `${spec.id}-dc-${idx}` |
| `inventoryRecords` | 8 | 0 | `productMetadataId` |
| `goldRates` | 6 | 0 | `id` |
| `diamondRates` | 5 | 0 | `id` |
| `pricingRules` | 1 | 0 | `version` |
| `pricingRuns` | 8 | 0 | `id` |
| `pricingRunItems` | 64 | 0 | Deterministic `${run.id}-${item.sku}` |
| `pricingSnapshots` | 59 | 6 | `id` |
| `customers` | 3 | 0 | `email` |
| `orders` | 3 | 6 | `orderNumber` |
| `orderItems` | 3 | 6 | Deterministic `${order.id}-item-${idx}` |
| `payments` | 3 | 6 | `providerPaymentId` |
| `shipments` | 2 | 0 | `id` |
| `refunds` | 0 | 6 | `providerRefundId` |
| `inventoryMovements` | 8 | 18 | `id` |
| `discounts` | 2 | 0 | `code` |
| `banners` | 4 | 0 | `id` |
| `contents` | 4 | 0 | `slug` |
| `notifications` | 2 | 6 | `id` |
| `integrationEvents` | 0 | 0 | `[provider, eventId]` |
| `auditLogs` | 99 | 24 | `id` (all 123 accounted for) |

*(Note: 6 `cart-test-*` carts are also classified in `testArtifacts`, totaling 78 classified test artifacts across all collections.)*

---

## 5. Idempotency Strategy

- Every single entity collection uses `tx.<model>.upsert(...)` keyed on natural unique columns (`slug`, `handle`, `sku`, `version`, `email`, `orderNumber`, `providerPaymentId`, `providerRefundId`, `code`, `[provider, eventId]`) or preserved/deterministic primary IDs (`id`, `${spec.id}-dc-${idx}`, `${run.id}-${item.sku}`, `${order.id}-item-${idx}`).
- Verified by running `runJsonToPostgresImport` twice sequentially on the same dataset (`import-json-to-postgres.test.ts` test #5), confirming zero duplicate records.

---

## 6. Decimal Precision Strategy

- Implemented `toExactDecimalString(value, scale, fallback)` using `Decimal` from `decimal.js`.
- Financial fields (`@db.Decimal(14, 2)` / `Decimal(14, 4)`) and weight fields (`@db.Decimal(10, 3)`) are converted directly to fixed-scale decimal strings (`"68500.00"`, `"2.300"`, `"0.2000"`) without IEEE-754 `Number(...)` arithmetic.

---

## 7. Test Artifact Handling

- Pre-isolation test artifacts (`ord-1044`–`ord-1049`, `cart-test-*`, `rfnd-179*`, `MRS-TST-*`, `checkout-immutable-lock`, `buyer@example.com`, `pay_test_verified_001`) are explicitly classified into `summary.testArtifacts` (78 entries).
- Default `REJECT` policy fails closed so ambiguous test records can never enter a persistent database accidentally.
- `EXCLUDE` policy omits all 78 classified test artifacts while importing all legitimate records and reporting exact `skipped` counts.

---

## 8. Dry-Run Results (Real PostgreSQL 18.6 `mangal_royal_studio_dev`)

- **Command:** `DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" npx --workspace=@mrs/api tsx src/scripts/import-json-to-postgres.ts --dry-run --exclude-test-artifacts`
- **Exit Code:** `0` (`Mode: DRY-RUN (Rolled Back)`, `Test Artifacts Classified: 78`, `Unresolved References: 0`, `Discrepancies: 0`).
- **Post-Rollback Verification (`psql`):** `ProductMetadata: 0`, `PricingSnapshot: 0`, `AuditLog: 0` (confirming 100% rollback of all staged writes; `OrderMetadata: 12` reflects pre-existing rows from prior integration tests untouched per non-destructive rules).

---

## 9. Test, Typecheck & Build Results

| Check | Result | Details |
| :--- | :--- | :--- |
| `npm run typecheck` | **PASSED** (exit `0`) | 0 errors across `@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront` |
| `npm test` (`@mrs/shared`) | **PASSED** (exit `0`) | 3/3 passed (`pricing-engine.test.ts`) |
| `npm test` (`@mrs/api` non-DB) | **PASSED** (exit `0`) | 66/66 passed (`import-json-to-postgres.test.ts` 7/7, `data-store.test.ts` 9/9, `auth-config.test.ts` 5/5, `app.test.ts` 45/45); `postgres-integration.test.ts` skipped in sandbox |
| Unsandboxed `postgres-integration.test.ts` | **PASSED** (exit `0`) | 4/4 passed against live PostgreSQL 18.6 (`mangal_royal_studio_dev`) |
| `npm run build` | **PASSED** (exit `0`) | All 4 workspaces built cleanly |
| Protected JSON SHA-256 | **PASSED** | `.data/platform-state.json`: `3495c9aa...`; `services/api/.data/platform-state.json`: `84a50caa...` |
| Protected Themes | **PASSED** | Zero diff in `jewellery-theme-backup/` and `apps/shopify-theme/` |

---

## 10. Remaining Owner Decisions

1. **Canonical Data Authority & Test Artifact Policy:** Approve whether the live development import should use `services/api/.data/platform-state.json` with `--exclude-test-artifacts` (excluding the 78 test artifacts and keeping the 8 updated product prices, 8 pricing runs, 59 snapshots, 3 real orders, 2 shipments, and 99 real audit logs), or adopt `.data/platform-state.json` baseline prices.
2. **`MRS-EAR-2001` Inventory Stock:** If `ord-1044`–`ord-1049` are excluded as test artifacts, confirm whether `MRS-EAR-2001` stock should be restored to `9` (matching Root baseline) or kept at `3`.

---

## 11. Exact Next Step

Once the owner approves the canonical data authority and `MRS-EAR-2001` inventory decision:
1. Execute the approved persistent import into `mangal_royal_studio_dev` (`--commit --exclude-test-artifacts`).
2. Wire `DATA_BACKEND=postgres` and the Prisma repositories into `services/api/src/app.ts` in the next milestone.
