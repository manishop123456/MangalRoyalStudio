# MRS Final Catalogue Reconciliation

**Date:** 2026-11-22, 11:44–12:06 IST (06:14–06:36 UTC) · **Git:** `main` @ `c7de1bc` + uncommitted working tree (nothing committed or pushed)
**Databases:** local `mangal_royal_studio_dev` (localhost) · staging `mangal_royal_studio_staging` (VPS container `mrs_postgres`, unpublished). Credentials not shown.
**Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-final/`

## Result
**0 products activated. 8 ACTIVE (unchanged), 272 DRAFT (unchanged).** No authoritative product data exists for any draft, so publishing one would mean inventing its metal, purity, weight and diamond data.

## Sources examined
| Source | Finding |
|---|---|
| `private-imports/approved/MRS_FINAL_APPROVED_PRODUCT_PRICING.xlsx` | Generated **sample** data (shown 2026-11-21: produced by `generate-sample-excel.ts`; 15 photos shared across 296 rows; formula weights). **Not imported.** 0 of its 295 SKUs exist in either DB. |
| `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` | 272 rows, **0 filled** |
| `~/Downloads` | No supplier spec file. `Product Details.pdf`, `HOME.pdf` and `Cart Sidebar.pdf` are 1-page design mockups; the numbered PDFs are unrelated personal documents (not opened beyond identification; contents not recorded) |
| Local and staging DB | Identical: 280 products, 280 unique SKUs; ACTIVE specs byte-identical local vs staging |

## Counts (staging, before → after)
| | Before | After |
|---|---|---|
| ACTIVE | 8 | 8 |
| DRAFT | 272 | 272 |
| ProductImage | 3,122 | 3,122 |
| Orders / customers | 3 / 3 | 3 / 3 |

Dry run (`31-dry-run-activation.log`): would become ACTIVE = **0**. No status change was executed.

## Classification (all 280 rows: `30-catalogue-reconciliation-all-products.csv`)
| Class | Count | Products |
|---|---|---|
| A. Ready to publish | 6 | MRS-RNG-1001, MRS-RNG-1002, MRS-BRC-3001, MRS-PND-4001, MRS-BNG-5001, MRS-NCK-6001 (already ACTIVE; prices verified once the approved rate card is published) |
| B. Price on request | 2 | MRS-EAR-2001 (exactly 1.00 ct combined), MRS-ANT-7001 (22K, GST unconfirmed); kept as POR by owner decision of 2026-11-21 |
| C. Missing specifications | 272 | every `SKU…` supplier draft: no metal type, purity, net/gross weight or diamond data |
| D, E, F, G | 0 as primary class | supplier image notes below |

**Supplier image notes:**
- Most supplier crops are below 600 px (`LOW_RESOLUTION_ASSETS.csv`).
- Three SKU pairs share an identical photo: SKUDTG00007/SKUDTG00019, SKURIGO2916/SKURIGO2917 and SKUDRG00017/SKUDRG00063. Resolve these before publishing.

Active products' images load (8/8, checked on staging). Whether each photo is the right piece needs owner confirmation; the original names of the 8 baseline products are not in any approval record.

## Owner actions
1. Fill `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` for the pieces to sell. Rows that pass dry-run validation can then be imported and published; the rest stay Draft.
2. Confirm the 8 baseline names and photos, and resolve the 3 shared-photo SKU pairs.
