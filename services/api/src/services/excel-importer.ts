import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import {
  calculateJewelleryPrice,
  type DiamondComponentSpec,
  type DiamondRateMatrixEntry,
  type DiamondShape,
  type JewelleryProductSpec,
  type MakingChargeMode,
  type MetalPurity,
  type MetalRateRecord,
  type MetalType,
  type PricingFormulaRule,
  type WastageMode,
} from '@mrs/shared';
import type {
  CategoryRecord,
  ImportErrorItem,
  ImportJobRecord,
  ImportPreviewItem,
} from '../store/data-store.js';

export const MANGAL_EXCEL_SHEETS: ReadonlyArray<{
  sheetName: string;
  categorySlug: string;
  categoryName: string;
  shopifyCollectionHandle: string;
}> = [
  { sheetName: 'Rings', categorySlug: 'rings', categoryName: 'Rings', shopifyCollectionHandle: 'rings' },
  { sheetName: 'Earrings', categorySlug: 'earrings', categoryName: 'Earrings', shopifyCollectionHandle: 'earrings' },
  { sheetName: 'Pendants', categorySlug: 'pendants', categoryName: 'Pendants', shopifyCollectionHandle: 'pendants' },
  { sheetName: 'Necklaces', categorySlug: 'necklaces', categoryName: 'Necklaces', shopifyCollectionHandle: 'necklaces' },
  { sheetName: 'Bracelets', categorySlug: 'bracelets', categoryName: 'Bracelets', shopifyCollectionHandle: 'bracelets' },
  { sheetName: 'Bangles', categorySlug: 'bangles', categoryName: 'Bangles', shopifyCollectionHandle: 'bangles' },
  { sheetName: 'Mangalsutra', categorySlug: 'mangalsutra', categoryName: 'Mangalsutra', shopifyCollectionHandle: 'mangalsutra' },
  { sheetName: 'Solitaires', categorySlug: 'solitaires', categoryName: 'Solitaires', shopifyCollectionHandle: 'solitaires' },
  { sheetName: 'Nose Pins', categorySlug: 'nose-pins', categoryName: 'Nose Pins', shopifyCollectionHandle: 'nose-pins' },
  { sheetName: 'Chains', categorySlug: 'chains', categoryName: 'Chains', shopifyCollectionHandle: 'chains' },
  { sheetName: 'Antique', categorySlug: 'antique', categoryName: 'Antique', shopifyCollectionHandle: 'antique' },
];

function normalizePurity(raw: string): MetalPurity | null {
  const up = raw.trim().toUpperCase();
  if (up === '24K' || up === '22K' || up === '18K' || up === '14K') return up;
  if (up === '925_SILVER' || up === 'SILVER_925' || up === '925') return '925_SILVER';
  if (up === '950_PLATINUM' || up === 'PLATINUM_950' || up === 'PT950') return '950_PLATINUM';
  return null;
}

function normalizeMetalColor(
  raw: string
): 'YELLOW_GOLD' | 'ROSE_GOLD' | 'WHITE_GOLD' | 'TWO_TONE' | 'PLATINUM' | 'SILVER' {
  const up = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (up.includes('ROSE')) return 'ROSE_GOLD';
  if (up.includes('WHITE')) return 'WHITE_GOLD';
  if (up.includes('TWO')) return 'TWO_TONE';
  if (up.includes('PLATINUM')) return 'PLATINUM';
  if (up.includes('SILVER')) return 'SILVER';
  return 'YELLOW_GOLD';
}

function normalizeMakingMode(raw: string): MakingChargeMode {
  const up = raw.trim().toUpperCase();
  if (up === 'PER_GRAM_GROSS') return 'PER_GRAM_GROSS';
  if (up === 'PERCENTAGE_OF_METAL') return 'PERCENTAGE_OF_METAL';
  if (up === 'FLAT_PER_PIECE') return 'FLAT_PER_PIECE';
  return 'PER_GRAM_NET';
}

function normalizeWastageMode(raw: string): WastageMode {
  const up = raw.trim().toUpperCase();
  if (up === 'PERCENT_METAL_VALUE' || up === 'PERCENT_OF_METAL_VALUE') return 'PERCENT_METAL_VALUE';
  if (up === 'PERCENT_METAL_WEIGHT' || up === 'PERCENT_OF_NET_WEIGHT') return 'PERCENT_METAL_WEIGHT';
  if (up === 'FLAT_GRAMS') return 'FLAT_GRAMS';
  return 'NONE';
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getField(row: Record<string, unknown>, candidates: string[]): string {
  const normalizedMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalizedMap.set(normalizeHeaderKey(k), v);
  }
  for (const candidate of candidates) {
    const val = normalizedMap.get(normalizeHeaderKey(candidate));
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function slugifyHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface RunExcelImportArgs {
  fileName: string;
  buffer: Buffer;
  dryRun: boolean;
  createdByEmail: string;
  existingProducts: JewelleryProductSpec[];
  categories: CategoryRecord[];
  metalRates: MetalRateRecord[];
  diamondRates: DiamondRateMatrixEntry[];
  activePricingRule: PricingFormulaRule;
}

export function parseAndValidateWorkbook(args: RunExcelImportArgs): {
  job: ImportJobRecord;
  validNewProducts: JewelleryProductSpec[];
} {
  const workbook = XLSX.read(args.buffer, { type: 'buffer' });
  const existingSkus = new Set(args.existingProducts.map((p) => p.sku.toUpperCase()));
  const existingHandles = new Set(args.existingProducts.map((p) => p.handle.toLowerCase()));
  const seenSkusInWorkbook = new Set<string>();

  const categoryBySheet = new Map<string, CategoryRecord>();
  for (const cat of args.categories) {
    categoryBySheet.set(cat.excelSheetName.toLowerCase(), cat);
    categoryBySheet.set(cat.name.toLowerCase(), cat);
    categoryBySheet.set(cat.slug.toLowerCase(), cat);
  }

  const errors: ImportErrorItem[] = [];
  const previewItems: ImportPreviewItem[] = [];
  const validNewProducts: JewelleryProductSpec[] = [];
  const detectedSheets: ImportJobRecord['detectedSheets'] = [];

  let totalRows = 0;
  let validRows = 0;
  let failedRows = 0;
  let duplicateSkus = 0;

  const jobId = `imp-${Date.now()}`;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });

    const matchedCategory =
      categoryBySheet.get(sheetName.trim().toLowerCase()) || args.categories[0];

    let sheetValid = 0;
    let sheetErrors = 0;

    rawRows.forEach((rawRow, idx) => {
      const rowNumber = idx + 2;
      totalRows += 1;

      const serialNumberStr = getField(rawRow, ['Sr No', 'Serial Number', 'S.No', 'Sr. No']);
      const productTag = getField(rawRow, ['Product Tag', 'Tag', 'Item Tag']);
      const ringSize = getField(rawRow, ['Ring Size', 'Size']) || 'Free Size';
      const customImageUrl = getField(rawRow, ['Image URL', 'Image', 'Photo URL']);
      const sku = getField(rawRow, ['SKU', 'Product SKU', 'Item Code', 'Variant SKU']);
      const title = getField(rawRow, ['Title', 'Product Title', 'Name', 'Product Name']);
      const rawHandle = getField(rawRow, ['Handle', 'Shopify Handle', 'URL Handle']);
      const handle = rawHandle ? slugifyHandle(rawHandle) : slugifyHandle(`${title}-${sku}`);

      const metalTypeRaw = (getField(rawRow, ['Metal Type', 'Metal']) || 'GOLD').toUpperCase();
      const metalPurityRaw = getField(rawRow, ['Metal Purity', 'Purity', 'Karat']) || '18K';
      const metalColorRaw = getField(rawRow, ['Metal Color', 'Color', 'Gold Color']) || 'Rose Gold';

      const grossWeightStr = getField(rawRow, ['Gross Weight (g)', 'Gross Weight', 'GrossWt']);
      const netWeightStr = getField(rawRow, ['Net Weight (g)', 'Net Weight', 'NetWt']);
      const makingModeRaw = getField(rawRow, ['Making Charge Mode', 'Making Mode']) || 'PER_GRAM_NET';
      const makingValueStr = getField(rawRow, ['Making Charge Value', 'Making Charge', 'MakingRate']) || '1650';
      const wastageModeRaw = getField(rawRow, ['Wastage Mode']) || 'PERCENT_METAL_VALUE';
      const wastagePercentStr = getField(rawRow, ['Wastage (%)', 'Wastage Percent', 'Wastage']) || '3.5';
      const certFeeStr = getField(rawRow, ['Certification Fee (INR)', 'Certification Fee', 'CertFee']) || '1500';
      const stockQtyStr = getField(rawRow, ['Stock Qty', 'Inventory', 'Quantity', 'Available']) || '3';

      const d1Shape = (getField(rawRow, ['Diamond 1 Shape', 'Diamond Shape', 'Shape']) || 'ROUND').toUpperCase();
      const d1Quality = getField(rawRow, ['Diamond 1 Quality', 'Diamond Quality', 'Quality']) || 'EF_VVS';
      const d1PiecesStr = getField(rawRow, ['Diamond 1 Pieces', 'Diamond Pieces', 'Pcs']) || '0';
      const d1CaratStr = getField(rawRow, ['Diamond 1 Carat', 'Diamond Carat', 'Carat', 'Ct']) || '0';

      const d2Shape = (getField(rawRow, ['Diamond 2 Shape']) || 'ROUND').toUpperCase();
      const d2PiecesStr = getField(rawRow, ['Diamond 2 Pieces']) || '0';
      const d2CaratStr = getField(rawRow, ['Diamond 2 Carat']) || '0';

      const rowMessages: string[] = [];
      let rowStatus: 'VALID' | 'DUPLICATE_SKU' | 'INVALID' = 'VALID';

      if (!sku) {
        rowStatus = 'INVALID';
        rowMessages.push('Missing required SKU.');
        errors.push({
          sheetName,
          rowNumber,
          sku: '(missing)',
          field: 'SKU',
          severity: 'ERROR',
          message: 'SKU is required for every jewellery row [MISSING_SKU].',
        });
      }

      if (!title) {
        rowStatus = 'INVALID';
        rowMessages.push('Missing required Title.');
        errors.push({
          sheetName,
          rowNumber,
          sku: sku || '(missing)',
          field: 'Title',
          severity: 'ERROR',
          message: 'Product Title is required [MISSING_TITLE].',
        });
      }

      const normalizedSku = sku.toUpperCase();
      if (sku) {
        if (seenSkusInWorkbook.has(normalizedSku) || existingSkus.has(normalizedSku)) {
          rowStatus = 'DUPLICATE_SKU';
          rowMessages.push(`Duplicate SKU "${sku}" blocked.`);
          errors.push({
            sheetName,
            rowNumber,
            sku,
            field: 'SKU',
            severity: 'ERROR',
            message: `Duplicate SKU "${sku}" detected [DUPLICATE_SKU]. Duplicate SKUs are never silently overwritten.`,
          });
        }
        seenSkusInWorkbook.add(normalizedSku);
      }

      const parsedPurity = normalizePurity(metalPurityRaw);
      if (!parsedPurity) {
        rowStatus = 'INVALID';
        rowMessages.push(`Invalid Metal Purity "${metalPurityRaw}".`);
        errors.push({
          sheetName,
          rowNumber,
          sku: sku || '(missing)',
          field: 'Metal Purity',
          severity: 'ERROR',
          message: `Metal Purity "${metalPurityRaw}" is unsupported [INVALID_METAL_PURITY].`,
        });
      }

      const grossWeight = Number(grossWeightStr);
      const netWeight = Number(netWeightStr);

      if (!grossWeightStr || Number.isNaN(grossWeight) || grossWeight <= 0) {
        rowStatus = 'INVALID';
        rowMessages.push(`Invalid Gross Weight "${grossWeightStr}".`);
        errors.push({
          sheetName,
          rowNumber,
          sku: sku || '(missing)',
          field: 'Gross Weight (g)',
          severity: 'ERROR',
          message: `Gross Weight "${grossWeightStr}" must be > 0g [INVALID_GROSS_WEIGHT].`,
        });
      }

      if (!netWeightStr || Number.isNaN(netWeight) || netWeight <= 0) {
        rowStatus = 'INVALID';
        rowMessages.push(`Invalid Net Weight "${netWeightStr}".`);
        errors.push({
          sheetName,
          rowNumber,
          sku: sku || '(missing)',
          field: 'Net Weight (g)',
          severity: 'ERROR',
          message: `Net Weight "${netWeightStr}" must be > 0g [INVALID_NET_WEIGHT].`,
        });
      } else if (!Number.isNaN(grossWeight) && netWeight > grossWeight) {
        rowStatus = 'INVALID';
        rowMessages.push(`Net weight (${netWeight}g) exceeds gross weight (${grossWeight}g).`);
        errors.push({
          sheetName,
          rowNumber,
          sku: sku || '(missing)',
          field: 'Net Weight (g)',
          severity: 'ERROR',
          message: `Net weight (${netWeight.toFixed(3)}g) cannot exceed gross weight (${grossWeight.toFixed(3)}g) [NET_EXCEEDS_GROSS_WEIGHT].`,
        });
      }

      const diamondComponents: DiamondComponentSpec[] = [];
      const d1Carat = Number(d1CaratStr || '0');
      const d1Pieces = Math.max(1, Math.round(Number(d1PiecesStr || '1')));
      if (!Number.isNaN(d1Carat) && d1Carat > 0) {
        diamondComponents.push({
          componentName: 'Primary Stones',
          shape: (['ROUND', 'PRINCESS', 'OVAL', 'MARQUISE', 'PEAR', 'EMERALD', 'CUSHION', 'BAGUETTE', 'OTHER'].includes(
            d1Shape
          )
            ? d1Shape
            : 'ROUND') as DiamondShape,
          stoneCount: d1Pieces,
          totalCaratWeight: d1Carat.toFixed(3),
          colorGrade: d1Quality.includes('GH') ? 'GH' : 'EF',
          clarityGrade: d1Quality.includes('VS') && !d1Quality.includes('VVS') ? 'VS' : 'VVS',
          cutGrade: 'EXCELLENT',
          certification: 'IGI',
        });
      }

      const d2Carat = Number(d2CaratStr || '0');
      const d2Pieces = Math.max(1, Math.round(Number(d2PiecesStr || '1')));
      if (!Number.isNaN(d2Carat) && d2Carat > 0) {
        diamondComponents.push({
          componentName: 'Secondary Accent Stones',
          shape: (['ROUND', 'PRINCESS', 'OVAL', 'MARQUISE', 'PEAR', 'EMERALD', 'CUSHION', 'BAGUETTE', 'OTHER'].includes(
            d2Shape
          )
            ? d2Shape
            : 'ROUND') as DiamondShape,
          stoneCount: d2Pieces,
          totalCaratWeight: d2Carat.toFixed(3),
          colorGrade: 'EF',
          clarityGrade: 'VVS',
          cutGrade: 'EXCELLENT',
        });
      }

      let previewPriceInr = '0.00';

      if (rowStatus === 'VALID' && parsedPurity) {
        const finalHandle = existingHandles.has(handle)
          ? `${handle}-${sku.toLowerCase()}`
          : handle;

        const productSpec: JewelleryProductSpec = {
          id: `prod-imp-${Date.now()}-${validRows + 1}`,
          serialNumber: serialNumberStr ? Number(serialNumberStr) : validRows + 1,
          productTag: productTag || `TAG-${sku}`,
          sku,
          handle: finalHandle,
          title,
          category: matchedCategory?.name || sheetName,
          shopifyProductGid: `gid://shopify/Product/staged-${sku}`,
          shopifyVariantGid: `gid://shopify/ProductVariant/staged-${sku}`,
          currentShopifyPriceInr: '0.00',
          metalType: (['GOLD', 'SILVER', 'PLATINUM'].includes(metalTypeRaw)
            ? metalTypeRaw
            : 'GOLD') as MetalType,
          metalPurity: parsedPurity,
          metalColor: normalizeMetalColor(metalColorRaw),
          ringSize,
          grossWeightGrams: grossWeight.toFixed(3),
          netMetalWeightGrams: netWeight.toFixed(3),
          netWeightMode: 'EXPLICIT_NET_WEIGHT',
          diamondComponents,
          makingChargeMode: normalizeMakingMode(makingModeRaw),
          makingChargeValue: Number(makingValueStr || '1650').toFixed(2),
          wastageMode: normalizeWastageMode(wastageModeRaw),
          wastageValue: Number(wastagePercentStr || '3.5').toFixed(2),
          certificationFeeInr: Number(certFeeStr || '1500').toFixed(2),
          hallmarkFeeInr: '100.00',
          fixedAdjustmentInr: '0.00',
          manualPriceOverrideInr: null,
          pricingEnabled: true,
          inventoryQuantity: Math.max(0, Math.round(Number(stockQtyStr || '3'))),
          imageUrl:
            customImageUrl ||
            'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
          updatedAt: new Date().toISOString(),
        };

        const calc = calculateJewelleryPrice({
          product: productSpec,
          metalRates: args.metalRates,
          diamondRates: args.diamondRates,
          rule: args.activePricingRule,
        });

        previewPriceInr = calc.finalProposedPriceInr;
        productSpec.currentShopifyPriceInr = previewPriceInr;
        validNewProducts.push(productSpec);
        validRows += 1;
        sheetValid += 1;
        rowMessages.push(`Validated • Calculated INR ${previewPriceInr}`);
      } else {
        if (rowStatus === 'DUPLICATE_SKU') {
          duplicateSkus += 1;
        }
        failedRows += 1;
        sheetErrors += 1;
      }

      previewItems.push({
        sheetName,
        rowNumber,
        sku: sku || '(missing)',
        handle,
        title: title || '(missing)',
        category: matchedCategory?.name || sheetName,
        metalPurity: metalPurityRaw,
        grossWeightGrams: grossWeightStr || '0',
        netMetalWeightGrams: netWeightStr || '0',
        diamondCarats: diamondComponents
          .reduce((acc, d) => acc + Number(d.totalCaratWeight), 0)
          .toFixed(3),
        diamondCount: diamondComponents.length,
        makingChargeMode: makingModeRaw,
        makingChargeValue: makingValueStr,
        calculatedPreviewPriceInr: previewPriceInr,
        status: rowStatus,
        messages: rowMessages,
      });
    });

    detectedSheets.push({
      sheetName,
      mappedCategory: matchedCategory?.name || sheetName,
      rowCount: rawRows.length,
      validCount: sheetValid,
      errorCount: sheetErrors,
    });
  }

  const workbookHash = crypto.createHash('sha256').update(args.buffer).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const job: ImportJobRecord = {
    id: jobId,
    sourceFileName: args.fileName,
    workbookHash,
    expiresAt,
    status: args.dryRun ? 'PREVIEWED' : 'IMPORTED_TO_STAGING',
    dryRun: args.dryRun,
    detectedSheets,
    totalRows,
    validRows,
    failedRows,
    duplicateSkus,
    processedRows: totalRows,
    previewItems,
    errors,
    validNewProducts,
    createdBy: args.createdByEmail,
    createdAt: now.toISOString(),
    completedAt: now.toISOString(),
  };

  return { job, validNewProducts };
}

export function formatImportErrorsCsv(job: ImportJobRecord): string {
  const header = ['Sheet Name', 'Row Number', 'SKU', 'Field', 'Severity', 'Message'];
  const escapeCsv = (val: string | number | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    header.join(','),
    ...job.errors.map((e) =>
      [
        escapeCsv(e.sheetName),
        escapeCsv(e.rowNumber),
        escapeCsv(e.sku),
        escapeCsv(e.field),
        escapeCsv(e.severity),
        escapeCsv(e.message),
      ].join(',')
    ),
  ];

  return lines.join('\n');
}

export function getDefaultSampleWorkbookPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'MANGAL JEWELLERY.xlsx'),
    path.resolve(process.cwd(), 'samples', 'MANGAL JEWELLERY.xlsx'),
    path.resolve(process.cwd(), '..', '..', 'MANGAL JEWELLERY.xlsx'),
    path.resolve(process.cwd(), '..', '..', 'samples', 'MANGAL JEWELLERY.xlsx'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[3] ?? path.resolve(process.cwd(), 'MANGAL JEWELLERY.xlsx');
}
