import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Cookie-based sessions + CSRF protection.
 *
 * - Session JWTs are issued in HttpOnly cookies so page scripts (XSS) can never read them.
 * - Cookie-authenticated unsafe requests must carry an `x-csrf-token` header equal to
 *   HMAC(JWT secret, "csrf|" + session token). The value is bound to the session, so a
 *   sibling-subdomain cookie-tossing attacker cannot forge it, and it is handed to the SPA
 *   in login / "me" JSON responses (never stored in a script-readable cookie).
 * - Unsafe requests that carry cookie credentials must also come from an allow-listed Origin.
 * - Requests authenticated with an explicit `Authorization: Bearer` header are not CSRF-prone
 *   (no ambient credentials) and keep working for API clients.
 */

export const ADMIN_SESSION_COOKIE = 'mrs_admin_session';
export const CUSTOMER_SESSION_COOKIE = 'mrs_customer_session';
export const CSRF_HEADER = 'x-csrf-token';

export type SessionKind = 'admin' | 'customer';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Unauthenticated entry points: Origin is validated, but no session-bound CSRF token can exist yet. */
const CSRF_TOKEN_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/customer/login',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/verification/resend',
]);

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      // ignore malformed cookie values
    }
  }
  return out;
}

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.CORS_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter((entry) => entry && entry !== '*');
  if (configured.length > 0) return configured;
  return env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
}

export function cookiesAreSecure(env: NodeJS.ProcessEnv = process.env, req?: Request): boolean {
  const isLocalHttpTunnel =
    Boolean(req) &&
    (req!.hostname === 'localhost' || req!.hostname === '127.0.0.1') &&
    !req!.secure &&
    String(req!.headers?.['x-forwarded-proto'] || '').toLowerCase() !== 'https';
  if (isLocalHttpTunnel && env.COOKIE_SECURE !== 'force') {
    return false;
  }
  return env.NODE_ENV === 'production' || env.COOKIE_SECURE === 'true';
}

function sameSiteFor(kind: SessionKind, env: NodeJS.ProcessEnv): 'Strict' | 'Lax' | 'None' {
  const override = (env.COOKIE_SAMESITE || '').toLowerCase();
  if (override === 'none' && cookiesAreSecure(env)) return 'None';
  if (override === 'lax') return 'Lax';
  if (override === 'strict') return 'Strict';
  return kind === 'admin' ? 'Strict' : 'Lax';
}

function cookieName(kind: SessionKind): string {
  return kind === 'admin' ? ADMIN_SESSION_COOKIE : CUSTOMER_SESSION_COOKIE;
}

function jwtExpiryEpochSeconds(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds: number; sameSite: 'Strict' | 'Lax' | 'None'; secure: boolean }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${options.sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res: Response, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

export function issueSessionCookie(res: Response, kind: SessionKind, token: string, env: NodeJS.ProcessEnv = process.env): void {
  const exp = jwtExpiryEpochSeconds(token);
  const maxAgeSeconds = exp ? exp - Math.floor(Date.now() / 1000) : 3600;
  appendSetCookie(
    res,
    serializeCookie(cookieName(kind), token, {
      maxAgeSeconds,
      sameSite: sameSiteFor(kind, env),
      secure: cookiesAreSecure(env, res.req),
    })
  );
}

export function clearSessionCookie(res: Response, kind: SessionKind, env: NodeJS.ProcessEnv = process.env): void {
  appendSetCookie(
    res,
    serializeCookie(cookieName(kind), '', { maxAgeSeconds: 0, sameSite: sameSiteFor(kind, env), secure: cookiesAreSecure(env, res.req) })
  );
}

export function deriveCsrfToken(sessionToken: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`csrf|${sessionToken}`).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Resolves the credential for a request: explicit Bearer first, then the HttpOnly session cookie. */
export function resolveSessionToken(req: Request, kind: SessionKind): { token: string; via: 'bearer' | 'cookie' } | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    return token ? { token, via: 'bearer' } : null;
  }
  const cookie = parseCookies(req.headers.cookie)[cookieName(kind)];
  return cookie ? { token: cookie, via: 'cookie' } : null;
}

function requestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) return origin.replace(/\/$/, '');
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function createCsrfProtection(getSecret: () => string, getOrigins: () => string[] = () => getAllowedOrigins()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next();
    // Explicit Bearer credentials are not ambient, so they are not CSRF-prone.
    if (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) return next();

    const cookies = parseCookies(req.headers.cookie);
    const sessionTokens = [cookies[ADMIN_SESSION_COOKIE], cookies[CUSTOMER_SESSION_COOKIE]].filter(
      (value): value is string => Boolean(value)
    );
    const path = (req.originalUrl || req.url || '').split('?')[0] || '';
    const tokenExempt = CSRF_TOKEN_EXEMPT_PATHS.has(path);
    const origin = requestOrigin(req);

    if (tokenExempt) {
      // Unauthenticated entry points: reject only an explicitly foreign Origin.
      if (origin && !getOrigins().includes(origin)) {
        res.status(403).json({ error: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed.' });
        return;
      }
      return next();
    }

    if (sessionTokens.length === 0) return next();

    if (!origin || !getOrigins().includes(origin)) {
      res.status(403).json({ error: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed.' });
      return;
    }
    const supplied = req.headers[CSRF_HEADER];
    const secret = getSecret();
    const valid =
      typeof supplied === 'string' &&
      supplied.length > 0 &&
      sessionTokens.some((token) => constantTimeEqual(supplied, deriveCsrfToken(token, secret)));
    if (!valid) {
      res.status(403).json({ error: 'CSRF_TOKEN_INVALID', message: 'A valid CSRF token is required for this request.' });
      return;
    }
    next();
  };
}
