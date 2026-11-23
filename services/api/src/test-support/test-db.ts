import type { PrismaClient } from '@prisma/client';

export const DEFAULT_TEST_DB_URL =
  'postgresql://macbook@localhost:5432/mangal_royal_studio_test?schema=public';

function isAllowedTestDbName(dbName: string): boolean {
  return (
    Boolean(dbName) &&
    dbName !== 'mangal_royal_studio_dev' &&
    dbName !== 'mangal_royal_studio_staging' &&
    !dbName.includes('prod') &&
    dbName.endsWith('_test')
  );
}

export function resolveIsolatedTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_TEST_DB_URL;
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!isAllowedTestDbName(dbName)) {
    throw new Error(
      `REFUSING_NON_TEST_DATABASE: Refusing to run PostgreSQL tests against "${dbName}". Must target an isolated *_test database.`
    );
  }
  return url;
}

export async function assertIsolatedTestDatabase(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
  const dbName = rows[0]?.db ?? '';
  if (!isAllowedTestDbName(dbName)) {
    throw new Error(
      `REFUSING_NON_TEST_DATABASE: current_database() is "${dbName}". Expected an isolated *_test database.`
    );
  }
  return dbName;
}
