import crypto from 'node:crypto';

/**
 * Seed credentials come ONLY from environment variables (never from source code).
 *
 * - Explicit seeding (`seed-dev-auth.ts`) REQUIRES all admin variables and stops before any database write
 *   if one is missing, too short or a placeholder.
 * - The JSON store's first-run default state uses them when present; otherwise the seeded accounts get an
 *   unusable random password (they cannot sign in until a password is set). There is no fallback password.
 */
export type SeedAdminRole = 'OWNER' | 'MANAGER' | 'PRICING_OPERATOR';

export const SEED_ADMIN_PASSWORD_ENV: Record<SeedAdminRole, string> = {
  OWNER: 'MRS_SEED_OWNER_PASSWORD',
  MANAGER: 'MRS_SEED_MANAGER_PASSWORD',
  PRICING_OPERATOR: 'MRS_SEED_PRICING_PASSWORD',
};

/** Shared password for the demo customer accounts in the JSON default state (optional). */
export const SEED_CUSTOMER_PASSWORD_ENV = 'MRS_SEED_CUSTOMER_PASSWORD';

export const MIN_SEED_PASSWORD_LENGTH = 14;

export class SeedCredentialError extends Error {
  readonly code = 'SEED_CREDENTIALS_MISSING';
}

function isUsableSecret(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  if (v.length < MIN_SEED_PASSWORD_LENGTH) return false;
  return !/replace[_-]?me|change[_-]?me|placeholder|example|^password|your[_-]/i.test(v);
}

function read(name: string, env: NodeJS.ProcessEnv): string | null {
  const v = env[name]?.trim();
  return isUsableSecret(v) ? v : null;
}

/** Required seed password; throws (never falls back) when absent or weak. The value is never logged. */
export function requireSeedAdminPassword(role: SeedAdminRole, env: NodeJS.ProcessEnv = process.env): string {
  const name = SEED_ADMIN_PASSWORD_ENV[role];
  const v = read(name, env);
  if (!v) {
    throw new SeedCredentialError(
      `SEED_CREDENTIALS_MISSING: set ${name} (at least ${MIN_SEED_PASSWORD_LENGTH} characters, not a placeholder) before seeding.`
    );
  }
  return v;
}

/** Optional seed password: the configured value, or null when absent/weak (caller must then lock the account). */
export function optionalSeedPassword(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  return read(name, env);
}

/** A random, never-stored password: hashing it yields an account nobody can sign in to. */
export function unusableRandomPassword(): string {
  return crypto.randomBytes(48).toString('base64url');
}
