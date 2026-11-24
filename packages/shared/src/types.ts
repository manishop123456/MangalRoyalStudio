export type AdminRoleName = 'OWNER' | 'MANAGER' | 'PRICING_OPERATOR';

export type PermissionCode =
  | 'RATES_VIEW'
  | 'RATES_WRITE'
  | 'PRICING_PREVIEW'
  | 'PRICING_VALIDATE'
  | 'PRICING_APPROVE'
  | 'PRICING_PUBLISH'
  | 'PRODUCTS_VIEW'
  | 'PRODUCTS_WRITE'
  | 'IMPORTS_RUN'
  | 'IMPORTS_SYNC_SHOPIFY'
  | 'ORDERS_VIEW'
  | 'ORDERS_MANAGE'
  | 'CUSTOMERS_PII_VIEW'
  | 'SHIPMENTS_MANAGE'
  | 'PAYMENTS_VIEW'
  | 'DISCOUNTS_MANAGE'
  | 'CONTENT_MANAGE'
  | 'USERS_MANAGE'
  | 'SETTINGS_MANAGE'
  | 'AUDIT_VIEW'
  | 'CUSTOMIZATION_VIEW'
  | 'CUSTOMIZATION_MANAGE'
  | 'MODEL_ASSETS_MANAGE'
  | 'DESIGNS_VIEW';

export const ROLE_PERMISSIONS: Record<AdminRoleName, PermissionCode[]> = {
  OWNER: [
    'RATES_VIEW',
    'RATES_WRITE',
    'PRICING_PREVIEW',
    'PRICING_VALIDATE',
    'PRICING_APPROVE',
    'PRICING_PUBLISH',
    'PRODUCTS_VIEW',
    'PRODUCTS_WRITE',
    'IMPORTS_RUN',
    'IMPORTS_SYNC_SHOPIFY',
    'ORDERS_VIEW',
    'ORDERS_MANAGE',
    'CUSTOMERS_PII_VIEW',
    'SHIPMENTS_MANAGE',
    'PAYMENTS_VIEW',
    'DISCOUNTS_MANAGE',
    'CONTENT_MANAGE',
    'USERS_MANAGE',
    'SETTINGS_MANAGE',
    'AUDIT_VIEW',
    'CUSTOMIZATION_VIEW',
    'CUSTOMIZATION_MANAGE',
    'MODEL_ASSETS_MANAGE',
    'DESIGNS_VIEW',
  ],
  MANAGER: [
    'RATES_VIEW',
    'PRICING_PREVIEW',
    'PRICING_VALIDATE',
    'PRODUCTS_VIEW',
    'PRODUCTS_WRITE',
    'IMPORTS_RUN',
    'ORDERS_VIEW',
    'ORDERS_MANAGE',
    'SHIPMENTS_MANAGE',
    'PAYMENTS_VIEW',
    'DISCOUNTS_MANAGE',
    'CONTENT_MANAGE',
    'AUDIT_VIEW',
    'CUSTOMIZATION_VIEW',
    'CUSTOMIZATION_MANAGE',
    'MODEL_ASSETS_MANAGE',
    'DESIGNS_VIEW',
  ],
  PRICING_OPERATOR: [
    'RATES_VIEW',
    'PRICING_PREVIEW',
    'PRICING_VALIDATE',
    'PRODUCTS_VIEW',
    'PRODUCTS_WRITE',
    'IMPORTS_RUN',
    'AUDIT_VIEW',
    'CUSTOMIZATION_VIEW',
  ],
};

export type MetalType = 'GOLD' | 'SILVER' | 'PLATINUM';

export type MetalPurity =
  | '24K'
  | '22K'
  | '18K'
  | '14K'
  | '925_SILVER'
  | '950_PLATINUM';

export type DiamondShape =
  | 'ROUND'
  | 'CUSHION'
  | 'EMERALD'
  | 'PEAR'
  | 'OVAL'
  | 'PRINCESS'
  | 'HEART'
  | 'MARQUISE'
  | 'RADIANT'
  | 'ASSCHER'
  | 'BAGUETTE'
  | 'OTHER';

export type MakingChargeMode =
  | 'PER_GRAM_NET'
  | 'PER_GRAM_GROSS'
  | 'PERCENTAGE_OF_METAL'
  | 'FLAT_PER_PIECE';

export type WastageMode =
  | 'NONE'
  | 'PERCENT_METAL_VALUE'
  | 'PERCENT_METAL_WEIGHT'
  | 'FLAT_GRAMS';

export type NetWeightDerivationMode =
  | 'EXPLICIT_NET_WEIGHT'
  | 'GROSS_MINUS_STONE_WEIGHT';

export type RoundingMode =
  | 'NEAREST_1'
  | 'NEAREST_10'
  | 'NEAREST_99'
  | 'NEAREST_100'
  | 'NONE';

export type GstMode = 'INCLUSIVE' | 'EXCLUSIVE';

export type PricingRunStatus =
  | 'DRAFT'
  | 'PREVIEWED'
  | 'VALIDATED'
  | 'APPROVED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

export interface MetalRateRecord {
  id: string;
  metalType: MetalType;
  purity: MetalPurity;
  ratePerGramInr: string;
  currency: 'INR';
  source: string;
  sourceReference?: string;
  isPlaceholder: boolean;
  effectiveAt: string;
  createdBy: string;
  createdAt: string;
}

export interface DiamondRateMatrixEntry {
  id: string;
  shape: DiamondShape | 'ANY';
  sieveRange?: string;
  sizeMinCarat: string;
  sizeMaxCarat: string;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  colorGrade: string;
  clarityGrade: string;
  cutGrade: string;
  pricingType: 'PER_CARAT' | 'FLAT_PER_STONE';
  rateInr: string;
  currency: 'INR';
  version: number;
  isPlaceholder: boolean;
  isActive: boolean;
  effectiveAt: string;
  createdBy: string;
  createdAt: string;
}

export interface DiamondComponentSpec {
  id?: string;
  componentName: string;
  shape: DiamondShape;
  stoneCount: number;
  totalCaratWeight: string;
  colorGrade: string;
  clarityGrade: string;
  cutGrade?: string;
  sieveSize?: string;
  certification?: string;
  rateOverridePerCaratInr?: string;
}

export interface ProductVariantOption {
  id: string;
  sku: string;
  title: string;
  metalPurity: MetalPurity;
  metalColor: 'YELLOW_GOLD' | 'ROSE_GOLD' | 'WHITE_GOLD' | 'TWO_TONE' | 'PLATINUM' | 'SILVER';
  ringSize?: string;
  priceInr: string;
  compareAtPriceInr?: string;
  inventoryQuantity: number;
  inStock: boolean;
}

export interface JewelleryProductSpec {
  id: string;
  serialNumber?: number;
  productTag?: string;
  sku: string;
  handle: string;
  title: string;
  description?: string;
  category: string;
  collections?: string[];
  shopifyProductGid: string;
  shopifyVariantGid: string;
  currentShopifyPriceInr: string;
  compareAtPriceInr?: string;
  metalType: MetalType;
  metalPurity: MetalPurity;
  metalColor: 'YELLOW_GOLD' | 'ROSE_GOLD' | 'WHITE_GOLD' | 'TWO_TONE' | 'PLATINUM' | 'SILVER';
  ringSize?: string;
  grossWeightGrams: string;
  netMetalWeightGrams: string;
  netWeightMode: NetWeightDerivationMode;
  diamondComponents: DiamondComponentSpec[];
  makingChargeMode: MakingChargeMode;
  makingChargeValue: string;
  wastageMode: WastageMode;
  wastageValue: string;
  certificationFeeInr: string;
  hallmarkFeeInr: string;
  fixedAdjustmentInr: string;
  manualPriceOverrideInr?: string | null;
  pricingEnabled: boolean;
  inventoryQuantity: number;
  imageUrl?: string;
  altImageUrl?: string;
  galleryImages?: string[];
  variants?: ProductVariantOption[];
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  isFeaturedBestseller?: boolean;
  priceBreakup?: PriceCalculationBreakdown;
  latestBreakdown?: PriceCalculationBreakdown | null;
  /** Server-computed breakdowns for each purity the product is offered in (public detail only). */
  purityBreakups?: Partial<Record<MetalPurity, PriceCalculationBreakdown>>;
  effectivePriceInr?: string;
  priceOnRequest?: boolean;
  priceOnRequestReason?: string | null;
  displayPriceLabel?: string;
  priceSource?: 'CALCULATED_MARKET_RATE' | 'OWNER_MANUAL_OVERRIDE' | 'PRICE_ON_REQUEST';
  rateCardLabel?: string;
  rateCardUpdatedAt?: string;
  updatedAt: string;
}

export interface PricingFormulaRule {
  id: string;
  version: number;
  name: string;
  description: string;
  status: 'DRAFT' | 'APPROVED' | 'RETIRED';
  isPlaceholderFormula: boolean;
  stoneWeightToGramsFactor: string; // Standard: 1 carat = 0.2 grams
  gstRatePercent: string; // Confirmed for 14K & 18K: 3.00%
  gstMode: GstMode;
  roundingMode: RoundingMode;
  maxPriceDeltaPercentThreshold: string; // Guardrail threshold e.g. 15%
  defaultCertificationFeeInr: string;
  defaultHallmarkFeeInr: string;
  makingChargePerGramInr?: string;
  useRateCardMakingCharge?: boolean;
  confirmedGstPurities?: MetalPurity[];
  /**
   * How the diamond rate tier is selected.
   * - TOTAL_PRODUCT_CARAT: tier chosen from the combined carat weight of all diamond components
   *   (owner rate card: "(Diamond 1 ct + Diamond 2 ct) × applicable rate/ct; rate based on combined carat weight").
   * - COMPONENT_AVERAGE_STONE: tier chosen per component from its average stone size (legacy matrix mode).
   * Defaults to TOTAL_PRODUCT_CARAT when useRateCardMakingCharge is true, otherwise COMPONENT_AVERAGE_STONE.
   */
  diamondTierBasis?: 'TOTAL_PRODUCT_CARAT' | 'COMPONENT_AVERAGE_STONE';
  /**
   * Whether product-level wastage, certification and hallmark fees are added.
   * Owner rate card: "Certification & wastage not automatically included"; "Other charges: only Additional
   * Approved Charges" (fixedAdjustmentInr). Defaults to false when useRateCardMakingCharge is true, else true.
   */
  applyProductLevelFees?: boolean;
  /**
   * TEST/DEV ONLY. When true, placeholder rules/rates may produce sellable prices. Never persisted in
   * PostgreSQL (no column), so staging/production always fail closed to Price on request.
   */
  allowPlaceholderPricing?: boolean;
  rateCardLabel?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface OwnerMarketRateCard {
  label: 'Owner-updated market rates';
  version: number;
  lastUpdatedAt: string;
  updatedBy: string;
  rates: {
    gold14kPerGramInr: string;
    gold18kPerGramInr: string;
    gold22kPerGramInr: string;
    gold24kStatus: 'BLOCKED_PENDING_CONFIRMATION';
    gold24kBlockedNote: string;
    platinum950PerGramInr: string;
    makingChargePerGramInr: string;
    diamondUnder1CaratPerCaratInr: string;
    diamondOver1CaratPerCaratInr: string;
    diamondExact1CaratStatus: 'PENDING_OWNER_INPUT';
    diamondExact1CaratNote: string;
  };
  gstRules: {
    confirmedPurities: MetalPurity[];
    confirmedGstPercent: string;
    unconfirmedPurities: MetalPurity[];
    gold24kGstNote: string;
  };
}

export interface DiamondComponentCalculation {
  componentName: string;
  shape: DiamondShape;
  stoneCount: number;
  totalCaratWeight: string;
  averageStoneCarat: string;
  matchedRateId: string;
  appliedRatePerCaratInr: string;
  componentValueInr: string;
  isPlaceholderRate: boolean;
}

export interface PriceCalculationBreakdown {
  sku: string;
  formulaVersion: number;
  isPlaceholderConfiguration: boolean;
  currency: 'INR';
  metalType: MetalType;
  metalPurity: MetalPurity;
  grossWeightGrams: string;
  totalDiamondCarats: string;
  stoneWeightInGrams: string;
  computedNetMetalWeightGrams: string;
  metalRatePerGramInr: string;
  baseMetalValueInr: string;
  wastageMode: WastageMode;
  wastageGrams: string;
  wastageValueInr: string;
  payableMetalValueInr: string;
  diamondComponents: DiamondComponentCalculation[];
  totalDiamondValueInr: string;
  makingChargeMode: MakingChargeMode;
  makingChargeRateInput: string;
  makingChargeValueInr: string;
  certificationFeeInr: string;
  hallmarkFeeInr: string;
  fixedAdjustmentInr: string;
  subtotalBeforeTaxInr: string;
  gstRatePercent: string;
  gstMode: GstMode;
  gstAmountInr: string;
  unroundedTotalInr: string;
  roundingMode: RoundingMode;
  roundingAdjustmentInr: string;
  calculatedPriceInr: string;
  manualOverrideApplied: boolean;
  finalProposedPriceInr: string;
  priceOnRequest?: boolean;
  priceOnRequestReason?: string | null;
  displayPriceLabel?: string;
  priceSource?: 'CALCULATED_MARKET_RATE' | 'OWNER_MANUAL_OVERRIDE' | 'PRICE_ON_REQUEST';
  gstConfirmed?: boolean;
  diamondTierBasis?: 'TOTAL_PRODUCT_CARAT' | 'COMPONENT_AVERAGE_STONE';
  productLevelFeesApplied?: boolean;
  rateCardLabel?: string;
  rateCardUpdatedAt?: string;
  oldPriceInr: string;
  priceDeltaInr: string;
  priceDeltaPercent: string;
  exceedsMaxDeltaThreshold: boolean;
  warnings: string[];
  calculatedAt: string;
}

// ============================================================================
// PHASE 2: JEWELLERY CUSTOMIZATION, SAVED DESIGNS & 3D MODEL ASSETS
// ============================================================================

export type CustomizationOptionCategory =
  | 'METAL'
  | 'PURITY'
  | 'METAL_COLOR'
  | 'DIAMOND'
  | 'GEMSTONE'
  | 'SIZE'
  | 'FINISH'
  | 'SETTING'
  | 'ENGRAVING'
  | 'OTHER';

export type CustomizationSelectionMode = 'SINGLE' | 'TEXT';

export type CustomizationPriceRuleType =
  | 'INCLUDED'
  | 'FIXED_INR'
  | 'PER_GRAM_INR'
  | 'PER_CARAT_INR'
  | 'PERCENT_OF_BASE'
  | 'METAL_RATE_PURITY';

export interface CustomizationDependencyRule {
  requiresDiamondSupport?: boolean;
  requiresEngravingSupport?: boolean;
  allowedMetalTypes?: MetalType[];
  allowedCategories?: string[];
}

export interface CustomizationOptionRecord {
  id: string;
  groupId: string;
  code: string;
  label: string;
  description?: string;
  value: string;
  swatchHex?: string;
  imageUrl?: string;
  priceRuleType: CustomizationPriceRuleType;
  priceRuleValue: string;
  metalType?: MetalType;
  metalPurity?: MetalPurity;
  metalColor?: string;
  diamondShape?: DiamondShape;
  diamondCaratWeight?: string;
  diamondColorGrade?: string;
  diamondClarityGrade?: string;
  gemstoneType?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  eligibilityRule?: CustomizationDependencyRule;
  createdAt: string;
  updatedAt: string;
}

export interface CustomizationGroupRecord {
  id: string;
  profileId: string;
  code: string;
  name: string;
  description?: string;
  stepOrder: number;
  selectionMode: CustomizationSelectionMode;
  optionCategory: CustomizationOptionCategory;
  isRequired: boolean;
  isActive: boolean;
  dependencyRule?: CustomizationDependencyRule;
  options: CustomizationOptionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomizationProfileRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  eligibleCategories: string[];
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  updatedBy?: string;
  groups: CustomizationGroupRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductCustomizationAssignmentRecord {
  id: string;
  productMetadataId: string;
  productSku?: string;
  profileId: string;
  isCustomizable: boolean;
  allowDiamondSelection: boolean;
  allowEngraving: boolean;
  maxEngravingChars: number;
  disabledOptionCodes: string[];
  configOverrides?: Record<string, unknown>;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductModelAssetRecord {
  id: string;
  productMetadataId: string;
  productSku: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageProvider: 'LOCAL_MANAGED' | 'EXTERNAL_URL';
  storageKey: string;
  assetUrl: string;
  previewImageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomizationSelectionMap = Record<string, string>;

export interface CustomizationSelectionSnapshotItem {
  groupCode: string;
  groupName: string;
  optionCategory: CustomizationOptionCategory;
  selectionMode: CustomizationSelectionMode;
  optionCode?: string;
  label: string;
  value: string;
  priceDeltaInr: string;
}

export interface CustomizationQuoteBreakdownLine {
  key: string;
  label: string;
  amountInr: string;
  category: 'BASE' | 'METAL' | 'STONE' | 'OPTION' | 'ENGRAVING' | 'TAX' | 'ROUNDING';
}

export interface CustomizationQuoteResponse {
  sku: string;
  productTitle: string;
  profileId: string;
  profileName: string;
  quantity: number;
  currency: 'INR';
  pricingRuleVersion: number;
  isPlaceholderConfiguration: boolean;
  unitPriceInr: string;
  totalPriceInr: string;
  subtotalBeforeTaxInr: string;
  gstRatePercent: string;
  gstAmountInr: string;
  roundingAdjustmentInr: string;
  breakdownLines: CustomizationQuoteBreakdownLine[];
  selectionSnapshot: CustomizationSelectionSnapshotItem[];
  resolvedMetalType: MetalType;
  resolvedMetalPurity: MetalPurity;
  resolvedMetalColor: string;
  resolvedRingSize?: string;
  calculatedAt: string;
}

export interface CustomerDesignRecord {
  id: string;
  customerId: string;
  productMetadataId: string;
  productSku: string;
  productHandle: string;
  productTitle: string;
  profileId?: string;
  name: string;
  selections: CustomizationSelectionMap;
  selectionSnapshot: CustomizationSelectionSnapshotItem[];
  lastQuotedPriceInr: string;
  lastPriceBreakdown: CustomizationQuoteBreakdownLine[];
  pricingRuleVersion: number;
  status: 'SAVED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 3 List, Pagination & Executive Dashboard Types
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardFinancialMetrics {
  grossCapturedInr: string;
  totalRefundedInr: string;
  netRevenueInr: string;
  paidOrdersTotalInr: string;
  currency: 'INR';
  disclaimer: string;
}

export interface DashboardKpiSummary {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  totalCustomers: number;
  lowStockCount: number;
  pendingPricingRuns: number;
  activeShipments: number;
  financials: DashboardFinancialMetrics;
}

export interface TopSellerItem {
  sku: string;
  title: string;
  totalUnitsSold: number;
  totalRevenueInr: string;
}

export interface TrendBucketItem {
  date: string;
  orderCount: number;
  revenueInr: string;
}



