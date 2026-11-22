import fs from 'node:fs';
import {
  optionalSeedPassword,
  SEED_ADMIN_PASSWORD_ENV,
  SEED_CUSTOMER_PASSWORD_ENV,
  unusableRandomPassword,
  type SeedAdminRole,
} from '../config/seed-credentials.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  calculateJewelleryPrice,
  ROLE_PERMISSIONS,
  type AdminRoleName,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MetalRateRecord,
  type PermissionCode,
  type PriceCalculationBreakdown,
  type PricingFormulaRule,
  type PricingRunStatus,
} from '@mrs/shared';

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AdminRoleName;
  permissions: PermissionCode[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  shopifyCollectionId: string;
  excelSheetName: string;
  description: string;
  productCount: number;
  displayOrder: number;
  isActive: boolean;
}

export interface PricingRunRecord {
  id: string;
  status: PricingRunStatus;
  ruleVersion: number;
  ruleId: string;
  notes: string;
  createdBy: string;
  validatedBy?: string | null;
  validatedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  summary: {
    totalProducts: number;
    increasedCount: number;
    decreasedCount: number;
    unchangedCount: number;
    flaggedThresholdCount: number;
    isPlaceholderRun: boolean;
  };
  items: Array<{
    sku: string;
    title: string;
    shopifyVariantGid: string;
    oldPriceInr: string;
    proposedPriceInr: string;
    priceDeltaInr: string;
    priceDeltaPercent: string;
    exceedsThreshold: boolean;
    breakdown: PriceCalculationBreakdown;
  }>;
}

export interface PricingSnapshotRecord {
  id: string;
  sku: string;
  shopifyVariantGid: string;
  pricingRunId: string;
  formulaVersion: number;
  publishedPriceInr: string;
  currency: 'INR';
  breakdown: PriceCalculationBreakdown;
  publishedBy: string;
  publishedAt: string;
}

export interface ImportErrorItem {
  sheetName: string;
  rowNumber: number;
  sku: string;
  field: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface ImportPreviewItem {
  sheetName: string;
  rowNumber: number;
  sku: string;
  handle: string;
  title: string;
  category: string;
  metalPurity: string;
  grossWeightGrams: string;
  netMetalWeightGrams: string;
  diamondCarats: string;
  diamondCount: number;
  makingChargeMode: string;
  makingChargeValue: string;
  calculatedPreviewPriceInr: string;
  status: 'VALID' | 'DUPLICATE_SKU' | 'INVALID';
  messages: string[];
}

export interface ImportJobRecord {
  id: string;
  sourceFileName: string;
  workbookHash?: string;
  expiresAt?: string;
  committedAt?: string;
  committedBy?: string;
  committedProductsCount?: number;
  status:
    | 'DRY_RUN_COMPLETED'
    | 'PREVIEWED'
    | 'IMPORTED_TO_STAGING'
    | 'COMMITTED'
    | 'SYNCED_TO_SHOPIFY'
    | 'FAILED'
    | 'ROLLED_BACK'
    | 'EXPIRED';
  dryRun: boolean;
  detectedSheets: Array<{
    sheetName: string;
    mappedCategory: string;
    rowCount: number;
    validCount: number;
    errorCount: number;
  }>;
  totalRows: number;
  validRows: number;
  failedRows: number;
  duplicateSkus: number;
  processedRows: number;
  previewItems: ImportPreviewItem[];
  errors: ImportErrorItem[];
  validNewProducts?: JewelleryProductSpec[];
  createdBy: string;
  createdAt: string;
  completedAt: string;
}

export interface CustomerAddressRecord {
  id: string;
  customerId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerRecord {
  id: string;
  shopifyCustomerGid?: string;
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: string;
  emailVerificationLastSentAt?: string;
  totalOrdersCount: number;
  totalSpentInr: string;
  tags: string[];
  addresses?: CustomerAddressRecord[];
  createdAt: string;
}

export interface CollectionRecord {
  id: string;
  handle: string;
  title: string;
  description: string;
  imageUrl: string;
  isFeatured: boolean;
  isActive: boolean;
  productSkus: string[];
}

export interface InventoryMovementRecord {
  id: string;
  sku: string;
  title: string;
  movementType: 'ADJUSTMENT' | 'RESTOCK' | 'RESERVATION' | 'SALE_DEDUCTION' | 'RETURN_RESTORE' | 'CANCELLATION_RESTORE';
  deltaQuantity: number;
  previousAvailable: number;
  newAvailable: number;
  reason: string;
  referenceId?: string;
  actorEmail: string;
  createdAt: string;
}

export interface CartItemRecord {
  id: string;
  sku: string;
  handle: string;
  title: string;
  imageUrl: string;
  quantity: number;
  unitPriceInr: string;
  lineTotalInr: string;
  metalPurity: string;
  metalColor: string;
  ringSize: string;
  customizationSelections?: Record<string, string>;
  customizationSnapshot?: unknown[];
  pricingBreakdown?: unknown[];
  customerDesignId?: string;
}

export interface CartRecord {
  id: string;
  customerId?: string;
  items: CartItemRecord[];
  discountCode?: string;
  discountAmountInr: string;
  subtotalInr: string;
  taxAmountInr: string;
  totalInr: string;
  updatedAt: string;
}

export interface RefundRecordItem {
  id: string;
  orderId: string;
  orderNumber: string;
  paymentId: string;
  providerRefundId: string;
  amountInr: string;
  reason: string;
  status: 'PROCESSED' | 'INITIATED' | 'FAILED';
  initiatedByEmail: string;
  processedAt: string;
}

export interface NotificationRecord {
  id: string;
  recipientEmail: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'ADMIN_ALERT';
  templateCode: string;
  subject: string;
  body: string;
  status: 'SENT' | 'QUEUED';
  sentAt: string;
}

export interface OrderRecord {
  id: string;
  shopifyOrderGid?: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  totalPriceInr: string;
  subtotalPriceInr: string;
  totalTaxInr: string;
  financialStatus: 'PAID' | 'PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  fulfillmentStatus:
    | 'UNFULFILLED'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'FULFILLED'
    | 'CANCELLED';
  paymentGateway: string;
  idempotencyKey?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  lineItems: Array<{
    sku: string;
    title: string;
    quantity: number;
    purchaseTimePriceInr: string;
    metalPurity: string;
    diamondCarats: string;
    pricingSnapshotId: string;
    customizationSnapshot?: unknown[];
    customerDesignId?: string;
  }>;
  placedAt: string;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  shopifyOrderGid?: string;
  provider: 'SHIPROCKET';
  shiprocketOrderId: string;
  shipmentId: string;
  awbCode: string;
  courierName: string;
  declaredValueInr: string;
  isInsured: boolean;
  packageWeightGrams: string;
  labelUrl: string;
  manifestUrl: string;
  trackingUrl: string;
  status: 'CREATED' | 'AWB_ASSIGNED' | 'PICKUP_SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'RTO' | 'CANCELLED';
  latestMilestone: string;
  trackingHistory: Array<{
    timestamp: string;
    location: string;
    status: string;
    remarks: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecordItem {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: 'RAZORPAY' | 'RAZORPAY_SHOPIFY_CHECKOUT';
  providerPaymentId: string;
  amountInr: string;
  currency: 'INR';
  method: string;
  status: 'CAPTURED' | 'AUTHORIZED' | 'REFUNDED' | 'FAILED';
  signatureVerified: boolean;
  capturedAt: string;
}

export interface DiscountRecord {
  id: string;
  code: string;
  title: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'MAKING_CHARGE_WAIVER';
  value: string;
  minOrderAmountInr: string;
  appliesTo: string;
  isActive: boolean;
  usageCount: number;
  startsAt: string;
  endsAt?: string;
}

export interface BannerRecord {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  placement: string;
  sectionFile: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
  isActive: boolean;
  updatedAt: string;
}

export interface ContentRecord {
  id: string;
  slug: string;
  title: string;
  sectionType: 'EDITORIAL' | 'POLICY' | 'TRUST_PILLAR' | 'STORE_LOCATION';
  liquidSection: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface StoreSettingsRecord {
  storeName: string;
  legalEntityName: string;
  foundedYear: number;
  shopifyDomain: string;
  shopifyPlan: 'Shopify Basic';
  shopifyApiVersion: string;
  shopifyLiveWritesEnabled: boolean;
  currency: 'INR';
  defaultGstPercent: string;
  requireOwnerApprovalForPricing: boolean;
  maxAutoPriceSwingPercent: string;
  shiprocketEnabled: boolean;
  shiprocketPickupLocation: string;
  shiprocketHighValueInsuranceEnabled: boolean;
  razorpayViaShopifyCheckout: boolean;
  announcementBarText: string;
  announcementBarBgColor: string;
  primaryBrandColor: string;
  secondaryPeachColor: string;
}

export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorRole: AdminRoleName | 'CUSTOMER' | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
}

export interface IntegrationEventRecord {
  id: string;
  provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY';
  eventId: string;
  eventType: string;
  payloadHash: string;
  status: 'PROCESSED' | 'IGNORED_DUPLICATE' | 'IGNORED_MISMATCH';
  receivedAt: string;
}

export interface PlatformState {
  users: AdminUserRecord[];
  categories: CategoryRecord[];
  collections: CollectionRecord[];
  metalRates: MetalRateRecord[];
  diamondRates: DiamondRateMatrixEntry[];
  pricingRules: PricingFormulaRule[];
  products: JewelleryProductSpec[];
  inventoryMovements: InventoryMovementRecord[];
  pricingRuns: PricingRunRecord[];
  pricingSnapshots: PricingSnapshotRecord[];
  importJobs: ImportJobRecord[];
  customers: CustomerRecord[];
  carts: Record<string, CartRecord>;
  wishlists: Record<string, string[]>;
  orders: OrderRecord[];
  shipments: ShipmentRecord[];
  payments: PaymentRecordItem[];
  refunds: RefundRecordItem[];
  discounts: DiscountRecord[];
  banners: BannerRecord[];
  contents: ContentRecord[];
  notifications: NotificationRecord[];
  settings: StoreSettingsRecord;
  auditLogs: AuditLogRecord[];
  integrationEvents: IntegrationEventRecord[];
  customizationProfiles?: import('@mrs/shared').CustomizationProfileRecord[];
  productCustomizationAssignments?: import('@mrs/shared').ProductCustomizationAssignmentRecord[];
  customerDesigns?: import('@mrs/shared').CustomerDesignRecord[];
  productModelAssets?: import('@mrs/shared').ProductModelAssetRecord[];
}

const SCRYPT_PREFIX = 'scrypt$';
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, keyHex] = parts;
    if (!salt || !keyHex || keyHex.length % 2 !== 0) return false;
    try {
      const expectedBuf = Buffer.from(keyHex, 'hex');
      if (expectedBuf.length === 0) return false;
      const derivedBuf = crypto.scryptSync(password, salt, expectedBuf.length);
      if (expectedBuf.length !== derivedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, derivedBuf);
    } catch {
      return false;
    }
  }

  // Migration-compatible verification for existing SHA-256 hashes in .data/platform-state.json
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const legacyHex = crypto
      .createHash('sha256')
      .update(`mrs_salt_${password}`)
      .digest('hex');
    const expectedBuf = Buffer.from(storedHash.toLowerCase(), 'hex');
    const candidateBuf = Buffer.from(legacyHex.toLowerCase(), 'hex');
    if (expectedBuf.length !== candidateBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, candidateBuf);
  }

  return false;
}

// Seed credentials come from environment variables only (see config/seed-credentials.ts). Without them the
// seeded accounts get an unusable random password: no hard-coded or fallback password exists in source.
let seedCredentialWarningShown = false;
function warnSeedCredentialsMissing(name: string): void {
  if (seedCredentialWarningShown || process.env.VITEST) return;
  seedCredentialWarningShown = true;
  console.warn(`[Mangal Royal Studio] ${name} (and related MRS_SEED_* variables) not set: seeded accounts are locked until a password is set.`);
}
function seedAdminPasswordHash(role: SeedAdminRole): string {
  const name = SEED_ADMIN_PASSWORD_ENV[role];
  const configured = optionalSeedPassword(name);
  if (!configured) warnSeedCredentialsMissing(name);
  return hashPassword(configured ?? unusableRandomPassword());
}
function seedCustomerPasswordHash(): string {
  const configured = optionalSeedPassword(SEED_CUSTOMER_PASSWORD_ENV);
  return hashPassword(configured ?? unusableRandomPassword());
}

function createInitialSeedState(): PlatformState {
  const now = '2026-11-05T10:00:00.000Z';

  const users: AdminUserRecord[] = [
    {
      id: 'usr-owner-1',
      email: 'owner@mangalroyalstudio.com',
      passwordHash: seedAdminPasswordHash('OWNER'),
      displayName: 'Mangal Royal Studio — Owner',
      role: 'OWNER',
      permissions: ROLE_PERMISSIONS.OWNER,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
    },
    {
      id: 'usr-manager-1',
      email: 'manager@mangalroyalstudio.com',
      passwordHash: seedAdminPasswordHash('MANAGER'),
      displayName: 'Store Operations Manager',
      role: 'MANAGER',
      permissions: ROLE_PERMISSIONS.MANAGER,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
    },
    {
      id: 'usr-operator-1',
      email: 'pricing@mangalroyalstudio.com',
      passwordHash: seedAdminPasswordHash('PRICING_OPERATOR'),
      displayName: 'Bullion & Diamond Pricing Operator',
      role: 'PRICING_OPERATOR',
      permissions: ROLE_PERMISSIONS.PRICING_OPERATOR,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
    },
  ];

  // 11 Categories aligned with the 11 sheets of MANGAL JEWELLERY.xlsx & theme
  const categories: CategoryRecord[] = [
    {
      id: 'cat-rings',
      name: 'Rings',
      slug: 'rings',
      shopifyCollectionId: 'gid://shopify/Collection/3001',
      excelSheetName: 'Rings',
      description: 'IGI-certified lab-grown diamond engagement, solitaire & cocktail rings.',
      productCount: 4,
      displayOrder: 1,
      isActive: true,
    },
    {
      id: 'cat-earrings',
      name: 'Earrings',
      slug: 'earrings',
      shopifyCollectionId: 'gid://shopify/Collection/3002',
      excelSheetName: 'Earrings',
      description: 'Solitaire studs, drops, hoops & chandelier earrings.',
      productCount: 2,
      displayOrder: 2,
      isActive: true,
    },
    {
      id: 'cat-pendants',
      name: 'Pendants',
      slug: 'pendants',
      shopifyCollectionId: 'gid://shopify/Collection/3003',
      excelSheetName: 'Pendants',
      description: 'Everyday diamond pendants and solitaire necklaces.',
      productCount: 2,
      displayOrder: 3,
      isActive: true,
    },
    {
      id: 'cat-necklaces',
      name: 'Necklaces',
      slug: 'necklaces',
      shopifyCollectionId: 'gid://shopify/Collection/3004',
      excelSheetName: 'Necklaces',
      description: 'Bridal & heritage lab-grown diamond tennis and statement necklaces.',
      productCount: 1,
      displayOrder: 4,
      isActive: true,
    },
    {
      id: 'cat-bracelets',
      name: 'Bracelets',
      slug: 'bracelets',
      shopifyCollectionId: 'gid://shopify/Collection/3005',
      excelSheetName: 'Bracelets',
      description: 'Tennis bracelets and delicate everyday diamond wristwear.',
      productCount: 1,
      displayOrder: 5,
      isActive: true,
    },
    {
      id: 'cat-bangles',
      name: 'Bangles',
      slug: 'bangles',
      shopifyCollectionId: 'gid://shopify/Collection/3006',
      excelSheetName: 'Bangles',
      description: 'Crafted gold & diamond kadas and stackable bangles.',
      productCount: 1,
      displayOrder: 6,
      isActive: true,
    },
    {
      id: 'cat-mangalsutra',
      name: 'Mangalsutra',
      slug: 'mangalsutra',
      shopifyCollectionId: 'gid://shopify/Collection/3007',
      excelSheetName: 'Mangalsutra',
      description: 'Contemporary lab-grown diamond mangalsutra necklaces & bracelets.',
      productCount: 1,
      displayOrder: 7,
      isActive: true,
    },
    {
      id: 'cat-solitaires',
      name: 'Solitaires',
      slug: 'solitaires',
      shopifyCollectionId: 'gid://shopify/Collection/3008',
      excelSheetName: 'Solitaires',
      description: 'Signature IGI-certified single-stone diamond creations.',
      productCount: 1,
      displayOrder: 8,
      isActive: true,
    },
    {
      id: 'cat-nose-pins',
      name: 'Nose Pins',
      slug: 'nose-pins',
      shopifyCollectionId: 'gid://shopify/Collection/3009',
      excelSheetName: 'Nose Pins',
      description: 'Delicate diamond nose pins and studs in 18K gold.',
      productCount: 1,
      displayOrder: 9,
      isActive: true,
    },
    {
      id: 'cat-chains',
      name: 'Chains',
      slug: 'chains',
      shopifyCollectionId: 'gid://shopify/Collection/3010',
      excelSheetName: 'Chains',
      description: '14K & 18K solid gold chains paired with diamond stations.',
      productCount: 1,
      displayOrder: 10,
      isActive: true,
    },
    {
      id: 'cat-antique',
      name: 'Antique',
      slug: 'antique',
      shopifyCollectionId: 'gid://shopify/Collection/3011',
      excelSheetName: 'Antique',
      description: 'Heritage heirloom designs inspired by five decades of Mangal Royal Jewels.',
      productCount: 1,
      displayOrder: 11,
      isActive: true,
    },
  ];

  // Configurable Placeholder Metal Rates (explicitly marked isPlaceholder: true)
  const metalRates: MetalRateRecord[] = [
    {
      id: 'mr-24k',
      metalType: 'GOLD',
      purity: '24K',
      ratePerGramInr: '7650.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable 24K Bullion Benchmark Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'mr-22k',
      metalType: 'GOLD',
      purity: '22K',
      ratePerGramInr: '7015.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable 22K (91.6%) Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'mr-18k',
      metalType: 'GOLD',
      purity: '18K',
      ratePerGramInr: '5740.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable 18K (75.0%) Fine Diamond Jewellery Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'mr-14k',
      metalType: 'GOLD',
      purity: '14K',
      ratePerGramInr: '4475.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable 14K (58.5%) Everyday Diamond Jewellery Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'mr-silver-925',
      metalType: 'SILVER',
      purity: '925_SILVER',
      ratePerGramInr: '95.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable 925 Sterling Silver Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'mr-plat-950',
      metalType: 'PLATINUM',
      purity: '950_PLATINUM',
      ratePerGramInr: '3450.00',
      currency: 'INR',
      source: 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
      sourceReference: 'Configurable Pt950 Platinum Placeholder',
      isPlaceholder: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
  ];

  const diamondRates: DiamondRateMatrixEntry[] = [
    {
      id: 'dr-melee-ef-vvs',
      shape: 'ANY',
      sieveRange: '-2 to +11 (0.005 - 0.07 ct)',
      sizeMinCarat: '0.001',
      sizeMaxCarat: '0.080',
      colorGrade: 'EF',
      clarityGrade: 'VVS',
      cutGrade: 'EXCELLENT',
      pricingType: 'PER_CARAT',
      rateInr: '16500.00',
      currency: 'INR',
      version: 1,
      isPlaceholder: true,
      isActive: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'dr-pointers-ef-vvs',
      shape: 'ANY',
      sieveRange: 'Pointers (0.081 - 0.49 ct)',
      sizeMinCarat: '0.081',
      sizeMaxCarat: '0.499',
      colorGrade: 'EF',
      clarityGrade: 'VVS',
      cutGrade: 'EXCELLENT',
      pricingType: 'PER_CARAT',
      rateInr: '19500.00',
      currency: 'INR',
      version: 1,
      isPlaceholder: true,
      isActive: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'dr-solitaire-round-ef-vvs',
      shape: 'ROUND',
      sieveRange: 'Solitaire (0.50 - 3.00 ct)',
      sizeMinCarat: '0.500',
      sizeMaxCarat: '5.000',
      colorGrade: 'EF',
      clarityGrade: 'VVS',
      cutGrade: 'EXCELLENT',
      pricingType: 'PER_CARAT',
      rateInr: '24500.00',
      currency: 'INR',
      version: 1,
      isPlaceholder: true,
      isActive: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'dr-fancy-solitaire-ef-vvs',
      shape: 'ANY',
      sieveRange: 'Fancy Cut Solitaire (0.50 - 5.00 ct)',
      sizeMinCarat: '0.500',
      sizeMaxCarat: '5.000',
      colorGrade: 'EF',
      clarityGrade: 'VVS',
      cutGrade: 'EXCELLENT',
      pricingType: 'PER_CARAT',
      rateInr: '26000.00',
      currency: 'INR',
      version: 1,
      isPlaceholder: true,
      isActive: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
    {
      id: 'dr-any-gh-vs',
      shape: 'ANY',
      sieveRange: 'All Sizes GH-VS',
      sizeMinCarat: '0.001',
      sizeMaxCarat: '5.000',
      colorGrade: 'GH',
      clarityGrade: 'VS',
      cutGrade: 'VERY_GOOD',
      pricingType: 'PER_CARAT',
      rateInr: '14800.00',
      currency: 'INR',
      version: 1,
      isPlaceholder: true,
      isActive: true,
      effectiveAt: now,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
    },
  ];

  const pricingRules: PricingFormulaRule[] = [
    {
      id: 'rule-v1',
      version: 1,
      name: 'MRS Standard Lab-Grown Jewellery Formula v1 (Placeholder)',
      description:
        'Configurable placeholder rule: Payable Metal (Net Weight × Purity Rate + Wastage) + Lab-Grown Diamond Matrix Value + Making Charges + Certification/Hallmark Fees + 3.00% GST, rounded to nearest ₹1.',
      status: 'APPROVED',
      isPlaceholderFormula: true,
      stoneWeightToGramsFactor: '0.2000',
      gstRatePercent: '3.00',
      gstMode: 'INCLUSIVE',
      roundingMode: 'NEAREST_1',
      maxPriceDeltaPercentThreshold: '15.00',
      defaultCertificationFeeInr: '500.00',
      defaultHallmarkFeeInr: '100.00',
      approvedBy: 'owner@mangalroyalstudio.com',
      approvedAt: now,
      createdAt: now,
    },
  ];

  const products: JewelleryProductSpec[] = [
    {
      id: 'prod-mrs-001',
      sku: 'MRS-RNG-1001',
      handle: 'royal-celeste-solitaire-ring',
      title: 'Royal Celeste 1.50 ct IGI Lab-Grown Solitaire Ring',
      category: 'Rings',
      shopifyProductGid: 'gid://shopify/Product/801001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/901001',
      currentShopifyPriceInr: '68500.00',
      compareAtPriceInr: '74900.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'ROSE_GOLD',
      grossWeightGrams: '4.150',
      netMetalWeightGrams: '3.800',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Center Round Solitaire',
          shape: 'ROUND',
          stoneCount: 1,
          totalCaratWeight: '1.500',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
          cutGrade: 'EXCELLENT',
          certification: 'IGI',
        },
        {
          componentName: 'Hidden Halo Melee',
          shape: 'ROUND',
          stoneCount: 16,
          totalCaratWeight: '0.250',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1250.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '750.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 6,
      ringSize: '12',
      isFeaturedBestseller: true,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png',
      galleryImages: [
        'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
        'https://i1dtfi-iv.myshopify.com/cdn/shop/files/0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png',
        'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg',
      ],
      updatedAt: now,
    },
    {
      id: 'prod-mrs-002',
      sku: 'MRS-RNG-1002',
      handle: 'imperial-emerald-cut-halo-ring',
      title: 'Imperial Emerald-Cut Halo Engagement Ring',
      category: 'Rings',
      shopifyProductGid: 'gid://shopify/Product/801002',
      shopifyVariantGid: 'gid://shopify/ProductVariant/901002',
      currentShopifyPriceInr: '56900.00',
      compareAtPriceInr: '62000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'WHITE_GOLD',
      grossWeightGrams: '3.840',
      netMetalWeightGrams: '3.600',
      netWeightMode: 'GROSS_MINUS_STONE_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Center Emerald Cut',
          shape: 'EMERALD',
          stoneCount: 1,
          totalCaratWeight: '1.000',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
          certification: 'IGI',
        },
        {
          componentName: 'Halo & Shank Accents',
          shape: 'ROUND',
          stoneCount: 20,
          totalCaratWeight: '0.200',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1200.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '600.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 4,
      ringSize: '14',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-003',
      sku: 'MRS-EAR-2001',
      handle: 'lumiere-solitaire-diamond-studs',
      title: 'Lumière 1.00 ct tw Classic Solitaire Diamond Studs',
      category: 'Earrings',
      shopifyProductGid: 'gid://shopify/Product/802001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/902001',
      currentShopifyPriceInr: '34500.00',
      compareAtPriceInr: '38900.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'YELLOW_GOLD',
      grossWeightGrams: '2.300',
      netMetalWeightGrams: '2.100',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Matched Solitaire Pair',
          shape: 'ROUND',
          stoneCount: 2,
          totalCaratWeight: '1.000',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
          certification: 'IGI',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1100.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '500.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 9,
      isFeaturedBestseller: true,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-004',
      sku: 'MRS-BRC-3001',
      handle: 'eternity-riviera-tennis-bracelet',
      title: 'Eternity Riviera 4.00 ct Lab-Grown Tennis Bracelet',
      category: 'Bracelets',
      shopifyProductGid: 'gid://shopify/Product/803001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/903001',
      currentShopifyPriceInr: '142000.00',
      compareAtPriceInr: '158000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'ROSE_GOLD',
      grossWeightGrams: '11.200',
      netMetalWeightGrams: '10.400',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Graduated Round Tennis Line',
          shape: 'ROUND',
          stoneCount: 52,
          totalCaratWeight: '4.000',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
          certification: 'IGI',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1350.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '1000.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 3,
      isFeaturedBestseller: true,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/6158221b28f34134f5119c8a750d12eceab5003b.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/ecc2833a188c54ecfc769f015891cdb3ae75bd69.jpg',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-005',
      sku: 'MRS-PND-4001',
      handle: 'aria-pear-drop-diamond-pendant',
      title: 'Aria Pear-Drop Daily Diamond Pendant',
      category: 'Pendants',
      shopifyProductGid: 'gid://shopify/Product/804001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/904001',
      currentShopifyPriceInr: '14800.00',
      compareAtPriceInr: '16500.00',
      metalType: 'GOLD',
      metalPurity: '14K',
      metalColor: 'ROSE_GOLD',
      grossWeightGrams: '1.680',
      netMetalWeightGrams: '1.600',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Pear Center & Halo',
          shape: 'PEAR',
          stoneCount: 9,
          totalCaratWeight: '0.320',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'FLAT_PER_PIECE',
      makingChargeValue: '1800.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '350.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 14,
      isFeaturedBestseller: true,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c28d5704abb507036c26701c54ae84ffc8656ea8_1.jpg',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-006',
      sku: 'MRS-BNG-5001',
      handle: 'maharani-heritage-diamond-kada-bangle',
      title: 'Maharani Heritage Lab-Grown Diamond Kada Bangle',
      category: 'Bangles',
      shopifyProductGid: 'gid://shopify/Product/805001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/905001',
      currentShopifyPriceInr: '128500.00',
      compareAtPriceInr: '139000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'YELLOW_GOLD',
      grossWeightGrams: '14.500',
      netMetalWeightGrams: '13.900',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Flush & Pavé Set Diamonds',
          shape: 'ROUND',
          stoneCount: 44,
          totalCaratWeight: '2.100',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PERCENTAGE_OF_METAL',
      makingChargeValue: '14.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '800.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 2,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/bcc9181711e9062c42a1984945aa96643c4c1ac8.jpg',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-007',
      sku: 'MRS-NCK-6001',
      handle: 'regal-cascade-bridal-diamond-necklace',
      title: 'Regal Cascade Bridal Lab-Grown Diamond Necklace',
      category: 'Necklaces',
      shopifyProductGid: 'gid://shopify/Product/806001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/906001',
      currentShopifyPriceInr: '264000.00',
      compareAtPriceInr: '285000.00',
      metalType: 'GOLD',
      metalPurity: '18K',
      metalColor: 'WHITE_GOLD',
      grossWeightGrams: '26.400',
      netMetalWeightGrams: '24.800',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Graduated Pear & Round Suite',
          shape: 'PEAR',
          stoneCount: 96,
          totalCaratWeight: '5.800',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PER_GRAM_NET',
      makingChargeValue: '1400.00',
      wastageMode: 'NONE',
      wastageValue: '0',
      certificationFeeInr: '1500.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 1,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/832f60664a5381eb7addb5fef2ce71e8ae897c6f_1.jpg',
      updatedAt: now,
    },
    {
      id: 'prod-mrs-008',
      sku: 'MRS-ANT-7001',
      handle: '1975-founder-edition-heirloom-choker',
      title: '1975 Founder Edition Antique Polki & Diamond Choker',
      category: 'Antique',
      shopifyProductGid: 'gid://shopify/Product/807001',
      shopifyVariantGid: 'gid://shopify/ProductVariant/907001',
      currentShopifyPriceInr: '198000.00',
      compareAtPriceInr: '215000.00',
      metalType: 'GOLD',
      metalPurity: '22K',
      metalColor: 'YELLOW_GOLD',
      grossWeightGrams: '21.800',
      netMetalWeightGrams: '20.900',
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: [
        {
          componentName: 'Rose-Cut & Cushion Diamonds',
          shape: 'CUSHION',
          stoneCount: 38,
          totalCaratWeight: '2.400',
          colorGrade: 'EF',
          clarityGrade: 'VVS',
        },
      ],
      makingChargeMode: 'PERCENTAGE_OF_METAL',
      makingChargeValue: '16.00',
      wastageMode: 'PERCENT_METAL_VALUE',
      wastageValue: '3.00',
      certificationFeeInr: '1200.00',
      hallmarkFeeInr: '100.00',
      fixedAdjustmentInr: '0',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 2,
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955.png',
      altImageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
      updatedAt: now,
    },
  ];

  const activeRule = pricingRules[0]!;
  const initialRunItems = products.map((product) => {
    const breakdown = calculateJewelleryPrice({
      product,
      metalRates,
      diamondRates,
      rule: activeRule,
    });
    return {
      sku: product.sku,
      title: product.title,
      shopifyVariantGid: product.shopifyVariantGid,
      oldPriceInr: breakdown.oldPriceInr,
      proposedPriceInr: breakdown.finalProposedPriceInr,
      priceDeltaInr: breakdown.priceDeltaInr,
      priceDeltaPercent: breakdown.priceDeltaPercent,
      exceedsThreshold: breakdown.exceedsMaxDeltaThreshold,
      breakdown,
    };
  });

  const pricingRuns: PricingRunRecord[] = [
    {
      id: 'run-initial-001',
      status: 'VALIDATED',
      ruleVersion: activeRule.version,
      ruleId: activeRule.id,
      notes: 'Initial baseline pricing run using configurable placeholder rates — awaiting Owner Approval.',
      createdBy: 'pricing@mangalroyalstudio.com',
      validatedBy: 'manager@mangalroyalstudio.com',
      validatedAt: now,
      approvedBy: null,
      approvedAt: null,
      publishedBy: null,
      publishedAt: null,
      createdAt: now,
      summary: {
        totalProducts: initialRunItems.length,
        increasedCount: initialRunItems.filter((i) => Number(i.priceDeltaInr) > 0).length,
        decreasedCount: initialRunItems.filter((i) => Number(i.priceDeltaInr) < 0).length,
        unchangedCount: initialRunItems.filter((i) => Number(i.priceDeltaInr) === 0).length,
        flaggedThresholdCount: initialRunItems.filter((i) => i.exceedsThreshold).length,
        isPlaceholderRun: true,
      },
      items: initialRunItems,
    },
  ];

  const pricingSnapshots: PricingSnapshotRecord[] = initialRunItems.slice(0, 3).map((item, idx) => ({
    id: `snap-00${idx + 1}`,
    sku: item.sku,
    shopifyVariantGid: item.shopifyVariantGid,
    pricingRunId: 'run-initial-001',
    formulaVersion: 1,
    publishedPriceInr: item.oldPriceInr,
    currency: 'INR',
    breakdown: item.breakdown,
    publishedBy: 'owner@mangalroyalstudio.com',
    publishedAt: now,
  }));

  const customers: CustomerRecord[] = [
    {
      id: 'cust-001',
      shopifyCustomerGid: 'gid://shopify/Customer/7001',
      email: 'ananya.sharma@example.com',
      passwordHash: seedCustomerPasswordHash(),
      firstName: 'Ananya',
      lastName: 'Sharma',
      phone: '+91 98201 44510',
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true,
      emailVerified: false,
      totalOrdersCount: 2,
      totalSpentInr: '103000.00',
      tags: ['VIP', 'Bridal Consultation', 'IGI Verified Buyer'],
      createdAt: now,
    },
    {
      id: 'cust-002',
      shopifyCustomerGid: 'gid://shopify/Customer/7002',
      email: 'rohan.mehta@example.com',
      passwordHash: seedCustomerPasswordHash(),
      firstName: 'Rohan',
      lastName: 'Mehta',
      phone: '+91 98112 77890',
      city: 'New Delhi',
      state: 'Delhi',
      isActive: true,
      emailVerified: false,
      totalOrdersCount: 1,
      totalSpentInr: '56900.00',
      tags: ['Engagement Ring', 'First Time Buyer'],
      createdAt: now,
    },
    {
      id: 'cust-003',
      shopifyCustomerGid: 'gid://shopify/Customer/7003',
      email: 'priya.desai@example.com',
      passwordHash: seedCustomerPasswordHash(),
      firstName: 'Priya',
      lastName: 'Desai',
      phone: '+91 99250 33120',
      city: 'Ahmedabad',
      state: 'Gujarat',
      isActive: true,
      emailVerified: false,
      totalOrdersCount: 3,
      totalSpentInr: '188400.00',
      tags: ['Repeat Collector', 'At-Home Trial'],
      createdAt: now,
    },
  ];

  const orders: OrderRecord[] = [
    {
      id: 'ord-1041',
      shopifyOrderGid: 'gid://shopify/Order/5501041',
      orderNumber: 'MRS-1041',
      customerId: 'cust-001',
      customerName: 'Ananya Sharma',
      customerEmail: 'ananya.sharma@example.com',
      customerPhone: '+91 98201 44510',
      shippingCity: 'Mumbai',
      shippingState: 'Maharashtra',
      shippingPincode: '400050',
      totalPriceInr: '68500.00',
      subtotalPriceInr: '66504.85',
      totalTaxInr: '1995.15',
      financialStatus: 'PAID',
      fulfillmentStatus: 'IN_TRANSIT',
      paymentGateway: 'Razorpay (Shopify Hosted Checkout)',
      razorpayPaymentId: 'pay_MrsRzp99201441',
      lineItems: [
        {
          sku: 'MRS-RNG-1001',
          title: 'Royal Celeste 1.50 ct IGI Lab-Grown Solitaire Ring',
          quantity: 1,
          purchaseTimePriceInr: '68500.00',
          metalPurity: '18K Rose Gold',
          diamondCarats: '1.750 ct tw (EF-VVS)',
          pricingSnapshotId: 'snap-001',
        },
      ],
      placedAt: '2026-11-04T14:20:00.000Z',
    },
    {
      id: 'ord-1042',
      shopifyOrderGid: 'gid://shopify/Order/5501042',
      orderNumber: 'MRS-1042',
      customerId: 'cust-002',
      customerName: 'Rohan Mehta',
      customerEmail: 'rohan.mehta@example.com',
      customerPhone: '+91 98112 77890',
      shippingCity: 'New Delhi',
      shippingState: 'Delhi',
      shippingPincode: '110016',
      totalPriceInr: '56900.00',
      subtotalPriceInr: '55242.72',
      totalTaxInr: '1657.28',
      financialStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      paymentGateway: 'Razorpay (Shopify Hosted Checkout)',
      razorpayPaymentId: 'pay_MrsRzp99201442',
      lineItems: [
        {
          sku: 'MRS-RNG-1002',
          title: 'Imperial Emerald-Cut Halo Engagement Ring',
          quantity: 1,
          purchaseTimePriceInr: '56900.00',
          metalPurity: '18K White Gold',
          diamondCarats: '1.200 ct tw (EF-VVS)',
          pricingSnapshotId: 'snap-002',
        },
      ],
      placedAt: '2026-11-05T08:15:00.000Z',
    },
    {
      id: 'ord-1043',
      shopifyOrderGid: 'gid://shopify/Order/5501043',
      orderNumber: 'MRS-1043',
      customerId: 'cust-003',
      customerName: 'Priya Desai',
      customerEmail: 'priya.desai@example.com',
      customerPhone: '+91 99250 33120',
      shippingCity: 'Ahmedabad',
      shippingState: 'Gujarat',
      shippingPincode: '380009',
      totalPriceInr: '34500.00',
      subtotalPriceInr: '33495.15',
      totalTaxInr: '1004.85',
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      paymentGateway: 'Razorpay (Shopify Hosted Checkout)',
      razorpayPaymentId: 'pay_MrsRzp99201443',
      lineItems: [
        {
          sku: 'MRS-EAR-2001',
          title: 'Lumière 1.00 ct tw Classic Solitaire Diamond Studs',
          quantity: 1,
          purchaseTimePriceInr: '34500.00',
          metalPurity: '18K Yellow Gold',
          diamondCarats: '1.000 ct tw (EF-VVS)',
          pricingSnapshotId: 'snap-003',
        },
      ],
      placedAt: '2026-11-02T11:45:00.000Z',
    },
  ];

  const shipments: ShipmentRecord[] = [
    {
      id: 'ship-001',
      orderId: 'ord-1041',
      orderNumber: 'MRS-1041',
      shopifyOrderGid: 'gid://shopify/Order/5501041',
      provider: 'SHIPROCKET',
      shiprocketOrderId: 'SR-ORD-882910',
      shipmentId: 'SR-SHP-441209',
      awbCode: 'AWB8849201',
      courierName: 'BlueDart Insured Jewellery Air',
      declaredValueInr: '68500.00',
      isInsured: true,
      packageWeightGrams: '140',
      labelUrl: 'https://shiprocket.co/labels/AWB8849201.pdf',
      manifestUrl: 'https://shiprocket.co/manifests/SR-SHP-441209.pdf',
      trackingUrl: 'https://shiprocket.co/tracking/AWB8849201',
      status: 'IN_TRANSIT',
      latestMilestone: 'In Transit — Arrived at Mumbai Santacruz Secure Hub',
      trackingHistory: [
        {
          timestamp: '2026-11-04T16:00:00.000Z',
          location: 'Mangal Royal Studio Vault, Mumbai',
          status: 'PICKUP_COMPLETED',
          remarks: 'Tamper-evident security seal verified & scanned',
        },
        {
          timestamp: '2026-11-05T06:30:00.000Z',
          location: 'Mumbai Santacruz Secure Hub',
          status: 'IN_TRANSIT',
          remarks: 'Out for insured priority delivery',
        },
      ],
      createdAt: '2026-11-04T15:10:00.000Z',
      updatedAt: '2026-11-05T06:30:00.000Z',
    },
    {
      id: 'ship-002',
      orderId: 'ord-1043',
      orderNumber: 'MRS-1043',
      shopifyOrderGid: 'gid://shopify/Order/5501043',
      provider: 'SHIPROCKET',
      shiprocketOrderId: 'SR-ORD-882701',
      shipmentId: 'SR-SHP-440988',
      awbCode: 'AWB8847109',
      courierName: 'Sequel Logistics Fine Jewellery',
      declaredValueInr: '34500.00',
      isInsured: true,
      packageWeightGrams: '110',
      labelUrl: 'https://shiprocket.co/labels/AWB8847109.pdf',
      manifestUrl: 'https://shiprocket.co/manifests/SR-SHP-440988.pdf',
      trackingUrl: 'https://shiprocket.co/tracking/AWB8847109',
      status: 'DELIVERED',
      latestMilestone: 'Delivered to recipient with OTP verification in Ahmedabad',
      trackingHistory: [
        {
          timestamp: '2026-11-02T17:00:00.000Z',
          location: 'Mumbai Studio Vault',
          status: 'PICKUP_COMPLETED',
          remarks: 'Picked up by insured courier',
        },
        {
          timestamp: '2026-11-03T15:20:00.000Z',
          location: 'Ahmedabad Navrangpura',
          status: 'DELIVERED',
          remarks: 'Delivered & signed with OTP verification',
        },
      ],
      createdAt: '2026-11-02T14:00:00.000Z',
      updatedAt: '2026-11-03T15:20:00.000Z',
    },
  ];

  const payments: PaymentRecordItem[] = [
    {
      id: 'pay-001',
      orderId: 'ord-1041',
      orderNumber: 'MRS-1041',
      provider: 'RAZORPAY_SHOPIFY_CHECKOUT',
      providerPaymentId: 'pay_MrsRzp99201441',
      amountInr: '68500.00',
      currency: 'INR',
      method: 'HDFC Bank Credit Card (EMI)',
      status: 'CAPTURED',
      signatureVerified: true,
      capturedAt: '2026-11-04T14:20:12.000Z',
    },
    {
      id: 'pay-002',
      orderId: 'ord-1042',
      orderNumber: 'MRS-1042',
      provider: 'RAZORPAY_SHOPIFY_CHECKOUT',
      providerPaymentId: 'pay_MrsRzp99201442',
      amountInr: '56900.00',
      currency: 'INR',
      method: 'UPI (ICICI)',
      status: 'CAPTURED',
      signatureVerified: true,
      capturedAt: '2026-11-05T08:15:09.000Z',
    },
    {
      id: 'pay-003',
      orderId: 'ord-1043',
      orderNumber: 'MRS-1043',
      provider: 'RAZORPAY_SHOPIFY_CHECKOUT',
      providerPaymentId: 'pay_MrsRzp99201443',
      amountInr: '34500.00',
      currency: 'INR',
      method: 'NetBanking (SBI)',
      status: 'CAPTURED',
      signatureVerified: true,
      capturedAt: '2026-11-02T11:45:30.000Z',
    },
  ];

  const discounts: DiscountRecord[] = [
    {
      id: 'disc-001',
      code: 'ENGAGEMENT10',
      title: 'Get 10% OFF On Engagement Rings (Announcement Bar Promo)',
      discountType: 'PERCENTAGE',
      value: '10.00',
      minOrderAmountInr: '25000.00',
      appliesTo: 'Engagement Rings Collection',
      isActive: true,
      usageCount: 18,
      startsAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'disc-002',
      code: 'ROYALMAKING0',
      title: 'Festive 50% Waiver on Making Charges Above ₹75,000',
      discountType: 'MAKING_CHARGE_WAIVER',
      value: '50.00',
      minOrderAmountInr: '75000.00',
      appliesTo: 'All Solitaire & Bridal Collections',
      isActive: true,
      usageCount: 7,
      startsAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const banners: BannerRecord[] = [
    {
      id: 'bnr-001',
      title: 'Brilliance For Today',
      eyebrow: 'TRADITION IN TRUST',
      subtitle: 'Every creation is designed to reflect modern elegance while carrying forward a legacy of trust.',
      placement: 'HOMEPAGE_HERO_SLIDE_1',
      sectionFile: 'sections/slideshow.liquid',
      imageUrl: 'shopify://shop_images/2cad1ff177013aa3114de81b745559fa80ff958a.jpg',
      ctaLabel: 'Shop Now',
      ctaLink: '/collections/all',
      isActive: true,
      updatedAt: now,
    },
    {
      id: 'bnr-002',
      title: 'Get 10% OFF On Engagement Rings',
      eyebrow: 'ANNOUNCEMENT BAR',
      subtitle: 'Burgundy #7a1023 top announcement bar',
      placement: 'HEADER_ANNOUNCEMENT_BAR',
      sectionFile: 'sections/announcement-bar.liquid',
      imageUrl: '',
      ctaLabel: '',
      ctaLink: '/collections/rings',
      isActive: true,
      updatedAt: now,
    },
    {
      id: 'bnr-003',
      title: '"Luxury today is not just about what you wear. It\'s about the choices you make."',
      eyebrow: 'EDITORIAL QUOTE BANNER',
      subtitle: 'Full-width editorial banner with 40% overlay',
      placement: 'HOMEPAGE_QUOTE_BANNER',
      sectionFile: 'sections/image-banner.liquid',
      imageUrl: 'shopify://shop_images/59205e0bf94ef6a4257d713defef8fe89d9fe5b8.png',
      ctaLabel: '',
      ctaLink: '',
      isActive: true,
      updatedAt: now,
    },
    {
      id: 'bnr-004',
      title: 'Loved it online? Now you can find it in our physical store.',
      eyebrow: 'visit our store !',
      subtitle: 'Physical Store CTA banner on Product Detail Pages (#FBE8DB)',
      placement: 'PDP_PHYSICAL_STORE_CTA',
      sectionFile: 'sections/mangal-physical-store-cta.liquid',
      imageUrl: '',
      ctaLabel: 'GET STORE LOCATION',
      ctaLink: '/pages/contact',
      isActive: true,
      updatedAt: now,
    },
  ];

  const contents: ContentRecord[] = [
    {
      id: 'cnt-001',
      slug: 'brand-story-rooted-in-legacy',
      title: 'ROOTED IN LEGACY — Build for today.',
      sectionType: 'EDITORIAL',
      liquidSection: 'sections/brand-story.liquid',
      body: 'A unit of Mangal Royal Jewels Pvt Ltd — since 1975. Combining five decades of Indian jewellery craftsmanship with IGI-certified lab-grown diamonds.',
      isPublished: true,
      updatedAt: now,
    },
    {
      id: 'cnt-002',
      slug: 'four-pillar-trust-bar',
      title: 'IGI Certified • Lifetime Exchange • Free Shipping • Free Resizing',
      sectionType: 'TRUST_PILLAR',
      liquidSection: 'sections/trust-bar.liquid',
      body: 'Every diamond certified for authenticity | Full value on every piece, forever | Insured delivery across India | Complimentary for 30 days after purchase.',
      isPublished: true,
      updatedAt: now,
    },
    {
      id: 'cnt-003',
      slug: 'why-lab-grown-conscious-choice',
      title: 'The conscious choice — Why lab grown?',
      sectionType: 'EDITORIAL',
      liquidSection: 'sections/why-lab-grown.liquid',
      body: 'Physically identical (100% real diamonds with identical optical & chemical properties) | Consciously made | Exceptional value.',
      isPublished: true,
      updatedAt: now,
    },
    {
      id: 'cnt-004',
      slug: 'lifetime-exchange-and-buyback-policy',
      title: 'Lifetime Exchange & 30-Day Resizing Policy',
      sectionType: 'POLICY',
      liquidSection: 'sections/main-page.liquid',
      body: 'Mangal Royal Studio offers lifetime exchange across all IGI-certified lab-grown diamond jewellery along with complimentary 30-day ring resizing.',
      isPublished: true,
      updatedAt: now,
    },
  ];

  const settings: StoreSettingsRecord = {
    storeName: 'Mangal Royal Studio',
    legalEntityName: 'Mangal Royal Jewels Pvt Ltd (Since 1975)',
    foundedYear: 1975,
    shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN || 'mangal-royal-studio.myshopify.com',
    shopifyPlan: 'Shopify Basic',
    shopifyApiVersion: process.env.SHOPIFY_ADMIN_API_VERSION || '2025-01',
    shopifyLiveWritesEnabled: process.env.SHOPIFY_LIVE_WRITES_ENABLED === 'true',
    currency: 'INR',
    defaultGstPercent: '3.00',
    requireOwnerApprovalForPricing: true,
    maxAutoPriceSwingPercent: '15.00',
    shiprocketEnabled: true,
    shiprocketPickupLocation: 'Primary_Mumbai_Studio_Vault',
    shiprocketHighValueInsuranceEnabled: true,
    razorpayViaShopifyCheckout: true,
    announcementBarText: 'Get 10% OFF On Engagement Rings',
    announcementBarBgColor: '#7A1023',
    primaryBrandColor: '#7D132A',
    secondaryPeachColor: '#F8E1CF',
  };

  const auditLogs: AuditLogRecord[] = [
    {
      id: 'aud-001',
      actorEmail: 'owner@mangalroyalstudio.com',
      actorRole: 'OWNER',
      action: 'SYSTEM_INITIALIZED',
      entityType: 'Platform',
      entityId: 'mrs-core',
      summary: 'Initialized Mangal Royal Studio platform with configurable placeholder gold & diamond rate cards.',
      createdAt: now,
    },
    {
      id: 'aud-002',
      actorEmail: 'pricing@mangalroyalstudio.com',
      actorRole: 'PRICING_OPERATOR',
      action: 'PRICING_RUN_PREVIEW_CREATED',
      entityType: 'PricingRun',
      entityId: 'run-initial-001',
      summary: 'Generated dry-run pricing preview for 8 catalogue SKUs using Formula Rule v1.',
      createdAt: now,
    },
  ];

  const collections: CollectionRecord[] = [
    {
      id: 'col-bestsellers',
      handle: 'best-sellers',
      title: 'Bestsellers',
      description: 'Our most coveted IGI-certified lab-grown diamond creations.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-RNG-1001', 'MRS-EAR-2001', 'MRS-PND-4001', 'MRS-BRC-3001'],
    },
    {
      id: 'col-all',
      handle: 'all',
      title: 'All Fine Jewellery',
      description: 'Complete Mangal Royal Studio collection of IGI-certified lab-grown diamond jewellery.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/2cad1ff177013aa3114de81b745559fa80ff958a.jpg',
      isFeatured: true,
      isActive: true,
      productSkus: products.map((p) => p.sku),
    },
    {
      id: 'col-rings',
      handle: 'rings',
      title: 'Rings',
      description: 'Solitaire, halo, and eternity rings in 14K & 18K hallmarked gold.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-RNG-1001', 'MRS-RNG-1002'],
    },
    {
      id: 'col-earrings',
      handle: 'earrings',
      title: 'Earrings',
      description: 'Classic solitaire studs, drops, and bridal chandbalis.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-EAR-2001'],
    },
    {
      id: 'col-pendants',
      handle: 'pendants',
      title: 'Pendants',
      description: 'Everyday diamond pendants and delicate solitaire drops.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-PND-4001'],
    },
    {
      id: 'col-necklaces',
      handle: 'necklaces',
      title: 'Necklaces',
      description: 'Bridal diamond haars and graduated tennis necklaces.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-NCK-6001'],
    },
    {
      id: 'col-bracelets',
      handle: 'bracelets',
      title: 'Bracelets',
      description: 'Illusion and four-prong diamond tennis bracelets.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/6158221b28f34134f5119c8a750d12eceab5003b.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-BRC-3001'],
    },
    {
      id: 'col-bangles',
      handle: 'bangles',
      title: 'Bangles',
      description: 'Handcrafted gold and lab-grown diamond kadas & bangles.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-BNG-5001'],
    },
    {
      id: 'col-antique',
      handle: 'antique',
      title: 'Antique',
      description: '1975 Founder Edition heirloom creations.',
      imageUrl: 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955.png',
      isFeatured: true,
      isActive: true,
      productSkus: ['MRS-ANT-7001'],
    },
  ];

  const inventoryMovements: InventoryMovementRecord[] = products.map((p, idx) => ({
    id: `mov-init-${idx + 1}`,
    sku: p.sku,
    title: p.title,
    movementType: 'RESTOCK',
    deltaQuantity: p.inventoryQuantity,
    previousAvailable: 0,
    newAvailable: p.inventoryQuantity,
    reason: 'Initial vault stock verification',
    actorEmail: 'owner@mangalroyalstudio.com',
    createdAt: now,
  }));

  const notifications: NotificationRecord[] = [
    {
      id: 'notif-001',
      recipientEmail: 'ananya.sharma@example.com',
      channel: 'EMAIL',
      templateCode: 'ORDER_CONFIRMATION',
      subject: 'Your Mangal Royal Studio Order #MRS-1041 is Confirmed',
      body: 'Thank you for choosing Mangal Royal Studio. Your Royal Celeste 1.50 ct IGI Solitaire Ring is being prepared for insured dispatch.',
      status: 'SENT',
      sentAt: '2026-11-04T14:21:00.000Z',
    },
    {
      id: 'notif-002',
      recipientEmail: 'ananya.sharma@example.com',
      channel: 'WHATSAPP',
      templateCode: 'SHIPMENT_DISPATCHED',
      subject: 'Order #MRS-1041 Dispatched via BlueDart Insured Air (AWB8849201)',
      body: 'Your insured jewellery parcel is in transit with tamper-evident seal verification.',
      status: 'SENT',
      sentAt: '2026-11-04T15:12:00.000Z',
    },
  ];

  return {
    users,
    categories,
    collections,
    metalRates,
    diamondRates,
    pricingRules,
    products,
    inventoryMovements,
    pricingRuns,
    pricingSnapshots,
    importJobs: [],
    customers,
    carts: {},
    wishlists: {},
    orders,
    shipments,
    payments,
    refunds: [],
    discounts,
    banners,
    contents,
    notifications,
    settings,
    auditLogs,
    integrationEvents: [],
  };
}

const API_PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_API_DATA_FILE_PATH = path.join(API_PACKAGE_ROOT, '.data', 'platform-state.json');

export function resolveDefaultDataFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.MRS_DATA_FILE_PATH?.trim();
  if (configured) {
    return path.resolve(API_PACKAGE_ROOT, configured);
  }
  return DEFAULT_API_DATA_FILE_PATH;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const REQUIRED_STATE_ARRAY_KEYS = [
  'users', 'categories', 'metalRates', 'diamondRates', 'pricingRules', 'products',
  'pricingRuns', 'pricingSnapshots', 'importJobs', 'customers', 'orders', 'shipments',
  'payments', 'discounts', 'banners', 'contents', 'auditLogs',
] as const;

const OPTIONAL_STATE_ARRAY_KEYS = [
  'collections',
  'inventoryMovements',
  'refunds',
  'notifications',
  'integrationEvents',
  'customizationProfiles',
  'productCustomizationAssignments',
  'customerDesigns',
  'productModelAssets',
] as const;

function validatePersistedStateShape(value: unknown): asserts value is Partial<PlatformState> {
  if (!isPlainRecord(value)) {
    throw new Error('The state root must be an object.');
  }
  for (const key of REQUIRED_STATE_ARRAY_KEYS) {
    if (!Array.isArray(value[key]) || (value[key] as unknown[]).some((item) => !isPlainRecord(item))) {
      throw new Error(`Required state section "${key}" is malformed.`);
    }
  }
  for (const key of OPTIONAL_STATE_ARRAY_KEYS) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || (value[key] as unknown[]).some((item) => !isPlainRecord(item)))) {
      throw new Error(`Optional state section "${key}" is malformed.`);
    }
  }
  for (const key of ['carts', 'wishlists']) {
    if (value[key] !== undefined && !isPlainRecord(value[key])) {
      throw new Error(`Optional state section "${key}" is malformed.`);
    }
  }
  if (!isPlainRecord(value.settings)) {
    throw new Error('Required state section "settings" is malformed.');
  }
}

function syncDirectoryIfSupported(directory: string): void {
  let fd: number | null = null;
  try {
    fd = fs.openSync(directory, 'r');
    fs.fsyncSync(fd);
  } catch (err: any) {
    if (['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'EBADF', 'EPERM'].includes(err?.code)) {
      return;
    }
    throw err;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* directory close is best-effort after fsync */ }
    }
  }
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === 'EPERM';
  }
}

export interface DataStoreOptions {
  filePath?: string;
  testMode?: boolean;
  enforceLock?: boolean;
}

/**
 * DataStore provides single-writer JSON persistence for the Mangal Royal Studio API.
 *
 * ARCHITECTURAL CONSTRAINT & SINGLE-HOST LIMITATION (SEC-123A-05):
 * Single-writer locking coordinates processes on a single POSIX host via atomic lockfile creation
 * and local OS PID checks (process.kill(pid, 0)). It does NOT provide distributed locking across
 * multi-container, clustered, or network-mounted storage (NFS/EFS/SMB). The API MUST be deployed
 * as a single writer instance until the PostgreSQL runtime migration (Step 1.3) is active.
 */
export class DataStore {
  private state: PlatformState;
  private lastPersistedState!: PlatformState;
  private readonly filePath: string;
  private readonly lockFilePath: string;
  private readonly testModeOverride?: boolean;
  private readonly enforceLock: boolean;
  private lockHeld = false;
  private lockToken: string | null = null;
  private exitListener?: () => void;

  private isTestMode(): boolean {
    if (this.testModeOverride !== undefined) {
      return this.testModeOverride;
    }
    return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  }

  constructor(options?: DataStoreOptions) {
    this.testModeOverride = options?.testMode;
    this.enforceLock = Boolean(options?.enforceLock);
    const requestedPath = options?.filePath
      ? path.resolve(options.filePath)
      : resolveDefaultDataFilePath();
    const dataDir = path.dirname(requestedPath);
    const shouldLock = (!this.isTestMode() && process.env.DATA_BACKEND?.trim().toLowerCase() !== 'postgres') || this.enforceLock;

    if ((!this.isTestMode() || shouldLock) && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const canonicalDirectory = fs.existsSync(dataDir) ? fs.realpathSync(dataDir) : dataDir;
    this.filePath = path.join(canonicalDirectory, path.basename(requestedPath));
    this.lockFilePath = `${this.filePath}.lock`;
    if (fs.existsSync(this.filePath) && fs.lstatSync(this.filePath).isSymbolicLink()) {
      throw new Error('STATE_FILE_SYMLINK_UNSUPPORTED: Refusing a symbolic-link state path because it can bypass single-writer locking.');
    }

    if (shouldLock) {
      this.acquireLock();
      if (!this.isTestMode()) {
        this.exitListener = () => this.releaseLock();
        process.once('exit', this.exitListener);
      }
    }

    const seed = createInitialSeedState();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        validatePersistedStateShape(parsed);
        const loaded = parsed;
        this.state = {
          ...seed,
          ...loaded,
          collections: loaded.collections ?? seed.collections,
          inventoryMovements: loaded.inventoryMovements ?? seed.inventoryMovements,
          carts: loaded.carts ?? {},
          wishlists: loaded.wishlists ?? {},
          refunds: loaded.refunds ?? [],
          notifications: loaded.notifications ?? seed.notifications,
          integrationEvents: loaded.integrationEvents ?? seed.integrationEvents,
          customizationProfiles: loaded.customizationProfiles ?? [],
          productCustomizationAssignments: loaded.productCustomizationAssignments ?? [],
          customerDesigns: loaded.customerDesigns ?? [],
          productModelAssets: loaded.productModelAssets ?? [],
        };
      } catch {
        this.releaseLock();
        throw new Error(
          'CORRUPT_STATE_FILE: The existing API state file is malformed or unreadable. Startup was stopped and the original file was left unchanged.'
        );
      }
      // Ensure seed product images use verified https://i1dtfi-iv.myshopify.com/cdn/shop/files/ URLs
      for (const prod of this.state.products) {
        const seedProd = seed.products.find((sp) => sp.sku === prod.sku);
        if (seedProd && (!prod.imageUrl || prod.imageUrl.startsWith('shopify://'))) {
          prod.imageUrl = seedProd.imageUrl;
          prod.altImageUrl = seedProd.altImageUrl;
          prod.galleryImages = seedProd.galleryImages;
          prod.isFeaturedBestseller = seedProd.isFeaturedBestseller;
        }
      }
      // Historical records without verification evidence stay unverified. Only a persisted
      // true value created by the verification workflow is trusted.
      for (const cust of this.state.customers) {
        if (cust.isActive === undefined) {
          cust.isActive = true;
        }
        if (cust.emailVerified === undefined) {
          cust.emailVerified = false;
        }
      }
      this.lastPersistedState = structuredClone(this.state);
    } else {
      this.state = seed;
      this.lastPersistedState = structuredClone(this.state);
      if (!this.isTestMode()) {
        if (!this.persist()) {
          this.releaseLock();
          throw new Error(
            `INITIAL_PERSIST_FAILED: Unable to write initial state file at "${this.filePath}".`
          );
        }
      } else {
        this.lastPersistedState = structuredClone(this.state);
      }
    }
  }

  private writeLockFileExclusively(): void {
    const fd = fs.openSync(this.lockFilePath, 'wx', 0o600);
    const generatedToken = crypto.randomBytes(24).toString('hex');
    try {
      const payload = JSON.stringify(
        {
          pid: process.pid,
          startedAt: new Date().toISOString(),
          lockToken: generatedToken,
        },
        null,
        2
      );
      try {
        fs.writeFileSync(fd, payload, 'utf8');
        fs.fsyncSync(fd);
      } catch (err) {
        fs.closeSync(fd);
        try { fs.unlinkSync(this.lockFilePath); } catch { /* leave ambiguous lock for manual inspection */ }
        throw err;
      }
    } finally {
      try { fs.closeSync(fd); } catch { /* lock contents have already been synced */ }
    }
    this.lockHeld = true;
    this.lockToken = generatedToken;
  }

  private acquireLock(): void {
    try {
      this.writeLockFileExclusively();
      return;
    } catch (err: any) {
      if (err?.code !== 'EEXIST') {
        throw new Error(
          `SINGLE_WRITER_LOCK_FAILED: Unable to create lockfile "${this.lockFilePath}" (${err?.message || 'unknown error'}).`
        );
      }
    }

    // Lockfile already exists: inspect whether the holder PID is still alive or stale
    let existingPid: number | null = null;
    try {
      const rawLock = fs.readFileSync(this.lockFilePath, 'utf8');
      const parsedLock = JSON.parse(rawLock) as { pid?: unknown };
      if (typeof parsedLock?.pid === 'number' && Number.isInteger(parsedLock.pid) && parsedLock.pid > 0) {
        existingPid = parsedLock.pid;
      }
    } catch {
      throw new Error(
        `SINGLE_WRITER_LOCK_HELD: Lockfile "${this.lockFilePath}" exists and could not be verified as a stale lock.`
      );
    }

    if (existingPid === null) {
      throw new Error(
        `SINGLE_WRITER_LOCK_HELD: Lockfile "${this.lockFilePath}" does not contain a valid PID; refusing to overwrite lock.`
      );
    }

    if (isPidAlive(existingPid)) {
      throw new Error(
        `SINGLE_WRITER_LOCK_HELD: State file "${this.filePath}" is already locked by active process PID ${existingPid}.`
      );
    }

    // A stale PID is not sufficient proof that the lock can be removed safely: the PID may
    // have been reused, and concurrent recovery can unlink a new owner's lock. Fail closed.
    throw new Error(
      `STALE_STATE_LOCK: Lockfile "${this.lockFilePath}" refers to a process that is not running. It was preserved; verify the state file and remove the lock manually before restarting.`
    );
  }

  public releaseLock(): void {
    if (!this.lockHeld) {
      return;
    }
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const raw = fs.readFileSync(this.lockFilePath, 'utf8');
        const parsed = JSON.parse(raw) as { pid?: unknown; lockToken?: unknown };
        if (parsed?.pid === process.pid && parsed?.lockToken === this.lockToken) {
          fs.unlinkSync(this.lockFilePath);
        }
      }
    } catch {
      // Ignore cleanup errors on shutdown
    } finally {
      this.lockHeld = false;
      this.lockToken = null;
      if (this.exitListener) {
        process.removeListener('exit', this.exitListener);
        this.exitListener = undefined;
      }
    }
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public getLockFilePath(): string {
    return this.lockFilePath;
  }

  public getState(): PlatformState {
    return this.state;
  }

  public persist(): boolean {
    if (this.isTestMode()) {
      this.lastPersistedState = structuredClone(this.state);
      return true;
    }
    const dataDir = path.dirname(this.filePath);
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`;
    let fd: number | null = null;
    let renamed = false;
    let nextSnapshot: PlatformState | null = null;
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      nextSnapshot = structuredClone(this.state);
      const serialized = JSON.stringify(this.state, null, 2);
      if (serialized === undefined) throw new Error('State could not be serialized.');
      fd = fs.openSync(tmpPath, 'wx', 0o600);
      fs.writeFileSync(fd, serialized, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(tmpPath, this.filePath);
      renamed = true;
      this.lastPersistedState = nextSnapshot;
      try {
        syncDirectoryIfSupported(dataDir);
      } catch {
        // Directory sync is best-effort across platforms once renameSync has succeeded
      }
      return true;
    } catch {
      if (renamed) {
        // The complete new file is already visible. Keep memory aligned with it while
        // reporting that directory durability could not be confirmed.
        if (nextSnapshot) this.lastPersistedState = nextSnapshot;
      } else {
        this.state = structuredClone(this.lastPersistedState);
      }
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore close error
        }
      }
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // ignore temp file cleanup error
      }
      return false;
    }
  }

  public stageAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord {
    const record: AuditLogRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this.state.auditLogs.unshift(record);
    return record;
  }

  public addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord | null {
    const record = this.stageAuditLog(entry);
    // persist() restores the last committed snapshot (business change and staged audit) on failure.
    if (!this.persist()) return null;
    return record;
  }
}

export const dbStore = new DataStore();

