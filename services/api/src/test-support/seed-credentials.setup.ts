/**
 * Vitest setup (runs before each test file is imported):
 * 1. Gives the seeded test accounts RANDOM per-run passwords via the same MRS_SEED_* variables the application
 *    reads (always overwritten, so a real password exported in a shell can never be used by tests).
 * 2. Points the default JSON data store at a fresh temporary file, so tests never read or write the developer's
 *    live services/api/.data/platform-state.json (and never depend on its stored password hashes).
 * No password is stored in source.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SEED_ADMIN_PASSWORD_ENV, SEED_CUSTOMER_PASSWORD_ENV } from '../config/seed-credentials.js';

const random = () => `T-${crypto.randomBytes(18).toString('base64url')}`;
for (const name of [...Object.values(SEED_ADMIN_PASSWORD_ENV), SEED_CUSTOMER_PASSWORD_ENV]) {
  process.env[name] = random();
}

const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-api-test-state-'));
process.env.MRS_DATA_FILE_PATH = path.join(isolatedDir, 'platform-state.json');
