import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyTestArtifacts,
  resolveStateFilePath,
  runJsonToPostgresImport,
  toExactDecimalString,
  validateStateForImport,
} from './import-json-to-postgres.js';
import type { PlatformState } from '../store/data-store.js';

function createInMemoryPrismaHarness() {
  const committed: Record<string, Map<string, any>> = {};
  let staging: Record<string, Map<string, any>> | null = null;

  const getStore = (model: string) => {
    const target = staging ?? committed;
    if (!target[model]) target[model] = new Map<string, any>();
    return target[model];
  };

  const makeModelDelegate = (model: string, uniqueKeys: string[]) => ({
    upsert: async ({ where, update, create }: any) => {
      const store = getStore(model);
      let existingKey: string | undefined;
      for (const [k, row] of store.entries()) {
        const matches = uniqueKeys.some((uk) => {
          if (uk === 'provider_eventId' && where.provider_eventId) {
            return (
              row.provider === where.provider_eventId.provider &&
              row.eventId === where.provider_eventId.eventId
            );
          }
          return where[uk] !== undefined && row[uk] === where[uk];
        });
        if (matches) {
          existingKey = k;
          break;
        }
      }
      if (existingKey) {
        const updated = { ...store.get(existingKey), ...update };
        store.set(existingKey, updated);
        return updated;
      }
      const id = create.id ?? `${model}-${store.size + 1}`;
      const inserted = { ...create, id };
      store.set(id, inserted);
      return inserted;
    },
  });

  const tx: any = {
    category: makeModelDelegate('category', ['id', 'slug']),
    collection: makeModelDelegate('collection', ['id', 'handle']),
    productMetadata: makeModelDelegate('productMetadata', ['id', 'sku']),
    jewellerySpecification: makeModelDelegate('jewellerySpecification', ['id', 'productMetadataId']),
    diamondComponent: makeModelDelegate('diamondComponent', ['id']),
    inventoryRecord: makeModelDelegate('inventoryRecord', ['id', 'productMetadataId']),
    goldRate: makeModelDelegate('goldRate', ['id']),
    diamondRate: makeModelDelegate('diamondRate', ['id']),
    pricingRule: makeModelDelegate('pricingRule', ['id', 'version']),
    pricingRun: makeModelDelegate('pricingRun', ['id']),
    pricingRunItem: makeModelDelegate('pricingRunItem', ['id']),
    pricingSnapshot: makeModelDelegate('pricingSnapshot', ['id']),
    customer: makeModelDelegate('customer', ['id', 'email']),
    orderMetadata: makeModelDelegate('orderMetadata', ['id', 'orderNumber']),
    orderItem: makeModelDelegate('orderItem', ['id']),
    paymentRecord: makeModelDelegate('paymentRecord', ['id', 'providerPaymentId']),
    shipment: makeModelDelegate('shipment', ['id', 'awbCode']),
    refundRecord: makeModelDelegate('refundRecord', ['id', 'providerRefundId']),
    inventoryMovement: makeModelDelegate('inventoryMovement', ['id']),
    discount: makeModelDelegate('discount', ['id', 'code']),
    banner: makeModelDelegate('banner', ['id']),
    content: makeModelDelegate('content', ['id', 'slug']),
    notification: makeModelDelegate('notification', ['id']),
    integrationEvent: makeModelDelegate('integrationEvent', ['id', 'provider_eventId']),
    auditLog: makeModelDelegate('auditLog', ['id']),
  };

  // Fix productMetadataId lookup for JewellerySpecification & InventoryRecord
  const origSpecUpsert = tx.jewellerySpecification.upsert;
  tx.jewellerySpecification.upsert = async (args: any) => {
    if (args.create?.productMetadata?.connect?.id && !args.create.productMetadataId) {
      args.create.productMetadataId = args.create.productMetadata.connect.id;
    }
    return origSpecUpsert(args);
  };
  const origInvUpsert = tx.inventoryRecord.upsert;
  tx.inventoryRecord.upsert = async (args: any) => {
    if (args.create?.productMetadata?.connect?.id && !args.create.productMetadataId) {
      args.create.productMetadataId = args.create.productMetadata.connect.id;
    }
    return origInvUpsert(args);
  };

  const prisma: any = {
    $queryRawUnsafe: async () => [{ version: 'PostgreSQL 18.6 (InMemory Harness)' }],
    $transaction: async (fn: (client: any) => Promise<void>) => {
      // Clone committed into staging
      staging = {};
      for (const [model, map] of Object.entries(committed)) {
        staging[model] = new Map(map);
      }
      try {
        await fn(tx);
        // Commit staging -> committed
        for (const [model, map] of Object.entries(staging)) {
          committed[model] = map;
        }
      } finally {
        staging = null;
      }
    },
  };

  return { prisma, committed };
}

/**
 * Test isolation (2026-11-22): the live services/api/.data/platform-state.json is written by any locally
 * running JSON-backed API (e.g. the owner's dev session). Tests therefore read ONE immutable snapshot copied
 * into a private temp dir before the suite, run every import against that snapshot, and derive expected totals
 * from the snapshot itself instead of hard-coding environment-dependent counts (e.g. 123 audit logs).
 */
let snapshotDir = '';
let snapshotPath = '';
let snapshot: PlatformState;
let snapshotSha256 = '';
const readSnapshot = (): PlatformState => JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const sha256File = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

beforeAll(() => {
  snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-importer-snapshot-'));
  snapshotPath = path.join(snapshotDir, 'platform-state.snapshot.json');
  fs.copyFileSync(resolveStateFilePath(), snapshotPath);
  snapshot = readSnapshot();
  snapshotSha256 = sha256File(snapshotPath);
});

afterAll(() => {
  if (snapshotDir) fs.rmSync(snapshotDir, { recursive: true, force: true });
});

describe('JSON-to-PostgreSQL Importer Remediation (Phase 1.3C)', () => {
  it('1. resolves state file paths reliably from package root and monorepo root', () => {
    const defaultResolved = resolveStateFilePath();
    expect(fs.existsSync(defaultResolved)).toBe(true);
    expect(defaultResolved.endsWith('services/api/.data/platform-state.json')).toBe(true);

    const fromRootRel = resolveStateFilePath('services/api/.data/platform-state.json');
    expect(fromRootRel).toBe(defaultResolved);
  });

  it('2. preserves exact decimal precision without IEEE-754 float drift', () => {
    expect(toExactDecimalString('68500.00', 2)).toBe('68500.00');
    expect(toExactDecimalString('35517.67', 2)).toBe('35517.67');
    expect(toExactDecimalString('2.3', 3)).toBe('2.300');
    expect(toExactDecimalString('0.2', 4)).toBe('0.2000');
    expect(toExactDecimalString('9999999999.99', 2)).toBe('9999999999.99');
  });

  it('3. classifies all test artifacts and unresolved FKs in API snapshot without silent coercion', () => {
    const state: PlatformState = readSnapshot();

    const classified = classifyTestArtifacts(state);
    expect(classified.testOrderIds.size).toBe(6);
    expect(classified.testRefundIds.size).toBe(6);
    expect(classified.testSnapshotIds.size).toBe(6);

    const validationReject = validateStateForImport(state, { testArtifactPolicy: 'REJECT' });
    expect(validationReject.unresolvedReferences.some((r) => r.missingKey === 'cust-guest')).toBe(true);
    expect(
      validationReject.unresolvedReferences.some((r) => r.missingKey === 'checkout-immutable-lock')
    ).toBe(true);
    expect(
      validationReject.discrepancies.some((d) => d.includes('pay_test_verified_001'))
    ).toBe(true);

    const validationExclude = validateStateForImport(state, { testArtifactPolicy: 'EXCLUDE' });
    expect(validationExclude.unresolvedReferences.length).toBe(0);
    expect(validationExclude.discrepancies.length).toBe(0);
  });

  it('4. executes dry-run and leaves zero persistent records', async () => {
    const { prisma, committed } = createInMemoryPrismaHarness();
    const summary = await runJsonToPostgresImport({
      filePath: snapshotPath,
      dryRun: true,
      testArtifactPolicy: 'EXCLUDE',
      prismaClient: prisma,
    });
    const classified = classifyTestArtifacts(snapshot);

    expect(summary.dryRun).toBe(true);
    expect(summary.rolledBack).toBe(true);
    expect(summary.sourceFilePath).toBe(snapshotPath);
    // Every record in the snapshot is accounted for (imported + skipped), with test artifacts skipped.
    expect(summary.imported.products + summary.skipped.products).toBe(snapshot.products.length);
    expect(summary.imported.orders + summary.skipped.orders).toBe(snapshot.orders.length);
    expect(summary.skipped.orders).toBe(classified.testOrderIds.size);
    expect(summary.imported.pricingRuns + summary.skipped.pricingRuns).toBe(snapshot.pricingRuns.length);
    expect(summary.imported.pricingSnapshots + summary.skipped.pricingSnapshots).toBe(snapshot.pricingSnapshots.length);
    expect(summary.skipped.pricingSnapshots).toBe(classified.testSnapshotIds.size);
    expect(summary.imported.shipments + summary.skipped.shipments).toBe(snapshot.shipments.length);
    // Audit logs: compared with the snapshot's own count, never a hard-coded environment total.
    expect(summary.imported.auditLogs + summary.skipped.auditLogs).toBe(snapshot.auditLogs.length);
    // Dry-run leaves zero committed records and never modifies its source file.
    expect(Object.keys(committed).length).toBe(0);
    expect(sha256File(snapshotPath)).toBe(snapshotSha256);
  });

  it('4b. regression: audit accounting follows the dataset, so extra entries cannot break the test', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-importer-extra-audit-'));
    try {
      const file = path.join(dir, 'state.json');
      const state = readSnapshot();
      const base = state.auditLogs.length;
      const template = state.auditLogs[0]!;
      state.auditLogs.unshift(
        { ...template, id: 'audit-isolation-test-1', action: 'AUTH_LOGIN', createdAt: '2026-11-22T06:05:15.084Z' },
        { ...template, id: 'audit-isolation-test-2', action: 'METAL_RATE_UPDATED', createdAt: '2026-11-22T06:08:11.940Z' }
      );
      fs.writeFileSync(file, JSON.stringify(state));
      const { prisma } = createInMemoryPrismaHarness();
      const summary = await runJsonToPostgresImport({ filePath: file, dryRun: true, testArtifactPolicy: 'EXCLUDE', prismaClient: prisma });
      expect(summary.imported.auditLogs + summary.skipped.auditLogs).toBe(base + 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('5. is strictly idempotent when run twice on the same dataset', async () => {
    const { prisma, committed } = createInMemoryPrismaHarness();

    const first = await runJsonToPostgresImport({
      filePath: snapshotPath,
      dryRun: false,
      testArtifactPolicy: 'EXCLUDE',
      prismaClient: prisma,
    });
    const second = await runJsonToPostgresImport({
      filePath: snapshotPath,
      dryRun: false,
      testArtifactPolicy: 'EXCLUDE',
      prismaClient: prisma,
    });

    // Second run upserts the same rows: committed sizes equal ONE run's imported counts.
    expect(second.imported.products).toBe(first.imported.products);
    expect(committed.productMetadata?.size).toBe(first.imported.products);
    expect(committed.orderMetadata?.size).toBe(first.imported.orders);
    expect(committed.pricingRun?.size).toBe(first.imported.pricingRuns);
    expect(committed.pricingSnapshot?.size).toBe(first.imported.pricingSnapshots);
    expect(first.imported.products).toBeGreaterThan(0);
    expect(committed.auditLog?.size).toBe(first.imported.auditLogs);
  });

  it('6. rolls back all writes when an intentional failure occurs mid-transaction', async () => {
    const { prisma, committed } = createInMemoryPrismaHarness();

    await expect(
      runJsonToPostgresImport({
        filePath: snapshotPath,
        dryRun: false,
        testArtifactPolicy: 'EXCLUDE',
        prismaClient: prisma,
        beforeTransactionEnd: async () => {
          throw new Error('INTENTIONAL_FAILURE_ROLLBACK_TEST');
        },
      })
    ).rejects.toThrow('INTENTIONAL_FAILURE_ROLLBACK_TEST');

    expect(Object.keys(committed).length).toBe(0);
  });

  it('7. fails closed on missing foreign keys unless explicitly mapped', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-importer-test-'));
    const tmpFile = path.join(tmpDir, 'state.json');
    const state: PlatformState = readSnapshot();

    // Inject an order with an unknown customerId that is not a test artifact
    const baseOrder = state.orders[0]!;
    state.orders.push({
      ...baseOrder,
      id: 'ord-unknown-fk',
      orderNumber: 'MRS-9999',
      customerId: 'cust-nonexistent-999',
      customerEmail: 'real-customer@example.com',
    });
    fs.writeFileSync(tmpFile, JSON.stringify(state));

    const { prisma } = createInMemoryPrismaHarness();
    await expect(
      runJsonToPostgresImport({
        filePath: tmpFile,
        dryRun: false,
        testArtifactPolicy: 'EXCLUDE',
        prismaClient: prisma,
      })
    ).rejects.toThrow('UNRESOLVED_REFERENCES');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
