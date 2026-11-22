# Mangal Royal Studio — Phase 1, Step 1.3B
## Data Authority & Discrepancy Reconciliation Report (Mandatory Owner Approval Gate)

**Date:** 2026-11-10  
**Status:** BLOCKED PENDING OWNER DECISION (Mandatory Approval Gate)  
**Target:** Safe schema & runtime migration from JSON persistence to PostgreSQL/Prisma.

---

## 1. Executive Summary

As required by the **Mangal Royal Studio (MRS) Complete Execution Master Prompt**, this report documents all discrepancies, conflicting records, and referential integrity anomalies identified between the two existing platform state files:
1. **Root Platform State:** `.data/platform-state.json` (SHA-256: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`)
2. **API Package State:** `services/api/.data/platform-state.json` (SHA-256: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f`)

Under the Non-Negotiable Protection Rules, the automated system **refuses to invent resolutions or unilaterally declare either file canonical**. An explicit owner decision is required before importing data or executing PostgreSQL runtime cutover.

---

## 2. Inventory & Pricing Discrepancies (Catalog)

Every catalog product has divergent published Shopify prices between the two state files, and `MRS-EAR-2001` has an inventory discrepancy:

| SKU | Product Title | Root Price (`.data`) | API Price (`services/api/.data`) | Root Stock | API Stock | Discrepancy Note |
|---|---|---|---|---|---|---|
| `MRS-RNG-1001` | The Royal Solitaire Diamond Ring | ₹68,500.00 | ₹70,336.00 | 5 | 5 | Price difference of +₹1,836.00 in API |
| `MRS-RNG-1002` | Imperial Halo Eternity Ring | ₹56,900.00 | ₹56,634.00 | 12 | 12 | Price difference of -₹266.00 in API |
| `MRS-EAR-2001` | Nizam Emerald & Diamond Drop Earrings | ₹34,500.00 | ₹40,648.00 | **9** | **3** | Price difference of +₹6,148.00; **Stock conflict: 9 units vs 3 units** |
| `MRS-BRC-3001` | Maharaja Tennis Bracelet | ₹142,000.00 | ₹145,061.00 | 4 | 4 | Price difference of +₹3,061.00 in API |
| `MRS-PND-4001` | Noor Solitaire Diamond Pendant | ₹14,800.00 | ₹15,131.00 | 8 | 8 | Price difference of +₹331.00 in API |
| `MRS-BNG-5001` | Rajwada Antique Diamond Kada | ₹128,500.00 | ₹130,301.00 | 6 | 6 | Price difference of +₹1,801.00 in API |
| `MRS-NCK-6001` | Darbar Diamond Bridal Choker | ₹264,000.00 | ₹282,603.00 | 2 | 2 | Price difference of +₹18,603.00 in API |
| `MRS-ANT-7001` | Mughal Navratna Polki Necklace | ₹198,000.00 | ₹222,556.00 | 3 | 3 | Price difference of +₹24,556.00 in API |

### Impact Analysis
- The API state prices reflect recent formula recalculations from live rate updates.
- The Root state prices reflect the baseline values established in early Phase 0/1.1 audits.
- **Stock conflict on `MRS-EAR-2001`:** If stock is set to 9, oversell risk exists if 6 units were genuinely reserved. If set to 3, available inventory for sale is restricted.

---

## 3. Order & Payment Record Conflicts

| Entity Section | Root State Count | API State Count | Key Discrepancies |
|---|---|---|---|
| `orders` | 3 | 9 | API contains 6 additional orders (`ord-1044` to `ord-1049`). |
| `payments` | 3 | 9 | API contains 6 additional payment records corresponding to `ord-1044`–`ord-1049`. |
| `shipments` | 2 | 2 | Identical in both files (`shp-2001` and `shp-2002`). |
| `refunds` | 0 | 0 | Identical in both files. |

### Referential Integrity Anomaly: Guest Orders
- Orders `ord-1044` through `ord-1049` in `services/api/.data/platform-state.json` specify `customerId: "cust-guest"`.
- Neither state file contains a customer record with `id: "cust-guest"`.
- In Prisma schema (`schema.prisma`), `OrderMetadata.customerId` is nullable (`String?`), but a relation exists to `Customer.id`. Importing `"cust-guest"` directly into a foreign-key column without an existing customer row would fail database constraints.

---

## 4. Pricing Runs & Orphan Pricing Snapshots

| Section | Root State | API State | Referential Integrity Findings |
|---|---|---|---|
| `pricingRuns` | 1 run | 8 runs | Root has only `run-1001`; API has `run-1001` through `run-1008`. |
| `pricingSnapshots` | 3 snapshots | 65 snapshots | Root has 3 snapshots; API has 65 snapshots across various runs. |
| **Orphan Snapshots** | **0** | **6** | In API state, 6 snapshots reference non-existent `pricingRunId`s. |

### Technical Analysis:
In `schema.prisma`, `PricingSnapshot.pricingRunId` is an optional foreign key (`PricingRun?`). If imported into PostgreSQL, snapshots with non-existent `pricingRunId`s must either:
- Have `pricingRunId` set to `NULL` (preserving the published price snapshot without the run reference), OR
- Have placeholder pricing run records created to preserve historical grouping.

---

## 5. Additional Entity Sections

| Section | Root State | API State | Status / Description |
|---|---|---|---|
| `collections` | Not present | 9 collections | Curated collections (`all`, `bestsellers`, `rings`, etc.). Safe to import. |
| `inventoryMovements`| Not present | 2 records | Audit movements recorded in API. Safe to import. |
| `carts` | Not present | 0 carts (empty map) | Ephemeral cart sessions. Safe to initialize empty. |
| `wishlists` | Not present | 0 wishlists (empty map) | Ephemeral wishlist sessions. Safe to initialize empty. |
| `notifications` | Not present | 6 notifications | Email notification log from payment events. Safe to import. |
| `auditLogs` | 3 logs | 123 logs | Rich audit history of pricing, stock adjustments, and logins in API state. |
| `integrationEvents` | 0 events | 0 events | Webhook event logs. |

---

## 6. Local PostgreSQL Availability (Step 1.3A)

A scan of the local machine confirmed:
- Postgres.app is installed at `/Applications/Postgres.app/Contents/Versions/latest/bin/`.
- `pg_isready -h localhost -p 5432` returns: **`localhost:5432 - no response`**.
- PostgreSQL server is **NOT currently running**.

### Instructions to Start Local PostgreSQL
1. Launch **Postgres.app** from the macOS Applications folder:
   ```bash
   open -a Postgres
   ```
2. Click **"Start"** in the Postgres.app window.
3. Verify connection:
   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost -p 5432
   ```
4. Create the development database:
   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin/createdb mangal_royal_studio
   ```

---

## 7. Required Owner Decisions

Before Step 1.3 database migration and data import can proceed, the project owner must decide:

1. **Canonical State Authority:**
   - **Option A (Recommended):** Declare `services/api/.data/platform-state.json` as the authoritative source of truth, as it contains complete operational history, updated prices, 9 orders, and 123 audit logs.
   - **Option B:** Declare `.data/platform-state.json` authoritative and discard the 6 additional orders and price runs.
2. **`MRS-EAR-2001` Inventory Quantity:**
   - Set to **3 units** (reflecting reserved stock from orders in API state), or
   - Set to **9 units** (original unreserved stock).
3. **Guest Order Customer FK Handling:**
   - Set `customerId = NULL` for guest orders, or
   - Create a dedicated system profile for guest checkouts (`cust-guest`).
4. **Orphan Pricing Snapshots:**
   - Set `pricingRunId = NULL` for the 6 orphan snapshots, or
   - Create stub historical pricing run records.

*Phase 1 implementation for all code, security, cookies, webhooks, rate limiting, and UI wiring is 100% complete and fully verified. Execution awaits owner decision on the above 4 items to execute database loading.*
