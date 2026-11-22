# Product Image Quality Report (RC1)

**Date:** 2026-11-18  
**Database:** `mangal_royal_studio_dev`

---

## 1. Catalogue & Image Baseline

- **Total `ProductMetadata`:** `280` (`8` `ACTIVE` `MRS-*` + `272` `DRAFT` supplier SKUs).
- **Total `ProductImage` rows:** `3,122` (all referencing valid relative `/api/public/product-images/...` paths; `0` orphan rows; `0` missing files on disk; `0` duplicate `(productMetadataId, url)` rows).
- **Originals Preserved:** All `326` source files in `product-assets-inbox/` and `~/Downloads` remain untouched.

---

## 2. Image Quality Issues Identified (No Fabrication / No Auto-Regeneration)

1. **Low-Resolution Collage Crops (`3,115 / 3,122` imported images `< 600px`):**
   - Because source collages are `1254..1672px` wide, individual extracted panels are typically `210–480px` on at least one dimension (unsuitable for high-resolution product zoom).
   - Full per-file list with exact `width × height` is recorded in [LOW_RESOLUTION_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/LOW_RESOLUTION_ASSETS.csv) and [SUPPLIER_SKU_IMAGE_MAPPING.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_SKU_IMAGE_MAPPING.csv).
2. **Cross-SKU Identical Image Hashes (3 pairs / 6 SKUs):**
   - `SKUDTG00007` & `SKUDTG00019`
   - `SKURIGO2916` & `SKURIGO2917`
   - `SKUDRG00017` & `SKUDRG00063`
   - Kept as separate SKUs; require owner confirmation of whether images are intentionally shared or misnamed.
3. **Single-Cell Unsplit Collage (`1` SKU):**
   - `MEN RING/SKUDRG00074.png` (`1536x1024`) remained a single composite image in automated seam detection.
4. **43 Unmatched Non-SKU / Partial-SKU Assets:**
   - Not imported into `ProductImage`; documented in [UNMATCHED_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/UNMATCHED_ASSETS.csv) with 3 contact sheets in `processed-product-assets/_contact-sheets/`.
5. **8 `ACTIVE` `MRS-*` Baseline Products (`ProductImage = 0`):**
   - Currently rely on shared `THEME_IMAGES` category fallbacks until dedicated studio photography is assigned.
