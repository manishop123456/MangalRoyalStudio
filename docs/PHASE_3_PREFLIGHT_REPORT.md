# Phase 3 Preflight Report

**Date:** 2026-11-13  
**Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Branch:** `main`  

---

## 1. Environment & Configuration Inspection

- **Active `.env` Configuration (Secrets Redacted):**
  - `NODE_ENV`: `development`
  - `API_PORT`: `4000`, `API_HOST`: `0.0.0.0`
  - `CORS_ORIGIN`: `http://localhost:3000,http://localhost:3001`
  - `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_ADMIN_API_URL`: `http://localhost:4000`
  - `SHOPIFY_LIVE_WRITES_ENABLED`: `false`
  - `SHOPIFY_API_VERSION`: `2025-01`
  - `DATABASE_URL`: `postgresql://localhost:5432/mangal_royal_studio` (credentials redacted)
- **Prisma Migrations Present (`services/api/prisma/migrations/`):**
  1. `20261105000000_init_complete_platform`
  2. `20261112000000_phase1_runtime_completion`
  3. `20261112180000_phase2_customization_and_3d_assets`
- **Running Processes Check:**
  - `lsof -i :3001 -i :4000` returned no active listeners (`PORTS_FREE`).
  - `pg_isready -h localhost -p 5432` returned `localhost:5432 - no response` (PostgreSQL not running).

---

## 2. Protected Resources & Incident Audit

- **Theme Directories:** `jewellery-theme-backup/` and `apps/shopify-theme/` show zero modifications in `git status`.
- **Protected JSON SHA-256 Checksums:**
  - `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (**MATCH**)
  - `services/api/.data/platform-state.json` at preflight start: `5fc8a4fc8ff89e0d0b624ca6330d471af30dad2618ad316ba48eedfa4e9a96ea` (**MISMATCH DETECTED**)
    - **Root Cause Investigation:** Diffing against the verified Phase 1.2.2 backup showed that running the live JSON-mode Express API during the earlier local preview (`NODE_ENV=development`) persisted `lastLoginAt` on `users`, 1 `AUTH_LOGIN` entry in `auditLogs` (123 → 124), and empty Phase 2 arrays (`customizationProfiles`, `productCustomizationAssignments`, `customerDesigns`, `productModelAssets`). No product, order, price, or `MRS-EAR-2001` inventory record was altered.
    - **Immediate Remediation:** Restored `services/api/.data/platform-state.json` from the verified backup (`backups/step-1-2-2-state-backup/api-data/platform-state.json`).
    - **Re-verified SHA-256:** `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (**EXACT MATCH**).
    - **Prevention:** Subsequent JSON-mode local preview / browser acceptance runs use `MRS_DATA_FILE_PATH` pointing to an isolated copy in `/tmp` (or `NODE_ENV=test` in-memory mode) so `services/api/.data/platform-state.json` is never written to on disk.
