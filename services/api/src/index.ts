import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });
dotenv.config();

const { validateProductionConfigOnStartup } = await import('./middleware/auth.js');
validateProductionConfigOnStartup();

const { assertRazorpayTestMode } = await import('./services/razorpay-service.js');
assertRazorpayTestMode();

const { resolveDataBackendMode, ensurePostgresStartup } = await import('./db/backend.js');
const { disconnectPrisma } = await import('./db/prisma.js');
const { createApp } = await import('./app.js');

const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '0.0.0.0';

const mode = resolveDataBackendMode();
let app: ReturnType<typeof createApp>;

if (mode === 'postgres') {
  try {
    const { prisma, version } = await ensurePostgresStartup();
    console.log(`[Mangal Royal Studio API] PostgreSQL backend connected (${version.split(' on ')[0]})`);
    app = createApp({ backend: 'postgres', prisma });
  } catch (err) {
    console.error(
      `[Mangal Royal Studio API] FATAL: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
} else {
  app = createApp();
}

const server = app.listen(PORT, HOST, () => {
  console.log(
    `[Mangal Royal Studio API] Listening on http://localhost:${PORT} (backend=${mode}, Shopify API ${process.env.SHOPIFY_API_VERSION || process.env.SHOPIFY_ADMIN_API_VERSION || '2025-01'})`
  );
});

let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Mangal Royal Studio API] Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  setTimeout(async () => {
    await disconnectPrisma();
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
