# Phase 3 Database Integration Report

**Date:** 2026-11-13  
**Target Database:** `mangal_royal_studio_dev` (`localhost:5432`, user `macbook`)  
**Status:** **PASS**

---

## 1. Schema & Migration Verification

- `npx --workspace=@mrs/api prisma validate`: **PASS** (`The schema at prisma/schema.prisma is valid`).
- `npx --workspace=@mrs/api prisma migrate status` (process-scoped `DATABASE_URL` to `mangal_royal_studio_dev`): **PASS** (`3 migrations found in prisma/migrations`, `Database schema is up to date!`).
- No pending, failed, or drifted migrations exist; no schema-writing migrations were required.

---

## 2. Investigation of "Product" and "Order" Table Naming Discrepancy

Inspection of `services/api/prisma/schema.prisma` (and PostgreSQL tables) proves there are **no** models named `Product` or `Order` and **no** `@@map` directives renaming them. Instead, by design (because Shopify is the commerce system of record while PostgreSQL stores custom platform metadata and operational records):
- **Products** are modeled as **`ProductMetadata`** (`"ProductMetadata"` table), related to `ProductVariant`, `ProductImage`, `JewellerySpecification`, `DiamondComponent`, `InventoryRecord`, `PricingSnapshot`, `ProductCustomizationAssignment`, and `ProductModelAsset`.
- **Orders** are modeled as **`OrderMetadata`** (`"OrderMetadata"` table), related to `OrderItem`, `PaymentRecord`, `RefundRecord`, `Shipment`, and `Customer`.

---

## 3. Verified Baseline Data Counts & Referential Integrity

Queried directly via `psql` against `mangal_royal_studio_dev`:

| Entity / Table | Expected | Verified Actual |
|---|---:|---:|
| `ProductMetadata` (Products) | 8 | **8** |
| `OrderMetadata` (Orders) | 3 | **3** |
| `Customer` | 3 | **3** |
| `InventoryRecord` | 8 | **8** |
| `OrderItem` | 3 | **3** |
| `PaymentRecord` | 3 | **3** |
| `RefundRecord` | 0 | **0** |
| `AdminUser` | 3 | **3** |
| `GoldRate` / `DiamondRate` / `PricingRule` | 6 / 5 / 1 | **6 / 5 / 1** |
| `MRS-EAR-2001` `availableQuantity` | 9 | **9** |

- All 3 baseline orders (`MRS-1041` -> `cust-001`, `MRS-1042` -> `cust-002`, `MRS-1043` -> `cust-003`) have `financialStatus = PAID`, valid `Customer` links, and `1` `OrderItem` each.
- All 8 `ProductMetadata` rows have corresponding `InventoryRecord` rows.
- Post-test re-verification confirmed `products=8`, `orders=3`, `customers=3`, `MRS-EAR-2001 availableQuantity=9`.

---

## 4. PostgreSQL Integration & API Security Test Results

Executed sequentially (`--no-file-parallelism`) with `DATA_BACKEND=postgres`, `DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public"`, `NODE_ENV=test`:

| Test Suite | Result | Details |
|---|---|---|
| `src/db/postgres-integration.test.ts` | **5/5 PASS** | Connection, dry-run rollback, stock reservation & rollback, idempotent capture, 25-table rollback |
| `src/db/postgres-runtime.e2e.test.ts` | **5/5 PASS** | Fail-closed backend selection, `/health` & live catalog (`MRS-EAR-2001=9`), HttpOnly cookie + CSRF + RBAC + pricing run, checkout/cancel restock, HMAC webhook replay |
| `src/phase2-postgres.integration.test.ts` | **1/1 PASS** | Customization assignment, saved design, customized order snapshot, `MRS-EAR-2001=9` |
| `src/phase2-acceptance-audit.test.ts` | **26/26 PASS** | Quote engine, IDOR protections, cart/order snapshots, admin RBAC & 3D assets, GLB validation, Excel dry-run/commit/rollback (`confirmCommit: true`), reconciliation |
| `src/phase2-api-security.test.ts` | **5/5 PASS** | Quote validation, client price tamper rejection, IDOR, GLB upload/RBAC, bulk Excel lifecycle |
| **Total PostgreSQL / Security** | **42/42 PASS** | **5 test files, 0 failures** |

Live PostgreSQL-backed HTTP server verification:
- Started `@mrs/api` with `DATA_BACKEND=postgres` on `http://localhost:4000` (`PostgreSQL 18.6 (Postgres.app)`).
- `GET http://localhost:4000/health` returned HTTP 200 with `"backend":"postgres"`, `"counts":{"products":8,"categories":9,"orders":3,"customers":3,"pricingRuns":8}`.
