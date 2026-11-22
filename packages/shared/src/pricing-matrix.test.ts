import { describe, expect, it } from 'vitest';
import {
  calculateJewelleryPrice,
  OWNER_MARKET_DIAMOND_RATES,
  OWNER_MARKET_METAL_RATES,
  OWNER_MARKET_PRICING_RULE,
} from './pricing-engine.js';
import type {
  DiamondComponentSpec,
  JewelleryProductSpec,
  MetalRateRecord,
  PricingFormulaRule,
} from './types.js';

/**
 * Exhaustive owner-rate-card pricing matrix (MRS final pricing audit, 2026-11-21).
 * Owner rate card (workbook "Rate Card" sheet B5:B13 + rules A16:D21):
 *   14K ₹10,200/g · 18K ₹12,300/g · 22K ₹11,510/g · Pt950 ₹3,911/g · making ₹2,500 per NET metal gram
 *   diamonds: tier by COMBINED carat weight, <1.00 ct ₹30,000/ct, >1.00 ct ₹45,000/ct, =1.00 ct held
 *   GST 3% on 14K/18K only; 22K/Pt GST unconfirmed; 24K unresolved; wastage/certification not included.
 * Rounding: NEAREST_1 (half-up) on the GST-inclusive total. Currency INR.
 * All expected values below were computed by hand from those inputs.
 */

const base: JewelleryProductSpec = {
  id: 'matrix',
  sku: 'MRS-MATRIX',
  handle: 'matrix',
  title: 'Matrix Piece',
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
  diamondComponents: [],
  makingChargeMode: 'PER_GRAM_NET',
  makingChargeValue: '1100.00', // legacy supplier value — must be ignored in owner mode
  wastageMode: 'NONE',
  wastageValue: '0',
  certificationFeeInr: '0.00',
  hallmarkFeeInr: '0.00',
  fixedAdjustmentInr: '0.00',
  manualPriceOverrideInr: null,
  pricingEnabled: true,
  inventoryQuantity: 1,
  updatedAt: '2026-11-21T00:00:00.000Z',
};

const dia = (ct: string, stones = 1, name = 'Diamond'): DiamondComponentSpec => ({
  componentName: name,
  shape: 'ROUND',
  stoneCount: stones,
  totalCaratWeight: ct,
  colorGrade: 'EF',
  clarityGrade: 'VVS',
});

const price = (
  overrides: Partial<JewelleryProductSpec>,
  rule: PricingFormulaRule = OWNER_MARKET_PRICING_RULE,
  metalRates: MetalRateRecord[] = OWNER_MARKET_METAL_RATES
) =>
  calculateJewelleryPrice({
    product: { ...base, ...overrides },
    metalRates,
    diamondRates: OWNER_MARKET_DIAMOND_RATES,
    rule,
  });

function expectSaneAmounts(calc: ReturnType<typeof price>) {
  for (const v of [calc.finalProposedPriceInr, calc.calculatedPriceInr, calc.subtotalBeforeTaxInr]) {
    expect(Number.isFinite(Number(v))).toBe(true);
    expect(Number(v)).toBeGreaterThanOrEqual(0);
  }
  if (!calc.priceOnRequest) {
    expect(Number(calc.finalProposedPriceInr)).toBeGreaterThan(0);
  } else {
    expect(calc.displayPriceLabel).toBe('Price on request');
  }
}

describe('Owner rate card pricing matrix — metals', () => {
  it('18K no diamond: 4g × 12,300 + 4g × 2,500 = 59,200 + 3% GST 1,776 = ₹60,976', () => {
    const c = price({});
    expect(c.baseMetalValueInr).toBe('49200.00');
    expect(c.makingChargeValueInr).toBe('10000.00');
    expect(c.makingChargeRateInput).toBe('2500.00');
    expect(c.totalDiamondValueInr).toBe('0.00');
    expect(c.gstAmountInr).toBe('1776.00');
    expect(c.finalProposedPriceInr).toBe('60976.00');
    expect(c.displayPriceLabel).toBe('₹60,976');
    expect(c.currency).toBe('INR');
    expectSaneAmounts(c);
  });

  it('14K: 2g × 10,200 + 2g × 2,500 + 0.01ct × 30,000 = 25,700 + GST 771 = ₹26,471', () => {
    const c = price({ metalPurity: '14K', netMetalWeightGrams: '2.000', grossWeightGrams: '2.100', diamondComponents: [dia('0.010')] });
    expect(c.baseMetalValueInr).toBe('20400.00');
    expect(c.totalDiamondValueInr).toBe('300.00');
    expect(c.finalProposedPriceInr).toBe('26471.00');
  });

  it('22K computes metal value at ₹11,510/g but is Price on request (GST unconfirmed)', () => {
    const c = price({ metalPurity: '22K' });
    expect(c.metalRatePerGramInr).toBe('11510.00');
    expect(c.baseMetalValueInr).toBe('46040.00');
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
    expect(c.finalProposedPriceInr).toBe('0.00');
    expectSaneAmounts(c);
  });

  it('Platinum 950 computes metal value at ₹3,911/g but is Price on request (GST unconfirmed)', () => {
    const c = price({ metalType: 'PLATINUM', metalPurity: '950_PLATINUM' });
    expect(c.metalRatePerGramInr).toBe('3911.00');
    expect(c.baseMetalValueInr).toBe('15644.00');
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
  });

  it('24K is blocked (no approved rate) and never priced', () => {
    const c = price({ metalPurity: '24K' });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('24K_RATE_BLOCKED_PENDING_CONFIRMATION');
    expect(c.metalRatePerGramInr).toBe('0.00');
  });

  it('missing metal purity -> Price on request (MISSING_METAL_RATE)', () => {
    const c = price({ metalPurity: '' as unknown as JewelleryProductSpec['metalPurity'] });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('MISSING_METAL_RATE');
    expectSaneAmounts(c);
  });
});

describe('Owner rate card pricing matrix — net weight', () => {
  it.each([
    ['missing', ''],
    ['zero', '0'],
  ])('%s net metal weight -> Price on request, never gross weight', (_label, net) => {
    const c = price({ netMetalWeightGrams: net, grossWeightGrams: '5.000' });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('MISSING_NET_METAL_WEIGHT');
    expect(c.baseMetalValueInr).toBe('0.00');
  });

  it('negative net metal weight -> Price on request (INVALID_PRODUCT_DATA), no throw', () => {
    const c = price({ netMetalWeightGrams: '-2.000' });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('INVALID_PRODUCT_DATA');
    expectSaneAmounts(c);
  });

  it('non-numeric net metal weight -> Price on request (INVALID_PRODUCT_DATA), no throw/NaN', () => {
    const c = price({ netMetalWeightGrams: 'abc' });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('INVALID_PRODUCT_DATA');
    expectSaneAmounts(c);
  });

  it('diamond weight is never added to metal weight', () => {
    const c = price({ diamondComponents: [dia('0.500')] });
    expect(c.computedNetMetalWeightGrams).toBe('4.000');
    expect(c.baseMetalValueInr).toBe('49200.00');
    expect(c.makingChargeValueInr).toBe('10000.00');
  });

  it('fractional grams: 2.345g 18K = 28,843.50 + 5,862.50 = 34,706 + GST 1,041.18 = 35,747.18 -> ₹35,747', () => {
    const c = price({ netMetalWeightGrams: '2.345', grossWeightGrams: '2.500' });
    expect(c.baseMetalValueInr).toBe('28843.50');
    expect(c.makingChargeValueInr).toBe('5862.50');
    expect(c.gstAmountInr).toBe('1041.18');
    expect(c.unroundedTotalInr).toBe('35747.18');
    expect(c.roundingAdjustmentInr).toBe('-0.18');
    expect(c.finalProposedPriceInr).toBe('35747.00');
  });
});

describe('Owner rate card pricing matrix — diamond tiers (combined carat weight)', () => {
  it('0 ct: no diamond charge at all', () => {
    const c = price({ diamondComponents: [dia('0.000')] });
    expect(c.totalDiamondValueInr).toBe('0.00');
    expect(c.priceOnRequest).toBe(false);
  });

  it('0.99 ct -> ₹30,000/ct: 29,700; total 88,900 + GST 2,667 = ₹91,567', () => {
    const c = price({ diamondComponents: [dia('0.990')] });
    expect(c.diamondComponents[0]!.appliedRatePerCaratInr).toBe('30000.00');
    expect(c.totalDiamondValueInr).toBe('29700.00');
    expect(c.finalProposedPriceInr).toBe('91567.00');
  });

  it('exactly 1.00 ct -> Price on request (owner rate not supplied)', () => {
    const c = price({ diamondComponents: [dia('1.000')] });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');
    expect(c.finalProposedPriceInr).toBe('0.00');
  });

  it('1.01 ct -> ₹45,000/ct: 45,450; 104,650 + GST 3,139.50 = 107,789.50 -> half-up ₹107,790', () => {
    const c = price({ diamondComponents: [dia('1.010')] });
    expect(c.diamondComponents[0]!.appliedRatePerCaratInr).toBe('45000.00');
    expect(c.totalDiamondValueInr).toBe('45450.00');
    expect(c.unroundedTotalInr).toBe('107789.50');
    expect(c.finalProposedPriceInr).toBe('107790.00');
  });

  it('3.50 ct multi-stone -> ₹45,000/ct on combined weight even though each stone is tiny', () => {
    const c = price({ diamondComponents: [dia('3.500', 70, 'Melee')] });
    expect(c.totalDiamondValueInr).toBe('157500.00');
    expect(c.finalProposedPriceInr).toBe('223201.00');
    expect(c.diamondTierBasis).toBe('TOTAL_PRODUCT_CARAT');
  });

  it('Diamond 1 0.60 + Diamond 2 0.50 = 1.10 ct combined -> both at ₹45,000/ct = 49,500 -> ₹111,961', () => {
    const c = price({ diamondComponents: [dia('0.600', 1, 'D1'), dia('0.500', 12, 'D2')] });
    expect(c.totalDiamondCarats).toBe('1.100');
    expect(c.diamondComponents.map((d) => d.appliedRatePerCaratInr)).toEqual(['45000.00', '45000.00']);
    expect(c.totalDiamondValueInr).toBe('49500.00');
    expect(c.finalProposedPriceInr).toBe('111961.00');
  });

  it('Diamond 1 0.70 + Diamond 2 0.30 = exactly 1.00 ct combined -> Price on request', () => {
    const c = price({ diamondComponents: [dia('0.700', 1, 'D1'), dia('0.300', 10, 'D2')] });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');
  });

  it.each(['abc', '-0.50'])('invalid diamond weight "%s" -> Price on request, no throw', (ct) => {
    const c = price({ diamondComponents: [dia(ct)] });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('INVALID_PRODUCT_DATA');
    expectSaneAmounts(c);
  });

  it('legacy (non owner rate card) rules keep per-component average-stone tiering', () => {
    const legacyRule: PricingFormulaRule = {
      ...OWNER_MARKET_PRICING_RULE,
      diamondTierBasis: 'COMPONENT_AVERAGE_STONE',
    };
    const c = price({ diamondComponents: [dia('0.600', 1, 'D1'), dia('0.500', 12, 'D2')] }, legacyRule);
    expect(c.totalDiamondValueInr).toBe('33000.00');
  });
});

describe('Owner rate card pricing matrix — charges, GST, overrides and versioning', () => {
  it('stored wastage / certification / hallmark are NOT added under the owner rate card', () => {
    const c = price({
      wastageMode: 'PERCENT_METAL_VALUE',
      wastageValue: '3.5',
      certificationFeeInr: '1500.00',
      hallmarkFeeInr: '100.00',
    });
    expect(c.wastageValueInr).toBe('0.00');
    expect(c.certificationFeeInr).toBe('0.00');
    expect(c.hallmarkFeeInr).toBe('0.00');
    expect(c.productLevelFeesApplied).toBe(false);
    expect(c.finalProposedPriceInr).toBe('60976.00');
  });

  it('they are applied only when a rule explicitly approves product-level fees', () => {
    const c = price(
      { certificationFeeInr: '1500.00', hallmarkFeeInr: '100.00' },
      { ...OWNER_MARKET_PRICING_RULE, applyProductLevelFees: true }
    );
    // 59,200 + 1,600 = 60,800 + GST 1,824 = 62,624
    expect(c.finalProposedPriceInr).toBe('62624.00');
  });

  it('an explicitly approved fixed adjustment is included (Additional Approved Charges)', () => {
    const c = price({ fixedAdjustmentInr: '1000.00' });
    // 60,200 + GST 1,806 = 62,006
    expect(c.finalProposedPriceInr).toBe('62006.00');
  });

  it('missing GST rule (no confirmed purities) -> Price on request, no tax guessed', () => {
    const c = price({}, { ...OWNER_MARKET_PRICING_RULE, confirmedGstPurities: [] });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
  });

  it('manual override is shown separately, survives a rate change, and removal restores the market price', () => {
    const raised = OWNER_MARKET_METAL_RATES.map((r) =>
      r.purity === '18K' ? { ...r, ratePerGramInr: '13000.00' } : r
    );
    const withOverride = price({ manualPriceOverrideInr: '75000.00' });
    const withOverrideAfterRateChange = price({ manualPriceOverrideInr: '75000.00' }, OWNER_MARKET_PRICING_RULE, raised);
    expect(withOverride.priceSource).toBe('OWNER_MANUAL_OVERRIDE');
    expect(withOverride.finalProposedPriceInr).toBe('75000.00');
    expect(withOverride.calculatedPriceInr).toBe('60976.00');
    expect(withOverrideAfterRateChange.finalProposedPriceInr).toBe('75000.00');
    // 4g × 13,000 = 52,000 + 10,000 = 62,000 + GST 1,860 = 63,860
    expect(withOverrideAfterRateChange.calculatedPriceInr).toBe('63860.00');

    const removed = price({ manualPriceOverrideInr: null }, OWNER_MARKET_PRICING_RULE, raised);
    expect(removed.priceSource).toBe('CALCULATED_MARKET_RATE');
    expect(removed.finalProposedPriceInr).toBe('63860.00');
  });

  it('invalid manual override is rejected (Price on request), never published', () => {
    const c = price({ manualPriceOverrideInr: 'not-a-number' });
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('INVALID_PRODUCT_DATA');
  });

  it('historical reproducibility: identical inputs + rate snapshot reproduce an identical breakdown', () => {
    const a = price({ diamondComponents: [dia('0.630', 22)] });
    const b = price({ diamondComponents: [dia('0.630', 22)] });
    const strip = (x: typeof a) => ({ ...x, calculatedAt: '' });
    expect(strip(a)).toEqual(strip(b));
    expect(a.formulaVersion).toBe(OWNER_MARKET_PRICING_RULE.version);
  });
});

describe('Fail-closed: only owner-approved rules and rates may produce a sellable price', () => {
  const placeholderMetal = OWNER_MARKET_METAL_RATES.map((r) =>
    r.purity === '18K' ? { ...r, ratePerGramInr: '5740.00', isPlaceholder: true } : r
  );
  it('placeholder metal rate -> Price on request (PRICING_RULE_NOT_APPROVED)', () => {
    const c = price({}, OWNER_MARKET_PRICING_RULE, placeholderMetal);
    expect(c.priceOnRequest).toBe(true);
    expect(c.priceOnRequestReason).toBe('PRICING_RULE_NOT_APPROVED');
    expect(c.finalProposedPriceInr).toBe('0.00');
  });
  it('placeholder pricing formula -> Price on request', () => {
    const c = price({}, { ...OWNER_MARKET_PRICING_RULE, isPlaceholderFormula: true });
    expect(c.priceOnRequestReason).toBe('PRICING_RULE_NOT_APPROVED');
  });
  it('rule not in APPROVED status (draft/retired/old version) -> Price on request', () => {
    for (const status of ['DRAFT', 'RETIRED'] as const) {
      const c = price({}, { ...OWNER_MARKET_PRICING_RULE, status });
      expect(c.priceOnRequest).toBe(true);
      expect(c.priceOnRequestReason).toBe('PRICING_RULE_NOT_APPROVED');
    }
  });
  it('placeholder diamond rate matched -> Price on request', () => {
    const c = calculateJewelleryPrice({
      product: { ...base, diamondComponents: [dia('0.500')] },
      metalRates: OWNER_MARKET_METAL_RATES,
      diamondRates: OWNER_MARKET_DIAMOND_RATES.map((d) => ({ ...d, isPlaceholder: true })),
      rule: OWNER_MARKET_PRICING_RULE,
    });
    expect(c.priceOnRequestReason).toBe('PRICING_RULE_NOT_APPROVED');
  });
  it('a manual owner override is still honoured (explicit owner price)', () => {
    const c = price({ manualPriceOverrideInr: '70000.00' }, OWNER_MARKET_PRICING_RULE, placeholderMetal);
    expect(c.priceOnRequest).toBe(false);
    expect(c.finalProposedPriceInr).toBe('70000.00');
  });
  it('unsupported purity -> Price on request, never priced', () => {
    const c = price({ metalPurity: '925_SILVER' as JewelleryProductSpec['metalPurity'] });
    expect(c.priceOnRequest).toBe(true);
  });
});
