# Supplier SKU Catalogue Onboarding Report

**Date:** 2026-11-18  
**Project:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Database:** Local PostgreSQL `mangal_royal_studio_dev`

---

## 1. Executive Summary & Metrics

| Metric | Count | Notes |
| --- | ---: | --- |
| Total source files scanned | 326 | In `product-assets-inbox/` (originals untouched) |
| `SKU*`-named source files | 283 | `282` earlier text reference was a 1-off summary typo (`283 + 43 = 326`) |
| Same-SKU `(1).png` duplicate files | 11 | Deduplicated; not re-imported |
| **Distinct actual supplier SKUs** | **272** | Preserved exact spelling and leading zeros (`SKUDTG00001`, `SKURIGO399`, etc.) |
| **Products created as `DRAFT`** | **272** | All 272 supplier SKUs created in `ProductMetadata` with `status = 'DRAFT'` |
| **Total `ProductImage` rows imported** | **3,122** | Ordered `sortOrder = 0..N-1`; `p01` set as `isPrimary = true` |
| Low-resolution imported crops (`< 600px`) | 3,115 | Flagged in [SUPPLIER_SKU_IMAGE_MAPPING.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_SKU_IMAGE_MAPPING.csv) & [LOW_RESOLUTION_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/LOW_RESOLUTION_ASSETS.csv) |
| Duplicate image records avoided | 141 | Avoided from the 11 same-SKU `(1).png` copies |
| Cross-SKU identical SHA-256 pairs | 3 pairs (6 SKUs) | Kept as separate SKUs (`SKUDTG00007`/`SKUDTG00019`, `SKURIGO2916`/`SKURIGO2917`, `SKUDRG00017`/`SKUDRG00063`); flagged for review |
| **Unmatched assets (manual review)** | **43** | 42 non-SKU filenames + 1 partial-SKU `MEN RING/DRG00197.png` |
| Products awaiting price / weight / description | 272 | All 272 `DRAFT` supplier SKUs await commercial details (0 invented specs/stock) |

---

## 2. Database Baseline Before vs. After (`mangal_royal_studio_dev`)

| Table | Before | After | Status |
| --- | ---: | ---: | --- |
| `ProductMetadata` (total) | 8 | 280 | `8` `ACTIVE` (`MRS-*` untouched) + `272` `DRAFT` |
| `ProductImage` | 0 | 3,122 | `0` missing files on disk, `0` duplicate `(productMetadataId, url)` rows |
| `OrderMetadata` | 3 | 3 | Unchanged |
| `Customer` | 3 | 3 | Unchanged |
| `JewellerySpecification` | 8 | 8 | Unchanged (no invented metal purity/weights/stones) |
| `InventoryRecord` | 8 | 8 | Unchanged (no invented stock) |

---

## 3. Code Changes Applied

- **[types.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/types.ts)** & **[schemas.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/schemas.ts)**: Added `status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'` to `JewelleryProductSpec` and raised `ProductListQuerySchema` `limit`/`pageSize` max to `500`.
- **[catalog-repository.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/db/repositories/catalog-repository.ts)** & **[runtime-backend.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/db/runtime-backend.ts)**: Mapped `status` on `JewelleryProductSpec` and added `includeDrafts?: boolean` option to `listProducts()` (defaulting to `ACTIVE` only for public routes).
- **[app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts)**:
  - Added path-traversal-safe static product image route `GET /api/public/product-images/:category/:assetId/:filename` serving `processed-product-assets/`.
  - Updated `GET /api/admin/products` to call `backend.listProducts({ includeDrafts: true })` and filter by optional `status`.
  - Updated `GET /api/products/:handleOrSku` to return `404 PRODUCT_NOT_FOUND` for non-`ACTIVE` (`DRAFT`) products so drafts are never publicly visible.
- **[apps/admin/src/app/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx)**: Updated product fetch to `/api/admin/products?pageSize=500`, and added product thumbnail, gallery image count (`imgs`), and `DRAFT`/`ACTIVE` status badge to the Admin product table.

---

## 4. Verification Results

| Check | Result | Details |
| --- | --- | --- |
| `@mrs/shared` tests | PASS | 2 files, 7 passed |
| `@mrs/storefront` tests | PASS | 1 file, 7 passed |
| `@mrs/admin` navigation tests | PASS | 1 file, 3 passed |
| `@mrs/api` tests (`DATA_BACKEND=json`) | PASS | 2 files, 80 passed (`src/app.test.ts` 47, `src/phase3-admin-operations.test.ts` 33) |
| Workspace `typecheck` & `build` | PASS | Exited 0 across `@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront` |
| Protected JSON SHA-256 | UNCHANGED | `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`<br>`services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` |

---

## 5. Generated Deliverables

- [SUPPLIER_CATALOGUE_IMPORT_REPORT.md](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_CATALOGUE_IMPORT_REPORT.md)
- [SUPPLIER_SKU_CATALOGUE.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_SKU_CATALOGUE.csv)
- [SUPPLIER_SKU_IMAGE_MAPPING.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_SKU_IMAGE_MAPPING.csv)
- [SUPPLIER_CATALOGUE_PENDING_DETAILS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_CATALOGUE_PENDING_DETAILS.csv)
