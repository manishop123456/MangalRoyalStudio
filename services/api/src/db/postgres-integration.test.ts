import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, disconnectPrisma, checkDatabaseConnection } from './prisma.js';
import { PostgresOrderRepository } from './repositories/order-repository.js';
import { runJsonToPostgresImport } from '../scripts/import-json-to-postgres.js';
import path from 'node:path';
import fs from 'node:fs';

const DEV_DB_URL = 'postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public';

describe('PostgreSQL Runtime Integration & Transaction Workflows (Step 1.3)', () => {
  let isDbAvailable = false;
  let prisma: ReturnType<typeof getPrismaClient>;
  let orderRepo: PostgresOrderRepository;

  beforeAll(async () => {
    prisma = getPrismaClient(DEV_DB_URL);
    const health = await checkDatabaseConnection(prisma);
    isDbAvailable = health.ok;
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await disconnectPrisma();
    }
  });

  it('1. establishes connection to isolated development PostgreSQL and reports version', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test 1: PostgreSQL not reachable in sandbox');
      return;
    }
    const health = await checkDatabaseConnection(prisma);
    expect(health.ok).toBe(true);
    expect(health.version).toContain('PostgreSQL 18');
  });

  it('2. executes dry-run import rehearsal and rolls back all database writes cleanly', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test 2: PostgreSQL not reachable in sandbox');
      return;
    }
    let statePath = path.resolve(process.cwd(), '.data/platform-state.json');
    if (!fs.existsSync(statePath)) {
      statePath = path.resolve(process.cwd(), 'services/api/.data/platform-state.json');
    }

    // Count products before dry-run
    const prodsBefore = await prisma.productMetadata.count();

    const summary = await runJsonToPostgresImport({
      filePath: statePath,
      dryRun: true,
      testArtifactPolicy: 'EXCLUDE',
      databaseUrl: DEV_DB_URL,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.rolledBack).toBe(true);
    expect(summary.imported.products).toBe(8);
    expect(summary.imported.orders).toBe(3);
    expect(summary.skipped.orders).toBe(6);
    expect(summary.imported.categories).toBe(11);

    // Verify complete rollback: count after dry-run must equal count before!
    const prodsAfter = await prisma.productMetadata.count();
    expect(prodsAfter).toBe(prodsBefore);
  });

  it('3. transactional order placement reserves stock atomically and rolls back on insufficient stock', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test 3: PostgreSQL not reachable in sandbox');
      return;
    }

    orderRepo = new PostgresOrderRepository(prisma);

    // Seed test product and inventory record inside dev db
    const testSku = `TEST-RNG-${Date.now()}`;
    const product = await prisma.productMetadata.create({
      data: {
        sku: testSku,
        handle: `test-ring-${Date.now()}`,
        title: 'Transaction Test Solitaire Ring',
        currentShopifyPrice: 50000,
        inventoryRecord: {
          create: {
            availableQuantity: 2,
            reservedQuantity: 0,
          },
        },
      },
      include: { inventoryRecord: true },
    });

    let testOrderId: string | null = null;
    try {
      // 1. Successful order placement for 1 item
      const order = await orderRepo.createOrderWithInventoryReservation({
        orderNumber: `TEST-ORD-${Date.now()}`,
        customerEmail: 'test.buyer@example.com',
        customerName: 'Test Buyer',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400050',
        shippingAddressJson: { line1: 'Vault test road' },
        subtotalPriceInr: '48543.69',
        totalTaxInr: '1456.31',
        totalPriceInr: '50000.00',
        lineItems: [
          {
            sku: testSku,
            title: 'Transaction Test Solitaire Ring',
            quantity: 1,
            purchaseTimePriceInr: '50000.00',
          },
        ],
      });
      testOrderId = order.id;

      expect(order.orderNumber).toBeDefined();

      const invAfterFirst = await prisma.inventoryRecord.findUnique({
        where: { id: product.inventoryRecord!.id },
      });
      expect(invAfterFirst?.availableQuantity).toBe(1);
      expect(invAfterFirst?.reservedQuantity).toBe(1);

      // 2. Insufficient stock failure when requesting 5 items (only 1 available)
      await expect(
        orderRepo.createOrderWithInventoryReservation({
          orderNumber: `FAIL-ORD-${Date.now()}`,
          customerEmail: 'test.buyer@example.com',
          customerName: 'Test Buyer',
          shippingCity: 'Mumbai',
          shippingState: 'Maharashtra',
          shippingPincode: '400050',
          shippingAddressJson: { line1: 'Vault test road' },
          subtotalPriceInr: '242718.45',
          totalTaxInr: '7281.55',
          totalPriceInr: '250000.00',
          lineItems: [
            {
              sku: testSku,
              title: 'Transaction Test Solitaire Ring',
              quantity: 5,
              purchaseTimePriceInr: '50000.00',
            },
          ],
        })
      ).rejects.toThrow(/INSUFFICIENT_STOCK/);

      // Stock remains exactly 1 available, 1 reserved (transaction rolled back!)
      const invAfterFail = await prisma.inventoryRecord.findUnique({
        where: { id: product.inventoryRecord!.id },
      });
      expect(invAfterFail?.availableQuantity).toBe(1);
      expect(invAfterFail?.reservedQuantity).toBe(1);

      // 3. Cancellation with restock
      const cancelResult = await orderRepo.cancelOrderWithRestock(order.id, 'test.buyer@example.com');
      expect(cancelResult.order.fulfillmentStatus).toBe('CANCELLED');

      const invAfterCancel = await prisma.inventoryRecord.findUnique({
        where: { id: product.inventoryRecord!.id },
      });
      expect(invAfterCancel?.availableQuantity).toBe(2);
      expect(invAfterCancel?.reservedQuantity).toBe(0);
    } finally {
      // Clean up test order and test product
      if (testOrderId) {
        await prisma.auditLog.deleteMany({ where: { entityId: testOrderId } }).catch(() => undefined);
        await prisma.orderMetadata.delete({ where: { id: testOrderId } }).catch(() => undefined);
      }
      await prisma.productMetadata.delete({ where: { id: product.id } }).catch(() => undefined);
    }
  });

  it('4. payment capture confirmation is idempotent and prevents double-capture', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test 4: PostgreSQL not reachable in sandbox');
      return;
    }

    orderRepo = new PostgresOrderRepository(prisma);

    const orderNumber = `TEST-PAY-${Date.now()}`;
    const order = await prisma.orderMetadata.create({
      data: {
        orderNumber,
        customerEmail: 'pay.test@example.com',
        customerName: 'Payment Buyer',
        subtotalPriceInr: 10000,
        totalTaxInr: 300,
        totalPriceInr: 10300,
        financialStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        lineItemsSnapshot: [],
        pricingSnapshotsJson: {},
        shippingAddressJson: {},
      },
    });

    try {
      const paymentId = `pay_test_${Date.now()}`;
      const first = await orderRepo.confirmPaymentCapture({
        orderId: order.id,
        providerPaymentId: paymentId,
        amountInr: 10300,
        method: 'upi',
      });

      expect(first.order.financialStatus).toBe('PAID');
      expect(first.payment.providerPaymentId).toBe(paymentId);
      expect(first.idempotent).toBe(false);

      // Replay of same payment is idempotent
      const replay = await orderRepo.confirmPaymentCapture({
        orderId: order.id,
        providerPaymentId: paymentId,
        amountInr: 10300,
        method: 'upi',
      });
      expect(replay.idempotent).toBe(true);

      // Attempt to apply a DIFFERENT payment to already paid order is rejected
      await expect(
        orderRepo.confirmPaymentCapture({
          orderId: order.id,
          providerPaymentId: `pay_different_${Date.now()}`,
          amountInr: 10300,
          method: 'card',
        })
      ).rejects.toThrow(/ORDER_ALREADY_PAID/);
    } finally {
      await prisma.orderMetadata.delete({ where: { id: order.id } }).catch(() => undefined);
    }
  });

  it('5. verifies complete rollback across all 25 entity tables, decimal precision, and idempotency', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test 5: PostgreSQL not reachable in sandbox');
      return;
    }

    const tableNames = [
      'Category',
      'Collection',
      'ProductMetadata',
      'JewellerySpecification',
      'DiamondComponent',
      'InventoryRecord',
      'GoldRate',
      'DiamondRate',
      'PricingRule',
      'PricingRun',
      'PricingRunItem',
      'PricingSnapshot',
      'Customer',
      'OrderMetadata',
      'OrderItem',
      'PaymentRecord',
      'Shipment',
      'RefundRecord',
      'InventoryMovement',
      'Discount',
      'Banner',
      'Content',
      'Notification',
      'IntegrationEvent',
      'AuditLog',
    ];

    const getCounts = async () => {
      const counts: Record<string, number> = {};
      for (const tbl of tableNames) {
        const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*)::bigint AS count FROM "${tbl}"`
        );
        counts[tbl] = Number(rows[0]?.count ?? 0);
      }
      return counts;
    };

    const beforeCounts = await getCounts();
    let verifiedInsideTx = false;

    const summary = await runJsonToPostgresImport({
      dryRun: true,
      testArtifactPolicy: 'EXCLUDE',
      databaseUrl: DEV_DB_URL,
      beforeTransactionEnd: async (tx) => {
        // Verify exact Decimal precision inside PostgreSQL transaction
        const prod = await tx.productMetadata.findUnique({
          where: { sku: 'MRS-RNG-1001' },
          include: { jewellerySpecification: true },
        });
        expect(prod?.currentShopifyPrice.toFixed(2)).toBe('70336.00');
        expect(prod?.jewellerySpecification?.grossWeightGrams.toFixed(3)).toBe('4.150');

        const ord = await tx.orderMetadata.findUnique({ where: { orderNumber: 'MRS-1041' } });
        expect(ord?.totalPriceInr.toFixed(2)).toBe('68500.00');

        // Verify PricingSnapshot -> PricingRun and PricingRule relationships
        const snaps = await tx.pricingSnapshot.findMany({
          include: { pricingRun: true, pricingRule: true },
        });
        expect(snaps.length).toBe(59);
        expect(snaps.every((s) => s.pricingRule !== null && s.pricingRun !== null)).toBe(true);

        // Verify AuditLog count (at least all 99 non-test logs)
        const auditCount = await tx.auditLog.count();
        expect(auditCount).toBeGreaterThanOrEqual(99);

        // Verify idempotency: re-upserting existing category & product inside tx creates 0 duplicates
        const prodCountBefore = await tx.productMetadata.count();
        await tx.productMetadata.upsert({
          where: { sku: 'MRS-RNG-1001' },
          update: { title: prod!.title },
          create: {
            sku: 'MRS-RNG-1001',
            handle: prod!.handle,
            title: prod!.title,
            currentShopifyPrice: '70336.00',
          },
        });
        const prodCountAfter = await tx.productMetadata.count();
        expect(prodCountAfter).toBe(prodCountBefore);

        verifiedInsideTx = true;
      },
    });

    expect(verifiedInsideTx).toBe(true);
    expect(summary.rolledBack).toBe(true);

    const afterCounts = await getCounts();
    expect(afterCounts).toEqual(beforeCounts);
  });
});
