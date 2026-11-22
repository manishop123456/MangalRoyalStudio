# Phase 3 Final Preflight Report

**Date:** 2026-11-13  
**Workspace:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Branch:** `main` (existing uncommitted Phase 1/2/3 workspace changes preserved; no `git reset`, `checkout`, `clean`, `stash`, commit, or push performed)

---

## 1. Protected File Checksums (Before Work)

- `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (MATCH)
- `services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (MATCH)
- Protected directories (`jewellery-theme-backup/`, `apps/shopify-theme/`): untouched.

---

## 2. Environment & Runtime Backend Selection

- `.env` (non-secret inspection only):
  - `API_PORT=4000`
  - `DATABASE_URL` in `.env` targets `postgresql://postgres:***@localhost:5432/mangal_royal_studio?schema=public` (not modified).
  - `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000`, `NEXT_PUBLIC_STOREFRONT_API_URL=http://localhost:4000/api/v1`.
  - `DATA_BACKEND` is unset in `.env`; per `services/api/src/db/backend.ts` (`resolveDataBackendMode`), unset defaults to `'json'` unless `DATA_BACKEND=postgres` is explicitly provided at process startup.
- Process-scoped PostgreSQL target used for DB verification & integration tests:
  - `postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public` with `DATA_BACKEND=postgres`.
- Ports `3000`, `3001`, `4000` at preflight start: none listening (`lsof` empty).

---

## 3. Prisma Schema & Migrations Location

- Schema: `services/api/prisma/schema.prisma`
- Migrations (`services/api/prisma/migrations/`):
  1. `20261105000000_init_complete_platform`
  2. `20261112000000_phase1_runtime_completion`
  3. `20261112180000_phase2_customization_and_3d_assets`
