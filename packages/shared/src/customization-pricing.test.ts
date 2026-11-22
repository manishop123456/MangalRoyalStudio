import { describe, expect, it } from 'vitest';
import {
  calculateCustomizationQuote,
  CustomizationQuoteError,
  resolveEligibleCustomizationProfile,
} from './customization-pricing.js';
import type {
  CustomizationProfileRecord,
  DiamondRateMatrixEntry,
  JewelleryProductSpec,
  MetalRateRecord,
  PricingFormulaRule,
  ProductCustomizationAssignmentRecord,
} from './types.js';

const mockRule: PricingFormulaRule = {
  id: 'rule-1',
  version: 1,
  name: 'Standard',
  description: 'Standard INR GST rule',
  status: 'APPROVED',
  isPlaceholderFormula: false,
  stoneWeightToGramsFactor: '0.2',
  gstRatePercent: '3.00',
  gstMode: 'EXCLUSIVE',
  roundingMode: 'NEAREST_1',
  maxPriceDeltaPercentThreshold: '25.00',
  defaultCertificationFeeInr: '500.00',
  defaultHallmarkFeeInr: '150.00',
  createdAt: '2026-11-12T00:00:00.000Z',
};

const mockMetalRates: MetalRateRecord[] = [
  {
    id: 'mr-18k',
    metalType: 'GOLD',
    purity: '18K',
    ratePerGramInr: '5740.00',
    currency: 'INR',
    source: 'TEST',
    isPlaceholder: false,
    effectiveAt: '2026-11-12T00:00:00.000Z',
    createdBy: 'owner@test.com',
    createdAt: '2026-11-12T00:00:00.000Z',
  },
  {
    id: 'mr-22k',
    metalType: 'GOLD',
    purity: '22K',
    ratePerGramInr: '7015.00',
    currency: 'INR',
    source: 'TEST',
    isPlaceholder: false,
    effectiveAt: '2026-11-12T00:00:00.000Z',
    createdBy: 'owner@test.com',
    createdAt: '2026-11-12T00:00:00.000Z',
  },
];

const mockDiamondRates: DiamondRateMatrixEntry[] = [
  {
    id: 'dr-1',
    shape: 'ROUND',
    sizeMinCarat: '0.100',
    sizeMaxCarat: '1.000',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '22000.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-12T00:00:00.000Z',
    createdBy: 'owner@test.com',
    createdAt: '2026-11-12T00:00:00.000Z',
  },
];

const mockProduct: JewelleryProductSpec = {
  id: 'prod-1',
  sku: 'MRS-RNG-TEST',
  handle: 'royal-solitaire-ring',
  title: 'Royal Solitaire Ring',
  category: 'Rings',
  shopifyProductGid: 'gid://shopify/Product/1',
  shopifyVariantGid: 'gid://shopify/ProductVariant/1',
  currentShopifyPriceInr: '55000.00',
  metalType: 'GOLD',
  metalPurity: '18K',
  metalColor: 'ROSE_GOLD',
  ringSize: '12',
  grossWeightGrams: '4.500',
  netMetalWeightGrams: '4.200',
  netWeightMode: 'EXPLICIT_NET_WEIGHT',
  diamondComponents: [
    {
      componentName: 'Center Solitaire',
      shape: 'ROUND',
      stoneCount: 1,
      totalCaratWeight: '0.500',
      colorGrade: 'EF',
      clarityGrade: 'VVS',
    },
  ],
  makingChargeMode: 'PER_GRAM_NET',
  makingChargeValue: '1200.00',
  wastageMode: 'NONE',
  wastageValue: '0',
  certificationFeeInr: '500.00',
  hallmarkFeeInr: '150.00',
  fixedAdjustmentInr: '0.00',
  pricingEnabled: true,
  inventoryQuantity: 5,
  updatedAt: '2026-11-12T00:00:00.000Z',
};

const mockProfile: CustomizationProfileRecord = {
  id: 'prof-rings',
  code: 'RING_BESPOKE',
  name: 'Bespoke Ring Studio',
  eligibleCategories: ['Rings'],
  isActive: true,
  isDefault: true,
  createdBy: 'owner@test.com',
  createdAt: '2026-11-12T00:00:00.000Z',
  updatedAt: '2026-11-12T00:00:00.000Z',
  groups: [
    {
      id: 'grp-purity',
      profileId: 'prof-rings',
      code: 'PURITY',
      name: 'Metal Purity',
      stepOrder: 1,
      selectionMode: 'SINGLE',
      optionCategory: 'PURITY',
      isRequired: true,
      isActive: true,
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      options: [
        {
          id: 'opt-18k',
          groupId: 'grp-purity',
          code: 'GOLD_18K',
          label: '18K Gold',
          value: '18K',
          priceRuleType: 'METAL_RATE_PURITY',
          priceRuleValue: '0',
          metalType: 'GOLD',
          metalPurity: '18K',
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          createdAt: '2026-11-12T00:00:00.000Z',
          updatedAt: '2026-11-12T00:00:00.000Z',
        },
        {
          id: 'opt-22k',
          groupId: 'grp-purity',
          code: 'GOLD_22K',
          label: '22K Gold',
          value: '22K',
          priceRuleType: 'METAL_RATE_PURITY',
          priceRuleValue: '0',
          metalType: 'GOLD',
          metalPurity: '22K',
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          createdAt: '2026-11-12T00:00:00.000Z',
          updatedAt: '2026-11-12T00:00:00.000Z',
        },
        {
          id: 'opt-14k',
          groupId: 'grp-purity',
          code: 'GOLD_14K',
          label: '14K Gold',
          value: '14K',
          priceRuleType: 'METAL_RATE_PURITY',
          priceRuleValue: '0',
          metalType: 'GOLD',
          metalPurity: '14K',
          isDefault: false,
          isActive: true,
          sortOrder: 3,
          createdAt: '2026-11-12T00:00:00.000Z',
          updatedAt: '2026-11-12T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'grp-setting',
      profileId: 'prof-rings',
      code: 'SETTING',
      name: 'Setting Style',
      stepOrder: 2,
      selectionMode: 'SINGLE',
      optionCategory: 'SETTING',
      isRequired: true,
      isActive: true,
      dependencyRule: { requiresDiamondSupport: true },
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      options: [
        {
          id: 'opt-prong',
          groupId: 'grp-setting',
          code: 'CLASSIC_PRONG',
          label: 'Classic 4-Prong',
          value: 'CLASSIC_PRONG',
          priceRuleType: 'INCLUDED',
          priceRuleValue: '0',
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          createdAt: '2026-11-12T00:00:00.000Z',
          updatedAt: '2026-11-12T00:00:00.000Z',
        },
        {
          id: 'opt-halo',
          groupId: 'grp-setting',
          code: 'ROYAL_HALO',
          label: 'Royal Halo',
          value: 'ROYAL_HALO',
          priceRuleType: 'FIXED_INR',
          priceRuleValue: '4500.00',
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          createdAt: '2026-11-12T00:00:00.000Z',
          updatedAt: '2026-11-12T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'grp-engrave',
      profileId: 'prof-rings',
      code: 'ENGRAVING',
      name: 'Inner Band Engraving',
      stepOrder: 3,
      selectionMode: 'TEXT',
      optionCategory: 'ENGRAVING',
      isRequired: false,
      isActive: true,
      dependencyRule: { requiresEngravingSupport: true },
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      options: [],
    },
  ],
};

describe('Phase 2 Customization Pricing & Eligibility Engine', () => {
  it('computes authoritative Decimal quote with purity change and fixed option surcharge', () => {
    const quote18k = calculateCustomizationQuote({
      product: mockProduct,
      profile: mockProfile,
      assignment: null,
      selections: { PURITY: 'GOLD_18K', SETTING: 'CLASSIC_PRONG' },
      quantity: 1,
      metalRates: mockMetalRates,
      diamondRates: mockDiamondRates,
      rule: mockRule,
    });

    const quote18kHalo = calculateCustomizationQuote({
      product: mockProduct,
      profile: mockProfile,
      assignment: null,
      selections: { PURITY: 'GOLD_18K', SETTING: 'ROYAL_HALO' },
      quantity: 2,
      metalRates: mockMetalRates,
      diamondRates: mockDiamondRates,
      rule: mockRule,
    });

    expect(Number(quote18kHalo.unitPriceInr)).toBeGreaterThan(Number(quote18k.unitPriceInr));
    expect(Number(quote18kHalo.totalPriceInr)).toBe(Number(quote18kHalo.unitPriceInr) * 2);
    expect(quote18kHalo.resolvedMetalPurity).toBe('18K');
    expect(quote18kHalo.breakdownLines.some((l) => l.key === 'opt-SETTING-ROYAL_HALO')).toBe(true);
  });

  it('refuses (422 PRICE_ON_REQUEST) to quote a purity whose GST is unconfirmed — no customization bypass', () => {
    let caught: unknown;
    try {
      calculateCustomizationQuote({
        product: mockProduct,
        profile: mockProfile,
        assignment: null,
        selections: { PURITY: 'GOLD_22K', SETTING: 'ROYAL_HALO' },
        quantity: 1,
        metalRates: mockMetalRates,
        diamondRates: mockDiamondRates,
        rule: mockRule,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CustomizationQuoteError);
    expect((caught as CustomizationQuoteError).code).toBe('PRICE_ON_REQUEST');
    expect((caught as CustomizationQuoteError).statusCode).toBe(422);
  });

  it('fails closed with 422 when selected purity has no active metal rate', () => {
    expect(() =>
      calculateCustomizationQuote({
        product: mockProduct,
        profile: mockProfile,
        assignment: null,
        selections: { PURITY: 'GOLD_14K', SETTING: 'CLASSIC_PRONG' },
        quantity: 1,
        metalRates: mockMetalRates,
        diamondRates: mockDiamondRates,
        rule: mockRule,
      })
    ).toThrowError(CustomizationQuoteError);
  });

  it('enforces diamond dependency, disabled options, and engraving length limits', () => {
    const assignment: ProductCustomizationAssignmentRecord = {
      id: 'assign-1',
      productMetadataId: 'prod-1',
      profileId: 'prof-rings',
      isCustomizable: true,
      allowDiamondSelection: false,
      allowEngraving: true,
      maxEngravingChars: 10,
      disabledOptionCodes: ['GOLD_22K'],
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    expect(() =>
      calculateCustomizationQuote({
        product: mockProduct,
        profile: mockProfile,
        assignment,
        selections: { PURITY: 'GOLD_22K' },
        quantity: 1,
        metalRates: mockMetalRates,
        diamondRates: mockDiamondRates,
        rule: mockRule,
      })
    ).toThrow(/invalid or disabled/i);

    expect(() =>
      calculateCustomizationQuote({
        product: mockProduct,
        profile: mockProfile,
        assignment,
        selections: { PURITY: 'GOLD_18K', SETTING: 'ROYAL_HALO' },
        quantity: 1,
        metalRates: mockMetalRates,
        diamondRates: mockDiamondRates,
        rule: mockRule,
      })
    ).toThrow(/Diamond customization is not enabled/i);

    expect(() =>
      calculateCustomizationQuote({
        product: mockProduct,
        profile: mockProfile,
        assignment,
        selections: { PURITY: 'GOLD_18K', ENGRAVING: 'THIS IS WAY TOO LONG' },
        quantity: 1,
        metalRates: mockMetalRates,
        diamondRates: mockDiamondRates,
        rule: mockRule,
      })
    ).toThrow(/cannot exceed 10 characters/i);
  });

  it('respects isCustomizable=false in assignment', () => {
    const disabledAssignment: ProductCustomizationAssignmentRecord = {
      id: 'assign-2',
      productMetadataId: 'prod-1',
      profileId: 'prof-rings',
      isCustomizable: false,
      allowDiamondSelection: false,
      allowEngraving: false,
      maxEngravingChars: 0,
      disabledOptionCodes: [],
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    const res = resolveEligibleCustomizationProfile({
      product: mockProduct,
      assignment: disabledAssignment,
      profiles: [mockProfile],
    });
    expect(res.eligible).toBe(false);
    expect(res.profile).toBeNull();
  });
});
