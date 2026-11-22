/**
 * Test-only harness: starts a DEDICATED, isolated MRS API process for storefront integration tests.
 *
 * Guarantees (MRS test isolation, 2026-11-22):
 * - Never reuses a pre-existing process: the port is either a fresh free port chosen by the OS or an explicitly
 *   requested port that must be free; an occupied port is an error, never "use whatever is listening".
 * - Isolated data: JSON backend on a throwaway file in a private temp dir; DATABASE_URL is forced to an
 *   unreachable address so no PostgreSQL database (dev, staging or production) can be touched.
 * - Readiness: waits for GET /health = 200 from THIS child (child must still be alive), with a timeout.
 * - Cleanup: stops only the child it spawned (SIGTERM, then SIGKILL) and removes its temp dir.
 * Not imported by any app route; not part of the production bundle.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface IsolatedApi {
  baseUrl: string; // e.g. http://127.0.0.1:53211
  apiBase: string; // baseUrl + /api/v1
  port: number;
  pid: number;
  stop: () => Promise<void>;
}

const HOST = '127.0.0.1';

export function isPortFree(port: number, host = HOST): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, host, () => srv.close(() => resolve(true)));
  });
}

export function findFreePort(host = HOST): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('NO_FREE_PORT'))));
    });
  });
}

function isAlive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

async function waitForExit(child: ChildProcess, ms: number): Promise<boolean> {
  if (!isAlive(child)) return true;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(t);
      resolve(true);
    });
  });
}

export async function startIsolatedApi(options: { port?: number; timeoutMs?: number } = {}): Promise<IsolatedApi> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const apiDir = path.join(repoRoot, 'services/api');
  const entry = path.join(apiDir, 'src/index.ts');
  if (!fs.existsSync(entry)) throw new Error(`ISOLATED_API_ENTRY_MISSING: ${entry}`);

  let port: number;
  if (options.port !== undefined) {
    if (!(await isPortFree(options.port))) {
      throw new Error(`PORT_IN_USE: port ${options.port} is already in use; refusing to reuse an existing process.`);
    }
    port = options.port;
  } else {
    port = await findFreePort();
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-storefront-isolated-api-'));
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'test',
    API_HOST: HOST,
    API_PORT: String(port),
    DATA_BACKEND: 'json',
    MRS_DATA_FILE_PATH: path.join(tmpDir, 'platform-state.json'),
    // Explicitly unreachable: dotenv never overrides set variables, so the project .env cannot leak a real DB.
    DATABASE_URL: 'postgresql://isolated-test@127.0.0.1:1/isolated_test_no_db',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    CORS_ORIGIN: 'http://127.0.0.1:3999',
    SHOPIFY_LIVE_WRITES_ENABLED: 'false',
    RAZORPAY_MODE: 'test',
    RAZORPAY_KEY_ID: '',
    RAZORPAY_KEY_SECRET: '',
    RAZORPAY_WEBHOOK_SECRET: '',
    SHOPIFY_ADMIN_ACCESS_TOKEN: '',
    SHIPROCKET_EMAIL: '',
    SHIPROCKET_PASSWORD: '',
    RESEND_API_KEY: '',
  };

  // Single process (tsx loaded in-process), so stopping this PID stops the whole server.
  const child = spawn(process.execPath, ['--import', 'tsx', entry], {
    cwd: apiDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (d) => (output = (output + String(d)).slice(-4000)));
  child.stderr?.on('data', (d) => (output = (output + String(d)).slice(-4000)));

  const stop = async () => {
    if (isAlive(child)) {
      child.kill('SIGTERM');
      if (!(await waitForExit(child, 5000))) {
        child.kill('SIGKILL');
        await waitForExit(child, 5000);
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  const baseUrl = `http://${HOST}:${port}`;
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    if (!isAlive(child)) {
      await stop();
      throw new Error(`ISOLATED_API_EXITED (code ${child.exitCode}): ${output.slice(-800)}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.status === 200) {
        const body = (await res.json()) as { backend?: string };
        if (body.backend !== 'json') {
          await stop();
          throw new Error(`ISOLATED_API_WRONG_BACKEND: ${body.backend}`);
        }
        return { baseUrl, apiBase: `${baseUrl}/api/v1`, port, pid: child.pid!, stop };
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('ISOLATED_API_WRONG_BACKEND')) throw err;
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  await stop();
  throw new Error(`ISOLATED_API_NOT_READY within timeout: ${output.slice(-800)}`);
}
