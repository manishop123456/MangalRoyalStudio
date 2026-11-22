# MRS Final Test Isolation Report

**Date:** 2026-11-22, verification run 06:50:45–06:54:09 UTC (12:20–12:24 IST) · **Environment:** local Mac only · **Git:** `main` @ `c7de1bc` + working tree (nothing committed or pushed)
**Not touched:** staging and production databases and servers, DNS, deployment configuration, pricing values, product data and status, the owner's running local processes.
**Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-isolation/`

## Result: all executed suites PASS, 0 failures
| # | Command | Result |
|---|---|---|
| 1 | `npm run test --workspace=@mrs/api -- src/scripts/import-json-to-postgres.test.ts` | **8/8 PASS** (was 6/7 + 1 fail) |
| 2 | `npm run test --workspace=@mrs/api` | **166/166 PASS**, 12 files (was 164/165) |
| 3 | `npm run test --workspace=@mrs/storefront` | **10/10 PASS** (was 6/7) |
| 4 | `npm run test --workspace=@mrs/shared` | **51/51 PASS** |
| 5 | `npm run test --workspace=@mrs/api -- src/public-catalogue-exposure.test.ts src/phase2-api-security.test.ts src/phase3-admin-operations.test.ts src/db/postgres-runtime.e2e.test.ts` (security/RBAC/pricing/POR/fail-closed regression) | **60/60 PASS** |
| 6 | `npm run typecheck` (4 workspaces) | PASS (exit 0) |
| 7 | `npm run build` (4 workspaces) | PASS (exit 0) |

Lint: still **not configured** in any workspace, so not run. Browser E2E: not run (no browser tooling).
Total tests: 51 + 166 + 10 = **227 passed, 0 failed**.

## Task 1: importer audit test
**Cause:** every importer test read the live `services/api/.data/platform-state.json`, which any locally running JSON-backed API writes to (the owner's session added 2 audit entries, 123 → 125). Test 4 hard-coded `123`, plus other totals (8/3/6/59/6/2).

**Fix (`services/api/src/scripts/import-json-to-postgres.test.ts`):**
- `beforeAll` copies the state file **once** into a private temp directory. Every import runs against that snapshot via `filePath`; `afterAll` deletes it. The live file is only read for that copy and for the path-resolution test.
- Test 4 derives every expectation from the snapshot: imported + skipped = records in the snapshot for products, orders, pricing runs, snapshots, shipments and **audit logs**; skipped orders/snapshots = classified test artifacts. It also asserts that the snapshot's SHA-256 is unchanged after the import.
- Test 5 (idempotency): committed sizes equal one run's imported counts, not fixed numbers.
- **New regression test 4b:** appends 2 synthetic audit entries to a copy and asserts the importer accounts for exactly N + 2, so an environment-dependent total cannot creep back in.
- Remaining fixed numbers: test 3 still asserts the 6 known historical test-artifact orders, refunds and snapshots, now read from the snapshot. Normal owner activity does not create test artifacts, but these counts would need updating if new ones were deliberately added.

## Task 2: storefront integration test
**Cause:** the test called `http://localhost:4000` (the owner's own dev API, with different data) and **silently passed** (`if (!healthOk) return;`) when nothing was listening.

**Fix:** new test-only harness `apps/storefront/src/test-support/isolated-api.ts` (not imported by any route), used by `src/lib/storefront-helpers.test.ts`:
- Starts a **dedicated** API (`node --import tsx services/api/src/index.ts`, a single process) on a **fresh OS-assigned free port** on `127.0.0.1`.
- Isolated data: `DATA_BACKEND=json`, `NODE_ENV=test`, throwaway `MRS_DATA_FILE_PATH` in a temp directory, random JWT secret, Shopify live writes off, payment/shipping/email credentials blank. `DATABASE_URL` is forced to an unreachable address, so no PostgreSQL database can be reached even though the project `.env` is loaded.
- Readiness: polls `/health` until 200 **and** `backend: "json"` while the child is still alive; 60 s timeout. Failure to start **fails** the test (no silent skip).
- Cleanup: SIGTERM, then SIGKILL, for **its own PID only**; deletes its temp directory.
- **New regression tests:**
  - (a) an occupied port makes the harness throw `PORT_IN_USE` and leaves the existing listener untouched;
  - (b) after `stop()` the child PID no longer exists and the port is free;
  - (c) the integration test's server is not on port 4000.

**Verified after the runs:** no leftover harness processes or temp directories; the owner's data file is unchanged (SHA-256 `5d202bad…`).

## Owner's local processes
No owner process was stopped or restarted. Their `npm run dev` (pid 3267) and `tsx watch` (pid 3282), running since 11:33 IST, are unchanged. One note: `tsx watch` **restarted its own child server by itself** at 12:22:07 IST (port 4000 pid 5867 → 7450), because the required production build (step 7) rewrote `packages/shared/dist`, which that dev server watches. Their admin (3001) and storefront (3000) processes were not affected.

## Files changed in this task
- `services/api/src/scripts/import-json-to-postgres.test.ts` (snapshot isolation, derived totals, test 4b)
- `apps/storefront/src/lib/storefront-helpers.test.ts` (isolated live test, 3 harness regression tests)
- `apps/storefront/src/test-support/isolated-api.ts` (new)

## Remaining items
- None among the tests: 0 failures.
- Not run: lint (not configured) and browser E2E.
- Release status from the staging report is unchanged: CONDITIONAL PASS. The approved rate card is still to be published in staging Admin, and 272 drafts lack specifications.
