# MRS Production Database Readiness

- **Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean`
- **Date:** 2026-11-22

---

## 1. Test Database Isolation (`mangal_royal_studio_test`) — `VERIFIED`

To eliminate all dependency on `mangal_royal_studio_dev` and enable the 27 previously skipped PostgreSQL integration tests:

1. **Provisioned Isolated Test Database:**
   - Created `mangal_royal_studio_test` on `localhost:5432` owned by `macbook` (`mangal_royal_studio_dev` untouched).
   - Applied all 3 Prisma migrations via `prisma migrate deploy`:
     - `20261105000000_init_complete_platform`
     - `20261112000000_phase1_runtime_completion`
     - `20261112180000_phase2_customization_and_3d_assets`
2. **Seeded Synthetic Data Only:**
   - Imported synthetic `PlatformState` via `createSyntheticPlatformStateFixture()` + `runJsonToPostgresImport` (with `MRS_SEED_*` unset so seeded accounts remain locked).
   - Upserted `Role` and `Permission` rows from `ROLE_PERMISSIONS` (`OWNER`, `MANAGER`, `PRICING_OPERATOR`).
   - Ran `seed-phase2-customization.ts` (2 profiles, 8 groups, 26 options).
   - Activated synthetic non-placeholder rates and added 1 synthetic `DRAFT` product (`SYNTH-DRAFT-001`) in `mangal_royal_studio_test`.
3. **Database Identity Guard (`services/api/src/test-support/test-db.ts`):**
   - `resolveIsolatedTestDatabaseUrl()` defaults to `mangal_royal_studio_test` and throws `REFUSING_NON_TEST_DATABASE` for `mangal_royal_studio_dev`, `mangal_royal_studio_staging`, any `*prod*` name, or any database not ending in `_test`.
   - `assertIsolatedTestDatabase(prisma)` queries `SELECT current_database() AS db` before test writes.
   - Wired into `postgres-integration.test.ts`, `postgres-runtime.e2e.test.ts`, `phase2-acceptance-audit.test.ts`, and `phase2-postgres.integration.test.ts`.
4. **Test Execution Result:**
   - Command: `DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_test?schema=public" npm run test --workspace=@mrs/api`
   - Outcome: **13/13 test files passed, 176/176 tests passed, 0 skipped** (`EXIT_CODE=0`).

### Safe One-Time Local Test DB Setup Commands (Reference)
```bash
psql -h localhost -U macbook -d postgres -c "CREATE DATABASE mangal_royal_studio_test OWNER macbook;"
cd services/api
DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_test?schema=public" npx prisma migrate deploy
```

---

## 2. Prisma Migration Safety Audit — `VERIFIED`

Inspected all 3 migrations in `services/api/prisma/migrations/`:
- `20261105000000_init_complete_platform/migration.sql`
- `20261112000000_phase1_runtime_completion/migration.sql`
- `20261112180000_phase2_customization_and_3d_assets/migration.sql`

- **Result:** All migrations are strictly additive (`CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT`). Zero `DROP`, `TRUNCATE`, or `DELETE FROM` statements exist.
- **Production Rule:** Always deploy schema changes with `npx prisma migrate deploy`. Never run `prisma migrate reset` or `prisma db push` in production.

---

## 3. Production Database Isolation Plan — `INFRASTRUCTURE ACTION REQUIRED`

- **Dedicated Production DB:** Provision `mangal_royal_studio_prod` inside a separate `mrs_prod_postgres` container on `mrs_prod_network` (never `mangal_royal_studio_dev`, `mangal_royal_studio_staging`, or `mangal_royal_studio_test`).
- **Restricted DB Role:** Create a dedicated least-privilege PostgreSQL user (e.g., `mrs_prod_app`) bound to `mangal_royal_studio_prod` only, with no superuser privileges and no network exposure outside `mrs_prod_network` (never bind `0.0.0.0:5432`).
- **Pre-Migration Backup:** Before any production migration or data import, take a timestamped `pg_dump -Fc` backup outside the web root, verify readability with `pg_restore --list`, record its SHA-256 checksum, and set `chmod 600`.
