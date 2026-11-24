import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, disconnectPrisma, checkDatabaseConnection } from './prisma.js';
import { PostgresPricingRepository } from './repositories/pricing-repository.js';
import { assertIsolatedTestDatabase, resolveIsolatedTestDatabaseUrl } from '../test-support/test-db.js';

const SHAPE = 'REPUBLISH_TEST';

/**
 * Regression: re-publishing the owner rate card used to throw OVERLAPPING_DIAMOND_SLAB on Postgres
 * (the previous identical slab was still active) AFTER the metal rates had been saved, so no approved
 * PricingRule was ever created and every product fell back to "Price on request".
 */
describe('Postgres diamond rate re-publish is idempotent', () => {
  let available = false;
  let prisma: ReturnType<typeof getPrismaClient>;
  let repo: PostgresPricingRepository;

  beforeAll(async () => {
    prisma = getPrismaClient(resolveIsolatedTestDatabaseUrl());
    available = (await checkDatabaseConnection(prisma)).ok;
    if (available) {
      await assertIsolatedTestDatabase(prisma);
      repo = new PostgresPricingRepository(prisma);
    }
  });

  afterAll(async () => {
    if (available) {
      await prisma.diamondRate.deleteMany({ where: { shape: SHAPE } });
      await disconnectPrisma();
    }
  });

  const slab = (rate: string) => ({
    shape: SHAPE,
    caratMin: '0.0001',
    caratMax: '0.9999',
    colorGrade: 'ANY',
    clarityGrade: 'ANY',
    ratePerCaratInr: rate,
    createdBy: 'test@example.com',
    actorRole: 'OWNER',
  });

  it('supersedes the previous identical slab instead of rejecting it', async () => {
    if (!available) {
      console.warn('Skipping: PostgreSQL not reachable');
      return;
    }
    await repo.recordDiamondRate(slab('30000'));
    await expect(repo.recordDiamondRate(slab('31000'))).resolves.toBeDefined();

    const active = await prisma.diamondRate.findMany({ where: { shape: SHAPE, isActive: true } });
    expect(active).toHaveLength(1);
    expect(Number(active[0]!.rateInr)).toBe(31000);
  });

  it('still rejects a genuinely partial overlap', async () => {
    if (!available) return;
    await expect(
      repo.recordDiamondRate({ ...slab('32000'), caratMin: '0.5000', caratMax: '0.8000' })
    ).rejects.toThrow(/OVERLAPPING_DIAMOND_SLAB/);
  });
});
