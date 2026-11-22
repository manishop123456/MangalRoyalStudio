import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  optionalSeedPassword,
  requireSeedAdminPassword,
  SEED_ADMIN_PASSWORD_ENV,
  SeedCredentialError,
} from './config/seed-credentials.js';
import { getJwtSecret } from './middleware/auth.js';
import { DataStore, verifyPassword } from './store/data-store.js';
import { seedDevAuthAndSettings } from './db/seed-dev-auth.js';

/** Credential hygiene regressions (2026-11-22): no hard-coded or fallback credentials anywhere in source. */

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('Seed credentials come only from the environment', () => {
  it.each([
    ['missing', undefined],
    ['too short', 'Short-1'],
    ['placeholder', 'replace_me_owner_password_please'],
  ])('requireSeedAdminPassword rejects %s values without echoing them', (_l, value) => {
    const env: NodeJS.ProcessEnv = {};
    if (value !== undefined) env[SEED_ADMIN_PASSWORD_ENV.OWNER] = value;
    let err: unknown;
    try {
      requireSeedAdminPassword('OWNER', env);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SeedCredentialError);
    expect((err as Error).message).toContain('MRS_SEED_OWNER_PASSWORD');
    if (value) expect((err as Error).message).not.toContain(value);
  });

  it('accepts a strong configured value', () => {
    const env = { [SEED_ADMIN_PASSWORD_ENV.OWNER]: 'A-strong-local-value-123' };
    expect(requireSeedAdminPassword('OWNER', env)).toBe('A-strong-local-value-123');
    expect(optionalSeedPassword('MRS_SEED_OWNER_PASSWORD', {})).toBeNull();
  });

  it('the PostgreSQL seed script stops before any database access when a password is missing', async () => {
    delete process.env.MRS_SEED_MANAGER_PASSWORD;
    // An unreachable URL: if the script tried to connect before validating, the error would differ.
    await expect(seedDevAuthAndSettings('postgresql://nobody@127.0.0.1:1/never')).rejects.toThrow(
      /SEED_CREDENTIALS_MISSING: set MRS_SEED_MANAGER_PASSWORD/
    );
  });

  it('JSON default state without seed variables locks the seeded admins (random, unknown passwords)', () => {
    for (const name of Object.values(SEED_ADMIN_PASSWORD_ENV)) delete process.env[name];
    const mk = () =>
      new DataStore({
        filePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-cred-')), 'state.json'),
        testMode: true,
        enforceLock: false,
      });
    const a = mk().getState().users.find((u) => u.role === 'OWNER')!;
    const b = mk().getState().users.find((u) => u.role === 'OWNER')!;
    expect(a.passwordHash).not.toBe(b.passwordHash);
    for (const guess of ['', 'password', 'MRS_SEED_OWNER_PASSWORD', 'owner@mangalroyalstudio.com']) {
      expect(verifyPassword(guess, a.passwordHash)).toBe(false);
    }
  });

  it('JSON default state uses the configured seed password when provided', () => {
    process.env.MRS_SEED_OWNER_PASSWORD = 'Configured-owner-value-456';
    const store = new DataStore({
      filePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-cred-')), 'state.json'),
      testMode: true,
      enforceLock: false,
    });
    const owner = store.getState().users.find((u) => u.role === 'OWNER')!;
    expect(verifyPassword('Configured-owner-value-456', owner.passwordHash)).toBe(true);
  });
});

describe('No credential fallbacks', () => {
  it('non-production JWT fallback is a random per-process secret, never a source constant', () => {
    const s1 = getJwtSecret({ NODE_ENV: 'development' });
    const s2 = getJwtSecret({ NODE_ENV: 'development', JWT_SECRET: 'replace_me_placeholder' });
    expect(s1).toMatch(/^[0-9a-f]{96}$/);
    expect(s2).toBe(s1);
    const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'middleware/auth.ts'), 'utf8');
    expect(source).toMatch(/NON_PROD_FALLBACK_JWT_SECRET = crypto\.randomBytes\(/);
  });

  it('production still refuses to start without a strong JWT_SECRET', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });
});

describe('Source contains no hard-coded passwords', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const roots = ['services/api/src', 'apps/admin/src', 'apps/storefront/src', 'packages/shared/src'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'dist', '.next', 'test-support'].includes(e.name)) walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  for (const r of roots) walk(path.join(repoRoot, r));

  it('production source has no hashPassword("literal") or password: "literal" values', () => {
    expect(files.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (/hashPassword\(\s*['"`][^'"`]+['"`]\s*\)/.test(text) || /\bpassword\s*:\s*['"`][^'"`\s]{6,}['"`]/.test(text)) {
        offenders.push(path.relative(repoRoot, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
