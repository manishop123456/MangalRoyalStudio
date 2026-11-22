# Mangal Royal Studio — Catalogue Import Reconciliation

**Date:** 2026-11-21 (IST evening) · **Scope:** local `mangal_royal_studio_dev` + VPS `mangal_royal_studio_staging` · **Writes to either catalogue:** none

## 1. Outcome in one paragraph

The supplied "final approved" workbook was **not imported**, by owner decision on 2026-11-21. It turned out to be generated **sample data**, not the real catalogue (evidence in §3). None of its 295 SKUs exist in the database. The real supplier catalogue already in the database is 272 DRAFT products with real photographs but no metal, purity or weight data, so they cannot be priced or published yet. Staging therefore shows the same **8 ACTIVE products** as before; every draft remains a draft. To publish the supplier products, the owner fills in `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` (272 rows, one per supplier SKU).

## 2. Input

| Item | Value |
|---|---|
| File used | `~/Downloads/Mangal_Royal_Studio_Product_Naming_and_Pricing_UPDATED.xlsx` (the only pricing workbook in Downloads; downloaded 2026-11-21 19:54) |
| Copied to | `private-imports/approved/MRS_FINAL_APPROVED_PRODUCT_PRICING.xlsx` (git-ignored via `private-imports/` and `*.xlsx`; folder mode 700; not under any web/static path) |
| SHA-256 | `db18983aabeb883ee974d19560637fc4d26c6b669af538a2e345e19b7662f453` (identical to the original, which was left in Downloads) |
| Sheets | `Read Me` (29 rows) · `Rate Card` (21 rows) · `Product Pricing` (1 header + **296** rows × 47 columns) |
| Hidden rows/columns, filters | none · **Formula error cells:** 0 · cached formula results consistent (engine reproduces all 222 priced rows exactly, see `MRS_PRICING_ENGINE_AUDIT.md`) |

## 3. Workbook findings

| Check | Result |
|---|---|
| Product rows | 296 |
| Unique SKUs | 295 — `MRS-RNG-101` appears twice (row 2 "Aurelia Radiance…" and a row titled *"Duplicate SKU Protection Test Row"*) |
| Test/demo rows | `MRS-RNG-ERR-WEIGHT` — *"Invalid Weight Test Ring (Dry-Run Validation Demo)"*, net 4.1 g > gross 3.2 g |
| Blank / duplicate product names | 0 / 0 |
| Missing metal type, purity, net weight, gross weight, category, ring size (rings) | 0 each |
| Negative / text-in-number fields | 0 (only the net > gross test row is invalid) |
| Purity mix | 18K 185 · 22K 68 · 14K 42 · Platinum 950 1 · 24K 0 |
| Workbook pricing status | READY 222 · PRE-GST (22K/Pt) 68 · EXACTLY 1.00 CT HOLD 3 (`MRS-EAR-109`, `-117`, `-125`) · SOURCE REVIEW 3 |
| Owner fixed-price overrides (col AD) / additional approved charges (col Z) | 0 / 0 |
| Images | every row has a URL, but only **15 distinct photos across 296 rows** (≈20 SKUs share each) |

**Why the rows are sample data (provenance evidence, `MRS_AUDIT_EVIDENCE/run-20261121T233202/01-workbook-provenance.log`):**
- The workbook says it was built from `MANGAL JEWELLERY.xlsx`. That file is produced by this repository's `services/api/src/scripts/generate-sample-excel.ts`. `MAIN_PRODUCT_CATALOGUE_READINESS.md` (2026-11-15) had already classed it as a *"generated sample workbook… Do not bulk-import"*.
- 296/296 image URLs are the generator's 15 hard-coded `VERIFIED_CDN_IMAGES`.
- In every one of the 11 categories, net weights follow the generator's formula (base + ((i mod 9) − 3) × 0.35 g), giving exactly 9 distinct weights per category.
- 243/296 original titles are "*<name>* — Edition *N*" (generator line 281). The ERR-WEIGHT and duplicate-SKU rows are generator-injected validation fixtures.

Importing these would have published synthetic weights and specifications, attached other products' photographs, and broken the "no test/demo, never another SKU's image, never invent specs" rules.

## 4. Database reconciliation

| | Local `mangal_royal_studio_dev` (localhost) | Staging `mangal_royal_studio_staging` (VPS container `mrs_postgres`, not published) |
|---|---|---|
| ProductMetadata | 280 (280 unique SKUs) | 280 |
| ACTIVE | 8 (`MRS-RNG-1001`, `MRS-RNG-1002`, `MRS-EAR-2001`, `MRS-BRC-3001`, `MRS-PND-4001`, `MRS-BNG-5001`, `MRS-NCK-6001`, `MRS-ANT-7001`) | 8, specs **identical** to local |
| DRAFT | 272 supplier SKUs (`SKU…`), 0 with a JewellerySpecification | 272 |
| ProductImage | 3,122 | 3,122 |
| Orders / customers | 3 / 3 (orders reference `MRS-EAR-2001`, `MRS-RNG-1001`, `MRS-RNG-1002`) | 3 / 3 |

- The historical baseline (280 / 8 ACTIVE / 272 DRAFT; 296 source rows with one duplicate SKU) was re-measured and is unchanged.
- Workbook SKUs ∩ database SKUs = **0**; workbook handles ∩ database handles = **0**. The only overlap is 8 image URLs, which belong to the 8 ACTIVE baseline products.
- Workbook SKUs missing from the DB: 295, all excluded. DB SKUs missing from the workbook: 280 (8 baseline + 272 supplier).

## 5. Final counts (staging, after this release)

| Measure | Count |
|---|---|
| Rows in workbook | 296 |
| Unique valid real-catalogue products in workbook | **0** (all rows are generated sample data) |
| Published / ACTIVE on staging | **8**, unchanged and preserved |
| Still DRAFT | **272**. Reason: no metal type, purity, net/gross weight or diamond data, so price and specs cannot be shown without inventing them |
| Duplicate / test / demo exclusions | 2 test rows + the duplicate-SKU pair (inside the 296 not imported) |
| ACTIVE products showing Price on request (after the owner applies the rate card) | 2: `MRS-EAR-2001` (exactly 1.00 ct combined), `MRS-ANT-7001` (22K GST unconfirmed) |
| ACTIVE products missing verified images | 0 (all 8 load, checked through the showcase proxy) |
| Draft supplier SKUs with images | 272 (3,122 photos; the earlier report flagged most crops as < 600 px, see `LOW_RESOLUTION_ASSETS.csv`) |

"All products are live" is **not** true. Only the 8 baseline products are live; no valid real-catalogue product was available to add.

## 6. Owner review items

1. **Supply real specifications** for the 272 supplier SKUs in `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` (one row per SKU, with category and photo folder pre-filled). Required per piece: product name, metal type, purity, **net** metal weight, gross weight, diamond pieces and carats (Diamond 1/2), diamond quality, ring size where relevant, stock, and "owner approved = Y". Once returned, it can go through the existing dry-run → validate → commit import, and only rows that pass will be published.
2. **Real photography.** Most supplier crops are low resolution (see `LOW_RESOLUTION_ASSETS.csv`).
3. If the owner wants the AI-suggested names from the workbook for real products, they need to be matched to real SKUs; the workbook's SKUs do not correspond to any real product.

Row-level detail (no prices): `MRS_AUDIT_EVIDENCE/run-20261121T233202/30-workbook-row-reconciliation.csv`.
