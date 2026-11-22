# Bulk Product Import & Validation Report (`services/api/src/services/excel-importer.ts`)

> **Code-Verified Audit Status:** Audited against `services/api/src/services/excel-importer.ts` (lines 1–509), `services/api/src/scripts/generate-sample-excel.ts` (lines 1–203), `services/api/src/app.ts` (lines 1471–1631), and `MANGAL JEWELLERY.xlsx`. See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Workbook Architecture & Verified Row Counts (`MANGAL JEWELLERY.xlsx`)

The multi-sheet Excel importer (`parseAndValidateExcelWorkbook()` in [`excel-importer.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/services/excel-importer.ts#L195-L475)) parses `.xlsx` buffers using `xlsx` (`0.18.5`) and processes every worksheet tab as a product category.

| Sheet # | Worksheet Tab Name | Mapped Category Slug | Total Data Rows | Valid Rows | Failed Rows | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `Rings` | `rings` | 42 | 41 | 1 (Excel row `43`) | **VERIFIED** |
| 2 | `Earrings` | `earrings` | 36 | 36 | 0 | **VERIFIED** |
| 3 | `Necklace` | `necklace` | 28 | 28 | 0 | **VERIFIED** |
| 4 | `Bracelets` | `bracelets` | 26 | 26 | 0 | **VERIFIED** |
| 5 | `Pendant` | `pendant` | 28 | 28 | 0 | **VERIFIED** |
| 6 | `Bangles` | `bangles` | 24 | 24 | 0 | **VERIFIED** |
| 7 | `Mangalsutra` | `mangalsutra` | 26 | 26 | 0 | **VERIFIED** |
| 8 | `Solitaires` | `solitaires` | 22 | 22 | 0 | **VERIFIED** |
| 9 | `Bridal Sets` | `bridal-sets` | 20 | 20 | 0 | **VERIFIED** |
| 10 | `Everyday Luxury` | `everyday-luxury` | 22 | 22 | 0 | **VERIFIED** |
| 11 | `Antique` | `antique` | 22 | 21 | 1 (Excel row `23`) | **VERIFIED** |
| **Total** | **11 Sheets** | **11 Categories** | **296 Rows** | **294 Valid** | **2 Failed** | **VERIFIED** |

---

## 2. Exact Row-Level Validation Rules (`excel-importer.ts`)

Every row is validated without aborting the rest of the workbook:

1. **Required SKU (`MISSING_SKU`):**
   - Rejects rows with blank `SKU` / `Product Code` / `Item Code`.
2. **Required Product Title (`MISSING_TITLE`):**
   - Rejects rows with blank `Title` / `Product Name` / `Name`.
3. **Cross-Sheet Duplicate SKU Detection (`DUPLICATE_SKU`):**
   - Tracks `seenSkusInWorkbook = new Map<string, { sheet: string; row: number }>()` across all 11 sheets (`lines 207, 267–278`).
   - Also flags `existingSkus` already present in `dbStore.products` when `overwriteExisting` is false (`DUPLICATE_EXISTING_SKU`).
4. **Cross-Sheet Slug Uniqueness:**
   - Auto-generates URL-safe slugs and appends `-2`, `-3`, etc. if a title collision occurs (`lines 296–302`).
5. **Metal Purity Normalization (`INVALID_PURITY`):**
   - Normalizes `'24KT' -> '24K'`, `'22KT' -> '22K'`, `'18KT' -> '18K'`, `'14KT' -> '14K'`, `'9KT' -> '9K'` (`normalizePurity()`, lines 75–92).
6. **Gross & Net Weight Validation (`INVALID_GROSS_WEIGHT`, `INVALID_NET_WEIGHT`, `NET_EXCEEDS_GROSS_WEIGHT`):**
   - Requires `grossWeightGrams > 0`, `netWeightGrams > 0`, and enforces `netWeightGrams <= grossWeightGrams + 0.0001` (`lines 322–359`).
7. **Making Charge Mode Normalization:**
   - Maps `'PER_GRAM_NET'`, `'PER_GRAM_GROSS'`, `'PERCENTAGE_OF_METAL'`, `'FLAT_PER_PIECE'` (`normalizeMakingMode()`, lines 113–126).

---

## 3. Verified Validation Failures in `MANGAL JEWELLERY.xlsx`

> **Correction Note:** Earlier documentation described hypothetical errors on rows `14`, `19`, and `8` (`netWeightGrams = -1.25`). Inspection of [`generate-sample-excel.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/scripts/generate-sample-excel.ts#L163-L195) and the Vitest assertion in [`app.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/app.test.ts#L53-L68) confirms the **exact 2 intentional validation failures** embedded in `MANGAL JEWELLERY.xlsx`:

| Failure # | Sheet Name | Excel Row # (`rowNumber`) | SKU | Field | Error Code & Exact Message |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `Rings` | **`43`** (header is row 1 + 41 valid rows + 1 error row) | `MRS-RNG-ERR-WEIGHT` | `'Net Weight (g)'` | `[NET_EXCEEDS_GROSS_WEIGHT] Net weight (4.1g) cannot exceed gross weight (3.2g)` |
| **2** | `Antique` | **`23`** (header is row 1 + 21 valid rows + 1 error row) | `MRS-RNG-101` | `'SKU'` | `[DUPLICATE_SKU] Duplicate SKU "MRS-RNG-101" already seen in sheet "Rings" row 2` |

---

## 4. Import Endpoints & Rollback Audit (`services/api/src/app.ts`)

| Endpoint | Implementation Status | Verified Behavior & Limitations |
| :--- | :--- | :--- |
| `POST /api/admin/imports/default-excel` | **VERIFIED** | Loads `MANGAL JEWELLERY.xlsx` from the workspace root, runs `parseAndValidateExcelWorkbook()`, and commits valid products when `dryRun === false`. |
| `POST /api/admin/imports/excel` | **VERIFIED** | Accepts multipart file upload (`multer.memoryStorage()`) or JSON `{ fileBase64, fileName, dryRun, overwriteExisting }`. |
| `GET /api/admin/imports/:jobId/errors.csv` | **VERIFIED** | Streams downloadable CSV report with headers `Sheet,Row,SKU,Field,Message` (`app.ts` lines 1574–1594). |
| `POST /api/admin/imports/:jobId/rollback` | **PARTIALLY IMPLEMENTED** | Removes products from `dbStore.products` whose SKU matches a valid row of `jobId` (`app.ts` lines 1596–1631) and writes an audit log (`IMPORT_JOB_ROLLED_BACK`). **Limitations:** Does not check whether `job.dryRun` was `true`, does not restore overwritten pre-existing product states, and does not update `job.status` to `'ROLLED_BACK'`. |
