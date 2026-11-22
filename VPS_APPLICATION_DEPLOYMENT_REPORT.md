# VPS Application Deployment Report (Private Staging)

**Date:** 2026-11-19  
**VPS:** `[STAGING_SERVER_IP]` (`srv2177504`, Ubuntu 26.04.1 LTS)  
**Deployment User:** `mrsdeploy` (`~/.ssh/mrs_vps_ed25519`)  
**Database:** `mangal_royal_studio_staging` (`mrs_postgres`, PostgreSQL 18.7)  
**Status:** **COMPLETE & VERIFIED (ALL 4 CONTAINERS HEALTHY)**

---

## 1. Source Transfer Summary (Phase 2)

- **Destination:** `/srv/mangal-royal-studio/app/`
- **Transfer Size:** `4,207,999` bytes (`4.2 MB`, `~650` source/configuration files including `package-lock.json` and `services/api/prisma/schema.prisma`)
- **Exclusions Verified:** `.env`, `.env.*` (except `.env.example`), `node_modules/`, `.next/`, `dist/`, `.git/`, `product-assets-inbox/`, `processed-product-assets/`, `backups/`, `jewellery-theme-backup/`, `apps/shopify-theme/`, `.data/`, `.uploads/`.
- **Mac Source Integrity:** Zero Mac source files, local databases, or protected JSON files were modified.

---

## 2. Docker Images & Containers Deployed (Phases 3–7)

- **Dockerfile:** `/srv/mangal-royal-studio/deployment/Dockerfile` (multi-target `node:22-bookworm-slim` build sharing a cached `deps` layer that runs `npm ci`, `prisma generate`, and `@mrs/shared` build; runs runtime containers as non-root `USER node`; excludes `**/*.test.ts` and `**/*.test.tsx` via `/srv/mangal-royal-studio/app/.dockerignore`).
- **Compose File:** `/srv/mangal-royal-studio/deployment/docker-compose.app.yml`
- **Environment File:** `/srv/mangal-royal-studio/deployment/.env.app` (`-rw-------`, `chmod 600`, owned by `mrsdeploy:mrsdeploy`)

| Container | Image | Internal Port | Host Loopback Binding | Network | Status |
| --- | --- | ---: | --- | --- | --- |
| `mrs_postgres` | `postgres:18` | `5432/tcp` | *(none — internal only)* | `mrs_internal_net` | `Up (healthy)` |
| `mrs_api` | `mrs-api:staging` | `4000/tcp` | `127.0.0.1:4000->4000/tcp` | `mrs_internal_net` | `Up (healthy)` |
| `mrs_storefront` | `mrs-storefront:staging` | `3000/tcp` | `127.0.0.1:3000->3000/tcp` | `mrs_internal_net` | `Up (healthy)` |
| `mrs_admin` | `mrs-admin:staging` | `3001/tcp` | `127.0.0.1:3001->3001/tcp` | `mrs_internal_net` | `Up (healthy)` |

*(Note: `apps/admin/package.json` runs `next start -p 3001`, so `mrs_admin` maps `127.0.0.1:3001:3001`.)*

---

## 3. Product Image Mount & Verification (Phase 5)

- **Mount:** `/srv/mangal-royal-studio/product-assets:/srv/mangal-royal-studio/product-assets:ro` inside `mrs_api` with `PRODUCT_ASSETS_ROOT=/srv/mangal-royal-studio/product-assets`.
- **Verification:** Sampled `24` `ProductImage.url` paths directly from `mangal_royal_studio_staging` (3 from each of the 8 category folders: `EARING`, `WOMEN_RINGS`, `MEN_RING`, `ITALIAN_RINGS`, `BRACLET`, `FULL_SET`, `SET_2_0`, `SET_2_0_PENDENT`) -> **`24 / 24` returned `HTTP 200`**.

---

## 4. Network Isolation & Data Validation (Phases 6 & 9)

- **Host Listening Ports (`sudo ss -tulpn`):**
  - Public: Only `0.0.0.0:22` / `[::]:22` (`sshd`).
  - Loopback only: `127.0.0.1:3000`, `127.0.0.1:3001`, `127.0.0.1:4000`.
  - Port `5432` is **not** exposed on the host.
- **API & Auth Checks:**
  - `GET http://127.0.0.1:4000/health` and `/api/v1/health` -> `200` (`status: ok`, `backend: postgres`, `jwtConfigured: true`, `corsConfigured: true`).
  - Public `GET /api/v1/products` -> `8` `ACTIVE` `MRS-*` products only; public `GET /api/v1/products/SKUDTG00001` -> `404`.
  - Owner login (`POST /api/auth/login`) -> `200`; `GET /api/admin/products?pageSize=500` -> `total: 280` (`272` `DRAFT`, `8` `ACTIVE`); supplier SKU search `SKUDTG00001` -> exact match; orders -> `3`; customers -> `3`.
- **Staging Database Counts (`mangal_royal_studio_staging`):**
  - `ProductMetadata=280` (`ACTIVE=8`, `DRAFT=272`), `ProductImage=3,122`, `OrderMetadata=3`, `Customer=3`, `JewellerySpecification=8`, `InventoryRecord=8`, `AdminUser=3`, `Collection=9`.
