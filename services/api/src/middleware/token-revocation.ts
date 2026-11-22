import crypto from 'node:crypto';

/**
 * Server-side revocation of signed session tokens on logout.
 *
 * Session JWTs are stateless, so clearing the cookie alone leaves a copied token valid until expiry.
 * Logout records a SHA-256 digest of the token (never the token itself) until its own expiry time, and
 * token verification rejects revoked digests.
 *
 * Scope/limitation: the list is held in process memory. It covers the single-instance staging API; after an
 * API restart previously issued tokens remain valid only until their normal expiry (SESSION_TTL_HOURS).
 */
const revoked = new Map<string, number>(); // digest -> expiry epoch ms
const MAX_ENTRIES = 50_000;
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;

function digest(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokenExpiryMs(token: string): number {
  try {
    const body = token.split('.')[1];
    if (!body) return Date.now() + DEFAULT_TTL_MS;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return payload.exp * 1000;
  } catch {
    // fall through to default
  }
  return Date.now() + DEFAULT_TTL_MS;
}

function prune(now = Date.now()): void {
  for (const [key, exp] of revoked) {
    if (exp <= now) revoked.delete(key);
  }
  // Bound memory: drop the soonest-expiring entries first if ever exceeded.
  if (revoked.size > MAX_ENTRIES) {
    const sorted = [...revoked.entries()].sort((a, b) => a[1] - b[1]);
    for (const [key] of sorted.slice(0, revoked.size - MAX_ENTRIES)) revoked.delete(key);
  }
}

export function revokeSessionToken(token: string | null | undefined): void {
  if (!token) return;
  const exp = tokenExpiryMs(token);
  if (exp <= Date.now()) return;
  revoked.set(digest(token), exp);
  prune();
}

export function isSessionTokenRevoked(token: string): boolean {
  const exp = revoked.get(digest(token));
  if (exp === undefined) return false;
  if (exp <= Date.now()) {
    revoked.delete(digest(token));
    return false;
  }
  return true;
}

/** Test helper. */
export function clearRevokedSessionTokensForTests(): void {
  revoked.clear();
}
