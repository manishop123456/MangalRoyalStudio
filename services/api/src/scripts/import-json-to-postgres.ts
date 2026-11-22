/**
 * Mangal Royal Studio — JSON to PostgreSQL Deterministic Importer & Rehearsal Tool
 *
 * Remediated in Phase 1.3C for:
 * - Complete entity coverage (including pricingRuns, pricingSnapshots, shipments, refunds,
 *   inventoryMovements, notifications, integrationEvents, and all auditLogs)
 * - Strict idempotency across all collections via unique keys / deterministic IDs
 * - Pre-write foreign-key validation & explicit unresolved-reference reporting (no silent coercion)
 * - Explicit test artifact classification and exclusion/mapping controls
 * - Exact decimal precision via decimal.js (zero IEEE-754 float conversion for money/weights)
 * - Deterministic path resolution from monorepo root or services/api/
 * - Transaction-safe dry-run rollback verification
 *
 * Usage:
 *   # Dry-run rehearsal (validates and rolls back the transaction):
 *   DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" \
 *   npx tsx src/scripts/import-json-to-postgres.ts --dry-run [--exclude-test-artifacts]
 *
 *   # Live import into isolated development database (requires explicit policy):
 *   DATABASE_URL="postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public" \
 *   npx tsx src/scripts/import-json-to-postgres.ts --commit --exclude-test-artifacts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { getPrismaClient, disconnectPrisma, checkDatabaseConnection } from '../db/prisma.js';
import type { PlatformState } from '../store/data-store.js';

export type TestArtifactPolicy = 'REJECT' | 'EXCLUDE' | 'INCLUDE_WITH_MAPPING';

export type EntityCollectionKey =
  | 'categories'
  | 'collections'
  | 'products'
  | 'jewellerySpecs'
  | 'diamondComponents'
  | 'inventoryRecords'
  | 'goldRates'
  | 'diamondRates'
  | 'pricingRules'
  | 'pricingRuns'
  | 'pricingRunItems'
  | 'pricingSnapshots'
  | 'customers'
  | 'orders'
  | 'orderItems'
  | 'payments'
  | 'shipments'
  | 'refunds'
  | 'inventoryMovements'
  | 'discounts'
  | 'banners'
  | 'contents'
  | 'notifications'
  | 'integrationEvents'
  | 'auditLogs';

export interface ClassifiedTestArtifact {
  collection: EntityCollectionKey | 'carts';
  id: string;
  reason: string;
}

export interface UnresolvedReference {
  collection: EntityCollectionKey;
  recordId: string;
  field: string;
  targetCollection: string;
  missingKey: string;
  reason: string;
}

export interface ProvisionalInventoryOverride {
  quantity: number;
  reason: string;
  actorEmail?: string;
}

export interface ImportSummary {
  dryRun: boolean;
  rolledBack: boolean;
  sourceFilePath: string;
  testArtifactPolicy: TestArtifactPolicy;
  imported: Record<EntityCollectionKey, number>;
  skipped: Record<EntityCollectionKey, number>;
  rejected: Record<EntityCollectionKey, number>;
  testArtifacts: ClassifiedTestArtifact[];
  unresolvedReferences: UnresolvedReference[];
  discrepancies: string[];
  provisionalInventoryApplied: Array<{
    sku: string;
    sourceQuantity: number;
    appliedQuantity: number;
    reason: string;
  }>;
  errors: string[];
}

export interface JsonToPostgresImportOptions {
  filePath?: string;
  dryRun: boolean;
  databaseUrl?: string;
  testArtifactPolicy?: TestArtifactPolicy;
  unresolvedCustomerMapping?: Record<string, string | null>;
  orphanPricingRunMapping?: Record<string, string | null>;
  provisionalInventoryOverrides?: Record<string, ProvisionalInventoryOverride>;
  /**
   * Optional hook invoked inside the transaction right before commit/rollback.
   * Useful for testing intentional failure rollback after writes have occurred.
   */
  beforeTransactionEnd?: (tx: Prisma.TransactionClient) => Promise<void>;
  /**
   * Optional injected Prisma client (e.g., for unit testing with mock/in-memory tx).
   */
  prismaClient?: ReturnType<typeof getPrismaClient>;
}

const ALL_COLLECTION_KEYS: EntityCollectionKey[] = [
  'categories',
  'collections',
  'products',
  'jewellerySpecs',
  'diamondComponents',
  'inventoryRecords',
  'goldRates',
  'diamondRates',
  'pricingRules',
  'pricingRuns',
  'pricingRunItems',
  'pricingSnapshots',
  'customers',
  'orders',
  'orderItems',
  'payments',
  'shipments',
  'refunds',
  'inventoryMovements',
  'discounts',
  'banners',
  'contents',
  'notifications',
  'integrationEvents',
  'auditLogs',
];

function createZeroCounts(): Record<EntityCollectionKey, number> {
  const counts = {} as Record<EntityCollectionKey, number>;
  for (const key of ALL_COLLECTION_KEYS) {
    counts[key] = 0;
  }
  return counts;
}

/**
 * Resolves a JSON state file path reliably whether invoked from the monorepo root,
 * services/api/, or an explicit absolute/relative path.
 */
export function resolveStateFilePath(inputPath?: string): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const apiPackageRoot = path.resolve(scriptDir, '../..');
  const monorepoRoot = path.resolve(apiPackageRoot, '../..');

  const candidates = inputPath
    ? [
        path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath),
        path.resolve(apiPackageRoot, inputPath),
        path.resolve(monorepoRoot, inputPath),
      ]
    : [
        path.resolve(apiPackageRoot, '.data/platform-state.json'),
        path.resolve(monorepoRoot, 'services/api/.data/platform-state.json'),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `FILE_NOT_FOUND: State file does not exist. Checked: ${candidates.join(', ')}`
  );
}

/**
 * Converts unknown numeric/string input into an exact fixed-scale decimal string
 * using decimal.js without IEEE-754 floating-point precision loss.
 */
export function toExactDecimalString(value: unknown, scale = 2, fallback = '0.00'): string {
  if (value === null || value === undefined || value === '') {
    return new Decimal(fallback).toFixed(scale);
  }
  const str = String(value).trim();
  if (!str) {
    return new Decimal(fallback).toFixed(scale);
  }
  const dec = new Decimal(str);
  if (!dec.isFinite()) {
    throw new Error(`INVALID_DECIMAL_VALUE: "${str}" is not a finite decimal.`);
  }
  return dec.toFixed(scale);
}

function toOptionalDecimalString(value: unknown, scale = 2): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return toExactDecimalString(value, scale);
}

const TEST_ORDER_IDS = new Set([
  'ord-1044',
  'ord-1045',
  'ord-1046',
  'ord-1047',
  'ord-1048',
  'ord-1049',
]);

/**
 * Classifies known pre-isolation test artifacts without mutating or discarding them silently.
 */
export function classifyTestArtifacts(state: PlatformState): {
  artifacts: ClassifiedTestArtifact[];
  testOrderIds: Set<string>;
  testPaymentIds: Set<string>;
  testRefundIds: Set<string>;
  testSnapshotIds: Set<string>;
  testMovementIds: Set<string>;
  testNotificationIds: Set<string>;
  testAuditLogIds: Set<string>;
  testProductSkus: Set<string>;
} {
  const artifacts: ClassifiedTestArtifact[] = [];
  const testOrderIds = new Set<string>();
  const testPaymentIds = new Set<string>();
  const testRefundIds = new Set<string>();
  const testSnapshotIds = new Set<string>();
  const testMovementIds = new Set<string>();
  const testNotificationIds = new Set<string>();
  const testAuditLogIds = new Set<string>();
  const testProductSkus = new Set<string>();

  for (const prod of state.products || []) {
    if (prod.sku.startsWith('MRS-TST-')) {
      testProductSkus.add(prod.sku);
      artifacts.push({
        collection: 'products',
        id: prod.sku,
        reason: 'Matches test SKU prefix MRS-TST-*',
      });
    }
  }

  for (const cart of Object.values(state.carts || {})) {
    if (cart.id.startsWith('cart-test-')) {
      artifacts.push({
        collection: 'carts',
        id: cart.id,
        reason: 'Matches test cart prefix cart-test-*',
      });
    }
  }

  for (const ord of state.orders || []) {
    if (
      TEST_ORDER_IDS.has(ord.id) ||
      ord.customerEmail?.toLowerCase() === 'buyer@example.com' ||
      ord.customerId === 'cust-guest'
    ) {
      testOrderIds.add(ord.id);
      artifacts.push({
        collection: 'orders',
        id: ord.id,
        reason: `Test order (${ord.orderNumber}, customer=${ord.customerId}, email=${ord.customerEmail})`,
      });
    }
  }

  for (const pay of state.payments || []) {
    if (
      pay.providerPaymentId === 'pay_test_verified_001' ||
      testOrderIds.has(pay.orderId)
    ) {
      testPaymentIds.add(pay.id);
      artifacts.push({
        collection: 'payments',
        id: pay.id,
        reason: `Test payment (${pay.providerPaymentId} for order ${pay.orderId})`,
      });
    }
  }

  for (const rfnd of state.refunds || []) {
    if (
      rfnd.id.startsWith('rfnd-179') ||
      rfnd.paymentId === 'pay_test_verified_001' ||
      testOrderIds.has(rfnd.orderId)
    ) {
      testRefundIds.add(rfnd.id);
      artifacts.push({
        collection: 'refunds',
        id: rfnd.id,
        reason: `Test refund (${rfnd.id} referencing ${rfnd.paymentId})`,
      });
    }
  }

  for (const snap of state.pricingSnapshots || []) {
    if (
      snap.pricingRunId === 'checkout-immutable-lock' ||
      testProductSkus.has(snap.sku)
    ) {
      testSnapshotIds.add(snap.id);
      artifacts.push({
        collection: 'pricingSnapshots',
        id: snap.id,
        reason: `Checkout lock snapshot referencing "${snap.pricingRunId}"`,
      });
    }
  }

  for (const mov of state.inventoryMovements || []) {
    if (
      mov.sku.startsWith('MRS-TST-') ||
      mov.actorEmail?.toLowerCase() === 'buyer@example.com' ||
      mov.id.startsWith('mov-ord-179') ||
      mov.id.startsWith('mov-179')
    ) {
      testMovementIds.add(mov.id);
      artifacts.push({
        collection: 'inventoryMovements',
        id: mov.id,
        reason: `Test inventory movement (${mov.sku}, actor=${mov.actorEmail})`,
      });
    }
  }

  for (const notif of state.notifications || []) {
    if (
      notif.recipientEmail?.toLowerCase() === 'buyer@example.com' ||
      notif.body?.includes('pay_test_verified_001') ||
      notif.id.startsWith('notif-179')
    ) {
      testNotificationIds.add(notif.id);
      artifacts.push({
        collection: 'notifications',
        id: notif.id,
        reason: `Test notification (${notif.recipientEmail})`,
      });
    }
  }

  for (const log of state.auditLogs || []) {
    const summaryLower = (log.summary || '').toLowerCase();
    const entityId = log.entityId || '';
    if (
      entityId.startsWith('MRS-TST-') ||
      entityId.startsWith('rfnd-179') ||
      TEST_ORDER_IDS.has(entityId) ||
      summaryLower.includes('buyer@example.com') ||
      summaryLower.includes('pay_test_verified_001') ||
      summaryLower.includes('mrs-tst-') ||
      /mrs-104[4-9]/i.test(summaryLower)
    ) {
      testAuditLogIds.add(log.id);
      artifacts.push({
        collection: 'auditLogs',
        id: log.id,
        reason: `Test-related audit log (${log.action} on ${log.entityType}:${entityId})`,
      });
    }
  }

  return {
    artifacts,
    testOrderIds,
    testPaymentIds,
    testRefundIds,
    testSnapshotIds,
    testMovementIds,
    testNotificationIds,
    testAuditLogIds,
    testProductSkus,
  };
}

/**
 * Validates all foreign-key references, unique constraints, and test artifacts
 * against the dataset before executing any database writes.
 */
export function validateStateForImport(
  state: PlatformState,
  options: {
    testArtifactPolicy?: TestArtifactPolicy;
    unresolvedCustomerMapping?: Record<string, string | null>;
    orphanPricingRunMapping?: Record<string, string | null>;
  } = {}
) {
  const policy: TestArtifactPolicy = options.testArtifactPolicy || 'REJECT';
  const classification = classifyTestArtifacts(state);
  const unresolvedReferences: UnresolvedReference[] = [];
  const discrepancies: string[] = [];

  const customerIds = new Set((state.customers || []).map((c) => c.id));
  const productSkus = new Set((state.products || []).map((p) => p.sku));
  const pricingRuleIds = new Set((state.pricingRules || []).map((r) => r.id));
  const pricingRuleVersions = new Set((state.pricingRules || []).map((r) => r.version));
  const pricingRunIds = new Set((state.pricingRuns || []).map((r) => r.id));

  const excludedOrders = policy === 'EXCLUDE' ? classification.testOrderIds : new Set<string>();
  const excludedPayments = policy === 'EXCLUDE' ? classification.testPaymentIds : new Set<string>();
  const excludedRefunds = policy === 'EXCLUDE' ? classification.testRefundIds : new Set<string>();
  const excludedSnapshots = policy === 'EXCLUDE' ? classification.testSnapshotIds : new Set<string>();
  const excludedMovements = policy === 'EXCLUDE' ? classification.testMovementIds : new Set<string>();
  const excludedProducts = policy === 'EXCLUDE' ? classification.testProductSkus : new Set<string>();

  const activeOrderIds = new Set(
    (state.orders || []).filter((o) => !excludedOrders.has(o.id)).map((o) => o.id)
  );
  const activePaymentIds = new Set(
    (state.payments || []).filter((p) => !excludedPayments.has(p.id)).map((p) => p.id)
  );

  // Detect providerPaymentId collisions among included payments
  const seenProviderPaymentIds = new Map<string, string>();
  for (const pay of state.payments || []) {
    if (excludedPayments.has(pay.id)) continue;
    if (!activeOrderIds.has(pay.orderId)) {
      unresolvedReferences.push({
        collection: 'payments',
        recordId: pay.id,
        field: 'orderId',
        targetCollection: 'orders',
        missingKey: pay.orderId,
        reason: `Payment ${pay.id} references missing or excluded order ${pay.orderId}`,
      });
    }
    const existingPayId = seenProviderPaymentIds.get(pay.providerPaymentId);
    if (existingPayId) {
      discrepancies.push(
        `DUPLICATE_PROVIDER_PAYMENT_ID: Payment ${pay.id} shares providerPaymentId "${pay.providerPaymentId}" with ${existingPayId}`
      );
    } else {
      seenProviderPaymentIds.set(pay.providerPaymentId, pay.id);
    }
  }

  // Validate Orders customerId FK
  for (const ord of state.orders || []) {
    if (excludedOrders.has(ord.id)) continue;
    if (ord.customerId && !customerIds.has(ord.customerId)) {
      const hasExplicitMapping =
        options.unresolvedCustomerMapping !== undefined &&
        Object.prototype.hasOwnProperty.call(options.unresolvedCustomerMapping, ord.customerId);
      if (!hasExplicitMapping) {
        unresolvedReferences.push({
          collection: 'orders',
          recordId: ord.id,
          field: 'customerId',
          targetCollection: 'customers',
          missingKey: ord.customerId,
          reason: `Order ${ord.id} (${ord.orderNumber}) references non-existent customerId "${ord.customerId}" without explicit mapping`,
        });
      }
    }
  }

  // Validate PricingRuns rule FK
  for (const run of state.pricingRuns || []) {
    const hasRuleById = Boolean(run.ruleId && pricingRuleIds.has(run.ruleId));
    const hasRuleByVer = Boolean(run.ruleVersion && pricingRuleVersions.has(run.ruleVersion));
    if (!hasRuleById && !hasRuleByVer) {
      unresolvedReferences.push({
        collection: 'pricingRuns',
        recordId: run.id,
        field: 'ruleId',
        targetCollection: 'pricingRules',
        missingKey: run.ruleId || String(run.ruleVersion),
        reason: `PricingRun ${run.id} references missing pricingRule`,
      });
    }
  }

  // Validate PricingSnapshots FKs
  for (const snap of state.pricingSnapshots || []) {
    if (excludedSnapshots.has(snap.id)) continue;
    if (snap.pricingRunId && !pricingRunIds.has(snap.pricingRunId)) {
      const hasExplicitMapping =
        options.orphanPricingRunMapping !== undefined &&
        Object.prototype.hasOwnProperty.call(options.orphanPricingRunMapping, snap.pricingRunId);
      if (!hasExplicitMapping) {
        unresolvedReferences.push({
          collection: 'pricingSnapshots',
          recordId: snap.id,
          field: 'pricingRunId',
          targetCollection: 'pricingRuns',
          missingKey: snap.pricingRunId,
          reason: `PricingSnapshot ${snap.id} references non-existent pricingRunId "${snap.pricingRunId}" without explicit mapping`,
        });
      }
    }
    if (snap.formulaVersion && !pricingRuleVersions.has(snap.formulaVersion)) {
      unresolvedReferences.push({
        collection: 'pricingSnapshots',
        recordId: snap.id,
        field: 'formulaVersion',
        targetCollection: 'pricingRules',
        missingKey: String(snap.formulaVersion),
        reason: `PricingSnapshot ${snap.id} references missing pricingRule version ${snap.formulaVersion}`,
      });
    }
  }

  // Validate Shipments FKs
  for (const shp of state.shipments || []) {
    if (!activeOrderIds.has(shp.orderId)) {
      unresolvedReferences.push({
        collection: 'shipments',
        recordId: shp.id,
        field: 'orderId',
        targetCollection: 'orders',
        missingKey: shp.orderId,
        reason: `Shipment ${shp.id} references missing or excluded order ${shp.orderId}`,
      });
    }
  }

  // Validate Refunds FKs
  for (const rfnd of state.refunds || []) {
    if (excludedRefunds.has(rfnd.id)) continue;
    if (!activeOrderIds.has(rfnd.orderId)) {
      unresolvedReferences.push({
        collection: 'refunds',
        recordId: rfnd.id,
        field: 'orderId',
        targetCollection: 'orders',
        missingKey: rfnd.orderId,
        reason: `Refund ${rfnd.id} references missing or excluded order ${rfnd.orderId}`,
      });
    }
    const matchesPaymentId = activePaymentIds.has(rfnd.paymentId);
    const matchesProviderId = seenProviderPaymentIds.has(rfnd.paymentId);
    if (!matchesPaymentId && !matchesProviderId) {
      unresolvedReferences.push({
        collection: 'refunds',
        recordId: rfnd.id,
        field: 'paymentId',
        targetCollection: 'payments',
        missingKey: rfnd.paymentId,
        reason: `Refund ${rfnd.id} references missing payment "${rfnd.paymentId}"`,
      });
    }
  }

  // Validate InventoryMovements SKU FK
  for (const mov of state.inventoryMovements || []) {
    if (excludedMovements.has(mov.id)) continue;
    if (!productSkus.has(mov.sku) || excludedProducts.has(mov.sku)) {
      unresolvedReferences.push({
        collection: 'inventoryMovements',
        recordId: mov.id,
        field: 'sku',
        targetCollection: 'products',
        missingKey: mov.sku,
        reason: `InventoryMovement ${mov.id} references missing or excluded SKU "${mov.sku}"`,
      });
    }
  }

  return {
    classification,
    unresolvedReferences,
    discrepancies,
  };
}

export async function runJsonToPostgresImport(
  options: JsonToPostgresImportOptions
): Promise<ImportSummary> {
  const { dryRun } = options;
  const policy: TestArtifactPolicy = options.testArtifactPolicy || 'REJECT';
  const resolvedPath = resolveStateFilePath(options.filePath);

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const state: PlatformState = JSON.parse(raw);

  const validation = validateStateForImport(state, {
    testArtifactPolicy: policy,
    unresolvedCustomerMapping: options.unresolvedCustomerMapping,
    orphanPricingRunMapping: options.orphanPricingRunMapping,
  });

  const summary: ImportSummary = {
    dryRun,
    rolledBack: false,
    sourceFilePath: resolvedPath,
    testArtifactPolicy: policy,
    imported: createZeroCounts(),
    skipped: createZeroCounts(),
    rejected: createZeroCounts(),
    testArtifacts: validation.classification.artifacts,
    unresolvedReferences: validation.unresolvedReferences,
    discrepancies: validation.discrepancies,
    provisionalInventoryApplied: [],
    errors: [],
  };

  // Fail closed in REJECT policy if test artifacts or unresolved references exist
  if (policy === 'REJECT' && (summary.testArtifacts.length > 0 || summary.unresolvedReferences.length > 0 || summary.discrepancies.length > 0)) {
    const msg = `IMPORT_REJECTED_AMBIGUOUS_STATE: Found ${summary.testArtifacts.length} classified test artifacts, ${summary.unresolvedReferences.length} unresolved FK references, and ${summary.discrepancies.length} discrepancies under policy=REJECT.`;
    summary.errors.push(msg);
    if (!dryRun) {
      throw new Error(msg);
    }
    return summary;
  }

  // Fail closed if unresolved foreign keys or provider collisions remain
  if (summary.unresolvedReferences.length > 0 || summary.discrepancies.length > 0) {
    const msg = `UNRESOLVED_REFERENCES: Found ${summary.unresolvedReferences.length} unresolved FKs and ${summary.discrepancies.length} discrepancies.`;
    summary.errors.push(msg);
    throw new Error(msg);
  }

  const prisma = options.prismaClient ?? getPrismaClient(options.databaseUrl);
  const health = await checkDatabaseConnection(prisma);
  if (!health.ok) {
    throw new Error(`DATABASE_UNAVAILABLE: Could not connect to PostgreSQL: ${health.error}`);
  }

  const {
    testOrderIds,
    testPaymentIds,
    testRefundIds,
    testSnapshotIds,
    testMovementIds,
    testNotificationIds,
    testAuditLogIds,
    testProductSkus,
  } = validation.classification;

  const excludeTests = policy === 'EXCLUDE';

  const executeImport = async (tx: Prisma.TransactionClient) => {
    // 1. Categories
    const categoryIdByName = new Map<string, string>();
    for (const cat of state.categories || []) {
      const slug = (cat as any).slug || (cat as any).handle || cat.name.toLowerCase();
      const saved = await tx.category.upsert({
        where: { slug },
        update: {
          name: cat.name,
          description: cat.description,
          displayOrder: (cat as any).displayOrder ?? (cat as any).sortOrder ?? 0,
        },
        create: {
          id: cat.id,
          name: cat.name,
          slug,
          description: cat.description,
          displayOrder: (cat as any).displayOrder ?? (cat as any).sortOrder ?? 0,
        },
      });
      categoryIdByName.set(cat.name.toLowerCase(), saved.id);
      summary.imported.categories++;
    }

    // 2. Collections
    for (const col of state.collections || []) {
      await tx.collection.upsert({
        where: { handle: col.handle },
        update: {
          title: col.title,
          description: col.description,
          imageUrl: col.imageUrl,
          isActive: col.isActive ?? true,
          sortOrder: (col as any).sortOrder ?? 0,
        },
        create: {
          id: col.id,
          title: col.title,
          handle: col.handle,
          description: col.description,
          imageUrl: col.imageUrl,
          isActive: col.isActive ?? true,
          sortOrder: (col as any).sortOrder ?? 0,
        },
      });
      summary.imported.collections++;
    }

    // 3. Products, Specs, Diamond Components & Inventory Records
    const productIdBySku = new Map<string, string>();
    const inventoryIdBySku = new Map<string, string>();

    for (const prod of state.products || []) {
      if (excludeTests && testProductSkus.has(prod.sku)) {
        summary.skipped.products++;
        continue;
      }

      const categoryId = categoryIdByName.get(prod.category.toLowerCase()) ?? null;
      const product = await tx.productMetadata.upsert({
        where: { sku: prod.sku },
        update: {
          title: prod.title,
          handle: prod.handle,
          description: prod.description,
          currentShopifyPrice: toExactDecimalString(prod.currentShopifyPriceInr, 2),
          categoryId,
          imageUrl: prod.imageUrl,
          hoverImageUrl: prod.altImageUrl,
          isFeatured: prod.isFeaturedBestseller ?? false,
          isBestseller: prod.isFeaturedBestseller ?? false,
        },
        create: {
          id: `prod-${prod.sku.toLowerCase()}`,
          sku: prod.sku,
          handle: prod.handle,
          title: prod.title,
          description: prod.description,
          categoryId,
          currentShopifyPrice: toExactDecimalString(prod.currentShopifyPriceInr, 2),
          currency: 'INR',
          imageUrl: prod.imageUrl,
          hoverImageUrl: prod.altImageUrl,
          isFeatured: prod.isFeaturedBestseller ?? false,
          isBestseller: prod.isFeaturedBestseller ?? false,
        },
      });
      productIdBySku.set(prod.sku, product.id);
      summary.imported.products++;

      const grossWeight = toExactDecimalString(prod.grossWeightGrams, 3, '0.000');
      const netMetalWeight = toExactDecimalString(
        prod.netMetalWeightGrams ?? prod.grossWeightGrams,
        3,
        '0.000'
      );
      const makingChargeVal = toExactDecimalString(
        prod.makingChargeValue ?? (prod as any).makingChargeValueInr,
        2
      );
      const wastageVal = toExactDecimalString(
        prod.wastageValue ?? (prod as any).wastageValuePct,
        3,
        '0.000'
      );

      const spec = await tx.jewellerySpecification.upsert({
        where: { productMetadataId: product.id },
        update: {
          metalType: prod.metalType || 'GOLD',
          metalPurity: prod.metalPurity || '18K',
          metalColor: prod.metalColor || 'ROSE_GOLD',
          ringSize: prod.ringSize,
          grossWeightGrams: grossWeight,
          netMetalWeightGrams: netMetalWeight,
          netWeightMode: prod.netWeightMode || 'EXPLICIT_NET_WEIGHT',
          makingChargeMode: prod.makingChargeMode || 'PER_GRAM_NET',
          makingChargeValue: makingChargeVal,
          wastageMode: prod.wastageMode || 'NONE',
          wastageValue: wastageVal,
          certificationFeeInr: toExactDecimalString(prod.certificationFeeInr, 2),
          hallmarkFeeInr: toExactDecimalString(prod.hallmarkFeeInr, 2),
          fixedAdjustmentInr: toExactDecimalString(prod.fixedAdjustmentInr, 2),
          manualPriceOverrideInr: toOptionalDecimalString(prod.manualPriceOverrideInr, 2),
          igiCertificateNumber: (prod as any).igiCertificateNumber,
        },
        create: {
          productMetadata: { connect: { id: product.id } },
          metalType: prod.metalType || 'GOLD',
          metalPurity: prod.metalPurity || '18K',
          metalColor: prod.metalColor || 'ROSE_GOLD',
          ringSize: prod.ringSize,
          grossWeightGrams: grossWeight,
          netMetalWeightGrams: netMetalWeight,
          netWeightMode: prod.netWeightMode || 'EXPLICIT_NET_WEIGHT',
          makingChargeMode: prod.makingChargeMode || 'PER_GRAM_NET',
          makingChargeValue: makingChargeVal,
          wastageMode: prod.wastageMode || 'NONE',
          wastageValue: wastageVal,
          certificationFeeInr: toExactDecimalString(prod.certificationFeeInr, 2),
          hallmarkFeeInr: toExactDecimalString(prod.hallmarkFeeInr, 2),
          fixedAdjustmentInr: toExactDecimalString(prod.fixedAdjustmentInr, 2),
          manualPriceOverrideInr: toOptionalDecimalString(prod.manualPriceOverrideInr, 2),
          igiCertificateNumber: (prod as any).igiCertificateNumber,
        },
      });
      summary.imported.jewellerySpecs++;

      // Idempotent diamond components via deterministic IDs
      if (Array.isArray(prod.diamondComponents)) {
        for (const [idx, dc] of prod.diamondComponents.entries()) {
          const dcId = `${spec.id}-dc-${idx}`;
          await tx.diamondComponent.upsert({
            where: { id: dcId },
            update: {
              componentName: dc.componentName || 'Center / Accent Diamond',
              shape: dc.shape || 'ROUND',
              stoneCount: dc.stoneCount || 1,
              totalCaratWeight: toExactDecimalString(dc.totalCaratWeight, 3, '0.000'),
              colorGrade: dc.colorGrade || 'EF',
              clarityGrade: dc.clarityGrade || 'VVS',
              cutGrade: dc.cutGrade || 'EXCELLENT',
              sieveSize: dc.sieveSize,
              certification: dc.certification || 'IGI',
              rateOverridePerCaratInr: toOptionalDecimalString(dc.rateOverridePerCaratInr, 2),
            },
            create: {
              id: dcId,
              jewellerySpecificationId: spec.id,
              componentName: dc.componentName || 'Center / Accent Diamond',
              shape: dc.shape || 'ROUND',
              stoneCount: dc.stoneCount || 1,
              totalCaratWeight: toExactDecimalString(dc.totalCaratWeight, 3, '0.000'),
              colorGrade: dc.colorGrade || 'EF',
              clarityGrade: dc.clarityGrade || 'VVS',
              cutGrade: dc.cutGrade || 'EXCELLENT',
              sieveSize: dc.sieveSize,
              certification: dc.certification || 'IGI',
              rateOverridePerCaratInr: toOptionalDecimalString(dc.rateOverridePerCaratInr, 2),
            },
          });
          summary.imported.diamondComponents++;
        }
      }

      const override = options.provisionalInventoryOverrides?.[prod.sku];
      const targetAvailableQty = override ? override.quantity : prod.inventoryQuantity;

      const inv = await tx.inventoryRecord.upsert({
        where: { productMetadataId: product.id },
        update: { availableQuantity: targetAvailableQty },
        create: {
          productMetadata: { connect: { id: product.id } },
          availableQuantity: targetAvailableQty,
          reservedQuantity: 0,
        },
      });
      inventoryIdBySku.set(prod.sku, inv.id);
      summary.imported.inventoryRecords++;

      if (override) {
        const actorEmail = override.actorEmail || 'owner@mangalroyalstudio.com';
        const movId = `mov-provisional-import-${prod.sku.toLowerCase()}`;
        const audId = `aud-provisional-import-${prod.sku.toLowerCase()}`;
        const delta = override.quantity - prod.inventoryQuantity;

        await tx.inventoryMovement.upsert({
          where: { id: movId },
          update: {
            quantityDelta: delta,
            previousQuantity: prod.inventoryQuantity,
            newQuantity: override.quantity,
            reason: override.reason,
          },
          create: {
            id: movId,
            inventoryRecordId: inv.id,
            sku: prod.sku,
            movementType: 'PROVISIONAL_IMPORT_OVERRIDE',
            quantityDelta: delta,
            previousQuantity: prod.inventoryQuantity,
            newQuantity: override.quantity,
            reason: override.reason,
            actorEmail,
          },
        });
        summary.imported.inventoryMovements++;

        await tx.auditLog.upsert({
          where: { id: audId },
          update: {
            summary: `${prod.sku}: Provisional import inventory set to ${override.quantity} (source JSON=${prod.inventoryQuantity}). ${override.reason}`,
          },
          create: {
            id: audId,
            actorEmail,
            actorRole: 'OWNER',
            action: 'PROVISIONAL_INVENTORY_OVERRIDE',
            entityType: 'InventoryRecord',
            entityId: prod.sku,
            summary: `${prod.sku}: Provisional import inventory set to ${override.quantity} (source JSON=${prod.inventoryQuantity}). ${override.reason}`,
          },
        });
        summary.imported.auditLogs++;

        summary.provisionalInventoryApplied.push({
          sku: prod.sku,
          sourceQuantity: prod.inventoryQuantity,
          appliedQuantity: override.quantity,
          reason: override.reason,
        });
      }
    }

    // 4. Gold Rates (Idempotent upsert by ID)
    for (const [idx, gr] of (state.metalRates || []).entries()) {
      const id = gr.id || `gr-${gr.metalType}-${gr.purity}-${idx}`;
      await tx.goldRate.upsert({
        where: { id },
        update: {
          ratePerGramInr: toExactDecimalString(gr.ratePerGramInr, 4, '0.0000'),
          source: gr.source || 'JSON_IMPORT',
          sourceReference: gr.sourceReference,
          isPlaceholder: gr.isPlaceholder ?? false,
        },
        create: {
          id,
          metalType: gr.metalType,
          purity: gr.purity,
          ratePerGramInr: toExactDecimalString(gr.ratePerGramInr, 4, '0.0000'),
          currency: gr.currency || 'INR',
          source: gr.source || 'JSON_IMPORT',
          sourceReference: gr.sourceReference,
          isPlaceholder: gr.isPlaceholder ?? false,
          effectiveAt: gr.effectiveAt ? new Date(gr.effectiveAt) : new Date(),
          createdBy: gr.createdBy || 'system@mangalroyalstudio.com',
        },
      });
      summary.imported.goldRates++;
    }

    // 5. Diamond Rates (Idempotent upsert by ID)
    for (const [idx, dr] of (state.diamondRates || []).entries()) {
      const id = dr.id || `dr-${dr.shape}-${dr.colorGrade}-${dr.clarityGrade}-${idx}`;
      await tx.diamondRate.upsert({
        where: { id },
        update: {
          sizeMinCarat: toExactDecimalString(dr.sizeMinCarat ?? (dr as any).minCarat, 4, '0.0000'),
          sizeMaxCarat: toExactDecimalString(dr.sizeMaxCarat ?? (dr as any).maxCarat ?? 10, 4, '10.0000'),
          rateInr: toExactDecimalString(dr.rateInr ?? (dr as any).ratePerCaratInr, 4, '0.0000'),
          isActive: dr.isActive ?? true,
        },
        create: {
          id,
          shape: dr.shape,
          sieveRange: dr.sieveRange,
          sizeMinCarat: toExactDecimalString(dr.sizeMinCarat ?? (dr as any).minCarat, 4, '0.0000'),
          sizeMaxCarat: toExactDecimalString(dr.sizeMaxCarat ?? (dr as any).maxCarat ?? 10, 4, '10.0000'),
          colorGrade: dr.colorGrade,
          clarityGrade: dr.clarityGrade,
          cutGrade: dr.cutGrade || 'EXCELLENT',
          pricingType: dr.pricingType || 'PER_CARAT',
          rateInr: toExactDecimalString(dr.rateInr ?? (dr as any).ratePerCaratInr, 4, '0.0000'),
          currency: dr.currency || 'INR',
          version: dr.version || 1,
          isPlaceholder: dr.isPlaceholder ?? true,
          isActive: dr.isActive ?? true,
          effectiveAt: dr.effectiveAt ? new Date(dr.effectiveAt) : new Date(),
          createdBy: dr.createdBy || 'system@mangalroyalstudio.com',
        },
      });
      summary.imported.diamondRates++;
    }

    // 6. Pricing Rules
    const pricingRuleIdByVersion = new Map<number, string>();
    const validPricingRuleIds = new Set<string>();
    for (const pr of state.pricingRules || []) {
      const saved = await tx.pricingRule.upsert({
        where: { version: pr.version },
        update: {
          name: pr.name,
          description: pr.description || 'Active pricing rule',
          gstRatePercent: toExactDecimalString(pr.gstRatePercent ?? 3, 2, '3.00'),
        },
        create: {
          id: pr.id,
          version: pr.version,
          name: pr.name,
          description: pr.description || 'Active pricing rule',
          status: pr.status || 'APPROVED',
          isPlaceholderFormula: pr.isPlaceholderFormula ?? true,
          stoneWeightToGramsFactor: toExactDecimalString(pr.stoneWeightToGramsFactor ?? 0.2, 4, '0.2000'),
          gstRatePercent: toExactDecimalString(pr.gstRatePercent ?? 3, 2, '3.00'),
          gstMode: pr.gstMode || 'INCLUSIVE',
          roundingMode: pr.roundingMode || 'NEAREST_1',
          maxPriceDeltaPercentThreshold: toExactDecimalString(
            pr.maxPriceDeltaPercentThreshold ?? 15,
            2,
            '15.00'
          ),
          defaultCertificationFeeInr: toExactDecimalString(pr.defaultCertificationFeeInr, 2),
          defaultHallmarkFeeInr: toExactDecimalString(pr.defaultHallmarkFeeInr, 2),
          approvedBy: pr.approvedBy,
          approvedAt: pr.approvedAt ? new Date(pr.approvedAt) : null,
        },
      });
      pricingRuleIdByVersion.set(saved.version, saved.id);
      validPricingRuleIds.add(saved.id);
      summary.imported.pricingRules++;
    }

    // 7. Pricing Runs & Items
    const validPricingRunIds = new Set<string>();
    for (const run of state.pricingRuns || []) {
      const resolvedRuleId =
        (run.ruleId && validPricingRuleIds.has(run.ruleId) ? run.ruleId : undefined) ||
        pricingRuleIdByVersion.get(run.ruleVersion);

      if (!resolvedRuleId) {
        throw new Error(`UNRESOLVED_PRICING_RULE: Run ${run.id} cannot resolve pricingRule`);
      }

      const savedRun = await tx.pricingRun.upsert({
        where: { id: run.id },
        update: {
          status: run.status,
          validatedBy: run.validatedBy,
          validatedAt: run.validatedAt ? new Date(run.validatedAt) : null,
          approvedBy: run.approvedBy,
          approvedAt: run.approvedAt ? new Date(run.approvedAt) : null,
          publishedBy: run.publishedBy,
          publishedAt: run.publishedAt ? new Date(run.publishedAt) : null,
          summary: (run.summary || {}) as Prisma.InputJsonValue,
        },
        create: {
          id: run.id,
          status: run.status,
          pricingRuleId: resolvedRuleId,
          rateSnapshot: {} as Prisma.InputJsonValue,
          summary: (run.summary || {}) as Prisma.InputJsonValue,
          notes: run.notes,
          createdBy: run.createdBy,
          validatedBy: run.validatedBy,
          validatedAt: run.validatedAt ? new Date(run.validatedAt) : null,
          approvedBy: run.approvedBy,
          approvedAt: run.approvedAt ? new Date(run.approvedAt) : null,
          publishedBy: run.publishedBy,
          publishedAt: run.publishedAt ? new Date(run.publishedAt) : null,
          createdAt: run.createdAt ? new Date(run.createdAt) : new Date(),
        },
      });
      validPricingRunIds.add(savedRun.id);
      summary.imported.pricingRuns++;

      for (const item of run.items || []) {
        const itemId = `${savedRun.id}-${item.sku}`;
        await tx.pricingRunItem.upsert({
          where: { id: itemId },
          update: {
            oldPriceInr: toExactDecimalString(item.oldPriceInr, 2),
            proposedPriceInr: toExactDecimalString(item.proposedPriceInr, 2),
            priceDeltaInr: toExactDecimalString(item.priceDeltaInr, 2),
            priceDeltaPercent: toExactDecimalString(item.priceDeltaPercent, 2),
            exceedsThreshold: Boolean(item.exceedsThreshold),
          },
          create: {
            id: itemId,
            pricingRunId: savedRun.id,
            sku: item.sku,
            shopifyVariantGid: item.shopifyVariantGid,
            oldPriceInr: toExactDecimalString(item.oldPriceInr, 2),
            proposedPriceInr: toExactDecimalString(item.proposedPriceInr, 2),
            priceDeltaInr: toExactDecimalString(item.priceDeltaInr, 2),
            priceDeltaPercent: toExactDecimalString(item.priceDeltaPercent, 2),
            calculationBreakdown: (item.breakdown || {}) as unknown as Prisma.InputJsonValue,
            exceedsThreshold: Boolean(item.exceedsThreshold),
            status: run.status === 'PUBLISHED' ? 'PUBLISHED' : 'PENDING',
          },
        });
        summary.imported.pricingRunItems++;
      }
    }

    // 8. Pricing Snapshots
    for (const snap of state.pricingSnapshots || []) {
      if (excludeTests && testSnapshotIds.has(snap.id)) {
        summary.skipped.pricingSnapshots++;
        continue;
      }

      const resolvedRuleId = pricingRuleIdByVersion.get(snap.formulaVersion);
      if (!resolvedRuleId) {
        throw new Error(
          `UNRESOLVED_PRICING_RULE: Snapshot ${snap.id} formulaVersion=${snap.formulaVersion} missing`
        );
      }

      let resolvedRunId: string | null = snap.pricingRunId || null;
      if (resolvedRunId && !validPricingRunIds.has(resolvedRunId)) {
        if (
          options.orphanPricingRunMapping &&
          Object.prototype.hasOwnProperty.call(options.orphanPricingRunMapping, resolvedRunId)
        ) {
          resolvedRunId = options.orphanPricingRunMapping[resolvedRunId] ?? null;
        } else {
          throw new Error(
            `UNRESOLVED_PRICING_RUN: Snapshot ${snap.id} references missing pricingRunId="${resolvedRunId}"`
          );
        }
      }

      await tx.pricingSnapshot.upsert({
        where: { id: snap.id },
        update: {
          publishedPriceInr: toExactDecimalString(snap.publishedPriceInr, 2),
          pricingRunId: resolvedRunId,
        },
        create: {
          id: snap.id,
          productMetadataId: productIdBySku.get(snap.sku) ?? null,
          pricingRunId: resolvedRunId,
          pricingRuleId: resolvedRuleId,
          sku: snap.sku,
          shopifyVariantGid: snap.shopifyVariantGid,
          publishedPriceInr: toExactDecimalString(snap.publishedPriceInr, 2),
          currency: snap.currency || 'INR',
          rateSnapshot: {} as Prisma.InputJsonValue,
          calculationBreakdown: (snap.breakdown || {}) as unknown as Prisma.InputJsonValue,
          publishedBy: snap.publishedBy,
          publishedAt: snap.publishedAt ? new Date(snap.publishedAt) : new Date(),
        },
      });
      summary.imported.pricingSnapshots++;
    }

    // 9. Customers
    const validCustomerIds = new Set<string>();
    for (const c of state.customers || []) {
      const cust = await tx.customer.upsert({
        where: { email: c.email.toLowerCase() },
        update: {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          passwordHash: c.passwordHash,
          totalOrdersCount: c.totalOrdersCount || 0,
          totalSpentInr: toExactDecimalString(c.totalSpentInr, 2),
        },
        create: {
          id: c.id,
          email: c.email.toLowerCase(),
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          city: c.city,
          state: c.state,
          passwordHash: c.passwordHash,
          status: c.isActive ? 'ACTIVE' : 'SUSPENDED',
          totalOrdersCount: c.totalOrdersCount || 0,
          totalSpentInr: toExactDecimalString(c.totalSpentInr, 2),
        },
      });
      validCustomerIds.add(cust.id);
      summary.imported.customers++;
    }

    // 10. Orders & Order Items
    const importedOrderIds = new Set<string>();
    for (const ord of state.orders || []) {
      if (excludeTests && testOrderIds.has(ord.id)) {
        summary.skipped.orders++;
        summary.skipped.orderItems += ord.lineItems?.length || 0;
        continue;
      }

      let customerId: string | null = ord.customerId || null;
      if (customerId && !validCustomerIds.has(customerId)) {
        if (
          options.unresolvedCustomerMapping &&
          Object.prototype.hasOwnProperty.call(options.unresolvedCustomerMapping, customerId)
        ) {
          customerId = options.unresolvedCustomerMapping[customerId] ?? null;
        } else {
          throw new Error(
            `UNRESOLVED_CUSTOMER_FK: Order ${ord.id} references missing customerId="${customerId}"`
          );
        }
      }

      const savedOrder = await tx.orderMetadata.upsert({
        where: { orderNumber: ord.orderNumber },
        update: {
          financialStatus: ord.financialStatus,
          fulfillmentStatus: ord.fulfillmentStatus,
          customerId,
          discountAmountInr: toExactDecimalString((ord as any).discountAmountInr, 2),
          discountCode: (ord as any).discountCode ?? null,
        },
        create: {
          id: ord.id,
          orderNumber: ord.orderNumber,
          shopifyOrderGid: ord.shopifyOrderGid,
          customerEmail: ord.customerEmail.toLowerCase(),
          customerName: ord.customerName,
          customerPhone: ord.customerPhone,
          customerId,
          subtotalPriceInr: toExactDecimalString(ord.subtotalPriceInr, 2),
          discountAmountInr: toExactDecimalString((ord as any).discountAmountInr, 2),
          totalTaxInr: toExactDecimalString(ord.totalTaxInr, 2),
          totalPriceInr: toExactDecimalString(ord.totalPriceInr, 2),
          discountCode: (ord as any).discountCode ?? null,
          financialStatus: ord.financialStatus,
          fulfillmentStatus: ord.fulfillmentStatus,
          lineItemsSnapshot: (ord.lineItems || []) as unknown as Prisma.InputJsonValue,
          pricingSnapshotsJson: {} as Prisma.InputJsonValue,
          shippingAddressJson: {
            city: ord.shippingCity,
            state: ord.shippingState,
            pincode: ord.shippingPincode,
          } as Prisma.InputJsonValue,
          placedAt: ord.placedAt ? new Date(ord.placedAt) : new Date(),
        },
      });
      importedOrderIds.add(savedOrder.id);
      summary.imported.orders++;

      for (const [idx, li] of (ord.lineItems || []).entries()) {
        const orderItemId = `${savedOrder.id}-item-${idx}`;
        const qty = li.quantity || 1;
        const unitPrice = toExactDecimalString(li.purchaseTimePriceInr, 2);
        const totalLine = new Decimal(unitPrice).times(qty).toFixed(2);
        await tx.orderItem.upsert({
          where: { id: orderItemId },
          update: {
            quantity: qty,
            unitPriceInr: unitPrice,
            totalPriceInr: totalLine,
          },
          create: {
            id: orderItemId,
            orderMetadataId: savedOrder.id,
            productMetadataId: productIdBySku.get(li.sku) ?? null,
            sku: li.sku,
            title: li.title,
            quantity: qty,
            unitPriceInr: unitPrice,
            totalPriceInr: totalLine,
            metalPurity: li.metalPurity || '18K',
          },
        });
        summary.imported.orderItems++;
      }
    }

    // 11. Payments
    const paymentIdLookup = new Map<string, string>();
    for (const pay of state.payments || []) {
      if (excludeTests && testPaymentIds.has(pay.id)) {
        summary.skipped.payments++;
        continue;
      }

      const savedPay = await tx.paymentRecord.upsert({
        where: { providerPaymentId: pay.providerPaymentId },
        update: {
          status: pay.status || 'CAPTURED',
          signatureVerified: pay.signatureVerified ?? true,
        },
        create: {
          id: pay.id,
          orderMetadataId: pay.orderId,
          provider: pay.provider || 'RAZORPAY',
          providerPaymentId: pay.providerPaymentId,
          amountInr: toExactDecimalString(pay.amountInr, 2),
          currency: 'INR',
          method: pay.method || 'upi',
          status: pay.status || 'CAPTURED',
          signatureVerified: pay.signatureVerified ?? true,
          capturedAt: pay.capturedAt ? new Date(pay.capturedAt) : null,
        },
      });
      paymentIdLookup.set(savedPay.id, savedPay.id);
      paymentIdLookup.set(savedPay.providerPaymentId, savedPay.id);
      summary.imported.payments++;
    }

    // 12. Shipments
    for (const shp of state.shipments || []) {
      if (excludeTests && testOrderIds.has(shp.orderId)) {
        summary.skipped.shipments++;
        continue;
      }
      await tx.shipment.upsert({
        where: { id: shp.id },
        update: {
          status: shp.status,
          awbCode: shp.awbCode,
          trackingUrl: shp.trackingUrl,
          trackingHistory: (shp.trackingHistory || []) as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: shp.id,
          orderMetadataId: shp.orderId,
          shopifyOrderGid: shp.shopifyOrderGid,
          provider: shp.provider || 'SHIPROCKET',
          shiprocketOrderId: shp.shiprocketOrderId,
          shipmentId: shp.shipmentId,
          awbCode: shp.awbCode,
          courierName: shp.courierName,
          declaredValueInr: toExactDecimalString(shp.declaredValueInr, 2),
          isInsured: shp.isInsured ?? true,
          packageWeightGrams: toExactDecimalString(shp.packageWeightGrams ?? 120, 2, '120.00'),
          labelUrl: shp.labelUrl,
          manifestUrl: shp.manifestUrl,
          trackingUrl: shp.trackingUrl,
          status: shp.status || 'CREATED',
          trackingHistory: (shp.trackingHistory || []) as unknown as Prisma.InputJsonValue,
        },
      });
      summary.imported.shipments++;
    }

    // 13. Refunds
    for (const rfnd of state.refunds || []) {
      if (excludeTests && testRefundIds.has(rfnd.id)) {
        summary.skipped.refunds++;
        continue;
      }
      const resolvedPaymentId = paymentIdLookup.get(rfnd.paymentId);
      if (!resolvedPaymentId) {
        throw new Error(`UNRESOLVED_PAYMENT_FK: Refund ${rfnd.id} cannot resolve payment "${rfnd.paymentId}"`);
      }
      await tx.refundRecord.upsert({
        where: { providerRefundId: rfnd.providerRefundId },
        update: {
          status: rfnd.status || 'PROCESSED',
          amountInr: toExactDecimalString(rfnd.amountInr, 2),
        },
        create: {
          id: rfnd.id,
          orderMetadataId: rfnd.orderId,
          paymentRecordId: resolvedPaymentId,
          providerRefundId: rfnd.providerRefundId,
          amountInr: toExactDecimalString(rfnd.amountInr, 2),
          currency: 'INR',
          reason: rfnd.reason,
          status: rfnd.status || 'PROCESSED',
          initiatedBy: rfnd.initiatedByEmail,
          processedAt: rfnd.processedAt ? new Date(rfnd.processedAt) : null,
        },
      });
      summary.imported.refunds++;
    }

    // 14. Inventory Movements
    for (const mov of state.inventoryMovements || []) {
      if (excludeTests && testMovementIds.has(mov.id)) {
        summary.skipped.inventoryMovements++;
        continue;
      }
      const inventoryRecordId = inventoryIdBySku.get(mov.sku);
      if (!inventoryRecordId) {
        throw new Error(`UNRESOLVED_INVENTORY_FK: Movement ${mov.id} cannot resolve inventory for SKU ${mov.sku}`);
      }
      await tx.inventoryMovement.upsert({
        where: { id: mov.id },
        update: {
          quantityDelta: mov.deltaQuantity,
          previousQuantity: mov.previousAvailable,
          newQuantity: mov.newAvailable,
        },
        create: {
          id: mov.id,
          inventoryRecordId,
          sku: mov.sku,
          movementType: mov.movementType || 'MANUAL_ADJUSTMENT',
          quantityDelta: mov.deltaQuantity,
          previousQuantity: mov.previousAvailable,
          newQuantity: mov.newAvailable,
          reason: mov.reason,
          actorEmail: mov.actorEmail,
          createdAt: mov.createdAt ? new Date(mov.createdAt) : new Date(),
        },
      });
      summary.imported.inventoryMovements++;
    }

    // 15. Discounts
    for (const disc of state.discounts || []) {
      await tx.discount.upsert({
        where: { code: disc.code },
        update: {
          isActive: disc.isActive ?? true,
          value: toExactDecimalString((disc as any).percentage ?? (disc as any).value ?? 10, 2, '10.00'),
        },
        create: {
          id: disc.id,
          code: disc.code,
          title: (disc as any).title || (disc as any).description || disc.code,
          discountType: (disc as any).type || (disc as any).discountType || 'PERCENTAGE',
          value: toExactDecimalString((disc as any).percentage ?? (disc as any).value ?? 10, 2, '10.00'),
          minOrderAmountInr: toOptionalDecimalString(disc.minOrderAmountInr, 2),
          appliesTo: disc.appliesTo || 'ALL_COLLECTIONS',
          isActive: disc.isActive ?? true,
          usageCount: disc.usageCount || 0,
        },
      });
      summary.imported.discounts++;
    }

    // 16. Banners
    for (const b of state.banners || []) {
      await tx.banner.upsert({
        where: { id: b.id },
        update: {
          title: b.title,
          subtitle: b.subtitle,
          isActive: b.isActive ?? true,
        },
        create: {
          id: b.id,
          title: b.title,
          eyebrow: b.eyebrow,
          subtitle: b.subtitle,
          Placement: b.placement || 'HOMEPAGE_HERO',
          imageUrl: b.imageUrl || 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/placeholder.jpg',
          ctaLabel: b.ctaLabel,
          ctaLink: b.ctaLink,
          isActive: b.isActive ?? true,
        },
      });
      summary.imported.banners++;
    }

    // 17. Contents
    for (const c of state.contents || []) {
      await tx.content.upsert({
        where: { slug: c.slug },
        update: {
          title: c.title,
          body: c.body || c.title,
          isPublished: c.isPublished ?? true,
        },
        create: {
          id: c.id,
          slug: c.slug,
          title: c.title,
          sectionType: c.sectionType || 'EDITORIAL',
          body: c.body || c.title,
          isPublished: c.isPublished ?? true,
        },
      });
      summary.imported.contents++;
    }

    // 18. Notifications
    for (const n of state.notifications || []) {
      if (excludeTests && testNotificationIds.has(n.id)) {
        summary.skipped.notifications++;
        continue;
      }
      await tx.notification.upsert({
        where: { id: n.id },
        update: { status: n.status || 'SENT' },
        create: {
          id: n.id,
          channel: n.channel || 'EMAIL',
          recipientEmail: n.recipientEmail,
          subject: n.subject,
          body: n.body,
          eventType: n.templateCode || 'ORDER_CONFIRMATION',
          status: n.status || 'SENT',
          sentAt: n.sentAt ? new Date(n.sentAt) : new Date(),
        },
      });
      summary.imported.notifications++;
    }

    // 19. Integration Events
    for (const ev of state.integrationEvents || []) {
      await tx.integrationEvent.upsert({
        where: {
          provider_eventId: {
            provider: ev.provider,
            eventId: ev.eventId,
          },
        },
        update: { status: ev.status || 'PROCESSED' },
        create: {
          id: ev.id,
          provider: ev.provider,
          eventId: ev.eventId,
          eventType: ev.eventType,
          payloadHash: ev.payloadHash,
          status: ev.status || 'PROCESSED',
          receivedAt: ev.receivedAt ? new Date(ev.receivedAt) : new Date(),
          processedAt: (ev as any).processedAt ? new Date((ev as any).processedAt) : null,
        },
      });
      summary.imported.integrationEvents++;
    }

    // 20. Audit Logs (ALL records; no truncation)
    for (const log of state.auditLogs || []) {
      if (excludeTests && testAuditLogIds.has(log.id)) {
        summary.skipped.auditLogs++;
        continue;
      }
      await tx.auditLog.upsert({
        where: { id: log.id },
        update: {
          summary: log.summary,
        },
        create: {
          id: log.id,
          actorEmail: log.actorEmail,
          actorRole: log.actorRole,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          summary: log.summary,
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
        },
      });
      summary.imported.auditLogs++;
    }

    if (options.beforeTransactionEnd) {
      await options.beforeTransactionEnd(tx);
    }
  };

  if (dryRun) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await executeImport(tx);
          throw new Error('ROLLBACK_INTENTIONAL: Dry-run rehearsal completed successfully. All writes rolled back.');
        },
        { timeout: 30000 }
      );
    } catch (err: any) {
      if (err?.message?.includes('ROLLBACK_INTENTIONAL')) {
        summary.rolledBack = true;
      } else {
        throw err;
      }
    }
  } else {
    await prisma.$transaction(
      async (tx) => {
        await executeImport(tx);
      },
      { timeout: 30000 }
    );
  }

  return summary;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('import-json-to-postgres.ts')) {
  const isCommit = process.argv.includes('--commit');
  const excludeTests = process.argv.includes('--exclude-test-artifacts');
  const dryRun = !isCommit;
  const policy: TestArtifactPolicy = excludeTests ? 'EXCLUDE' : 'REJECT';

  const fileArgIndex = process.argv.indexOf('--file');
  const fileArg = fileArgIndex !== -1 ? process.argv[fileArgIndex + 1] : undefined;

  const provisionalInventoryOverrides: Record<string, ProvisionalInventoryOverride> = {};
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--provisional-inventory' && process.argv[i + 1]) {
      const [sku, qtyStr] = process.argv[i + 1]!.split('=');
      const qty = Number(qtyStr);
      if (!sku || !Number.isInteger(qty) || qty < 0) {
        console.error(`Invalid --provisional-inventory argument: ${process.argv[i + 1]}`);
        process.exit(1);
      }
      provisionalInventoryOverrides[sku] = {
        quantity: qty,
        reason: `Provisional pre-test-deduction inventory (${qty} units; pending physical vault confirmation)`,
        actorEmail: 'owner@mangalroyalstudio.com',
      };
    }
  }

  console.log(`Starting JSON-to-PostgreSQL import...`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (will rollback)' : 'LIVE COMMIT'}`);
  console.log(`Test Artifact Policy: ${policy}`);
  if (Object.keys(provisionalInventoryOverrides).length > 0) {
    console.log('Provisional Inventory Overrides:', JSON.stringify(provisionalInventoryOverrides));
  }

  runJsonToPostgresImport({
    filePath: fileArg,
    dryRun,
    testArtifactPolicy: policy,
    provisionalInventoryOverrides,
  })
    .then((summary) => {
      console.log('\n--- IMPORT SUMMARY ---');
      console.log(`Source: ${summary.sourceFilePath}`);
      console.log(`Mode: ${summary.dryRun ? 'DRY-RUN (Rolled Back)' : 'COMMITTED'}`);
      console.log(`Test Artifacts Classified: ${summary.testArtifacts.length}`);
      console.log(`Unresolved References: ${summary.unresolvedReferences.length}`);
      console.log(`Discrepancies: ${summary.discrepancies.length}`);
      console.log('Provisional Inventory Applied:', JSON.stringify(summary.provisionalInventoryApplied));
      console.log('Imported counts:', JSON.stringify(summary.imported, null, 2));
      console.log('Skipped counts:', JSON.stringify(summary.skipped, null, 2));
      console.log('----------------------');
    })
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    })
    .finally(() => {
      disconnectPrisma();
    });
}
