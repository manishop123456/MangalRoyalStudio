import { describe, expect, it } from 'vitest';
import {
  calculateJewelleryPrice,
  doDiamondSlabsOverlap,
  doesDiamondSlabCoverExactOneCarat,
  OWNER_MARKET_METAL_RATES,
  OWNER_MARKET_PRICING_RULE,
} from './pricing-engine.js';
import type { DiamondComponentSpec, DiamondRateMatrixEntry, JewelleryProductSpec } from './types.js';

const ROUND_EF_VVS_SLABS: DiamondRateMatrixEntry[] = [
  {
    id: 'round-ef-vvs-under-1',
    shape: 'ROUND',
    sieveRange: '> 0.0000 ct to < 1.0000 ct',
    sizeMinCarat: '0.0000',
    sizeMaxCarat: '1.0000',
    minInclusive: false,
    maxInclusive: false,
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '30000.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-24T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-24T00:00:00.000Z',
  },
  {
    id: 'round-ef-vvs-over-1',
    shape: 'ROUND',
    sieveRange: '> 1.0000 ct to <= 5.0000 ct',
    sizeMinCarat: '1.0000',
    sizeMaxCarat: '5.0000',
    minInclusive: false,
    maxInclusive: true,
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '45000.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-24T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-24T00:00:00.000Z',
  },
];

function priceWithDiamond(
  diamond: Partial<DiamondComponentSpec>,
  diamondRates: DiamondRateMatrixEntry[] = ROUND_EF_VVS_SLABS
) {
  const product: JewelleryProductSpec = {
    id: 'test-dia',
    sku: 'MRS-DIA-TEST',
    handle: 'dia-test',
    title: 'Diamond Boundary Test Piece',
    category: 'Rings',
    shopifyProductGid: 'gid://shopify/Product/1',
    shopifyVariantGid: 'gid://shopify/ProductVariant/1',
    currentShopifyPriceInr: '0.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'YELLOW_GOLD',
    grossWeightGrams: '4.500',
    netMetalWeightGrams: '4.000',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Center Diamond',
        shape: 'ROUND',
        stoneCount: 1,
        totalCaratWeight: '0.500',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
        ...diamond,
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '2500.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '0.00',
    hallmarkFeeInr: '0.00',
    fixedAdjustmentInr: '0.00',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 1,
    updatedAt: '2026-11-24T00:00:00.000Z',
  };

  return calculateJewelleryPrice({
    product,
    metalRates: OWNER_MARKET_METAL_RATES,
    diamondRates,
    rule: OWNER_MARKET_PRICING_RULE,
  });
}

describe('Diamond Rate Matrix exact carat boundaries and governance', () => {
  it('prices 0.50 ct, 0.99 ct, and 0.9999 ct ROUND EF-VVS at ₹30,000/ct', () => {
    for (const ct of ['0.50', '0.99', '0.9999']) {
      const res = priceWithDiamond({ totalCaratWeight: ct });
      expect(res.priceOnRequest).toBe(false);
      expect(res.diamondComponents[0]?.appliedRatePerCaratInr).toBe('30000.00');
    }
  });

  it('forces exactly 1.0000 ct to Price on Request even if an active slab could otherwise match', () => {
    const res = priceWithDiamond({ totalCaratWeight: '1.0000' });
    expect(res.priceOnRequest).toBe(true);

    const permissiveSlabs: DiamondRateMatrixEntry[] = [
      { ...ROUND_EF_VVS_SLABS[0]!, maxInclusive: true },
    ];
    const forced = priceWithDiamond({ totalCaratWeight: '1.0000' }, permissiveSlabs);
    expect(forced.priceOnRequest).toBe(true);
  });

  it('prices 1.0001 ct, 1.50 ct, and 5.00 ct ROUND EF-VVS at ₹45,000/ct', () => {
    for (const ct of ['1.0001', '1.50', '5.00']) {
      const res = priceWithDiamond({ totalCaratWeight: ct });
      expect(res.priceOnRequest).toBe(false);
      expect(res.diamondComponents[0]?.appliedRatePerCaratInr).toBe('45000.00');
    }
  });

  it('returns Price on Request above 5.00 ct when no slab covers > 5.00 ct', () => {
    const res = priceWithDiamond({ totalCaratWeight: '5.0001' });
    expect(res.priceOnRequest).toBe(true);
  });

  it('never silently falls back across different shapes, colours, clarity grades, or empty matrix', () => {
    expect(priceWithDiamond({ shape: 'EMERALD', totalCaratWeight: '0.50' }).priceOnRequest).toBe(true);
    expect(priceWithDiamond({ colorGrade: 'GH', totalCaratWeight: '0.50' }).priceOnRequest).toBe(true);
    expect(priceWithDiamond({ clarityGrade: 'VS', totalCaratWeight: '0.50' }).priceOnRequest).toBe(true);
    expect(priceWithDiamond({ totalCaratWeight: '0.50' }, []).priceOnRequest).toBe(true);
  });

  it('detects overlapping slabs, duplicate slabs, and slabs covering 1.0000 ct', () => {
    expect(
      doDiamondSlabsOverlap(ROUND_EF_VVS_SLABS[0]!, ROUND_EF_VVS_SLABS[1]!)
    ).toBe(false);
    expect(
      doDiamondSlabsOverlap(
        { sizeMinCarat: '0.01', sizeMaxCarat: '5.00', minInclusive: true, maxInclusive: true },
        { sizeMinCarat: '0.01', sizeMaxCarat: '5.00', minInclusive: true, maxInclusive: true }
      )
    ).toBe(true);
    expect(
      doDiamondSlabsOverlap(
        { sizeMinCarat: '0.00', sizeMaxCarat: '1.00', minInclusive: false, maxInclusive: true },
        { sizeMinCarat: '1.00', sizeMaxCarat: '5.00', minInclusive: true, maxInclusive: true }
      )
    ).toBe(true);
    expect(doesDiamondSlabCoverExactOneCarat(ROUND_EF_VVS_SLABS[0]!)).toBe(false);
    expect(doesDiamondSlabCoverExactOneCarat(ROUND_EF_VVS_SLABS[1]!)).toBe(false);
    expect(
      doesDiamondSlabCoverExactOneCarat({
        sizeMinCarat: '0.01',
        sizeMaxCarat: '5.00',
        minInclusive: true,
        maxInclusive: true,
      })
    ).toBe(true);
  });
});
