# VPS Database Restore Verification Report

**Date:** 2026-11-19  
**Source Database (Mac):** `mangal_royal_studio_dev` (`PostgreSQL 18.6`)  
**Target Staging Database (VPS):** `mangal_royal_studio_staging` (`PostgreSQL 18.7`, container `mrs_postgres`)  
**Status:** **PASS (100% Parity Verified)**

---

## 1. Fresh Source Backup & Checksum Verification (Phases 4 & 5)

- **Local Backup Path:** `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/staging_ready_mangal_royal_studio_dev_20261119.dump` (`310K`, custom format `-Fc`)
- **VPS Backup Path:** `/srv/mangal-royal-studio/backups/staging_ready_mangal_royal_studio_dev_20261119.dump` (`chmod 640`)
- **SHA-256 Checksum (Verified Identical on Mac & VPS):**
  ```text
  4df037d62a70be916f55616276ea56748d04bd35c33aa12307ac0ed38484a98f
  ```
- **Archive TOC Verification (`pg_restore --list`):** `261` TOC entries (`Format: CUSTOM`, `Compression: gzip`, `dbname: mangal_royal_studio_dev`).
- **Restore Command Executed:**
  ```bash
  docker exec -i mrs_postgres pg_restore --no-owner --no-privileges --exit-on-error \
    -U mrs_db_admin -d mangal_royal_studio_staging \
    < /srv/mangal-royal-studio/backups/staging_ready_mangal_royal_studio_dev_20261119.dump
  ```
  Result: `Command exited with code 0`.

---

## 2. Source vs. Staging Record Comparison (Phase 6)

| Table / Metric | Source (`mangal_royal_studio_dev`) | Staging (`mangal_royal_studio_staging`) | Match |
| --- | ---: | ---: | --- |
| `ProductMetadata` (total) | 280 | 280 | PASS |
| `ProductMetadata` (`ACTIVE`) | 8 | 8 | PASS |
| `ProductMetadata` (`DRAFT`) | 272 | 272 | PASS |
| `ProductImage` (total) | 3,122 | 3,122 | PASS |
| `ProductImage` (`localhost` URLs) | 0 | 0 | PASS |
| `ProductImage` (relative `/api/public/product-images/...`) | 3,122 | 3,122 | PASS |
| `ProductMetadata.imageUrl` (`localhost` URLs) | 0 | 0 | PASS |
| `ProductMetadata.imageUrl` (relative `/api/public/product-images/...`) | 272 | 272 | PASS |
| `OrderMetadata` | 3 | 3 | PASS |
| `Customer` | 3 | 3 | PASS |
| `JewellerySpecification` | 8 | 8 | PASS |
| `InventoryRecord` | 8 | 8 | PASS |
| `AdminUser` | 3 | 3 | PASS |
| `Category` | 11 | 11 | PASS |
| `Collection` | 9 | 9 | PASS |

---

## 3. Preservation & Isolation Checks

- **Local Development DB (`mangal_royal_studio_dev`):** Read-only `pg_dump` only; zero records modified.
- **Protected JSON Checksums (Local Mac):**
  - `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (unchanged)
  - `services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (unchanged)
- **VPS Port `5432` Exposure:** Confirmed not exposed on host (`sudo ss -tulpn` shows only `22/tcp` public).
