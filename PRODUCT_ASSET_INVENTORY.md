# Product Asset Inventory Report

**Date:** 2026-11-18  
**Source Inbox:** [product-assets-inbox](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/product-assets-inbox) (copied non-destructively from `/Users/macbook/Downloads/{braclet,DIAMOND,EARING,FULL SET,GOLDCOIN,ITALIAN,MEN RING,set 2.0,WOMEN RINGS}`; originals untouched)  
**Processed Crops Output:** [processed-product-assets](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/processed-product-assets)

---

## 1. Summary Metrics

| Metric | Count | Notes |
| --- | ---: | --- |
| Total source files scanned | 326 | All 326 files are valid `png` images (`0` unreadable/non-image files) |
| Unique source files (by SHA-256) | 311 | 15 exact duplicate files across 13 SHA-256 duplicate groups |
| Duplicate files skipped from re-cropping | 15 | Includes `(1).png` copies and 3 cross-SKU/filename exact duplicates |
| Collages processed (multi-panel) | 310 | 310 out of 311 unique files split into individual panels; 1 unique file (`MEN RING/SKUDRG00074.png`) remained single-cell in automated seam pass |
| Total individual images extracted | 3,483 | Saved into SKU/asset-specific folders under `processed-product-assets/` |
| Low-resolution crops (`< 600px` width or height) | 3,472 | Logged in [LOW_RESOLUTION_ASSETS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/LOW_RESOLUTION_ASSETS.csv); only 11 crops are `>= 600x600` |
| SKU-named source files (`SKU*`) | 282 | Exact SKU-pattern filenames (`SKUDTG*`, `SKUGTG*`, `SKUDNG*`, `SKUPDG*`, `SKURIGO*`, `SKUDRG*`, `SKUBGG*`, `SKUBRG*`, `SKUDBG*`) |
| Partial-SKU source files (`DRG00197.png`) | 1 | Missing `SKU` prefix; included in contact sheets for verification |
| Non-SKU source files | 43 | Includes `diamond 1..9`, `gold coin 1..7`, `bangle 1..3`, `ring set 1`, `set 1..12`, `men ring 23..27`, `ring 5`, `ring 5(1)`, `ring 64`, `NKNK`, `NOTAG` (42 non-SKU + `DRG00197.png` = 43 requiring manual ID) |

---

## 2. Folder Breakdown

| Category Folder | Total Files | Unique (SHA-256) | Duplicates | SKU-Named (`SKU*`) | Non-SKU / Partial | Extracted Crops |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `DIAMOND` | 9 | 9 | 0 | 0 | 9 | 36 |
| `EARING` | 77 | 76 | 1 | 77 | 0 | 930 |
| `FULL SET` | 19 | 19 | 0 | 17 | 2 | 231 |
| `GOLDCOIN` | 7 | 7 | 0 | 0 | 7 | 78 |
| `ITALIAN/FULL SET` | 16 | 16 | 0 | 0 | 16 | 168 |
| `ITALIAN/RINGS` | 26 | 25 | 1 | 26 | 0 | 261 |
| `MEN RING` | 26 | 26 | 0 | 20 | 6 | 279 |
| `WOMEN RINGS` | 77 | 64 | 13 | 74 | 3 | 784 |
| `braclet` | 59 | 59 | 0 | 59 | 0 | 601 |
| `set 2.0` | 8 | 8 | 0 | 8 | 0 | 96 |
| `set 2.0/pendent` | 2 | 2 | 0 | 2 | 0 | 19 |
| **Total** | **326** | **311** | **15** | **283** | **43** | **3,483** |

*(Note: `MEN RING` has 20 `SKU*` files + 1 partial `DRG00197.png` + 5 `men ring 23..27.png` = 26; `WOMEN RINGS` has 74 `SKU*` files including `(1)` copies + 3 non-SKU `ring 5`, `ring 5(1)`, `ring 64` = 77.)*

---

## 3. Source Dimensions & Formats

- **Format:** 100% PNG (`326 / 326`).
- **Source Resolutions:** `1448x1086` (113), `1536x1024` (96), `1402x1122` (75), `1254x1254` (33), `1369x1149` (3), `1672x941` (2), `1401x1123` (1), `1403x1121` (1), `1387x1134` (1), `1433x1098` (1).

---

## 4. Exact Duplicate Files (13 SHA-256 Groups, 15 Extra Copies)

1. `EARING/SKUDTG00007.png` == `EARING/SKUDTG00019.png` *(different SKUs, identical bytes)*
2. `ITALIAN/RINGS/SKURIGO2916.png` == `ITALIAN/RINGS/SKURIGO2917.png` *(different SKUs, identical bytes)*
3. `WOMEN RINGS/SKUDRG00017.png` == `SKUDRG00017(1).png` == `SKUDRG00063.png` == `SKUDRG00063(1).png` *(4 copies across 2 SKUs)*
4. `WOMEN RINGS/SKUDRG00038.png` == `SKUDRG00038(1).png`
5. `WOMEN RINGS/SKUDRG00039.png` == `SKUDRG00039(1).png`
6. `WOMEN RINGS/SKUDRG00060.png` == `SKUDRG00060(1).png`
7. `WOMEN RINGS/SKUDRG00072.png` == `SKUDRG00072(1).png`
8. `WOMEN RINGS/SKUDRG00103.png` == `SKUDRG00103(1).png`
9. `WOMEN RINGS/SKUDRG00111.png` == `SKUDRG00111(1).png`
10. `WOMEN RINGS/SKUDRG00120.png` == `SKUDRG00120(1).png`
11. `WOMEN RINGS/SKUDRG00223.png` == `SKUDRG00223(1).png`
12. `WOMEN RINGS/SKUDRG00260.png` == `SKUDRG00260(1).png`
13. `WOMEN RINGS/ring 5.png` == `WOMEN RINGS/ring 5(1).png`

---

## 5. Contact Sheets for Manual Identification

3 contact sheets covering all 42 unique non-SKU files + 1 partial-SKU (`DRG00197.png`) were generated in `processed-product-assets/_contact-sheets/`:
- [unmatched_contact_sheet_1.png](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/processed-product-assets/_contact-sheets/unmatched_contact_sheet_1.png)
- [unmatched_contact_sheet_2.png](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/processed-product-assets/_contact-sheets/unmatched_contact_sheet_2.png)
- [unmatched_contact_sheet_3.png](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/processed-product-assets/_contact-sheets/unmatched_contact_sheet_3.png)
