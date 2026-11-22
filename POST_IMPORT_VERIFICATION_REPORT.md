# Post-Import PostgreSQL and Image Verification Report

**Date:** 2026-11-18  
**Project:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Database:** `mangal_royal_studio_dev` (Read-Only Verification)  
**Overall Verdict:** **PARTIAL** *(Database integrity, `DRAFT` isolation, and local image serving PASS; deployment asset packaging/URLs and two Admin UI controls require action before production deployment.)*

---

## 1. PostgreSQL Database Counts & Integrity (`mangal_royal_studio_dev`)

| Check | Expected | Observed | Result |
| --- | ---: | ---: | --- |
| Active Database | `mangal_royal_studio_dev` | `mangal_royal_studio_dev` | PASS |
| Total `ProductMetadata` | 280 | 280 | PASS |
| `ACTIVE` products (`MRS-*`) | 8 | 8 | PASS |
| `DRAFT` supplier products | 272 | 272 | PASS |
| Non-`DRAFT` supplier products | 0 | 0 | PASS |
| Distinct SKUs (`COUNT(DISTINCT sku)`) | 280 | 280 | PASS |
| `ProductImage` total rows | 3,122 | 3,122 | PASS |
| Primary images (`isPrimary = true`) | 272 | 272 | PASS |
| Orphan `ProductImage` rows | 0 | 0 | PASS |
| Duplicate `(productMetadataId, url)` rows | 0 | 0 | PASS |
| Invalid `sortOrder` / primary count per SKU | 0 | 0 | PASS |
| `OrderMetadata` | 3 | 3 | PASS |
| `Customer` | 3 | 3 | PASS |
| `JewellerySpecification` | 8 | 8 | PASS |
| `InventoryRecord` | 8 | 8 | PASS |

### Category Breakdown (`DRAFT` Supplier SKUs)
- `Bracelets`: `601` images
- `Earrings`: `945` images
- `Necklaces`: `204` images
- `Pendants`: `115` images
- `Rings`: `1,257` images

---

## 2. Product Image File & Public Endpoint Verification

- **Disk Verification:** All `3,122` `ProductImage.url` entries were verified against `processed-product-assets/` (`0` missing files on disk).
- **Live Express + `PostgresRuntimeBackend` Verification (`createApp({ backend: 'postgres', prisma })`):**
  - `GET /api/public/product-images/EARING/SKUDTG00001/SKUDTG00001_p01_r1c1.png` -> `200 image/png` (`62,054` bytes)
  - `GET /api/public/product-images/WOMEN_RINGS/SKUDRG00017/SKUDRG00017_p01_r1c1.png` -> `200 image/png` (`92,768` bytes)
  - `GET /api/public/product-images/MEN_RING/SKUDRG00033/SKUDRG00033_p01_r1c1.png` -> `200 image/png` (`129,404` bytes)
  - `GET /api/public/product-images/ITALIAN_RINGS/SKURIGO2916/SKURIGO2916_p01_r1c1.png` -> `200 image/png` (`145,570` bytes)
  - `GET /api/public/product-images/BRACLET/SKUDBG00001/SKUDBG00001_p01_r1c1.png` -> `200 image/png` (`115,982` bytes)
  - `GET /api/public/product-images/FULL_SET/SKUDNG00001/SKUDNG00001_p01_r1c1.png` -> `200 image/png` (`307,333` bytes)
  - `GET /api/public/product-images/SET_2_0/SKUDTG00149/SKUDTG00149_p01_r1c1.png` -> `200 image/png` (`216,517` bytes)
  - `GET /api/public/product-images/SET_2_0_PENDENT/SKUPDG00085/SKUPDG00085_p01_r1c1.png` -> `200 image/png` (`216,336` bytes)

---

## 3. Admin & Public API Verification

- **Public Catalog (`GET /api/v1/products`):** Returns `200` with `8` `ACTIVE` `MRS-*` products only (`0` `DRAFT`s).
- **Public Direct Lookup (`GET /api/v1/products/:sku`):** Tested `SKUDTG00001`, `SKUDRG00017`, `SKURIGO2916`, `SKUDBG00001`, `SKUDNG00001`, `SKUPDG00085` -> all return `404 PRODUCT_NOT_FOUND`.
- **Public Collections (`GET /api/v1/collections/{all,rings,earrings,bracelets,necklaces,pendants}`):** All return `200` with `0` `DRAFT` products.
- **PostgreSQL Repository (`backend.listProducts({ includeDrafts: true })`):** Returns `280` total (`272` `DRAFT`, `8` `ACTIVE`), with exact supplier SKU lookup (`SKUDTG00001` -> `12` gallery images).
- **Admin UI Inspection (`apps/admin/src/app/page.tsx`):**
  - Fetches `/api/admin/products?pageSize=500` (covers all `280` products), renders primary `40x40` thumbnail, gallery image count (`imgs`), `DRAFT`/`ACTIVE` status badge, and exact SKU search (`productSearch`).
  - **Admin UI Gaps Found:**
    1. No `DRAFT` / `ACTIVE` status filter dropdown in the Admin UI table controls (the API `/api/admin/products?status=DRAFT` supports it, but `apps/admin/src/app/page.tsx` only renders `productSearch` and `productCategoryFilter`).
    2. No full multi-image gallery modal/drawer in Admin UI (table shows only the primary thumbnail + image count).

---

## 4. Deployment Readiness of Image Files

- **Disk Footprint:** `processed-product-assets/` is `605 MB` (`product-assets-inbox/` is `545 MB`).
- **Build Packaging:** `services/api` builds with `tsc -p tsconfig.json` into `services/api/dist/` — `processed-product-assets/` is **not** copied into `dist/` and there is no `Dockerfile` / `render.yaml` / `vercel.json` packaging `processed-product-assets/`.
- **`.gitignore`:** Neither `processed-product-assets/` nor `product-assets-inbox/` is listed in `.gitignore` (though large binary assets should not be committed to Git).
- **Stored Image URLs:** All `3,122` `ProductImage.url` rows currently store `http://localhost:4000/api/public/product-images/...`. **These URLs will fail on a deployed server or remote client.**
- **Required Fix Before Deployment:**
  1. Upload `processed-product-assets/` to durable object storage / CDN (e.g., Cloudinary, S3/R2) or mount it as a persistent volume on the API host.
  2. Update `ProductImage.url`, `ProductMetadata.imageUrl`, and `ProductMetadata.hoverImageUrl` to the public CDN/API origin (or store relative paths `/api/public/product-images/...` resolved via `NEXT_PUBLIC_API_BASE_URL`).
  3. Add `product-assets-inbox/` and `processed-product-assets/` to `.gitignore`.

---

## 5. Testing, Typecheck & Protected State

- **Typecheck:** `npm run typecheck` passed across `@mrs/shared`, `@mrs/api`, `@mrs/admin`, and `@mrs/storefront`.
- **PostgreSQL-Backed Verification:** Read-only `supertest` suite against `createApp({ backend: 'postgres', prisma })` passed for public catalog, draft 404 isolation, collection filtering, and all 8 category image routes. *(Note: `phase2-postgres.integration.test.ts` was intentionally not executed because it writes/deletes test records in `mangal_royal_studio_dev`, violating strict read-only verification.)*
- **Protected JSON SHA-256:**
  - `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (unchanged)
  - `services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (unchanged)

---

## Final Verdict: **PARTIAL**
- **PASS:** PostgreSQL counts (`280` products, `272` `DRAFT`, `8` `ACTIVE`, `3,122` `ProductImage`, `3` orders, `3` customers, `8` specs, `8` inventory), `0` missing files, `0` duplicates, `0` public `DRAFT` leaks, and local `/api/public/product-images/...` serving.
- **Action Required for Production:** Migrate `605 MB` `processed-product-assets/` to CDN/object storage (replacing `http://localhost:4000/...` URLs), add `product-assets-inbox/` & `processed-product-assets/` to `.gitignore`, and add the Admin UI `DRAFT`/`ACTIVE` filter dropdown and gallery preview modal.
