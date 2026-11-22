import type { PrismaClient } from '@prisma/client';
import { checkDatabaseConnection, getPrismaClient } from './prisma.js';

export type DataBackendMode = 'json' | 'postgres';

export function resolveDataBackendMode(env: NodeJS.ProcessEnv = process.env): DataBackendMode {
  const raw = env.DATA_BACKEND?.trim().toLowerCase();
  if (!raw || raw === 'json') {
    return 'json';
  }
  if (raw === 'postgres') {
    return 'postgres';
  }
  throw new Error(
    `INVALID_DATA_BACKEND: Unsupported DATA_BACKEND="${env.DATA_BACKEND}". Expected "json" or "postgres".`
  );
}

export async function ensurePostgresStartup(databaseUrl?: string): Promise<{
  prisma: PrismaClient;
  version: string;
}> {
  const url = databaseUrl || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'POSTGRES_STARTUP_FAILED: DATA_BACKEND=postgres requires DATABASE_URL to be configured. Refusing to fall back to JSON.'
    );
  }
  const prisma = getPrismaClient(url);
  const check = await checkDatabaseConnection(prisma);
  if (!check.ok) {
    throw new Error(
      `POSTGRES_STARTUP_FAILED: Unable to connect to PostgreSQL (${check.error || 'unknown error'}). Refusing to fall back to JSON.`
    );
  }
  return { prisma, version: check.version || 'PostgreSQL' };
}
