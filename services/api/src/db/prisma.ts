import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;
let prismaUrl: string | undefined;

export function getPrismaClient(databaseUrl?: string): PrismaClient {
  const effectiveUrl = databaseUrl || process.env.DATABASE_URL;
  if (prismaInstance && (!databaseUrl || databaseUrl === prismaUrl)) {
    return prismaInstance;
  }
  if (prismaInstance && databaseUrl && databaseUrl !== prismaUrl) {
    // Explicit override (e.g., isolated test DB URL) creates a client only when URL actually differs
    return new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  prismaUrl = effectiveUrl;
  prismaInstance = new PrismaClient({
    datasources: effectiveUrl ? { db: { url: effectiveUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    prismaUrl = undefined;
  }
}

export async function checkDatabaseConnection(client: PrismaClient = getPrismaClient()): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = await client.$queryRawUnsafe<Array<{ version: string }>>('SELECT version();');
    return { ok: true, version: result[0]?.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
