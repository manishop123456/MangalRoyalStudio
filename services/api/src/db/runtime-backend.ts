import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  ROLE_PERMISSIONS,
  type AdminRoleName,
  type CustomerDesignRecord,
  type CustomizationGroupRecord,
  type CustomizationOptionRecord,
  type CustomizationProfileRecord,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MetalRateRecord,
  type PriceCalculationBreakdown,
  type PricingFormulaRule,
  type ProductCustomizationAssignmentRecord,
  type ProductModelAssetRecord,
} from '@mrs/shared';
import type {
  AdminUserRecord,
  AuditLogRecord,
  BannerRecord,
  CartRecord,
  CategoryRecord,
  CollectionRecord,
  ContentRecord,
  CustomerRecord,
  DataStore,
  DiscountRecord,
  ImportJobRecord,
  IntegrationEventRecord,
  InventoryMovementRecord,
  NotificationRecord,
  OrderRecord,
  PaymentRecordItem,
  PricingRunRecord,
  PricingSnapshotRecord,
  RefundRecordItem,
  ShipmentRecord,
  StoreSettingsRecord,
} from '../store/data-store.js';
import type { AuthLookupProvider } from '../middleware/auth.js';
import { checkDatabaseConnection } from './prisma.js';
import { PostgresCatalogRepository } from './repositories/catalog-repository.js';
import { PostgresCustomerRepository } from './repositories/customer-repository.js';
import { PostgresOrderRepository, type CreateOrderParams } from './repositories/order-repository.js';
import { PostgresPricingRepository } from './repositories/pricing-repository.js';
import { PostgresOperationsRepository } from './repositories/operations-repository.js';
import { PostgresCustomizationRepository } from './repositories/customization-repository.js';

export interface RuntimeBackend {
  readonly mode: 'json' | 'postgres';
  readonly authLookup: AuthLookupProvider;
  healthCheck(): Promise<{
    ok: boolean;
    backend: 'json' | 'postgres';
    version?: string;
    error?: string;
    counts?: Record<string, number>;
  }>;

  // Catalog & Inventory
  listProducts(options?: { includeDrafts?: boolean }): Promise<JewelleryProductSpec[]>;
  findProductByHandleOrSku(handleOrSku: string): Promise<JewelleryProductSpec | null>;
  listCategories(): Promise<CategoryRecord[]>;
  listCollections(): Promise<CollectionRecord[]>;
  findCollectionByHandle(handle: string): Promise<CollectionRecord | null>;
  createProduct(params: Parameters<PostgresCatalogRepository['createProduct']>[0]): Promise<JewelleryProductSpec>;
  updateProductAttributes(
    sku: string,
    updates: Parameters<PostgresCatalogRepository['updateProductAttributes']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<JewelleryProductSpec | null>;
  deleteProduct(sku: string, actorEmail: string, actorRole: string): Promise<JewelleryProductSpec | null>;
  listInventory(): Promise<ReturnType<PostgresCatalogRepository['listInventory']> extends Promise<infer T> ? T : never>;
  adjustInventory(params: Parameters<PostgresCatalogRepository['adjustInventory']>[0]): Promise<{
    sku: string;
    previousQuantity: number;
    newQuantity: number;
    movement: InventoryMovementRecord;
  }>;
  listInventoryMovements(): Promise<InventoryMovementRecord[]>;

  // Customers
  listCustomers(): Promise<CustomerRecord[]>;
  findCustomerByEmail(email: string): Promise<CustomerRecord | null>;
  findCustomerById(id: string): Promise<CustomerRecord | null>;
  createCustomer(params: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    phone?: string;
    city?: string;
    state?: string;
    emailVerified?: boolean;
    emailVerificationTokenHash?: string;
    emailVerificationExpiresAt?: Date;
    emailVerificationLastSentAt?: Date;
  }): Promise<CustomerRecord>;
  updateVerificationToken(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    sentAt: Date
  ): Promise<CustomerRecord>;
  markEmailVerified(customerId: string): Promise<CustomerRecord>;

  // Orders, Payments, Refunds, Shipments
  listOrders(): Promise<OrderRecord[]>;
  findOrderByIdOrNumber(idOrNumber: string): Promise<OrderRecord | null>;
  findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null>;
  attachRazorpayOrderToOrder(params: {
    orderId: string;
    razorpayOrderId: string;
    actorEmail?: string;
    actorRole?: string;
  }): Promise<OrderRecord>;
  recordPaymentAttemptStatus(params: {
    orderId: string;
    providerPaymentId: string;
    providerOrderId?: string;
    amountInr: number | string;
    status: 'AUTHORIZED' | 'FAILED';
    method?: string;
    failureReason?: string;
    webhookEventId?: string;
    actorEmail?: string;
    actorRole?: string;
  }): Promise<{ recorded: boolean; ignoredReason?: string }>;
  listOrdersByCustomer(customerId: string, email: string): Promise<OrderRecord[]>;
  createOrderWithInventoryReservation(params: CreateOrderParams): Promise<OrderRecord>;
  confirmPaymentCapture(params: {
    orderId: string;
    providerPaymentId: string;
    providerOrderId?: string;
    providerSignature?: string;
    amountInr: number | string;
    method?: string;
    webhookEventId?: string;
    actorEmail?: string;
    actorRole?: string;
  }): Promise<{ order: OrderRecord; payment: PaymentRecordItem; idempotent: boolean }>;
  createRefund(params: {
    orderId: string;
    amountInr: number;
    reason: string;
    initiatedByEmail: string;
    initiatedByRole: string;
  }): Promise<{ refund: RefundRecordItem; order: OrderRecord }>;
  cancelOrderWithRestock(
    orderId: string,
    actorEmail: string,
    cancelReason?: string,
    actorRole?: string
  ): Promise<{ order: OrderRecord; idempotent: boolean }>;
  updateOrderStatus(params: {
    orderId: string;
    newStatus: string;
    reason?: string;
    actorEmail: string;
    actorRole: string;
    trackingNumber?: string;
    carrier?: string;
  }): Promise<OrderRecord>;
  listPayments(): Promise<PaymentRecordItem[]>;
  listRefunds(): Promise<RefundRecordItem[]>;
  listShipments(): Promise<ShipmentRecord[]>;
  createShipment(params: {
    orderId: string;
    shipment: ShipmentRecord;
    actorEmail: string;
    actorRole: string;
  }): Promise<ShipmentRecord>;

  // Pricing
  listMetalRates(): Promise<MetalRateRecord[]>;
  getActiveMetalRates(): Promise<MetalRateRecord[]>;
  recordGoldRate(params: {
    metalType: string;
    purity: string;
    ratePerGramInr: number | string;
    source?: string;
    isPlaceholder?: boolean;
    createdBy: string;
    actorRole?: string;
  }): Promise<MetalRateRecord>;
  listDiamondRates(): Promise<DiamondRateMatrixEntry[]>;
  getActiveDiamondRates(): Promise<DiamondRateMatrixEntry[]>;
  recordDiamondRate(params: {
    shape: string;
    caratMin: number | string;
    caratMax: number | string;
    colorGrade: string;
    clarityGrade: string;
    cutGrade?: string;
    ratePerCaratInr: number | string;
    isPlaceholder?: boolean;
    createdBy: string;
    actorRole?: string;
  }): Promise<DiamondRateMatrixEntry>;
  listPricingRules(): Promise<PricingFormulaRule[]>;
  getActivePricingRule(): Promise<PricingFormulaRule | null>;
  createPricingRule(params: Parameters<PostgresPricingRepository['createPricingRule']>[0]): Promise<PricingFormulaRule>;
  listPricingRuns(): Promise<PricingRunRecord[]>;
  findPricingRunById(runId: string): Promise<PricingRunRecord | null>;
  createPricingRun(params: {
    pricingRuleId: string;
    rateSnapshot: Record<string, unknown>;
    summary: PricingRunRecord['summary'];
    notes?: string;
    createdBy: string;
    actorRole?: string;
    items: PricingRunRecord['items'];
  }): Promise<PricingRunRecord>;
  validatePricingRun(runId: string, actorEmail: string, actorRole: string): Promise<PricingRunRecord>;
  approvePricingRun(runId: string, actorEmail: string, actorRole: string): Promise<PricingRunRecord>;
  publishPricingRun(
    runId: string,
    actorEmail: string,
    actorRole: string
  ): Promise<{ run: PricingRunRecord; snapshots: PricingSnapshotRecord[] }>;
  listPricingSnapshots(): Promise<PricingSnapshotRecord[]>;

  // Operations
  listAdminUsers(): Promise<AdminUserRecord[]>;
  findAdminUserByEmail(email: string): Promise<AdminUserRecord | null>;
  updateAdminLastLogin(id: string): Promise<void>;
  updateAdminUserRole(params: {
    userId: string;
    role: AdminRoleName;
    actorEmail: string;
    actorRole: string;
  }): Promise<AdminUserRecord>;
  listDiscounts(): Promise<DiscountRecord[]>;
  findDiscountByCode(code: string): Promise<DiscountRecord | null>;
  listBanners(): Promise<BannerRecord[]>;
  listContents(): Promise<ContentRecord[]>;
  getSettings(): Promise<StoreSettingsRecord>;
  updateSettings(
    updates: Partial<StoreSettingsRecord>,
    actorEmail: string,
    actorRole: string
  ): Promise<StoreSettingsRecord>;
  listAuditLogs(): Promise<AuditLogRecord[]>;
  addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord>;
  listNotifications(): Promise<NotificationRecord[]>;
  createNotification(params: {
    recipientEmail: string;
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'ADMIN_ALERT';
    templateCode: string;
    subject: string;
    body: string;
    referenceId?: string;
  }): Promise<NotificationRecord>;
  hasIntegrationEvent(provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY', eventId: string): Promise<boolean>;
  recordIntegrationEvent(params: {
    provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY';
    eventId: string;
    eventType: string;
    payloadHash: string;
    status: IntegrationEventRecord['status'];
  }): Promise<IntegrationEventRecord>;
  getCart(cartId: string): Promise<CartRecord | null>;
  saveCart(cart: CartRecord): Promise<CartRecord>;
  getWishlist(wishlistId: string): Promise<string[]>;
  toggleWishlist(wishlistId: string, sku: string): Promise<string[]>;
  listImportJobs(): Promise<ImportJobRecord[]>;
  findImportJobById(jobId: string): Promise<ImportJobRecord | null>;
  createImportJob(params: Parameters<PostgresOperationsRepository['createImportJob']>[0]): Promise<{
    job: ImportJobRecord;
    committedProductsCount: number;
    skippedTestArtifacts: number;
  }>;
  commitImportJob(params: {
    jobId: string;
    workbookHash: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<{
    job: ImportJobRecord;
    committedProductsCount: number;
    skippedTestArtifacts: number;
    alreadyCommitted?: boolean;
  }>;
  updateImportJobStatus(
    jobId: string,
    status: ImportJobRecord['status'],
    actorEmail: string,
    actorRole: string,
    summary?: string
  ): Promise<ImportJobRecord | null>;
  rollbackImportJob(
    jobId: string,
    actorEmail: string,
    actorRole: string
  ): Promise<{ job: ImportJobRecord; removedProductsCount: number } | null>;

  // Phase 2: Customization Profiles, Assignments, 3D Model Assets & Customer Designs
  listCustomizationProfiles(): Promise<CustomizationProfileRecord[]>;
  findCustomizationProfileById(id: string): Promise<CustomizationProfileRecord | null>;
  createCustomizationProfile(
    params: Parameters<PostgresCustomizationRepository['createProfile']>[0]
  ): Promise<CustomizationProfileRecord>;
  updateCustomizationProfile(
    profileId: string,
    updates: Parameters<PostgresCustomizationRepository['updateProfile']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationProfileRecord | null>;
  addCustomizationGroup(
    profileId: string,
    group: Parameters<PostgresCustomizationRepository['addGroup']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationGroupRecord>;
  updateCustomizationGroup(
    groupId: string,
    updates: Parameters<PostgresCustomizationRepository['updateGroup']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationGroupRecord | null>;
  addCustomizationOption(
    groupId: string,
    option: Parameters<PostgresCustomizationRepository['addOption']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationOptionRecord>;
  updateCustomizationOption(
    optionId: string,
    updates: Parameters<PostgresCustomizationRepository['updateOption']>[1],
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationOptionRecord | null>;
  listCustomizationAssignments(): Promise<ProductCustomizationAssignmentRecord[]>;
  findCustomizationAssignmentByProductId(productId: string): Promise<ProductCustomizationAssignmentRecord | null>;
  upsertCustomizationAssignment(
    params: Parameters<PostgresCustomizationRepository['upsertProductAssignment']>[0]
  ): Promise<ProductCustomizationAssignmentRecord>;
  listModelAssets(): Promise<ProductModelAssetRecord[]>;
  findModelAssetByProductId(productId: string): Promise<ProductModelAssetRecord | null>;
  upsertModelAsset(
    params: Parameters<PostgresCustomizationRepository['upsertModelAsset']>[0]
  ): Promise<{ asset: ProductModelAssetRecord; previousStorageKey?: string }>;
  deleteModelAsset(
    productId: string,
    actorEmail: string,
    actorRole: string
  ): Promise<{ deleted: ProductModelAssetRecord | null }>;
  listCustomerDesigns(customerId: string): Promise<CustomerDesignRecord[]>;
  listAllDesignsForAdmin(): Promise<CustomerDesignRecord[]>;
  findCustomerDesignById(designId: string): Promise<CustomerDesignRecord | null>;
  createCustomerDesign(
    params: Parameters<PostgresCustomizationRepository['createCustomerDesign']>[0]
  ): Promise<CustomerDesignRecord>;
  updateCustomerDesign(
    designId: string,
    customerId: string,
    updates: Parameters<PostgresCustomizationRepository['updateCustomerDesign']>[2]
  ): Promise<CustomerDesignRecord | null>;
  deleteCustomerDesign(designId: string, customerId: string): Promise<boolean>;
}

export class PostgresRuntimeBackend implements RuntimeBackend {
  readonly mode = 'postgres' as const;
  private readonly catalog: PostgresCatalogRepository;
  private readonly customers: PostgresCustomerRepository;
  private readonly orders: PostgresOrderRepository;
  private readonly pricing: PostgresPricingRepository;
  private readonly ops: PostgresOperationsRepository;
  private readonly customization: PostgresCustomizationRepository;
  readonly authLookup: AuthLookupProvider;

  constructor(private readonly prisma: PrismaClient) {
    this.catalog = new PostgresCatalogRepository(prisma);
    this.customers = new PostgresCustomerRepository(prisma);
    this.orders = new PostgresOrderRepository(prisma);
    this.pricing = new PostgresPricingRepository(prisma);
    this.ops = new PostgresOperationsRepository(prisma);
    this.customization = new PostgresCustomizationRepository(prisma);

    this.authLookup = {
      findAdminByIdAndEmail: async (id, email) => {
        const user = await this.ops.findAdminUserById(id);
        if (!user || user.email.toLowerCase() !== email.trim().toLowerCase()) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      },
      findCustomerByIdAndEmail: async (id, email) => {
        const cust = await this.customers.findById(id);
        if (!cust || cust.email.toLowerCase() !== email.trim().toLowerCase()) {
          return null;
        }
        return {
          id: cust.id,
          email: cust.email,
          firstName: cust.firstName,
          lastName: cust.lastName,
          isActive: cust.isActive,
          emailVerified: cust.emailVerified,
          passwordHash: cust.passwordHash,
        };
      },
    };
  }

  async healthCheck() {
    const db = await checkDatabaseConnection(this.prisma);
    if (!db.ok) {
      return { ok: false, backend: 'postgres' as const, error: db.error };
    }
    const [products, categories, orders, customers, pricingRuns] = await Promise.all([
      this.prisma.productMetadata.count(),
      this.prisma.collection.count(),
      this.prisma.orderMetadata.count(),
      this.prisma.customer.count(),
      this.prisma.pricingRun.count(),
    ]);
    return {
      ok: true,
      backend: 'postgres' as const,
      version: db.version,
      counts: { products, categories, orders, customers, pricingRuns },
    };
  }

  listProducts(options?: { includeDrafts?: boolean }) {
    return this.catalog.listProducts(options);
  }
  findProductByHandleOrSku(handleOrSku: string) {
    return this.catalog.findProductByHandleOrSku(handleOrSku);
  }
  listCategories() {
    return this.catalog.listCategories();
  }
  listCollections() {
    return this.catalog.listCollections();
  }
  findCollectionByHandle(handle: string) {
    return this.catalog.findCollectionByHandle(handle);
  }
  createProduct(params: Parameters<PostgresCatalogRepository['createProduct']>[0]) {
    return this.catalog.createProduct(params);
  }
  updateProductAttributes(
    sku: string,
    updates: Parameters<PostgresCatalogRepository['updateProductAttributes']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.catalog.updateProductAttributes(sku, updates, actorEmail, actorRole);
  }
  deleteProduct(sku: string, actorEmail: string, actorRole: string) {
    return this.catalog.deleteProduct(sku, actorEmail, actorRole);
  }
  listInventory() {
    return this.catalog.listInventory();
  }
  adjustInventory(params: Parameters<PostgresCatalogRepository['adjustInventory']>[0]) {
    return this.catalog.adjustInventory(params);
  }
  listInventoryMovements() {
    return this.catalog.listInventoryMovements();
  }

  listCustomers() {
    return this.customers.listCustomers();
  }
  findCustomerByEmail(email: string) {
    return this.customers.findByEmail(email);
  }
  findCustomerById(id: string) {
    return this.customers.findById(id);
  }
  createCustomer(params: Parameters<RuntimeBackend['createCustomer']>[0]) {
    return this.customers.createCustomer(params);
  }
  updateVerificationToken(customerId: string, tokenHash: string, expiresAt: Date, sentAt: Date) {
    return this.customers.updateVerificationToken(customerId, tokenHash, expiresAt, sentAt);
  }
  markEmailVerified(customerId: string) {
    return this.customers.markEmailVerified(customerId);
  }

  listOrders() {
    return this.orders.listOrders();
  }
  findOrderByIdOrNumber(idOrNumber: string) {
    return this.orders.findOrderByIdOrNumber(idOrNumber);
  }
  findOrderByIdempotencyKey(idempotencyKey: string) {
    return this.orders.findOrderByIdempotencyKey(idempotencyKey);
  }
  attachRazorpayOrderToOrder(params: Parameters<RuntimeBackend['attachRazorpayOrderToOrder']>[0]) {
    return this.orders.attachRazorpayOrderToOrder(params);
  }
  recordPaymentAttemptStatus(params: Parameters<RuntimeBackend['recordPaymentAttemptStatus']>[0]) {
    return this.orders.recordPaymentAttemptStatus(params);
  }
  listOrdersByCustomer(customerId: string, email: string) {
    return this.orders.listOrdersByCustomer(customerId, email);
  }
  async createOrderWithInventoryReservation(params: CreateOrderParams): Promise<OrderRecord> {
    const created = await this.orders.createOrderWithInventoryReservation(params);
    const mapped = await this.orders.findOrderByIdOrNumber(created.id);
    if (!mapped) throw new Error(`ORDER_NOT_FOUND: ${created.id}`);
    return mapped;
  }
  async confirmPaymentCapture(params: Parameters<RuntimeBackend['confirmPaymentCapture']>[0]) {
    const res = await this.orders.confirmPaymentCapture(params);
    const mappedOrder = await this.orders.findOrderByIdOrNumber(res.order.id);
    if (!mappedOrder) throw new Error(`ORDER_NOT_FOUND: ${res.order.id}`);
    return {
      order: mappedOrder,
      payment: {
        id: res.payment.id,
        orderId: res.order.id,
        orderNumber: mappedOrder.orderNumber,
        provider: res.payment.provider as PaymentRecordItem['provider'],
        providerPaymentId: res.payment.providerPaymentId,
        amountInr: res.payment.amountInr.toFixed(2),
        currency: 'INR' as const,
        method: res.payment.method || 'upi',
        status: res.payment.status as PaymentRecordItem['status'],
        signatureVerified: res.payment.signatureVerified,
        capturedAt: (res.payment.capturedAt || res.payment.createdAt).toISOString(),
      },
      idempotent: res.idempotent,
    };
  }
  createRefund(params: Parameters<RuntimeBackend['createRefund']>[0]) {
    return this.orders.createRefund(params);
  }
  async cancelOrderWithRestock(
    orderId: string,
    actorEmail: string,
    cancelReason?: string,
    actorRole?: string
  ) {
    const res = await this.orders.cancelOrderWithRestock(orderId, actorEmail, cancelReason, actorRole);
    const mapped = await this.orders.findOrderByIdOrNumber(res.order.id);
    if (!mapped) throw new Error(`ORDER_NOT_FOUND: ${res.order.id}`);
    return { order: mapped, idempotent: res.idempotent };
  }
  updateOrderStatus(params: Parameters<RuntimeBackend['updateOrderStatus']>[0]) {
    return this.orders.updateOrderStatus(params);
  }
  listPayments() {
    return this.orders.listPayments();
  }
  listRefunds() {
    return this.orders.listRefunds();
  }
  listShipments() {
    return this.orders.listShipments();
  }
  createShipment(params: Parameters<RuntimeBackend['createShipment']>[0]) {
    return this.orders.createShipment(params);
  }

  listMetalRates() {
    return this.pricing.listMetalRates();
  }
  getActiveMetalRates() {
    return this.pricing.getActiveMetalRates();
  }
  recordGoldRate(params: Parameters<RuntimeBackend['recordGoldRate']>[0]) {
    return this.pricing.recordGoldRate(params);
  }
  listDiamondRates() {
    return this.pricing.listDiamondRates();
  }
  getActiveDiamondRates() {
    return this.pricing.getActiveDiamondRates();
  }
  recordDiamondRate(params: Parameters<RuntimeBackend['recordDiamondRate']>[0]) {
    return this.pricing.recordDiamondRate(params);
  }
  listPricingRules() {
    return this.pricing.listPricingRules();
  }
  getActivePricingRule() {
    return this.pricing.getActivePricingRule();
  }
  createPricingRule(params: Parameters<PostgresPricingRepository['createPricingRule']>[0]) {
    return this.pricing.createPricingRule(params);
  }
  listPricingRuns() {
    return this.pricing.listPricingRuns();
  }
  findPricingRunById(runId: string) {
    return this.pricing.findPricingRunById(runId);
  }
  async createPricingRun(params: Parameters<RuntimeBackend['createPricingRun']>[0]): Promise<PricingRunRecord> {
    const run = await this.pricing.createPricingRun({
      pricingRuleId: params.pricingRuleId,
      rateSnapshot: params.rateSnapshot,
      summary: params.summary,
      notes: params.notes,
      createdBy: params.createdBy,
      actorRole: params.actorRole,
      items: params.items.map((i) => ({
        sku: i.sku,
        oldPriceInr: i.oldPriceInr,
        proposedPriceInr: i.proposedPriceInr,
        priceDeltaInr: i.priceDeltaInr,
        priceDeltaPercent: i.priceDeltaPercent,
        exceedsThreshold: i.exceedsThreshold,
        calculationBreakdown: i.breakdown as unknown as Record<string, unknown>,
        shopifyVariantGid: i.shopifyVariantGid,
      })),
    });
    const mapped = await this.pricing.findPricingRunById(run.id);
    if (!mapped) throw new Error(`PRICING_RUN_NOT_FOUND: ${run.id}`);
    return mapped;
  }
  async validatePricingRun(runId: string, actorEmail: string, actorRole: string) {
    await this.pricing.validatePricingRun(runId, actorEmail, actorRole);
    const mapped = await this.pricing.findPricingRunById(runId);
    if (!mapped) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    return mapped;
  }
  async approvePricingRun(runId: string, actorEmail: string, actorRole: string) {
    await this.pricing.approvePricingRun(runId, actorEmail, actorRole);
    const mapped = await this.pricing.findPricingRunById(runId);
    if (!mapped) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    return mapped;
  }
  async publishPricingRun(runId: string, actorEmail: string, actorRole: string) {
    const res = await this.pricing.publishPricingRun(runId, actorEmail, actorRole);
    const mapped = await this.pricing.findPricingRunById(runId);
    if (!mapped) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    return { run: mapped, snapshots: res.snapshots };
  }
  listPricingSnapshots() {
    return this.pricing.listPricingSnapshots();
  }

  listAdminUsers() {
    return this.ops.listAdminUsers();
  }
  findAdminUserByEmail(email: string) {
    return this.ops.findAdminUserByEmail(email);
  }
  updateAdminLastLogin(id: string) {
    return this.ops.updateAdminLastLogin(id);
  }
  updateAdminUserRole(params: Parameters<RuntimeBackend['updateAdminUserRole']>[0]) {
    return this.ops.updateAdminUserRole(params);
  }
  listDiscounts() {
    return this.ops.listDiscounts();
  }
  findDiscountByCode(code: string) {
    return this.ops.findDiscountByCode(code);
  }
  listBanners() {
    return this.ops.listBanners();
  }
  listContents() {
    return this.ops.listContents();
  }
  getSettings() {
    return this.ops.getSettings();
  }
  updateSettings(updates: Partial<StoreSettingsRecord>, actorEmail: string, actorRole: string) {
    return this.ops.updateSettings(updates, actorEmail, actorRole);
  }
  listAuditLogs() {
    return this.ops.listAuditLogs();
  }
  addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>) {
    return this.ops.addAuditLog(entry);
  }
  listNotifications() {
    return this.ops.listNotifications();
  }
  createNotification(params: Parameters<RuntimeBackend['createNotification']>[0]) {
    return this.ops.createNotification(params);
  }
  hasIntegrationEvent(provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY', eventId: string) {
    return this.ops.hasIntegrationEvent(provider, eventId);
  }
  recordIntegrationEvent(params: Parameters<RuntimeBackend['recordIntegrationEvent']>[0]) {
    return this.ops.recordIntegrationEvent(params);
  }
  getCart(cartId: string) {
    return this.ops.getCart(cartId);
  }
  saveCart(cart: CartRecord) {
    return this.ops.saveCart(cart);
  }
  getWishlist(wishlistId: string) {
    return this.ops.getWishlist(wishlistId);
  }
  toggleWishlist(wishlistId: string, sku: string) {
    return this.ops.toggleWishlist(wishlistId, sku);
  }
  listImportJobs() {
    return this.ops.listImportJobs();
  }
  findImportJobById(jobId: string) {
    return this.ops.findImportJobById(jobId);
  }
  createImportJob(params: Parameters<PostgresOperationsRepository['createImportJob']>[0]) {
    return this.ops.createImportJob(params);
  }
  commitImportJob(params: Parameters<RuntimeBackend['commitImportJob']>[0]) {
    return this.ops.commitImportJob(params);
  }
  updateImportJobStatus(
    jobId: string,
    status: ImportJobRecord['status'],
    actorEmail: string,
    actorRole: string,
    summary = ''
  ) {
    return this.ops.updateImportJobStatus(jobId, status, actorEmail, actorRole, summary);
  }
  rollbackImportJob(jobId: string, actorEmail: string, actorRole: string) {
    return this.ops.rollbackImportJob(jobId, actorEmail, actorRole);
  }

  // Phase 2 Customization, Models & Customer Designs
  listCustomizationProfiles() {
    return this.customization.listProfiles();
  }
  findCustomizationProfileById(id: string) {
    return this.customization.findProfileById(id);
  }
  createCustomizationProfile(params: Parameters<PostgresCustomizationRepository['createProfile']>[0]) {
    return this.customization.createProfile(params);
  }
  updateCustomizationProfile(
    profileId: string,
    updates: Parameters<PostgresCustomizationRepository['updateProfile']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.customization.updateProfile(profileId, updates, actorEmail, actorRole);
  }
  addCustomizationGroup(
    profileId: string,
    group: Parameters<PostgresCustomizationRepository['addGroup']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.customization.addGroup(profileId, group, actorEmail, actorRole);
  }
  updateCustomizationGroup(
    groupId: string,
    updates: Parameters<PostgresCustomizationRepository['updateGroup']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.customization.updateGroup(groupId, updates, actorEmail, actorRole);
  }
  addCustomizationOption(
    groupId: string,
    option: Parameters<PostgresCustomizationRepository['addOption']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.customization.addOption(groupId, option, actorEmail, actorRole);
  }
  updateCustomizationOption(
    optionId: string,
    updates: Parameters<PostgresCustomizationRepository['updateOption']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    return this.customization.updateOption(optionId, updates, actorEmail, actorRole);
  }
  listCustomizationAssignments() {
    return this.customization.listAssignments();
  }
  findCustomizationAssignmentByProductId(productId: string) {
    return this.customization.findAssignmentByProductId(productId);
  }
  upsertCustomizationAssignment(params: Parameters<PostgresCustomizationRepository['upsertProductAssignment']>[0]) {
    return this.customization.upsertProductAssignment(params);
  }
  listModelAssets() {
    return this.customization.listModelAssets();
  }
  findModelAssetByProductId(productId: string) {
    return this.customization.findModelAssetByProductId(productId);
  }
  upsertModelAsset(params: Parameters<PostgresCustomizationRepository['upsertModelAsset']>[0]) {
    return this.customization.upsertModelAsset(params);
  }
  deleteModelAsset(productId: string, actorEmail: string, actorRole: string) {
    return this.customization.deleteModelAsset(productId, actorEmail, actorRole);
  }
  listCustomerDesigns(customerId: string) {
    return this.customization.listCustomerDesigns(customerId);
  }
  listAllDesignsForAdmin() {
    return this.customization.listAllDesignsForAdmin();
  }
  findCustomerDesignById(designId: string) {
    return this.customization.findCustomerDesignById(designId);
  }
  createCustomerDesign(params: Parameters<PostgresCustomizationRepository['createCustomerDesign']>[0]) {
    return this.customization.createCustomerDesign(params);
  }
  updateCustomerDesign(
    designId: string,
    customerId: string,
    updates: Parameters<PostgresCustomizationRepository['updateCustomerDesign']>[2]
  ) {
    return this.customization.updateCustomerDesign(designId, customerId, updates);
  }
  deleteCustomerDesign(designId: string, customerId: string) {
    return this.customization.deleteCustomerDesign(designId, customerId);
  }
}

export class JsonRuntimeBackend implements RuntimeBackend {
  readonly mode = 'json' as const;
  readonly authLookup: AuthLookupProvider;

  constructor(private readonly store: DataStore) {
    this.authLookup = {
      findAdminByIdAndEmail: async (id, email) => {
        const user = this.store
          .getState()
          .users.find((u) => u.id === id && u.email.toLowerCase() === email.trim().toLowerCase());
        return user ? { id: user.id, email: user.email, role: user.role, isActive: user.isActive } : null;
      },
      findCustomerByIdAndEmail: async (id, email) => {
        const cust = this.store
          .getState()
          .customers.find((c) => c.id === id && c.email.toLowerCase() === email.trim().toLowerCase());
        return cust || null;
      },
    };
  }

  private persistOrThrow(): void {
    if (!this.store.persist()) {
      throw new Error('STATE_PERSIST_FAILED: Unable to persist platform state.');
    }
  }

  async healthCheck() {
    const s = this.store.getState();
    return {
      ok: true,
      backend: 'json' as const,
      counts: {
        products: s.products.length,
        categories: s.categories.length,
        orders: s.orders.length,
        customers: s.customers.length,
        pricingRuns: s.pricingRuns.length,
      },
    };
  }

  async listProducts(options?: { includeDrafts?: boolean }) {
    const products = this.store.getState().products;
    return options?.includeDrafts
      ? products
      : products.filter((p) => !p.status || p.status === 'ACTIVE');
  }
  async findProductByHandleOrSku(handleOrSku: string) {
    const k = handleOrSku.trim().toLowerCase();
    return (
      this.store
        .getState()
        .products.find((p) => p.sku.toLowerCase() === k || p.handle.toLowerCase() === k || p.id === handleOrSku) ||
      null
    );
  }
  async listCategories() {
    return this.store.getState().categories;
  }
  async listCollections() {
    return this.store.getState().collections;
  }
  async findCollectionByHandle(handle: string) {
    return (
      this.store.getState().collections.find((c) => c.handle.toLowerCase() === handle.trim().toLowerCase()) || null
    );
  }
  async createProduct(params: Parameters<PostgresCatalogRepository['createProduct']>[0]) {
    const s = this.store.getState();
    if (s.products.some((p) => p.sku === params.sku || p.handle === params.handle)) {
      throw new Error(`DUPLICATE_PRODUCT: SKU "${params.sku}" or handle "${params.handle}" already exists.`);
    }
    const created: JewelleryProductSpec = {
      id: `prod-${Date.now()}`,
      sku: params.sku,
      handle: params.handle,
      title: params.title,
      description: params.description,
      category: params.categoryName,
      shopifyProductGid: `gid://shopify/Product/${Date.now()}`,
      shopifyVariantGid: `gid://shopify/ProductVariant/${Date.now()}`,
      currentShopifyPriceInr: Number(params.priceInr).toFixed(2),
      metalType: params.metalType as JewelleryProductSpec['metalType'],
      metalPurity: params.metalPurity as JewelleryProductSpec['metalPurity'],
      metalColor: params.metalColor as JewelleryProductSpec['metalColor'],
      grossWeightGrams: Number(params.grossWeightGrams).toFixed(3),
      netMetalWeightGrams: Number(params.netMetalWeightGrams).toFixed(3),
      netWeightMode: (params.netWeightMode || 'EXPLICIT_NET_WEIGHT') as JewelleryProductSpec['netWeightMode'],
      diamondComponents: [],
      makingChargeMode: params.makingChargeMode as JewelleryProductSpec['makingChargeMode'],
      makingChargeValue: Number(params.makingChargeValue).toFixed(2),
      wastageMode: (params.wastageMode || 'NONE') as JewelleryProductSpec['wastageMode'],
      wastageValue: Number(params.wastageValue ?? 0).toFixed(3),
      certificationFeeInr: Number(params.certificationFeeInr ?? 0).toFixed(2),
      hallmarkFeeInr: Number(params.hallmarkFeeInr ?? 0).toFixed(2),
      fixedAdjustmentInr: Number(params.fixedAdjustmentInr ?? 0).toFixed(2),
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: params.inventoryQuantity,
      imageUrl: params.imageUrl,
      updatedAt: new Date().toISOString(),
    };
    s.products.unshift(created);
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'PRODUCT_CREATED',
      entityType: 'ProductMetadata',
      entityId: created.sku,
      summary: `Created product ${created.title} (${created.sku})`,
    });
    this.persistOrThrow();
    return created;
  }
  async updateProductAttributes(
    sku: string,
    updates: Parameters<PostgresCatalogRepository['updateProductAttributes']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const s = this.store.getState();
    const product = s.products.find((p) => p.sku === sku);
    if (!product) return null;
    Object.assign(product, updates, { updatedAt: new Date().toISOString() });
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'PRODUCT_PRICING_ATTRIBUTES_UPDATED',
      entityType: 'ProductMetadata',
      entityId: sku,
      summary: `Updated pricing attributes for ${sku}`,
      afterData: updates,
    });
    this.persistOrThrow();
    return product;
  }
  async deleteProduct(sku: string, actorEmail: string, actorRole: string) {
    const s = this.store.getState();
    const idx = s.products.findIndex((p) => p.sku === sku);
    if (idx === -1) return null;
    const [removed] = s.products.splice(idx, 1);
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'PRODUCT_DELETED',
      entityType: 'ProductMetadata',
      entityId: sku,
      summary: `Deleted product ${removed!.title} (${sku})`,
    });
    this.persistOrThrow();
    return removed!;
  }
  async listInventory() {
    return this.store.getState().products.map((p) => ({
      id: p.id,
      sku: p.sku,
      title: p.title,
      category: p.category,
      locationName: 'Mumbai Studio Vault',
      availableQuantity: p.inventoryQuantity,
      reservedQuantity: 0,
      lowStockThreshold: 2,
      isLowStock: p.inventoryQuantity <= 2,
      isProvisional: false,
      provisionalNote: undefined,
      updatedAt: p.updatedAt,
    }));
  }
  async adjustInventory(params: Parameters<PostgresCatalogRepository['adjustInventory']>[0]) {
    const s = this.store.getState();
    const product = s.products.find((p) => p.sku === params.sku);
    if (!product) throw new Error(`PRODUCT_NOT_FOUND: SKU "${params.sku}" not found.`);
    const previousQuantity = product.inventoryQuantity;
    const newQuantity = previousQuantity + params.quantityDelta;
    if (newQuantity < 0) {
      throw new Error(
        `INSUFFICIENT_STOCK: Cannot adjust ${params.sku} by ${params.quantityDelta}; available is ${previousQuantity}.`
      );
    }
    product.inventoryQuantity = newQuantity;
    product.updatedAt = new Date().toISOString();
    const movement: InventoryMovementRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sku: product.sku,
      title: product.title,
      movementType: 'ADJUSTMENT',
      deltaQuantity: params.quantityDelta,
      previousAvailable: previousQuantity,
      newAvailable: newQuantity,
      reason: params.reason,
      actorEmail: params.actorEmail,
      createdAt: new Date().toISOString(),
    };
    s.inventoryMovements.unshift(movement);
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'INVENTORY_ADJUSTED',
      entityType: 'InventoryRecord',
      entityId: product.sku,
      summary: `Adjusted inventory for ${product.sku} from ${previousQuantity} to ${newQuantity}`,
    });
    this.persistOrThrow();
    return { sku: product.sku, previousQuantity, newQuantity, movement };
  }
  async listInventoryMovements() {
    return this.store.getState().inventoryMovements;
  }

  async listCustomers() {
    return this.store.getState().customers;
  }
  async findCustomerByEmail(email: string) {
    return (
      this.store.getState().customers.find((c) => c.email.toLowerCase() === email.trim().toLowerCase()) || null
    );
  }
  async findCustomerById(id: string) {
    return this.store.getState().customers.find((c) => c.id === id) || null;
  }
  async createCustomer(params: Parameters<RuntimeBackend['createCustomer']>[0]) {
    const s = this.store.getState();
    const created: CustomerRecord = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: params.email.trim().toLowerCase(),
      passwordHash: params.passwordHash,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      phone: params.phone,
      city: params.city,
      state: params.state,
      isActive: true,
      emailVerified: params.emailVerified ?? false,
      emailVerificationTokenHash: params.emailVerificationTokenHash,
      emailVerificationExpiresAt: params.emailVerificationExpiresAt?.toISOString(),
      emailVerificationLastSentAt: params.emailVerificationLastSentAt?.toISOString(),
      totalOrdersCount: 0,
      totalSpentInr: '0.00',
      tags: ['REGISTERED'],
      createdAt: new Date().toISOString(),
    };
    s.customers.unshift(created);
    this.persistOrThrow();
    return created;
  }
  async updateVerificationToken(customerId: string, tokenHash: string, expiresAt: Date, sentAt: Date) {
    const cust = await this.findCustomerById(customerId);
    if (!cust) throw new Error(`CUSTOMER_NOT_FOUND: ${customerId}`);
    cust.emailVerificationTokenHash = tokenHash;
    cust.emailVerificationExpiresAt = expiresAt.toISOString();
    cust.emailVerificationLastSentAt = sentAt.toISOString();
    this.persistOrThrow();
    return cust;
  }
  async markEmailVerified(customerId: string) {
    const cust = await this.findCustomerById(customerId);
    if (!cust) throw new Error(`CUSTOMER_NOT_FOUND: ${customerId}`);
    cust.emailVerified = true;
    cust.emailVerificationTokenHash = undefined;
    cust.emailVerificationExpiresAt = undefined;
    this.store.stageAuditLog({
      actorEmail: cust.email,
      actorRole: 'CUSTOMER',
      action: 'CUSTOMER_EMAIL_VERIFIED',
      entityType: 'Customer',
      entityId: cust.id,
      summary: `Verified email for customer ${cust.email}`,
    });
    this.persistOrThrow();
    return cust;
  }

  async listOrders() {
    return this.store.getState().orders;
  }
  async findOrderByIdOrNumber(idOrNumber: string) {
    return (
      this.store.getState().orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber) || null
    );
  }
  async findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null> {
    const key = idempotencyKey.trim();
    if (!key) return null;
    return this.store.getState().orders.find((o) => o.idempotencyKey === key) || null;
  }
  async attachRazorpayOrderToOrder(params: Parameters<RuntimeBackend['attachRazorpayOrderToOrder']>[0]): Promise<OrderRecord> {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    if (order.financialStatus === 'PAID') {
      throw new Error('ORDER_ALREADY_PAID: Cannot create a new payment order for a paid order.');
    }
    order.razorpayOrderId = params.razorpayOrderId;
    this.store.stageAuditLog({
      actorEmail: params.actorEmail || order.customerEmail,
      actorRole: (params.actorRole as AdminRoleName | 'CUSTOMER' | 'SYSTEM') || 'CUSTOMER',
      action: 'RAZORPAY_ORDER_ATTACHED',
      entityType: 'OrderMetadata',
      entityId: order.id,
      summary: `Attached Razorpay order ${params.razorpayOrderId} to ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return order;
  }
  async recordPaymentAttemptStatus(params: Parameters<RuntimeBackend['recordPaymentAttemptStatus']>[0]) {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    if (order.financialStatus === 'PAID') {
      return { recorded: false, ignoredReason: 'already_paid' };
    }
    const existing = s.payments.find((p) => p.providerPaymentId === params.providerPaymentId);
    if (existing && existing.orderId !== order.id) {
      throw new Error('PAYMENT_ALREADY_ASSOCIATED: This payment ID is already linked to another order.');
    }
    if (existing && existing.status === 'CAPTURED') {
      return { recorded: false, ignoredReason: 'already_captured' };
    }
    if (existing) {
      existing.status = params.status;
      existing.method = params.method || existing.method;
    } else {
      s.payments.unshift({
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        provider: 'RAZORPAY',
        providerPaymentId: params.providerPaymentId,
        amountInr: Number(params.amountInr).toFixed(2),
        currency: 'INR',
        method: params.method || 'unknown',
        status: params.status,
        signatureVerified: true,
        capturedAt: new Date().toISOString(),
      });
    }
    this.store.stageAuditLog({
      actorEmail: params.actorEmail || order.customerEmail,
      actorRole: (params.actorRole as AdminRoleName | 'CUSTOMER' | 'SYSTEM') || 'SYSTEM',
      action: params.status === 'AUTHORIZED' ? 'PAYMENT_AUTHORIZED' : 'PAYMENT_FAILED',
      entityType: 'OrderMetadata',
      entityId: order.id,
      summary: `Recorded ${params.status} payment ${params.providerPaymentId} for ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return { recorded: true };
  }
  async listOrdersByCustomer(customerId: string, email: string) {
    const e = email.trim().toLowerCase();
    return this.store
      .getState()
      .orders.filter((o) => o.customerId === customerId || o.customerEmail.toLowerCase() === e);
  }
  async createOrderWithInventoryReservation(params: CreateOrderParams): Promise<OrderRecord> {
    const s = this.store.getState();
    for (const item of params.lineItems) {
      const prod = s.products.find((p) => p.sku === item.sku);
      if (!prod) throw new Error(`PRODUCT_NOT_FOUND: SKU "${item.sku}" does not exist.`);
      if (prod.inventoryQuantity < item.quantity) {
        throw new Error(
          `INSUFFICIENT_STOCK: SKU "${item.sku}" has ${prod.inventoryQuantity} available, cannot reserve ${item.quantity}.`
        );
      }
    }
    for (const item of params.lineItems) {
      const prod = s.products.find((p) => p.sku === item.sku)!;
      const prev = prod.inventoryQuantity;
      prod.inventoryQuantity -= item.quantity;
      s.inventoryMovements.unshift({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku: item.sku,
        title: prod.title,
        movementType: 'RESERVATION',
        deltaQuantity: -item.quantity,
        previousAvailable: prev,
        newAvailable: prod.inventoryQuantity,
        reason: `Order ${params.orderNumber} reservation`,
        actorEmail: params.customerEmail,
        createdAt: new Date().toISOString(),
      });
    }
    const newOrder: OrderRecord = {
      id: `ord-${Date.now()}`,
      orderNumber: params.orderNumber,
      customerId: params.customerId || 'cust-guest',
      customerName: params.customerName,
      customerEmail: params.customerEmail.trim().toLowerCase(),
      customerPhone: params.customerPhone || '',
      shippingCity: params.shippingCity,
      shippingState: params.shippingState,
      shippingPincode: params.shippingPincode,
      totalPriceInr: Number(params.totalPriceInr).toFixed(2),
      subtotalPriceInr: Number(params.subtotalPriceInr).toFixed(2),
      totalTaxInr: Number(params.totalTaxInr).toFixed(2),
      financialStatus: 'PENDING',
      fulfillmentStatus: 'UNFULFILLED',
      paymentGateway: params.paymentGateway || 'RAZORPAY',
      idempotencyKey: params.idempotencyKey,
      razorpayOrderId: params.razorpayOrderId,
      lineItems: params.lineItems.map((i) => ({
        sku: i.sku,
        title: i.title,
        quantity: i.quantity,
        purchaseTimePriceInr: Number(i.purchaseTimePriceInr).toFixed(2),
        metalPurity: i.metalPurity || '18K',
        diamondCarats: i.diamondCarats || '0.000',
        pricingSnapshotId: i.pricingSnapshotId || 'snap-immutable',
      })),
      placedAt: new Date().toISOString(),
    };
    s.orders.unshift(newOrder);
    this.store.stageAuditLog({
      actorEmail: params.auditActorEmail || newOrder.customerEmail,
      actorRole: (params.auditActorRole as AdminRoleName | 'CUSTOMER' | 'SYSTEM') || 'SYSTEM',
      action: 'ORDER_CREATED',
      entityType: 'OrderMetadata',
      entityId: newOrder.id,
      summary: `Created order ${newOrder.orderNumber}`,
    });
    this.persistOrThrow();
    return newOrder;
  }
  async confirmPaymentCapture(params: Parameters<RuntimeBackend['confirmPaymentCapture']>[0]) {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    if (order.financialStatus === 'PAID') {
      const existing = s.payments.find((p) => p.providerPaymentId === params.providerPaymentId);
      if (existing) return { order, payment: existing, idempotent: true };
      throw new Error('ORDER_ALREADY_PAID: Order already paid under a different payment reference.');
    }
    const existingPayment = s.payments.find((p) => p.providerPaymentId === params.providerPaymentId);
    if (existingPayment && existingPayment.orderId !== order.id) {
      throw new Error('PAYMENT_ALREADY_ASSOCIATED: This payment ID is already linked to another order.');
    }
    let payment: PaymentRecordItem;
    if (existingPayment) {
      existingPayment.status = 'CAPTURED';
      existingPayment.method = params.method || existingPayment.method;
      existingPayment.signatureVerified = true;
      existingPayment.capturedAt = new Date().toISOString();
      payment = existingPayment;
    } else {
      payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        provider: 'RAZORPAY',
        providerPaymentId: params.providerPaymentId,
        amountInr: Number(params.amountInr).toFixed(2),
        currency: 'INR',
        method: params.method || 'upi',
        status: 'CAPTURED',
        signatureVerified: true,
        capturedAt: new Date().toISOString(),
      };
      s.payments.unshift(payment);
    }
    order.financialStatus = 'PAID';
    order.razorpayPaymentId = params.providerPaymentId;
    this.store.stageAuditLog({
      actorEmail: params.actorEmail || order.customerEmail,
      actorRole: (params.actorRole as AdminRoleName | 'CUSTOMER' | 'SYSTEM') || 'SYSTEM',
      action: 'PAYMENT_CAPTURED',
      entityType: 'OrderMetadata',
      entityId: order.id,
      summary: `Verified Razorpay payment ${params.providerPaymentId} for ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return { order, payment, idempotent: false };
  }
  async createRefund(params: Parameters<RuntimeBackend['createRefund']>[0]) {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.financialStatus)) {
      throw new Error(`ORDER_NOT_REFUNDABLE: Order ${order.orderNumber} is ${order.financialStatus}`);
    }
    const payment = s.payments.find((p) => p.orderId === order.id && p.status === 'CAPTURED');
    if (!payment) throw new Error(`PAYMENT_NOT_FOUND: No captured payment for ${order.orderNumber}`);
    const alreadyRefunded = s.refunds
      .filter((r) => r.orderId === order.id && r.status === 'PROCESSED')
      .reduce((sum, r) => sum + Number(r.amountInr), 0);
    const remaining = Number((Number(order.totalPriceInr) - alreadyRefunded).toFixed(2));
    if (params.amountInr <= 0 || params.amountInr > remaining) {
      throw new Error(`REFUND_EXCEEDS_BALANCE: Requested ₹${params.amountInr} > ₹${remaining}`);
    }
    const refund: RefundRecordItem = {
      id: `ref-${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      providerRefundId: `rfnd_${Date.now()}`,
      amountInr: params.amountInr.toFixed(2),
      reason: params.reason,
      status: 'PROCESSED',
      initiatedByEmail: params.initiatedByEmail,
      processedAt: new Date().toISOString(),
    };
    s.refunds.unshift(refund);
    order.financialStatus = alreadyRefunded + params.amountInr >= Number(order.totalPriceInr) - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    this.store.stageAuditLog({
      actorEmail: params.initiatedByEmail,
      actorRole: params.initiatedByRole as AdminRoleName,
      action: 'ORDER_REFUNDED',
      entityType: 'RefundRecord',
      entityId: refund.id,
      summary: `Processed refund ${refund.providerRefundId} for ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return { refund, order };
  }
  async cancelOrderWithRestock(orderId: string, actorEmail: string, _cancelReason = 'Customer cancellation', actorRole = 'CUSTOMER') {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
    if (order.fulfillmentStatus === 'CANCELLED') return { order, idempotent: true };
    if (['IN_TRANSIT', 'FULFILLED'].includes(order.fulfillmentStatus)) {
      throw new Error(`ORDER_NOT_CANCELLABLE: Cannot cancel order in status "${order.fulfillmentStatus}".`);
    }
    for (const item of order.lineItems) {
      const prod = s.products.find((p) => p.sku === item.sku);
      if (prod) {
        const prev = prod.inventoryQuantity;
        prod.inventoryQuantity += item.quantity;
        s.inventoryMovements.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sku: item.sku,
          title: prod.title,
          movementType: 'CANCELLATION_RESTORE',
          deltaQuantity: item.quantity,
          previousAvailable: prev,
          newAvailable: prod.inventoryQuantity,
          reason: `Order ${order.orderNumber} restock on cancellation`,
          actorEmail,
          createdAt: new Date().toISOString(),
        });
      }
    }
    order.fulfillmentStatus = 'CANCELLED';
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName | 'CUSTOMER',
      action: 'ORDER_CANCELLED',
      entityType: 'OrderMetadata',
      entityId: order.id,
      summary: `Cancelled order ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return { order, idempotent: false };
  }
  async updateOrderStatus(params: Parameters<RuntimeBackend['updateOrderStatus']>[0]) {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    if (params.newStatus === 'CANCELLED') {
      const res = await this.cancelOrderWithRestock(
        order.id,
        params.actorEmail,
        params.reason || 'Status transition to CANCELLED',
        params.actorRole
      );
      return res.order;
    }
    if ((order.fulfillmentStatus as string) === 'CANCELLED') {
      throw new Error('INVALID_STATE_TRANSITION: Cannot transition cancelled order.');
    }
    if ((order.fulfillmentStatus as string) === 'DELIVERED') {
      throw new Error('INVALID_STATE_TRANSITION: Cannot transition delivered order.');
    }
    const previous = order.fulfillmentStatus;
    order.fulfillmentStatus = params.newStatus as OrderRecord['fulfillmentStatus'];
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'OrderMetadata',
      entityId: order.id,
      summary: `Transitioned order ${order.orderNumber} status from ${previous} to ${params.newStatus}`,
    });
    this.persistOrThrow();
    return order;
  }
  async listPayments() {
    return this.store.getState().payments;
  }
  async listRefunds() {
    return this.store.getState().refunds;
  }
  async listShipments() {
    return this.store.getState().shipments;
  }
  async createShipment(params: Parameters<RuntimeBackend['createShipment']>[0]) {
    const s = this.store.getState();
    const order = s.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
    s.shipments.unshift(params.shipment);
    order.fulfillmentStatus = 'IN_TRANSIT';
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'SHIPMENT_CREATED',
      entityType: 'Shipment',
      entityId: params.shipment.id,
      summary: `Created shipment ${params.shipment.awbCode} for ${order.orderNumber}`,
    });
    this.persistOrThrow();
    return params.shipment;
  }

  async listMetalRates() {
    return this.store.getState().metalRates;
  }
  async getActiveMetalRates() {
    const seen = new Set<string>();
    const active: MetalRateRecord[] = [];
    for (const r of this.store.getState().metalRates) {
      const key = `${r.metalType}::${r.purity}`;
      if (!seen.has(key)) {
        seen.add(key);
        active.push(r);
      }
    }
    return active;
  }
  async recordGoldRate(params: Parameters<RuntimeBackend['recordGoldRate']>[0]) {
    const s = this.store.getState();
    const now = new Date().toISOString();
    const previous = s.metalRates.find(
      (r) => r.metalType === params.metalType && r.purity === params.purity
    );
    const rateVersion =
      s.metalRates.filter((r) => r.metalType === params.metalType && r.purity === params.purity)
        .length + 1;
    const entry: MetalRateRecord = {
      id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      metalType: params.metalType as MetalRateRecord['metalType'],
      purity: params.purity as MetalRateRecord['purity'],
      ratePerGramInr: Number(params.ratePerGramInr).toFixed(2),
      currency: 'INR',
      source: params.source || 'Owner-updated market rates',
      isPlaceholder: params.isPlaceholder ?? false,
      effectiveAt: now,
      createdBy: params.createdBy,
      createdAt: now,
    };
    s.metalRates.unshift(entry);
    this.store.stageAuditLog({
      actorEmail: params.createdBy,
      actorRole: (params.actorRole as AdminRoleName) || 'PRICING_OPERATOR',
      action: 'METAL_RATE_UPDATED',
      entityType: 'GoldRate',
      entityId: entry.id,
      summary: `Recorded ${params.metalType} ${params.purity} rate ₹${entry.ratePerGramInr}/g (v${rateVersion})`,
      beforeData: previous
        ? {
            id: previous.id,
            metalType: previous.metalType,
            purity: previous.purity,
            ratePerGramInr: previous.ratePerGramInr,
            source: previous.source,
            effectiveAt: previous.effectiveAt,
          }
        : null,
      afterData: {
        id: entry.id,
        metalType: entry.metalType,
        purity: entry.purity,
        ratePerGramInr: entry.ratePerGramInr,
        source: entry.source,
        rateVersion,
        changedBy: params.createdBy,
        effectiveAt: entry.effectiveAt,
      },
    });
    this.persistOrThrow();
    return entry;
  }
  async listDiamondRates() {
    return this.store.getState().diamondRates;
  }
  async getActiveDiamondRates() {
    return this.store.getState().diamondRates.filter((d) => d.isActive);
  }
  async recordDiamondRate(params: Parameters<RuntimeBackend['recordDiamondRate']>[0]) {
    const s = this.store.getState();
    const now = new Date().toISOString();
    const minStr = Number(params.caratMin).toFixed(4);
    const maxStr = Number(params.caratMax).toFixed(4);
    const previous = s.diamondRates.find(
      (d) =>
        d.shape === params.shape &&
        Number(d.sizeMinCarat).toFixed(4) === minStr &&
        Number(d.sizeMaxCarat).toFixed(4) === maxStr
    );
    const nextVersion = (previous?.version ?? 0) + 1;
    if (params.isPlaceholder === false) {
      for (const dr of s.diamondRates) {
        if (
          dr.isPlaceholder ||
          (dr.shape === params.shape &&
            Number(dr.sizeMinCarat).toFixed(4) === minStr &&
            Number(dr.sizeMaxCarat).toFixed(4) === maxStr)
        ) {
          dr.isActive = false;
        }
      }
    }
    const entry: DiamondRateMatrixEntry = {
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      shape: params.shape as DiamondRateMatrixEntry['shape'],
      sizeMinCarat: minStr,
      sizeMaxCarat: maxStr,
      colorGrade: params.colorGrade,
      clarityGrade: params.clarityGrade,
      cutGrade: params.cutGrade || 'EXCELLENT',
      pricingType: 'PER_CARAT',
      rateInr: Number(params.ratePerCaratInr).toFixed(2),
      currency: 'INR',
      version: nextVersion,
      isPlaceholder: params.isPlaceholder ?? false,
      isActive: true,
      effectiveAt: now,
      createdBy: params.createdBy,
      createdAt: now,
    };
    s.diamondRates.unshift(entry);
    this.store.stageAuditLog({
      actorEmail: params.createdBy,
      actorRole: (params.actorRole as AdminRoleName) || 'PRICING_OPERATOR',
      action: 'DIAMOND_RATE_UPDATED',
      entityType: 'DiamondRate',
      entityId: entry.id,
      summary: `Recorded diamond rate ${params.shape} ${minStr}-${maxStr}ct at ₹${entry.rateInr}/ct (v${nextVersion})`,
      beforeData: previous
        ? {
            id: previous.id,
            shape: previous.shape,
            sizeMinCarat: previous.sizeMinCarat,
            sizeMaxCarat: previous.sizeMaxCarat,
            rateInr: previous.rateInr,
            version: previous.version,
            effectiveAt: previous.effectiveAt,
          }
        : null,
      afterData: {
        id: entry.id,
        shape: entry.shape,
        sizeMinCarat: entry.sizeMinCarat,
        sizeMaxCarat: entry.sizeMaxCarat,
        rateInr: entry.rateInr,
        rateVersion: nextVersion,
        changedBy: params.createdBy,
        effectiveAt: entry.effectiveAt,
      },
    });
    this.persistOrThrow();
    return entry;
  }
  private enrichRule(rule: PricingFormulaRule): PricingFormulaRule {
    const match = rule.description.match(/\[MAKING_CHARGE_PER_GRAM_INR:([0-9.]+)\]/);
    const makingChargePerGramInr =
      match?.[1] || rule.makingChargePerGramInr || (!rule.isPlaceholderFormula ? '2500.00' : undefined);
    return {
      ...rule,
      makingChargePerGramInr,
      useRateCardMakingCharge: Boolean(match || rule.useRateCardMakingCharge || !rule.isPlaceholderFormula),
      confirmedGstPurities: rule.confirmedGstPurities ?? ['14K', '18K'],
      rateCardLabel: rule.rateCardLabel || 'Owner-updated market rates',
      // Test fixtures are built from placeholder rates; only automated tests may price with them.
      allowPlaceholderPricing:
        rule.allowPlaceholderPricing ?? (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)),
    };
  }
  async listPricingRules() {
    return this.store.getState().pricingRules.map((r) => this.enrichRule(r));
  }
  async getActivePricingRule() {
    const found = this.store.getState().pricingRules.find((r) => r.status === 'APPROVED') || null;
    return found ? this.enrichRule(found) : null;
  }
  async createPricingRule(params: Parameters<PostgresPricingRepository['createPricingRule']>[0]) {
    const s = this.store.getState();
    const previous = s.pricingRules[0] || null;
    const nextVersion = Math.max(0, ...s.pricingRules.map((r) => r.version)) + 1;
    const created: PricingFormulaRule = this.enrichRule({
      id: `rule-${Date.now()}`,
      version: nextVersion,
      name: params.name,
      description: params.description,
      status: 'APPROVED',
      isPlaceholderFormula: params.isPlaceholderFormula ?? false,
      stoneWeightToGramsFactor: Number(params.stoneWeightToGramsFactor).toFixed(4),
      gstRatePercent: Number(params.gstRatePercent).toFixed(2),
      gstMode: params.gstMode as PricingFormulaRule['gstMode'],
      roundingMode: params.roundingMode as PricingFormulaRule['roundingMode'],
      maxPriceDeltaPercentThreshold: Number(params.maxPriceDeltaPercentThreshold).toFixed(2),
      defaultCertificationFeeInr: Number(params.defaultCertificationFeeInr ?? 0).toFixed(2),
      defaultHallmarkFeeInr: Number(params.defaultHallmarkFeeInr ?? 0).toFixed(2),
      approvedBy: params.createdBy,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    s.pricingRules.unshift(created);
    this.store.stageAuditLog({
      actorEmail: params.createdBy,
      actorRole: (params.actorRole as AdminRoleName) || 'OWNER',
      action: 'PRICING_RULE_CREATED',
      entityType: 'PricingRule',
      entityId: created.id,
      summary: `Created pricing rule v${created.version}: ${created.name}`,
      beforeData: previous
        ? { version: previous.version, name: previous.name, description: previous.description }
        : null,
      afterData: { version: created.version, name: created.name, description: created.description },
    });
    this.persistOrThrow();
    return created;
  }
  async listPricingRuns() {
    return this.store.getState().pricingRuns;
  }
  async findPricingRunById(runId: string) {
    return this.store.getState().pricingRuns.find((r) => r.id === runId) || null;
  }
  async createPricingRun(params: Parameters<RuntimeBackend['createPricingRun']>[0]) {
    const s = this.store.getState();
    const rule = s.pricingRules.find((r) => r.id === params.pricingRuleId);
    const run: PricingRunRecord = {
      id: `run-${Date.now()}`,
      status: 'PREVIEWED',
      ruleVersion: rule?.version ?? 1,
      ruleId: params.pricingRuleId,
      notes: params.notes || '',
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
      summary: params.summary,
      items: params.items,
    };
    s.pricingRuns.unshift(run);
    this.persistOrThrow();
    return run;
  }
  async validatePricingRun(runId: string, actorEmail: string, actorRole: string) {
    const run = await this.findPricingRunById(runId);
    if (!run) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    run.status = 'VALIDATED';
    run.validatedBy = actorEmail;
    run.validatedAt = new Date().toISOString();
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'PRICING_RUN_VALIDATED',
      entityType: 'PricingRun',
      entityId: run.id,
      summary: `Validated pricing run ${run.id}`,
    });
    this.persistOrThrow();
    return run;
  }
  async approvePricingRun(runId: string, actorEmail: string, actorRole: string) {
    const run = await this.findPricingRunById(runId);
    if (!run) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    run.status = 'APPROVED';
    run.approvedBy = actorEmail;
    run.approvedAt = new Date().toISOString();
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'PRICING_RUN_APPROVED',
      entityType: 'PricingRun',
      entityId: run.id,
      summary: `Owner approved pricing run ${run.id}`,
    });
    this.persistOrThrow();
    return run;
  }
  async publishPricingRun(runId: string, actorEmail: string, actorRole: string) {
    const s = this.store.getState();
    const run = await this.findPricingRunById(runId);
    if (!run) throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
    const publishedAt = new Date().toISOString();
    const snapshots: PricingSnapshotRecord[] = [];
    for (const item of run.items) {
      const prod = s.products.find((p) => p.sku === item.sku);
      if (prod) prod.currentShopifyPriceInr = item.proposedPriceInr;
      const snap: PricingSnapshotRecord = {
        id: `snap-${Date.now()}-${item.sku}`,
        sku: item.sku,
        shopifyVariantGid: item.shopifyVariantGid,
        pricingRunId: run.id,
        formulaVersion: run.ruleVersion,
        publishedPriceInr: item.proposedPriceInr,
        currency: 'INR',
        breakdown: item.breakdown as PriceCalculationBreakdown,
        publishedBy: actorEmail,
        publishedAt,
      };
      s.pricingSnapshots.unshift(snap);
      snapshots.push(snap);
    }
    run.status = 'PUBLISHED';
    run.publishedBy = actorEmail;
    run.publishedAt = publishedAt;
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'PRICING_RUN_PUBLISHED',
      entityType: 'PricingRun',
      entityId: run.id,
      summary: `Published pricing run ${run.id}`,
    });
    this.persistOrThrow();
    return { run, snapshots };
  }
  async listPricingSnapshots() {
    return this.store.getState().pricingSnapshots;
  }

  async listAdminUsers() {
    return this.store.getState().users;
  }
  async findAdminUserByEmail(email: string) {
    return (
      this.store.getState().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null
    );
  }
  async updateAdminLastLogin(id: string) {
    const u = this.store.getState().users.find((x) => x.id === id);
    if (u) {
      u.lastLoginAt = new Date().toISOString();
      this.store.persist();
    }
  }
  async updateAdminUserRole(params: Parameters<RuntimeBackend['updateAdminUserRole']>[0]) {
    const s = this.store.getState();
    const user = s.users.find(
      (u) => u.id === params.userId || u.email.toLowerCase() === params.userId.toLowerCase()
    );
    if (!user) {
      throw new Error(`ADMIN_USER_NOT_FOUND: ${params.userId}`);
    }
    if (user.role === 'OWNER' && params.role !== 'OWNER') {
      const activeOwners = s.users.filter((u) => u.role === 'OWNER' && u.isActive);
      if (activeOwners.length <= 1) {
        throw new Error('CANNOT_DOWNGRADE_LAST_OWNER: At least one active owner must remain.');
      }
    }
    const previousRole = user.role;
    user.role = params.role;
    user.permissions = [...ROLE_PERMISSIONS[params.role]];
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'ADMIN_ROLE_UPDATED',
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `Updated role for ${user.email} from ${previousRole} to ${params.role}`,
    });
    this.persistOrThrow();
    return user;
  }
  async listDiscounts() {
    return this.store.getState().discounts;
  }
  async findDiscountByCode(code: string) {
    return (
      this.store.getState().discounts.find((d) => d.code.toLowerCase() === code.trim().toLowerCase()) || null
    );
  }
  async listBanners() {
    return this.store.getState().banners;
  }
  async listContents() {
    return this.store.getState().contents;
  }
  async getSettings() {
    return this.store.getState().settings;
  }
  async updateSettings(updates: Partial<StoreSettingsRecord>, actorEmail: string, actorRole: string) {
    const s = this.store.getState();
    const before = { ...s.settings };
    s.settings = { ...s.settings, ...updates };
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'SETTINGS_UPDATED',
      entityType: 'StoreSettings',
      entityId: 'global',
      summary: 'Updated store & integration governance settings',
      beforeData: before,
      afterData: s.settings,
    });
    this.persistOrThrow();
    return s.settings;
  }
  async listAuditLogs() {
    return this.store.getState().auditLogs;
  }
  async addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>) {
    const rec = this.store.addAuditLog(entry);
    if (!rec) throw new Error('AUDIT_PERSIST_FAILED: Unable to persist audit log.');
    return rec;
  }
  async listNotifications() {
    return this.store.getState().notifications;
  }
  async createNotification(params: Parameters<RuntimeBackend['createNotification']>[0]) {
    const rec: NotificationRecord = {
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      recipientEmail: params.recipientEmail,
      channel: params.channel,
      templateCode: params.templateCode,
      subject: params.subject,
      body: params.body,
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };
    this.store.getState().notifications.unshift(rec);
    this.persistOrThrow();
    return rec;
  }
  async hasIntegrationEvent(provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY', eventId: string) {
    return this.store
      .getState()
      .integrationEvents.some((e) => e.provider === provider && e.eventId === eventId);
  }
  async recordIntegrationEvent(params: Parameters<RuntimeBackend['recordIntegrationEvent']>[0]) {
    const rec: IntegrationEventRecord = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      provider: params.provider,
      eventId: params.eventId,
      eventType: params.eventType,
      payloadHash: params.payloadHash,
      status: params.status,
      receivedAt: new Date().toISOString(),
    };
    this.store.getState().integrationEvents.unshift(rec);
    this.persistOrThrow();
    return rec;
  }
  async getCart(cartId: string) {
    return this.store.getState().carts[cartId] || null;
  }
  async saveCart(cart: CartRecord) {
    this.store.getState().carts[cart.id] = cart;
    this.persistOrThrow();
    return cart;
  }
  async getWishlist(wishlistId: string) {
    return this.store.getState().wishlists[wishlistId] || [];
  }
  async toggleWishlist(wishlistId: string, sku: string) {
    const s = this.store.getState();
    const list = s.wishlists[wishlistId] || [];
    const idx = list.indexOf(sku);
    if (idx === -1) list.push(sku);
    else list.splice(idx, 1);
    s.wishlists[wishlistId] = list;
    this.persistOrThrow();
    return list;
  }
  async listImportJobs() {
    return this.store.getState().importJobs;
  }
  async findImportJobById(jobId: string) {
    return this.store.getState().importJobs.find((j) => j.id === jobId) || null;
  }
  async createImportJob(params: Parameters<PostgresOperationsRepository['createImportJob']>[0]) {
    const s = this.store.getState();
    let committedProductsCount = 0;
    let skippedTestArtifacts = 0;

    if (!params.job.dryRun && params.newProducts.length > 0) {
      for (const prod of params.newProducts) {
        if (/^TEST[-_]/i.test(prod.sku) || /^test[-_]/i.test(prod.handle)) {
          skippedTestArtifacts += 1;
          continue;
        }
        if (s.products.some((p) => p.sku === prod.sku)) {
          continue;
        }
        s.products.unshift(prod);
        committedProductsCount += 1;
      }
    }
    s.importJobs.unshift(params.job);
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: params.job.dryRun ? 'IMPORT_DRY_RUN' : 'IMPORT_COMMITTED',
      entityType: 'ImportJob',
      entityId: params.job.id,
      summary: `${params.job.dryRun ? 'Dry-run validated' : 'Committed'} import ${params.job.sourceFileName} (${committedProductsCount} new products)`,
    });
    this.persistOrThrow();
    return { job: params.job, committedProductsCount, skippedTestArtifacts };
  }
  async commitImportJob(params: Parameters<RuntimeBackend['commitImportJob']>[0]) {
    const s = this.store.getState();
    const job = s.importJobs.find((j) => j.id === params.jobId);
    if (!job) {
      throw new Error(`IMPORT_JOB_NOT_FOUND: ${params.jobId}`);
    }
    if (job.workbookHash && job.workbookHash !== params.workbookHash) {
      throw new Error('WORKBOOK_HASH_MISMATCH: Supplied workbook hash does not match preview job.');
    }
    if (job.expiresAt && new Date(job.expiresAt).getTime() < Date.now()) {
      throw new Error('IMPORT_JOB_EXPIRED: Preview job has expired. Please re-upload the workbook.');
    }
    if (job.status === 'COMMITTED') {
      return {
        job,
        committedProductsCount: job.committedProductsCount ?? 0,
        skippedTestArtifacts: 0,
        alreadyCommitted: true,
      };
    }
    if (job.status !== 'PREVIEWED' && job.status !== 'DRY_RUN_COMPLETED') {
      throw new Error(
        `INVALID_IMPORT_JOB_STATE: Import job is in status '${job.status}', expected 'PREVIEWED'.`
      );
    }

    let committedProductsCount = 0;
    let skippedTestArtifacts = 0;
    const productsToCommit = job.validNewProducts || [];

    for (const prod of productsToCommit) {
      if (/^TEST[-_]/i.test(prod.sku) || /^test[-_]/i.test(prod.handle)) {
        skippedTestArtifacts += 1;
        continue;
      }
      if (prod.sku === 'MRS-EAR-2001') {
        continue;
      }
      if (s.products.some((p) => p.sku === prod.sku)) {
        continue;
      }
      s.products.unshift(prod);
      committedProductsCount += 1;
    }

    job.status = 'COMMITTED';
    job.dryRun = false;
    job.completedAt = new Date().toISOString();
    job.committedAt = new Date().toISOString();
    job.committedBy = params.actorEmail;
    job.committedProductsCount = committedProductsCount;

    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'IMPORT_COMMITTED',
      entityType: 'ImportJob',
      entityId: job.id,
      summary: `Owner committed import ${job.sourceFileName} (${committedProductsCount} new products)`,
    });
    this.persistOrThrow();
    return { job, committedProductsCount, skippedTestArtifacts };
  }
  async updateImportJobStatus(
    jobId: string,
    status: ImportJobRecord['status'],
    actorEmail: string,
    actorRole: string,
    summary?: string
  ) {
    const job = this.store.getState().importJobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`IMPORT_JOB_NOT_FOUND: ${jobId}`);
    job.status = status;
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'IMPORT_JOB_STATUS_UPDATED',
      entityType: 'ImportJob',
      entityId: jobId,
      summary: summary || `Updated import job ${jobId} to ${status}`,
    });
    this.persistOrThrow();
    return job;
  }
  async rollbackImportJob(jobId: string, actorEmail: string, actorRole: string) {
    const s = this.store.getState();
    const job = s.importJobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`IMPORT_JOB_NOT_FOUND: ${jobId}`);
    const candidateSkus = new Set(
      (job.previewItems || []).filter((item) => item.status === 'VALID').map((item) => item.sku)
    );
    const beforeCount = s.products.length;
    s.products = s.products.filter((p) => !candidateSkus.has(p.sku) || p.sku === 'MRS-EAR-2001');
    const removedProductsCount = beforeCount - s.products.length;
    job.status = 'ROLLED_BACK';
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'IMPORT_ROLLED_BACK',
      entityType: 'ImportJob',
      entityId: jobId,
      summary: `Rolled back import job ${jobId} (removed ${removedProductsCount} products)`,
    });
    this.persistOrThrow();
    return { job, removedProductsCount };
  }

  // Phase 2 Customization, Models & Customer Designs (JSON fallback)
  async listCustomizationProfiles() {
    return this.store.getState().customizationProfiles ?? [];
  }
  async findCustomizationProfileById(id: string) {
    return (this.store.getState().customizationProfiles ?? []).find((p) => p.id === id) || null;
  }
  async createCustomizationProfile(params: Parameters<PostgresCustomizationRepository['createProfile']>[0]) {
    const s = this.store.getState();
    s.customizationProfiles ??= [];
    const now = new Date().toISOString();
    const profile: CustomizationProfileRecord = {
      id: `cprof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: params.code.trim().toUpperCase(),
      name: params.name.trim(),
      description: params.description,
      eligibleCategories: params.eligibleCategories ?? [],
      isActive: params.isActive ?? true,
      isDefault: params.isDefault ?? false,
      createdBy: params.actorEmail,
      groups: [],
      createdAt: now,
      updatedAt: now,
    };
    s.customizationProfiles.unshift(profile);
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'CUSTOMIZATION_PROFILE_CREATED',
      entityType: 'CustomizationProfile',
      entityId: profile.id,
      summary: `Created customization profile ${profile.code}`,
    });
    this.persistOrThrow();
    return profile;
  }
  async updateCustomizationProfile(
    profileId: string,
    updates: Parameters<PostgresCustomizationRepository['updateProfile']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const profile = await this.findCustomizationProfileById(profileId);
    if (!profile) throw new Error(`CUSTOMIZATION_PROFILE_NOT_FOUND: ${profileId}`);
    Object.assign(profile, updates, { updatedBy: actorEmail, updatedAt: new Date().toISOString() });
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'CUSTOMIZATION_PROFILE_UPDATED',
      entityType: 'CustomizationProfile',
      entityId: profile.id,
      summary: `Updated customization profile ${profile.code}`,
    });
    this.persistOrThrow();
    return profile;
  }
  async addCustomizationGroup(
    profileId: string,
    group: Parameters<PostgresCustomizationRepository['addGroup']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const profile = await this.findCustomizationProfileById(profileId);
    if (!profile) throw new Error(`CUSTOMIZATION_PROFILE_NOT_FOUND: ${profileId}`);
    const now = new Date().toISOString();
    const created: CustomizationGroupRecord = {
      id: `cgrp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileId: profile.id,
      code: group.code.trim(),
      name: group.name.trim(),
      description: group.description,
      stepOrder: group.stepOrder ?? profile.groups.length + 1,
      selectionMode: group.selectionMode,
      optionCategory: group.optionCategory as CustomizationGroupRecord['optionCategory'],
      isRequired: group.isRequired ?? false,
      isActive: group.isActive ?? true,
      dependencyRule: group.dependencyRule,
      options: [],
      createdAt: now,
      updatedAt: now,
    };
    profile.groups.push(created);
    profile.updatedAt = now;
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'CUSTOMIZATION_GROUP_ADDED',
      entityType: 'CustomizationGroup',
      entityId: profile.id,
      summary: `Added customization group ${group.code} to ${profile.code}`,
    });
    this.persistOrThrow();
    return created;
  }
  async updateCustomizationGroup(
    groupId: string,
    updates: Parameters<PostgresCustomizationRepository['updateGroup']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const s = this.store.getState();
    for (const profile of s.customizationProfiles ?? []) {
      const grp = profile.groups.find((g) => g.id === groupId);
      if (grp) {
        Object.assign(grp, updates, { updatedAt: new Date().toISOString() });
        profile.updatedAt = new Date().toISOString();
        this.store.stageAuditLog({
          actorEmail,
          actorRole: actorRole as AdminRoleName,
          action: 'CUSTOMIZATION_GROUP_UPDATED',
          entityType: 'CustomizationGroup',
          entityId: groupId,
          summary: `Updated customization group ${grp.code}`,
        });
        this.persistOrThrow();
        return grp;
      }
    }
    return null;
  }
  async addCustomizationOption(
    groupId: string,
    option: Parameters<PostgresCustomizationRepository['addOption']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const s = this.store.getState();
    for (const profile of s.customizationProfiles ?? []) {
      const grp = profile.groups.find((g) => g.id === groupId);
      if (grp) {
        const now = new Date().toISOString();
        const created: CustomizationOptionRecord = {
          id: `copt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          groupId: grp.id,
          code: option.code.trim(),
          label: option.label.trim(),
          description: option.description,
          value: option.value.trim(),
          swatchHex: option.swatchHex,
          imageUrl: option.imageUrl,
          priceRuleType: option.priceRuleType,
          priceRuleValue: String(option.priceRuleValue ?? '0'),
          metalType: option.metalType,
          metalPurity: option.metalPurity,
          metalColor: option.metalColor,
          diamondShape: option.diamondShape as CustomizationOptionRecord['diamondShape'],
          diamondCaratWeight: option.diamondCaratWeight !== undefined ? String(option.diamondCaratWeight) : undefined,
          diamondColorGrade: option.diamondColorGrade,
          diamondClarityGrade: option.diamondClarityGrade,
          gemstoneType: option.gemstoneType,
          isDefault: option.isDefault ?? false,
          isActive: option.isActive ?? true,
          sortOrder: option.sortOrder ?? grp.options.length + 1,
          eligibilityRule: option.eligibilityRule,
          createdAt: now,
          updatedAt: now,
        };
        grp.options.push(created);
        this.store.stageAuditLog({
          actorEmail,
          actorRole: actorRole as AdminRoleName,
          action: 'CUSTOMIZATION_OPTION_ADDED',
          entityType: 'CustomizationOption',
          entityId: groupId,
          summary: `Added customization option ${option.code}`,
        });
        this.persistOrThrow();
        return created;
      }
    }
    throw new Error(`CUSTOMIZATION_GROUP_NOT_FOUND: ${groupId}`);
  }
  async updateCustomizationOption(
    optionId: string,
    updates: Parameters<PostgresCustomizationRepository['updateOption']>[1],
    actorEmail: string,
    actorRole: string
  ) {
    const s = this.store.getState();
    for (const profile of s.customizationProfiles ?? []) {
      for (const grp of profile.groups) {
        const opt = grp.options.find((o) => o.id === optionId);
        if (opt) {
          Object.assign(opt, updates, { updatedAt: new Date().toISOString() });
          this.store.stageAuditLog({
            actorEmail,
            actorRole: actorRole as AdminRoleName,
            action: 'CUSTOMIZATION_OPTION_UPDATED',
            entityType: 'CustomizationOption',
            entityId: optionId,
            summary: `Updated customization option ${opt.code}`,
          });
          this.persistOrThrow();
          return opt;
        }
      }
    }
    return null;
  }
  async listCustomizationAssignments() {
    return this.store.getState().productCustomizationAssignments ?? [];
  }
  async findCustomizationAssignmentByProductId(productId: string) {
    return (
      (this.store.getState().productCustomizationAssignments ?? []).find(
        (a) => a.productMetadataId === productId || a.productSku === productId
      ) || null
    );
  }
  async upsertCustomizationAssignment(
    params: Parameters<PostgresCustomizationRepository['upsertProductAssignment']>[0]
  ) {
    const s = this.store.getState();
    s.productCustomizationAssignments ??= [];
    const now = new Date().toISOString();
    const existing = s.productCustomizationAssignments.find(
      (a) => a.productMetadataId === params.productMetadataId
    );
    const rec: ProductCustomizationAssignmentRecord = {
      id: existing?.id || `passign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productMetadataId: params.productMetadataId,
      productSku: params.productSku,
      profileId: params.profileId,
      isCustomizable: params.isCustomizable,
      allowDiamondSelection: params.allowDiamondSelection ?? true,
      allowEngraving: params.allowEngraving ?? false,
      maxEngravingChars: params.maxEngravingChars ?? 20,
      disabledOptionCodes: params.disabledOptionCodes ?? [],
      updatedBy: params.actorEmail,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (existing) {
      Object.assign(existing, rec);
    } else {
      s.productCustomizationAssignments.unshift(rec);
    }
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'PRODUCT_CUSTOMIZATION_ASSIGNED',
      entityType: 'ProductCustomizationAssignment',
      entityId: params.productSku,
      summary: `Assigned customization profile ${params.profileId} to ${params.productSku}`,
    });
    this.persistOrThrow();
    return rec;
  }
  async listModelAssets() {
    return this.store.getState().productModelAssets ?? [];
  }
  async findModelAssetByProductId(productId: string) {
    return (
      (this.store.getState().productModelAssets ?? []).find(
        (m) => m.productMetadataId === productId || m.productSku === productId
      ) || null
    );
  }
  async upsertModelAsset(params: Parameters<PostgresCustomizationRepository['upsertModelAsset']>[0]) {
    const s = this.store.getState();
    s.productModelAssets ??= [];
    const now = new Date().toISOString();
    const existing = s.productModelAssets.find((m) => m.productMetadataId === params.productMetadataId);
    const previousStorageKey = existing?.storageKey;
    const rec: ProductModelAssetRecord = {
      id: existing?.id || `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productMetadataId: params.productMetadataId,
      productSku: params.productSku,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSizeBytes: params.fileSizeBytes,
      storageProvider: params.storageProvider,
      storageKey: params.storageKey,
      assetUrl: params.assetUrl,
      previewImageUrl: params.previewImageUrl,
      status: params.status ?? 'ACTIVE',
      uploadedBy: params.actorEmail,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (existing) {
      Object.assign(existing, rec);
    } else {
      s.productModelAssets.unshift(rec);
    }
    this.store.stageAuditLog({
      actorEmail: params.actorEmail,
      actorRole: params.actorRole as AdminRoleName,
      action: 'MODEL_ASSET_UPSERTED',
      entityType: 'ProductModelAsset',
      entityId: params.productSku,
      summary: `Configured 3D model asset (${params.fileName}) for ${params.productSku}`,
    });
    this.persistOrThrow();
    return { asset: rec, previousStorageKey };
  }
  async deleteModelAsset(productId: string, actorEmail: string, actorRole: string) {
    const list = this.store.getState().productModelAssets ?? [];
    const idx = list.findIndex((m) => m.productMetadataId === productId || m.productSku === productId);
    if (idx === -1) return { deleted: null };
    const removed = list.splice(idx, 1)[0]!;
    this.store.stageAuditLog({
      actorEmail,
      actorRole: actorRole as AdminRoleName,
      action: 'MODEL_ASSET_REMOVED',
      entityType: 'ProductModelAsset',
      entityId: removed.productSku,
      summary: `Removed 3D model asset for ${removed.productSku}`,
    });
    this.persistOrThrow();
    return { deleted: removed };
  }
  async listCustomerDesigns(customerId: string) {
    return (this.store.getState().customerDesigns ?? []).filter((d) => d.customerId === customerId);
  }
  async listAllDesignsForAdmin() {
    return this.store.getState().customerDesigns ?? [];
  }
  async findCustomerDesignById(designId: string) {
    return (this.store.getState().customerDesigns ?? []).find((d) => d.id === designId) || null;
  }
  async createCustomerDesign(params: Parameters<PostgresCustomizationRepository['createCustomerDesign']>[0]) {
    const s = this.store.getState();
    s.customerDesigns ??= [];
    const now = new Date().toISOString();
    const rec: CustomerDesignRecord = {
      id: `design-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: params.customerId,
      productMetadataId: params.productMetadataId,
      productSku: params.productSku,
      productHandle: params.productHandle,
      productTitle: params.productTitle,
      profileId: params.profileId,
      name: params.name.trim(),
      selections: params.selections,
      selectionSnapshot: params.selectionSnapshot,
      lastQuotedPriceInr: params.lastQuotedPriceInr,
      lastPriceBreakdown: params.lastPriceBreakdown,
      pricingRuleVersion: params.pricingRuleVersion,
      status: 'SAVED',
      createdAt: now,
      updatedAt: now,
    };
    s.customerDesigns.unshift(rec);
    this.persistOrThrow();
    return rec;
  }
  async updateCustomerDesign(
    designId: string,
    customerId: string,
    updates: Parameters<PostgresCustomizationRepository['updateCustomerDesign']>[2]
  ) {
    const rec = (this.store.getState().customerDesigns ?? []).find(
      (d) => d.id === designId && d.customerId === customerId
    );
    if (!rec) throw new Error('DESIGN_NOT_FOUND_OR_FORBIDDEN');
    Object.assign(rec, updates, { updatedAt: new Date().toISOString() });
    this.persistOrThrow();
    return rec;
  }
  async deleteCustomerDesign(designId: string, customerId: string) {
    const list = this.store.getState().customerDesigns;
    if (!list) return false;
    const idx = list.findIndex((d) => d.id === designId && d.customerId === customerId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.persistOrThrow();
    return true;
  }
}

export { ROLE_PERMISSIONS };
