# Main Product Catalogue Readiness Report

**Date:** 2026-11-15  
**Scope:** Audit of PostgreSQL development database (`mangal_royal_studio_dev`) and Excel catalogue workbooks (`MANGAL JEWELLERY.xlsx`, `samples/MANGAL JEWELLERY.xlsx`).  
**Constraints Respected:** No PostgreSQL records were deleted or modified, no baseline stock/prices or pricing rules were changed, and no unapproved bulk import was executed.

---

## 1. Executive Summary

- **PostgreSQL Baseline Catalogue:** 8 clean Mangal Royal Studio products exist in `ProductMetadata` (all `ACTIVE`, 3 referenced by existing baseline orders). All 8 baseline records are preserved intact.
- **Excel Catalogue Workbooks (`MANGAL JEWELLERY.xlsx` & `samples/MANGAL JEWELLERY.xlsx`):** Both files are **byte-for-byte identical** (`sha256: 8cb736c5615d3b11fcc3b076380c0d5a1cd54193555f7f06e15f0bc9673dfd53`) and represent a **generated sample workbook** containing 296 rows across 11 sheets with intentional validation defects and missing commercial fields. **Do not bulk-import this workbook as the main production catalogue.**

---

## 2. PostgreSQL Baseline Inventory (`mangal_royal_studio_dev`)

| Table | Verified Row Count | Notes |
| --- | ---: | --- |
| `ProductMetadata` | 8 | All `ACTIVE`; 3 referenced by baseline orders (`order_refs = 1`) |
| `ProductImage` | 0 | No dedicated product photography uploaded to DB yet |
| `OrderMetadata` | 3 | Baseline orders preserved untouched |
| `Customer` | 3 | Baseline customers preserved untouched |

### Existing 8 Baseline SKUs Classification

- **Class A (Retained in DB for baseline & historical order integrity) / Class C (Pending owner confirmation of final copy & genuine product photography):**

| SKU | Handle | Category | Purity / Metal | Gross / Net Weight (g) | Price (INR) | Stock | Order Refs | Bestseller |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| `MRS-ANT-7001` | `1975-founder-edition-heirloom-choker` | Antique | `22K` / `YELLOW_GOLD` | `21.800` / `20.900` | `222556.00` | `2` | `0` | No |
| `MRS-BNG-5001` | `maharani-heritage-diamond-kada-bangle` | Bangles | `18K` / `YELLOW_GOLD` | `14.500` / `13.900` | `130301.00` | `2` | `0` | No |
| `MRS-BRC-3001` | `eternity-riviera-tennis-bracelet` | Bracelets | `18K` / `ROSE_GOLD` | `11.200` / `10.400` | `145061.00` | `3` | `0` | Yes |
| `MRS-EAR-2001` | `lumiere-solitaire-diamond-studs` | Earrings | `18K` / `YELLOW_GOLD` | `2.300` / `2.100` | `40648.00` | `9` | `1` | Yes |
| `MRS-NCK-6001` | `regal-cascade-bridal-diamond-necklace` | Necklaces | `18K` / `WHITE_GOLD` | `26.400` / `24.800` | `282603.00` | `1` | `0` | No |
| `MRS-PND-4001` | `aria-pear-drop-diamond-pendant` | Pendants | `14K` / `ROSE_GOLD` | `1.680` / `1.600` | `15131.00` | `14` | `0` | Yes |
| `MRS-RNG-1001` | `royal-celeste-solitaire-ring` | Rings | `18K` / `ROSE_GOLD` | `4.150` / `3.800` | `70336.00` | `6` | `1` | Yes |
| `MRS-RNG-1002` | `imperial-emerald-cut-halo-ring` | Rings | `18K` / `WHITE_GOLD` | `3.840` / `3.600` | `56634.00` | `4` | `1` | No |

### Collections, Banners, and Content in DB

- `Collection` (9 rows): `all`, `antique`, `bangles`, `best-sellers`, `bracelets`, `earrings`, `necklaces`, `pendants`, `rings`.
- `Banner` (4 rows, all `isActive = t`): `bnr-001` (`Brilliance For Today`), `bnr-002` (`Get 10% OFF On Engagement Rings`), `bnr-003` (`"Luxury today is not just about what you wear..."`), `bnr-004` (`Loved it online? Now you can find it in our physical store.`).
  - *Note:* `bnr-002` in DB still holds promotional copy (`Get 10% OFF On Engagement Rings`); left untouched in DB per protection rules, while the hardcoded storefront announcement bar was cleaned up.
- `Content` (4 rows, all `isPublished = t`): `brand-story-rooted-in-legacy`, `four-pillar-trust-bar`, `why-lab-grown-conscious-choice`, `lifetime-exchange-and-buyback-policy`.

---

## 3. Excel Workbook Audit (`MANGAL JEWELLERY.xlsx` & `samples/MANGAL JEWELLERY.xlsx`)

- **SHA-256 (both files):** `8cb736c5615d3b11fcc3b076380c0d5a1cd54193555f7f06e15f0bc9673dfd53` (byte-for-byte identical).
- **Scale:** 296 rows across 11 sheets (`Rings`: 42, `Earrings`: 36, `Pendants`: 30, `Necklaces`: 24, `Bracelets`: 26, plus `Bangles`, `Mangalsutra`, `Solitaires`, `Nose Pins`, `Chains`, `Antique`).
- **Validation Findings:**
  - `missingTitle`: 0
  - `missingSku`: 0
  - `missingCategory`: 0
  - `missingStock`: 0
  - `zeroStock`: 0
  - `missingImg`: 0
  - `placeholderImg`: 0
  - `invalidWeights`: **1**
  - `dupSkusCount`: **1**
  - `dupHandlesCount`: 0
  - `hasDescriptionCol`: **false**
  - `hasPriceCol`: **false**
  - `hasCompareAtCol`: **false**
  - `hasStatusCol`: **false**
- **Image URLs in Workbook:** All 296 rows point to generic Shopify theme assets hosted on `i1dtfi-iv.myshopify.com` (reused category/banner photos rather than individual SKU photography).

---

## 4. Readiness Checklist Before Main Catalogue Launch

1. **Supply Genuine Master Catalogue CSV/XLSX:** Provide an owner-approved export containing unique SKUs, unique handles, valid gross/net weights, metal purity, diamond/stone specifications, making-charge rules, descriptions, and explicit status (`ACTIVE`/`DRAFT`).
2. **Dry-Run Import Validation:** Run the admin bulk import dry-run against the approved file and resolve any warnings/errors before committing.
3. **Owner Pricing Approval:** Confirm metal rates, diamond rate tables, making charges, and rounding rules in the pricing engine (preview -> validation -> owner approval -> publish).
4. **Upload Product Photography:** Populate `ProductImage` for every active SKU (see [PRODUCT_IMAGE_MAPPING_REPORT.md](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PRODUCT_IMAGE_MAPPING_REPORT.md)).
5. **Review `bnr-002` in DB:** Confirm whether to retire or update `bnr-002` (`Get 10% OFF On Engagement Rings`) via Admin before launch.
