# MRS Complete Catalogue Audit

- **Date / Time:** `2026-11-24 19:20 IST`
- **Environments Reconciled (Read-Only):**
  - **Development (`mangal_royal_studio_dev`):** `8` `ACTIVE`, `272` `DRAFT` (`280` total).
  - **Staging (`mangal_royal_studio_staging`):** `8` `ACTIVE`, `272` `DRAFT` (`280` total).
  - **Production (`mangal_royal_studio_prod`):** `8` `ACTIVE`, `0` `DRAFT` (`8` total; `0` customers, `0` orders).

## Authoritative Provenance & Eligibility Findings
- **`MRS_FINAL_APPROVED_PRODUCT_PRICING.xlsx`:** Generated sample workbook (`generate-sample-excel.ts`; 15 photos shared across 296 rows) — **not** authoritative supplier data; **0** rows imported.
- **`MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv`:** `272` rows, **`0` filled** (`completeDrafts: 0`, `missingSpecs: 272` in staging DB). None of the `272` supplier drafts have verified metal type, purity, net/gross weight, or diamond specifications; all `272` remain `DRAFT` (`IMAGE_VERIFIED_SPECIFICATION_MISSING` / `BLOCKED`).
- **8 Existing `ACTIVE` Products:**
  - `6` eligible for numeric pricing once the `OWNER` publishes the approved Rate Card: `MRS-RNG-1001`, `MRS-RNG-1002` (note: `1.00 ct` center + `0.20 ct` accent = `1.20 ct` total; verify pricing rule), `MRS-BRC-3001`, `MRS-PND-4001`, `MRS-BNG-5001`, `MRS-NCK-6001`.
  - `2` Price on Request (`PRICE_ON_REQUEST_APPROVED`): `MRS-EAR-2001` (`1.00 ct` diamond) and `MRS-ANT-7001` (`22K` Gold, GST unconfirmed).
