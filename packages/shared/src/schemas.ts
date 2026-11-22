import { z } from 'zod';

export const MetalTypeSchema = z.enum(['GOLD', 'SILVER', 'PLATINUM']);

export const MetalPuritySchema = z.enum([
  '24K',
  '22K',
  '18K',
  '14K',
  '925_SILVER',
  '950_PLATINUM',
]);

export const DiamondShapeSchema = z.enum([
  'ROUND',
  'CUSHION',
  'EMERALD',
  'PEAR',
  'OVAL',
  'PRINCESS',
  'HEART',
  'MARQUISE',
  'RADIANT',
  'ASSCHER',
  'BAGUETTE',
  'OTHER',
]);

export const DecimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val).trim())
  .refine((val) => /^-?\d+(\.\d+)?$/.test(val), {
    message: 'Must be a valid decimal number string',
  });

export const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (val) => Number(val) >= 0,
  { message: 'Must be a non-negative decimal value' }
);

export const CreateMetalRateInputSchema = z.object({
  metalType: MetalTypeSchema,
  purity: MetalPuritySchema,
  ratePerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Rate per gram must be greater than 0',
  }),
  source: z.string().min(2).max(120),
  sourceReference: z.string().max(240).optional(),
  isPlaceholder: z.boolean().default(true),
  effectiveAt: z.string().datetime().optional(),
});

export const CreateDiamondRateInputSchema = z.object({
  shape: z.union([DiamondShapeSchema, z.literal('ANY')]),
  sieveRange: z.string().max(50).optional(),
  sizeMinCarat: PositiveDecimalStringSchema,
  sizeMaxCarat: PositiveDecimalStringSchema,
  colorGrade: z.string().min(1).max(20),
  clarityGrade: z.string().min(1).max(20),
  cutGrade: z.string().min(1).max(30).default('EXCELLENT'),
  pricingType: z.enum(['PER_CARAT', 'FLAT_PER_STONE']).default('PER_CARAT'),
  rateInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Diamond rate must be greater than 0',
  }),
  isPlaceholder: z.boolean().default(true),
});

export const UpdateOwnerMarketRateCardSchema = z.object({
  gold14kPerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: '14K gold rate must be greater than 0',
  }),
  gold18kPerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: '18K gold rate must be greater than 0',
  }),
  gold22kPerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: '22K gold rate must be greater than 0',
  }),
  platinum950PerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Platinum (950) rate must be greater than 0',
  }),
  makingChargePerGramInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Making charge per gram must be greater than 0',
  }),
  diamondUnder1CaratPerCaratInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Diamond < 1.00 ct rate must be greater than 0',
  }),
  diamondOver1CaratPerCaratInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Diamond > 1.00 ct rate must be greater than 0',
  }),
  gold24kPerGramInr: PositiveDecimalStringSchema.optional(),
  diamondExact1CaratPerCaratInr: PositiveDecimalStringSchema.optional(),
  confirmPublish: z.boolean(),
  notes: z.string().max(400).optional(),
});

export const DiamondComponentInputSchema = z.object({
  componentName: z.string().min(1).default('Center / Accent Diamond'),
  shape: DiamondShapeSchema.default('ROUND'),
  stoneCount: z.number().int().min(1),
  totalCaratWeight: PositiveDecimalStringSchema,
  colorGrade: z.string().min(1).default('EF'),
  clarityGrade: z.string().min(1).default('VVS'),
  cutGrade: z.string().optional(),
  sieveSize: z.string().optional(),
  certification: z.string().optional(),
  rateOverridePerCaratInr: PositiveDecimalStringSchema.optional(),
});

export const UpdateProductJewellerySpecSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  metalType: MetalTypeSchema,
  metalPurity: MetalPuritySchema,
  metalColor: z
    .enum(['YELLOW_GOLD', 'ROSE_GOLD', 'WHITE_GOLD', 'TWO_TONE', 'PLATINUM', 'SILVER'])
    .default('ROSE_GOLD'),
  grossWeightGrams: PositiveDecimalStringSchema,
  netMetalWeightGrams: PositiveDecimalStringSchema,
  netWeightMode: z
    .enum(['EXPLICIT_NET_WEIGHT', 'GROSS_MINUS_STONE_WEIGHT'])
    .default('EXPLICIT_NET_WEIGHT'),
  diamondComponents: z.array(DiamondComponentInputSchema).default([]),
  makingChargeMode: z.enum([
    'PER_GRAM_NET',
    'PER_GRAM_GROSS',
    'PERCENTAGE_OF_METAL',
    'FLAT_PER_PIECE',
  ]),
  makingChargeValue: PositiveDecimalStringSchema,
  wastageMode: z
    .enum(['NONE', 'PERCENT_METAL_VALUE', 'PERCENT_METAL_WEIGHT', 'FLAT_GRAMS'])
    .default('NONE'),
  wastageValue: PositiveDecimalStringSchema.default('0'),
  certificationFeeInr: PositiveDecimalStringSchema.default('0'),
  hallmarkFeeInr: PositiveDecimalStringSchema.default('0'),
  fixedAdjustmentInr: DecimalStringSchema.default('0'),
  manualPriceOverrideInr: PositiveDecimalStringSchema.nullable().optional(),
  pricingEnabled: z.boolean().default(true),
});

export const CreatePricingRuleSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().min(3).max(500),
  isPlaceholderFormula: z.boolean().default(true),
  stoneWeightToGramsFactor: PositiveDecimalStringSchema.default('0.2'),
  gstRatePercent: PositiveDecimalStringSchema.default('3.00'),
  gstMode: z.enum(['INCLUSIVE', 'EXCLUSIVE']).default('INCLUSIVE'),
  roundingMode: z
    .enum(['NEAREST_1', 'NEAREST_10', 'NEAREST_99', 'NEAREST_100', 'NONE'])
    .default('NEAREST_1'),
  maxPriceDeltaPercentThreshold: PositiveDecimalStringSchema.default('15.00'),
  defaultCertificationFeeInr: PositiveDecimalStringSchema.default('0'),
  defaultHallmarkFeeInr: PositiveDecimalStringSchema.default('0'),
});

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export const CreateShipmentInputSchema = z.object({
  courierName: z.string().min(2).default('BlueDart Insured Jewellery Air'),
  declaredValueInr: PositiveDecimalStringSchema.optional(),
  packageWeightGrams: PositiveDecimalStringSchema.default('120'),
  isInsured: z.boolean().default(true),
});

export const CreateProductSchema = z.object({
  sku: z.string().min(2).max(60),
  title: z.string().min(3).max(200),
  handle: z.string().optional(),
  description: z.string().max(4000).optional(),
  productTag: z.string().max(80).optional(),
  category: z.string().min(2).default('Rings'),
  metalType: MetalTypeSchema.default('GOLD'),
  metalPurity: MetalPuritySchema.default('18K'),
  metalColor: z
    .enum(['YELLOW_GOLD', 'ROSE_GOLD', 'WHITE_GOLD', 'TWO_TONE', 'PLATINUM', 'SILVER'])
    .default('ROSE_GOLD'),
  ringSize: z.string().optional(),
  grossWeightGrams: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Gross weight must be > 0g',
  }),
  netMetalWeightGrams: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Net weight must be > 0g',
  }),
  makingChargeMode: z
    .enum(['PER_GRAM_NET', 'PER_GRAM_GROSS', 'PERCENTAGE_OF_METAL', 'FLAT_PER_PIECE'])
    .default('PER_GRAM_NET'),
  makingChargeValue: PositiveDecimalStringSchema.default('1650'),
  wastageMode: z
    .enum(['NONE', 'PERCENT_METAL_VALUE', 'PERCENT_METAL_WEIGHT', 'FLAT_GRAMS'])
    .default('NONE'),
  wastageValue: PositiveDecimalStringSchema.default('0'),
  certificationFeeInr: PositiveDecimalStringSchema.default('500'),
  hallmarkFeeInr: PositiveDecimalStringSchema.default('100'),
  diamondComponents: z.array(DiamondComponentInputSchema).default([]),
  inventoryQuantity: z.number().int().min(0).default(5),
  imageUrl: z.string().optional(),
  altImageUrl: z.string().optional(),
  manualPriceOverrideInr: PositiveDecimalStringSchema.nullable().optional(),
});

export const AdjustInventorySchema = z.object({
  sku: z.string().min(1),
  deltaQuantity: z.number().int().optional(),
  setQuantity: z.number().int().min(0).optional(),
  expectedQuantity: z.number().int().optional(),
  movementType: z
    .enum(['ADJUSTMENT', 'RESTOCK', 'RESERVATION', 'SALE_DEDUCTION', 'RETURN_RESTORE', 'CANCELLATION_RESTORE'])
    .default('ADJUSTMENT'),
  reason: z.string().min(2).max(240).default('Manual inventory adjustment via Admin'),
});

export const OrderTransitionSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  reason: z.string().max(250).optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
});

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'PRICING_OPERATOR']),
});

export const CustomerRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(8).max(20).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export const CustomerAddressSchema = z.object({
  label: z.string().default('Home'),
  recipientName: z.string().min(2),
  phone: z.string().min(8),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().min(6).max(10),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

export const CartItemInputSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  metalPurity: z.string().optional(),
  metalColor: z.string().optional(),
  ringSize: z.string().optional(),
  selections: z.record(z.string(), z.string().max(120)).optional(),
  customerDesignId: z.string().optional(),
});

export const CheckoutCreateOrderSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  shippingAddress: z.object({
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().min(6),
  }),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().min(1),
        ringSize: z.string().optional(),
        metalPurity: z.string().optional(),
        metalColor: z.string().optional(),
        selections: z.record(z.string(), z.string().max(120)).optional(),
        customerDesignId: z.string().optional(),
      })
    )
    .min(1),
  discountCode: z.string().optional(),
  paymentMethod: z.enum(['RAZORPAY', 'COD_STUDIO_PICKUP']).default('RAZORPAY'),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const RazorpayVerifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  orderAccessToken: z.string().optional(),
});

export const RazorpayRetryOrderSchema = z.object({
  orderAccessToken: z.string().optional(),
});

export const RefundCreateSchema = z.object({
  orderId: z.string().min(1),
  amountInr: PositiveDecimalStringSchema.refine((v) => Number(v) > 0, {
    message: 'Refund amount must be > 0',
  }),
  reason: z.string().min(3).max(300),
  restockItems: z.boolean().default(true),
});

// ============================================================================
// PHASE 2: CUSTOMIZATION, SAVED DESIGNS & MODEL ASSET SCHEMAS
// ============================================================================

export const CustomizationDependencyRuleSchema = z
  .object({
    requiresDiamondSupport: z.boolean().optional(),
    requiresEngravingSupport: z.boolean().optional(),
    allowedMetalTypes: z.array(MetalTypeSchema).optional(),
    allowedCategories: z.array(z.string()).optional(),
  })
  .optional();

export const CustomizationQuoteInputSchema = z.object({
  productHandleOrSku: z.string().min(1),
  variantId: z.string().optional(),
  selections: z.record(z.string(), z.string().max(120)).default({}),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const CreateCustomizationProfileSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  eligibleCategories: z.array(z.string().min(1)).default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const CreateCustomizationGroupSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  stepOrder: z.number().int().min(1).max(50).default(1),
  selectionMode: z.enum(['SINGLE', 'TEXT']).default('SINGLE'),
  optionCategory: z
    .enum([
      'METAL',
      'PURITY',
      'METAL_COLOR',
      'DIAMOND',
      'GEMSTONE',
      'SIZE',
      'FINISH',
      'SETTING',
      'ENGRAVING',
      'OTHER',
    ])
    .default('OTHER'),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  dependencyRule: CustomizationDependencyRuleSchema,
});

export const CreateCustomizationOptionSchema = z.object({
  code: z.string().min(2).max(60),
  label: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  value: z.string().min(1).max(120),
  swatchHex: z.string().max(20).optional(),
  imageUrl: z.string().max(500).optional(),
  priceRuleType: z
    .enum([
      'INCLUDED',
      'FIXED_INR',
      'PER_GRAM_INR',
      'PER_CARAT_INR',
      'PERCENT_OF_BASE',
      'METAL_RATE_PURITY',
    ])
    .default('INCLUDED'),
  priceRuleValue: z.union([z.string(), z.number()]).default('0'),
  metalType: MetalTypeSchema.optional(),
  metalPurity: MetalPuritySchema.optional(),
  metalColor: z.string().optional(),
  diamondShape: z.string().optional(),
  diamondCaratWeight: z.union([z.string(), z.number()]).optional(),
  diamondColorGrade: z.string().optional(),
  diamondClarityGrade: z.string().optional(),
  gemstoneType: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(500).default(1),
  eligibilityRule: CustomizationDependencyRuleSchema,
});

export const AssignProductCustomizationSchema = z.object({
  profileId: z.string().min(1),
  isCustomizable: z.boolean().default(true),
  allowDiamondSelection: z.boolean().default(true),
  allowEngraving: z.boolean().default(false),
  maxEngravingChars: z.number().int().min(0).max(80).default(20),
  disabledOptionCodes: z.array(z.string()).default([]),
});

export const CreateCustomerDesignSchema = z.object({
  productHandleOrSku: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  selections: z.record(z.string(), z.string().max(120)).default({}),
});

export const UpdateCustomerDesignSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  selections: z.record(z.string(), z.string().max(120)).optional(),
});

export const CartItemUpdateSchema = z.object({
  quantity: z.number().int().min(1).max(20).optional(),
  selections: z.record(z.string(), z.string().max(120)).optional(),
});

export const AssociateModelAssetSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['model/gltf-binary', 'model/gltf+json']).default('model/gltf-binary'),
  assetUrl: z.string().url(),
  previewImageUrl: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// ---------------------------------------------------------------------------
// Phase 3 List Pagination, Search, Filter & Date Range Schemas
// ---------------------------------------------------------------------------

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const ProductListQuerySchema = PaginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(25),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  category: z.string().trim().optional(),
  status: z.string().trim().optional(),
  metalType: z.string().trim().optional(),
  purity: z.string().trim().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

export const OrderListQuerySchema = PaginationQuerySchema.extend({
  financialStatus: z.string().trim().optional(),
  paymentStatus: z.string().trim().optional(),
  fulfillmentStatus: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  orderNumber: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
});

export const CustomerListQuerySchema = PaginationQuerySchema.extend({
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
});

export const InventoryListQuerySchema = PaginationQuerySchema.extend({
  category: z.string().trim().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});

export const AuditLogListQuerySchema = PaginationQuerySchema.extend({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorEmail: z.string().trim().optional(),
});

export const ImportCommitInputSchema = z.object({
  jobId: z.string().min(1),
  workbookHash: z.string().min(16),
  confirmCommit: z.literal(true),
});

export const DashboardOverviewQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y', 'all', 'custom']).default('30d'),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});




