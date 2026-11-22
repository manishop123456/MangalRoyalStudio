# Product Image Import Report

**Date:** 2026-11-18  
**Project:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Database:** PostgreSQL `mangal_royal_studio_dev`

---

## 1. Executive Summary

- **Total source files scanned:** 326 (`product-assets-inbox/`)
- **Total collages processed:** 310 (plus 15 duplicate files skipped from re-cropping and 1 single-cell file `MEN RING/SKUDRG00074.png`)
- **Total individual images extracted:** 3,483 (saved under `processed-product-assets/<CATEGORY>/<ASSET_ID>/`)
- **Total SKUs matched to existing PostgreSQL `ProductMetadata`:** **0**
- **Total images imported into PostgreSQL `ProductImage`:** **0**
- **Reason 0 images were imported into `ProductImage`:**
  - The existing PostgreSQL `ProductMetadata` table contains **8 baseline products** (`MRS-ANT-7001`, `MRS-BNG-5001`, `MRS-BRC-3001`, `MRS-EAR-2001`, `MRS-NCK-6001`, `MRS-PND-4001`, `MRS-RNG-1001`, `MRS-RNG-1002`), and `MANGAL JEWELLERY.xlsx` uses `MRS-*` SKUs as well.
  - None of the 326 inbox files match any `MRS-*` SKU in `ProductMetadata` or `MANGAL JEWELLERY.xlsx` (282 use vendor codes `SKUDTG*`, `SKUGTG*`, `SKUDNG*`, `SKUPDG*`, `SKURIGO*`, `SKUDRG*`, `SKUBGG*`, `SKUBRG*`, `SKUDBG*`; 1 uses `DRG00197`; 43 use descriptive names like `diamond 1.png`, `gold coin 1.png`, `set 1.png`, `ring 5.png`, `NKNK.png`, `NOTAG.png`).
  - Per strict safety rules (*"Do not guess a SKU based only on appearance"* and *"Do not create fake products or invent product details for unmatched SKUs"*), **all 326 assets were left unimported in `ProductImage`** and documented for owner SKU mapping or catalogue onboarding.

---

## 2. Deliverables Created

1. [PRODUCT_ASSET_INVENTORY.md](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PRODUCT_ASSET_INVENTORY.md) — Complete scan, duplicate groups, folder stats, and contact sheet links.
2. [PRODUCT_IMAGE_IMPORT_REPORT.md](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PRODUCT_IMAGE_IMPORT_REPORT.md) — This report.
3. [PRODUCT_ASSET_MAPPING.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PRODUCT_ASSET_MAPPING.csv) — Row-by-row mapping of all 326 source files, SHA-256 hashes, collage layouts, extracted crop counts, and DB match status.
4. [UNMATCHED_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/UNMATCHED_ASSETS.csv) — All 326 unmatched assets with reasons and required owner actions.
5. [LOW_RESOLUTION_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/LOW_RESOLUTION_ASSETS.csv) — All 3,472 extracted crops below `600px` in width or height (unsuitable for high-resolution product zoom).

---

## 3. Verification & Preservation Results

| Check | Result | Details |
| --- | --- | --- |
| `@mrs/shared` tests | PASS | 2 files, 7 passed (`vitest run`) |
| `@mrs/storefront` tests | PASS | 1 file, 7 passed (`vitest run`) |
| `@mrs/admin` navigation tests | PASS | 1 file, 3 passed (`apps/admin/src/lib/admin-navigation.test.ts`) |
| Workspace `typecheck` | Verified | `npm run typecheck` across `@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront` |
| Protected JSON SHA-256 | UNCHANGED | `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`<br>`services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` |
| PostgreSQL Baseline Counts | UNCHANGED | `ProductMetadata=8`, `OrderMetadata=3`, `Customer=3`, `ProductImage=0` |
| Theme & Original Files | UNCHANGED | `jewellery-theme-backup/`, `apps/shopify-theme/`, `product-assets-inbox/`, and `~/Downloads` originals untouched |

---

## 4. Manual Actions Required Before Final DB Import

1. **Confirm SKU Mapping or Onboard New Products:**
   - Either provide a mapping table linking the `SKU*` vendor codes (`SKUDTG*`, `SKUDRG*`, `SKURIGO*`, `SKUDNG*`, `SKUPDG*`, `SKUBGG*`, `SKUBRG*`, `SKUDBG*`, `SKUGTG*`) to existing `MRS-*` SKUs, **or** import an owner-approved product master CSV/XLSX creating those products with commercial pricing, weights, and descriptions.
2. **Identify the 43 Non-SKU / Partial-SKU Assets:**
   - Review the 3 contact sheets in `processed-product-assets/_contact-sheets/` (`diamond 1..9`, `gold coin 1..7`, `bangle 1..3`, `ring set 1`, `set 1..12`, `men ring 23..27`, `ring 5`, `ring 64`, `NKNK`, `NOTAG`, `DRG00197`) and assign their final SKUs.
3. **Resolve Duplicate Cross-SKU Files:**
   - Confirm whether `SKUDTG00007.png == SKUDTG00019.png`, `SKURIGO2916.png == SKURIGO2917.png`, and `SKUDRG00017.png == SKUDRG00063.png` are intentional shared photos or misnamed files.
4. **Source High-Resolution Originals (Recommended):**
   - Because source collages are `1254..1672px` wide, 3,472 of 3,483 cropped panels are `< 600px` on at least one side (`LOW_RESOLUTION_ASSETS.csv`). Supply individual uncollaged studio photos (`>= 1000x1000px`) where product zoom is required.
