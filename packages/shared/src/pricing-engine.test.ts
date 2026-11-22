import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  applyInrRounding,
  buildOwnerMarketRateCard,
  calculateJewelleryPrice,
  OWNER_MARKET_DIAMOND_RATES,
  OWNER_MARKET_METAL_RATES,
  OWNER_MARKET_PRICING_RULE,
  OWNER_MARKET_RATE_CARD_LABEL,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MetalRateRecord,
  type PricingFormulaRule,
} from './index.js';

const mockMetalRates: MetalRateRecord[] = [
  {
    id: 'mr-18k',
    metalType: 'GOLD',
    purity: '18K',
    ratePerGramInr: '5800.00',
    currency: 'INR',
    source: 'PLACEHOLDER_CONFIG',
    isPlaceholder: true,
    effectiveAt: '2026-11-05T00:00:00.000Z',
    createdBy: 'owner',
    createdAt: '2026-11-05T00:00:00.000Z',
  },
  {
    id: 'mr-14k',
    metalType: 'GOLD',
    purity: '14K',
    ratePerGramInr: '4520.00',
    currency: 'INR',
    source: 'PLACEHOLDER_CONFIG',
    isPlaceholder: true,
    effectiveAt: '2026-11-05T00:00:00.000Z',
    createdBy: 'owner',
    createdAt: '2026-11-05T00:00:00.000Z',
  },
];

const mockDiamondRates: DiamondRateMatrixEntry[] = [
  {
    id: 'dr-round-solitaire',
    shape: 'ROUND',
    sieveRange: '1.00 - 1.99 ct',
    sizeMinCarat: '0.50',
    sizeMaxCarat: '2.50',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '24000.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: true,
    isActive: true,
    effectiveAt: '2026-11-05T00:00:00.000Z',
    createdBy: 'owner',
    createdAt: '2026-11-05T00:00:00.000Z',
  },
  {
    id: 'dr-accent-melee',
    shape: 'ANY',
    sieveRange: '0.001 - 0.15 ct',
    sizeMinCarat: '0.001',
    sizeMaxCarat: '0.499',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '18000.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: true,
    isActive: true,
    effectiveAt: '2026-11-05T00:00:00.000Z',
    createdBy: 'owner',
    createdAt: '2026-11-05T00:00:00.000Z',
  },
];

const mockRule: PricingFormulaRule = {
  id: 'rule-v1',
  version: 1,
  name: 'Standard Lab-Grown Jewellery Rule v1 (Placeholder)',
  description: 'Configurable baseline rule with 3% GST and nearest ₹1 rounding',
  status: 'APPROVED',
  isPlaceholderFormula: true,
  stoneWeightToGramsFactor: '0.2',
  gstRatePercent: '3.00',
  gstMode: 'INCLUSIVE',
  roundingMode: 'NEAREST_1',
  maxPriceDeltaPercentThreshold: '15.00',
  defaultCertificationFeeInr: '500.00',
  defaultHallmarkFeeInr: '100.00',
  // Legacy matrix arithmetic fixture: explicitly opts in to placeholder pricing (never set in real environments).
  allowPlaceholderPricing: true,
  createdAt: '2026-11-05T00:00:00.000Z',
};

describe('Jewellery Pricing Engine (Decimal Arithmetic)', () => {
  it('calculates 18K Gold + multi-component Diamond + PER_GRAM_NET making + 3% GST accurately', () => {
    const product: JewelleryProductSpec = {
      id: 'prod-1',
      sku: 'MRS-RING-001',
      handle: 'royal-solitaire-ring',
      title: 'Royal Solitaire Lab-Grown Diamond Ring',
      category: 'Rings',
      shopifyProductGid: 'gid://shopify/Product/1001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/2001',
      currentShopifyPriceInr: '52000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'ROSE_GOLD',
      grossWeightGrams: '3.740',
      netMetalWeightGrams: '3.500',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Center Solitaire',
          shape: 'ROUND',
          stoneCount: 1,
          totalCaratWeight: '1.000',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
        {
          componentName: 'Side Pave Melee',
          shape: 'ROUND',
          stoneCount: 10,
          totalCaratWeight: '0.200',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1200.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '500.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0.00',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 5,
      updatedAt: '2026-11-05T00:00:00.000Z',
    };

    const result = calculateJewelleryPrice({
      product,
      metalRates: mockMetalRates,
      diamondRates: mockDiamondRates,
      rule: mockRule,
    });

    // Metal: 3.5g * 5800 = 20300.00
    expect(result.baseMetalValueInr).toBe('20300.00');
    // Diamonds: (1.0 ct * 24000) + (0.20 ct * 18000) = 24000 + 3600 = 27600.00
    expect(result.totalDiamondValueInr).toBe('27600.00');
    // Making: 3.5g * 1200 = 4200.00
    expect(result.makingChargeValueInr).toBe('4200.00');
    // Subtotal before GST: 20300 + 27600 + 4200 + 500 + 100 = 52700.00
    expect(result.subtotalBeforeTaxInr).toBe('52700.00');
    // GST 3%: 52700 * 0.03 = 1581.00
    expect(result.gstAmountInr).toBe('1581.00');
    // Total: 54281.00
    expect(result.finalProposedPriceInr).toBe('54281.00');
    expect(result.exceedsMaxDeltaThreshold).toBe(false);
    expect(result.isPlaceholderConfiguration).toBe(true);
  });

  it('derives net metal weight from gross weight minus stone weight when GROSS_MINUS_STONE_WEIGHT is active', () => {
    const product: JewelleryProductSpec = {
      id: 'prod-2',
      sku: 'MRS-PEND-002',
      handle: 'emerald-cut-pendant',
      title: 'Emerald Cut Pendant',
      category: 'Pendants',
      shopifyProductGid: 'gid://shopify/Product/1002',
      shopifyVariantGid: 'gid://shopify/ProductVariant/2002',
      currentShopifyPriceInr: '18000.00',
      metalType: 'GOLD',
      metalPurity: '14K',
      metalColor: 'YELLOW_GOLD',
      grossWeightGrams: '2.200', // 1.0 ct stone = 0.2g => net metal = 2.000g
      netMetalWeightGrams: '0',
      netWeightMode: 'GROSS_MINUS_STONE_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Center Stone',
          shape: 'ROUND',
          stoneCount: 1,
          totalCaratWeight: '1.000',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PERCENTAGE_OF_METAL',
      makingChargeValue: '15.00',
      wastageMode: 'PERCENT_METAL_VALUE',
      wastageValue: '5.00',
      certificationFeeInr: '0.00',
      hallmarkFeeInr: '0.00',
      fixedAdjustmentInr: '0.00',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 3,
      updatedAt: '2026-11-05T00:00:00.000Z',
    };

    const result = calculateJewelleryPrice({
      product,
      metalRates: mockMetalRates,
      diamondRates: mockDiamondRates,
      rule: { ...mockRule, defaultCertificationFeeInr: '0', defaultHallmarkFeeInr: '0' },
    });

    expect(result.stoneWeightInGrams).toBe('0.200');
    expect(result.computedNetMetalWeightGrams).toBe('2.000');
    // Base metal: 2.0g * 4520 = 9040.00
    expect(result.baseMetalValueInr).toBe('9040.00');
    // Wastage 5%: 452.00 -> Payable metal = 9492.00
    expect(result.wastageValueInr).toBe('452.00');
    expect(result.payableMetalValueInr).toBe('9492.00');
    // Making 15% of payable metal: 9492 * 0.15 = 1423.80
    expect(result.makingChargeValueInr).toBe('1423.80');
    // Exceeds 15% swing threshold vs 18000 old price
    expect(result.exceedsMaxDeltaThreshold).toBe(true);
  });

  it('supports INR rounding modes accurately', () => {
    expect(applyInrRounding(new Decimal('25434.49'), 'NEAREST_1').rounded.toFixed(2)).toBe('25434.00');
    expect(applyInrRounding(new Decimal('25434.50'), 'NEAREST_1').rounded.toFixed(2)).toBe('25435.00');
    expect(applyInrRounding(new Decimal('25436.00'), 'NEAREST_10').rounded.toFixed(2)).toBe('25440.00');
    expect(applyInrRounding(new Decimal('25451.00'), 'NEAREST_100').rounded.toFixed(2)).toBe('25500.00');
    expect(applyInrRounding(new Decimal('25451.00'), 'NEAREST_99').rounded.toFixed(2)).toBe('25499.00');
  });

  describe('Owner-updated market rates & safety guardrails', () => {
    const baseSpec: JewelleryProductSpec = {
      id: 'prod-owner-1',
      sku: 'MRS-TEST-001',
      handle: 'test-market-piece',
      title: 'Test Market Piece',
      category: 'Rings',
      shopifyProductGid: 'gid://shopify/Product/9001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/9001',
      currentShopifyPriceInr: '50000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'YELLOW_GOLD',
      grossWeightGrams: '4.500',
      netMetalWeightGrams: '4.000',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '2500.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '0.00',
      hallmarkFeeInr: '0.00',
      fixedAdjustmentInr: '0.00',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 3,
      updatedAt: '2026-11-20T00:00:00.000Z',
    };

    it('prices 14K gold (₹10,200/g) + making (₹2,500/g net) + <1.00 ct diamond (₹30,000/ct) + 3% GST', () => {
      const calc = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '14K',
          netMetalWeightGrams: '2.000',
          grossWeightGrams: '2.100',
          diamondComponents: [
            {
              componentName: '0.50 ct Solitaire',
              shape: 'ROUND',
              stoneCount: 1,
              totalCaratWeight: '0.500',
              colorGrade: 'EF',
              clarityGrade: 'VVS',
            },
          ],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      // Metal: 2.000g * 10200 = 20400.00
      expect(calc.baseMetalValueInr).toBe('20400.00');
      // Making: 2.000g * 2500 = 5000.00 (uses net weight, not 2.100g gross weight)
      expect(calc.makingChargeValueInr).toBe('5000.00');
      // Diamond <1.00ct: 0.500 * 30000 = 15000.00
      expect(calc.totalDiamondValueInr).toBe('15000.00');
      // Subtotal: 20400 + 5000 + 15000 = 40400.00
      expect(calc.subtotalBeforeTaxInr).toBe('40400.00');
      // 3% GST: 40400 * 0.03 = 1212.00
      expect(calc.gstAmountInr).toBe('1212.00');
      expect(calc.finalProposedPriceInr).toBe('41612.00');
      expect(calc.priceOnRequest).toBe(false);
      expect(calc.priceSource).toBe('CALCULATED_MARKET_RATE');
      expect(calc.rateCardLabel).toBe(OWNER_MARKET_RATE_CARD_LABEL);
    });

    it('prices 18K gold (₹12,300/g) + making (₹2,500/g net) + >1.00 ct diamond (₹45,000/ct) + 3% GST', () => {
      const calc = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '18K',
          netMetalWeightGrams: '3.000',
          grossWeightGrams: '3.300',
          diamondComponents: [
            {
              componentName: '1.50 ct Solitaire',
              shape: 'ROUND',
              stoneCount: 1,
              totalCaratWeight: '1.500',
              colorGrade: 'EF',
              clarityGrade: 'VVS',
            },
          ],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      // Metal: 3.000g * 12300 = 36900.00
      expect(calc.baseMetalValueInr).toBe('36900.00');
      // Making: 3.000g * 2500 = 7500.00
      expect(calc.makingChargeValueInr).toBe('7500.00');
      // Diamond >1.00ct: 1.500 * 45000 = 67500.00
      expect(calc.totalDiamondValueInr).toBe('67500.00');
      // Subtotal: 36900 + 7500 + 67500 = 111900.00
      expect(calc.subtotalBeforeTaxInr).toBe('111900.00');
      // 3% GST: 111900 * 0.03 = 3357.00
      expect(calc.gstAmountInr).toBe('3357.00');
      expect(calc.finalProposedPriceInr).toBe('115257.00');
      expect(calc.priceOnRequest).toBe(false);
    });

    it('flags exact = 1.00 ct diamond as Price on request (no rate supplied for = 1.00 ct)', () => {
      const calc = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '18K',
          diamondComponents: [
            {
              componentName: '1.00 ct Solitaire',
              shape: 'EMERALD',
              stoneCount: 1,
              totalCaratWeight: '1.000',
              colorGrade: 'EF',
              clarityGrade: 'VVS',
            },
          ],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      expect(calc.priceOnRequest).toBe(true);
      expect(calc.priceOnRequestReason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');
      expect(calc.displayPriceLabel).toBe('Price on request');
      expect(calc.finalProposedPriceInr).toBe('0.00');
    });

    it('does not apply diamond charges when no diamond weight exists', () => {
      const calc = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '18K',
          netMetalWeightGrams: '2.000',
          diamondComponents: [],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      expect(calc.totalDiamondValueInr).toBe('0.00');
      expect(calc.priceOnRequest).toBe(false);
      // (2 * 12300 + 2 * 2500) * 1.03 = 29600 * 1.03 = 30488.00
      expect(calc.finalProposedPriceInr).toBe('30488.00');
    });

    it('computes 22K gold (₹11,510/g) and Platinum 950 (₹3,911/g) pre-tax subtotals but flags Price on request because GST is unconfirmed', () => {
      const calc22k = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '22K',
          netMetalWeightGrams: '5.000',
          diamondComponents: [],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      // 5g * 11510 = 57550.00; Making 5g * 2500 = 12500.00
      expect(calc22k.baseMetalValueInr).toBe('57550.00');
      expect(calc22k.makingChargeValueInr).toBe('12500.00');
      expect(calc22k.gstAmountInr).toBe('0.00');
      expect(calc22k.gstConfirmed).toBe(false);
      expect(calc22k.priceOnRequest).toBe(true);
      expect(calc22k.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
      expect(calc22k.displayPriceLabel).toBe('Price on request');
      expect(calc22k.finalProposedPriceInr).toBe('0.00');

      const calcPlat = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalType: 'PLATINUM',
          metalPurity: '950_PLATINUM',
          netMetalWeightGrams: '4.000',
          diamondComponents: [],
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      // 4g * 3911 = 15644.00; Making 4g * 2500 = 10000.00
      expect(calcPlat.baseMetalValueInr).toBe('15644.00');
      expect(calcPlat.makingChargeValueInr).toBe('10000.00');
      expect(calcPlat.gstAmountInr).toBe('0.00');
      expect(calcPlat.priceOnRequest).toBe(true);
      expect(calcPlat.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
    });

    it('blocks 24K gold pending owner confirmation (conflicting ₹15,400/g vs ₹154,000/g)', () => {
      const calc24k = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '24K',
          netMetalWeightGrams: '5.000',
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      expect(calc24k.priceOnRequest).toBe(true);
      expect(calc24k.priceOnRequestReason).toBe('24K_RATE_BLOCKED_PENDING_CONFIRMATION');
      expect(calc24k.displayPriceLabel).toBe('Price on request');
      expect(calc24k.finalProposedPriceInr).toBe('0.00');
    });

    it('never assumes gross weight equals net gold weight when net weight is 0/missing', () => {
      const calcMissingNet = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '18K',
          grossWeightGrams: '6.500',
          netMetalWeightGrams: '0',
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      expect(calcMissingNet.computedNetMetalWeightGrams).toBe('0.000');
      expect(calcMissingNet.priceOnRequest).toBe(true);
      expect(calcMissingNet.priceOnRequestReason).toBe('MISSING_NET_METAL_WEIGHT');
      expect(calcMissingNet.finalProposedPriceInr).toBe('0.00');
    });

    it('preserves owner-approved manual price override and distinguishes it from calculated price', () => {
      const calcOverride = calculateJewelleryPrice({
        product: {
          ...baseSpec,
          metalPurity: '18K',
          netMetalWeightGrams: '2.000',
          manualPriceOverrideInr: '49999.00',
        },
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });

      expect(calcOverride.manualOverrideApplied).toBe(true);
      expect(calcOverride.priceSource).toBe('OWNER_MANUAL_OVERRIDE');
      expect(calcOverride.calculatedPriceInr).toBe('30488.00');
      expect(calcOverride.finalProposedPriceInr).toBe('49999.00');
      expect(calcOverride.priceOnRequest).toBe(false);

      const rateCard = buildOwnerMarketRateCard({
        metalRates: OWNER_MARKET_METAL_RATES,
        diamondRates: OWNER_MARKET_DIAMOND_RATES,
        rule: OWNER_MARKET_PRICING_RULE,
      });
      expect(rateCard.label).toBe('Owner-updated market rates');
      expect(rateCard.rates.gold24kStatus).toBe('BLOCKED_PENDING_CONFIRMATION');
      expect(rateCard.rates.diamondExact1CaratStatus).toBe('PENDING_OWNER_INPUT');
    });
  });
});

