# Product Image Mapping Report

**Date:** 2026-11-15  
**Scope:** Audit of product image assets across PostgreSQL (`ProductImage`), the Excel workbooks (`MANGAL JEWELLERY.xlsx`), and storefront fallback imagery (`apps/storefront/src/lib/storefront-data.ts`).

---

## 1. Current State Summary

- **PostgreSQL `ProductImage` rows:** **0** across all 8 baseline SKUs (`img_count = 0` for every row in `ProductMetadata`).
- **Storefront Behaviour:** Because `ProductImage` has 0 rows, the storefront currently relies on shared theme category images defined in `THEME_IMAGES` inside [storefront-data.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/lib/storefront-data.ts).
- **Excel Workbook Image URLs:** All 296 rows in `MANGAL JEWELLERY.xlsx` (identical to `samples/MANGAL JEWELLERY.xlsx`) reference generic Shopify theme category/banner assets on `i1dtfi-iv.myshopify.com`, not individual product photographs.

---

## 2. Per-SKU Image Mapping Status (Baseline 8 Products)

| SKU | Handle | Category | `ProductImage` Rows | Current Visual Source | Action Required |
| --- | --- | --- | ---: | --- | --- |
| `MRS-ANT-7001` | `1975-founder-edition-heirloom-choker` | Antique | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos (front, detail, worn) |
| `MRS-BNG-5001` | `maharani-heritage-diamond-kada-bangle` | Bangles | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-BRC-3001` | `eternity-riviera-tennis-bracelet` | Bracelets | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-EAR-2001` | `lumiere-solitaire-diamond-studs` | Earrings | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-NCK-6001` | `regal-cascade-bridal-diamond-necklace` | Necklaces | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-PND-4001` | `aria-pear-drop-diamond-pendant` | Pendants | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-RNG-1001` | `royal-celeste-solitaire-ring` | Rings | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |
| `MRS-RNG-1002` | `imperial-emerald-cut-halo-ring` | Rings | 0 | Shared category theme fallback (`THEME_IMAGES`) | Upload genuine product photos |

---

## 3. Recommended Next Steps for Genuine Product Photography

1. **Do not substitute stock photos:** Per project rules, no unapproved stock photos were added.
2. **Prepare SKU-named photography:** Capture or export high-resolution studio images keyed by SKU (e.g., `MRS-RNG-1001-01.jpg`, `MRS-RNG-1001-02.jpg`).
3. **Populate `ProductImage`:** Upload/register verified image URLs per SKU via Admin so each product card and detail gallery renders its own genuine jewellery photography.
