import type { Request, Response, NextFunction } from 'express';
import { isSessionTokenRevoked } from './token-revocation.js';
import crypto from 'node:crypto';
import net from 'node:net';
import { ROLE_PERMISSIONS, type AdminRoleName, type PermissionCode } from '@mrs/shared';
import { dbStore } from '../store/data-store.js';
import { resolveSessionToken } from './session.js';

export type RoleName = AdminRoleName;
export type Permission = PermissionCode;

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: RoleName;
  permissions: Permission[];
}

export interface AuthenticatedCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthLookupProvider {
  findAdminByIdAndEmail(
    id: string,
    email: string
  ): Promise<{ id: string; email: string; role: RoleName; isActive: boolean } | null>;
  findCustomerByIdAndEmail(
    id: string,
    email: string
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive?: boolean;
    emailVerified?: boolean;
    passwordHash?: string;
  } | null>;
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthenticatedAdmin;
      customerUser?: AuthenticatedCustomer;
      sessionToken?: string;
      sessionVia?: 'bearer' | 'cookie';
    }
  }
}

const PLACEHOLDER_JWT_SECRETS = new Set([
  'replace_with_32_byte_random_hex_secret_for_admin_jwt',
  'changeme',
  'secret',
]);

// Non-production only: when JWT_SECRET is missing or a placeholder, use a random per-process secret (never a
// value stored in source). Sessions then end when the process restarts; production always requires JWT_SECRET.
const NON_PROD_FALLBACK_JWT_SECRET = crypto.randomBytes(48).toString('hex');

function isPlaceholderSecretValue(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    PLACEHOLDER_JWT_SECRETS.has(trimmed) ||
    lower.startsWith('replace_me') ||
    lower.startsWith('replace_with_') ||
    lower === 'your_secret_here' ||
    lower === 'changeme' ||
    lower === 'secret'
  );
}

function isConfiguredSecret(value: string | undefined, minLength = 8): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length >= minLength && !isPlaceholderSecretValue(trimmed);
}

function isProductionSecret(value: string | undefined, minLength = 32): boolean {
  if (!isConfiguredSecret(value, minLength)) return false;
  const normalized = value!.trim().toLowerCase();
  if (normalized.includes('test-only') || normalized.includes('development') || normalized.includes('example')) return false;
  return new Set(normalized).size >= 8;
}

function isValidHttpOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function isValidPublicStorefrontUrl(rawUrl: string | undefined, requireHttps: boolean): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('example.com')) return false;
  try {
    const parsed = new URL(trimmed);
    if (requireHttps) {
      return parsed.protocol === 'https:';
    }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isConfiguredEmailFrom(rawFrom: string | undefined): boolean {
  if (!rawFrom) return false;
  const trimmed = rawFrom.trim();
  if (!trimmed || trimmed.toLowerCase().endsWith('@example.com')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function findExposedNextPublicVariables(env: NodeJS.ProcessEnv): string[] {
  const sensitiveKeyPattern = /(SECRET|PRIVATE|PASSWORD|TOKEN|WEBHOOK|API_KEY)/i;
  const serverSecretValues = [
    env.JWT_SECRET,
    env.RAZORPAY_KEY_SECRET,
    env.RAZORPAY_WEBHOOK_SECRET,
    env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    env.SHOPIFY_API_SECRET,
    env.SHOPIFY_WEBHOOK_SECRET,
    env.RESEND_API_KEY,
    env.SHIPROCKET_PASSWORD,
    env.SHIPROCKET_WEBHOOK_SECRET,
  ]
    .map((val) => val?.trim())
    .filter((val): val is string => Boolean(val && !isPlaceholderSecretValue(val)));

  const exposed: string[] = [];
  for (const [key, rawValue] of Object.entries(env)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    const value = rawValue?.trim() || '';
    if (sensitiveKeyPattern.test(key)) {
      exposed.push(key);
      continue;
    }
    if (value && serverSecretValues.includes(value)) {
      exposed.push(key);
    }
  }
  return exposed;
}

export interface OperationalReadinessStatus {
  environment: string;
  persistenceMode: 'JSON_SINGLE_WRITER';
  jwtConfigured: boolean;
  corsConfigured: boolean;
  razorpayConfigured: boolean;
  razorpayWebhookConfigured: boolean;
  emailVerificationConfigured: boolean;
  shopifyWebhookConfigured: boolean;
  trustedProxyConfigured: boolean;
  productionReady: boolean;
}

export function getOperationalReadiness(
  env: NodeJS.ProcessEnv = process.env
): OperationalReadinessStatus {
  const jwtSecret = env.JWT_SECRET?.trim();
  const jwtConfigured = env.NODE_ENV === 'production'
    ? isProductionSecret(jwtSecret, 32)
    : Boolean(jwtSecret && !isPlaceholderSecretValue(jwtSecret) && jwtSecret.length >= 32);

  const corsOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const corsConfigured =
    corsOrigins.length > 0 &&
    !corsOrigins.includes('*') &&
    corsOrigins.every((origin) => isValidHttpOrigin(origin));

  const isProduction = env.NODE_ENV === 'production';
  const razorpayKeyIdConfigured = isProduction
    ? /^rzp_live_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID?.trim() || '')
    : isConfiguredSecret(env.RAZORPAY_KEY_ID, 6);
  const razorpayKeySecretConfigured = isProduction
    ? isProductionSecret(env.RAZORPAY_KEY_SECRET, 16)
    : isConfiguredSecret(env.RAZORPAY_KEY_SECRET, 8);
  const razorpayConfigured = razorpayKeyIdConfigured && razorpayKeySecretConfigured;
  const razorpayWebhookConfigured = isProduction
    ? isProductionSecret(env.RAZORPAY_WEBHOOK_SECRET, 32)
    : isConfiguredSecret(env.RAZORPAY_WEBHOOK_SECRET, 8);
  const emailVerificationConfigured =
    (isProduction ? isProductionSecret(env.RESEND_API_KEY, 16) : isConfiguredSecret(env.RESEND_API_KEY, 8)) &&
    isConfiguredEmailFrom(env.EMAIL_FROM) &&
    isValidPublicStorefrontUrl(env.STOREFRONT_PUBLIC_URL, env.NODE_ENV === 'production');
  const shopifyWebhookConfigured = isProduction
    ? isProductionSecret(env.SHOPIFY_WEBHOOK_SECRET, 24)
    : isConfiguredSecret(env.SHOPIFY_WEBHOOK_SECRET, 8);
  let trustedProxyConfigured = false;
  try {
    trustedProxyConfigured = parseTrustedProxyCidrs(env.TRUSTED_PROXY_CIDRS).length > 0;
  } catch {
    trustedProxyConfigured = false;
  }
  const exposedNextPublic = findExposedNextPublicVariables(env);

  const productionReady =
    jwtConfigured &&
    corsConfigured &&
    razorpayConfigured &&
    razorpayWebhookConfigured &&
    emailVerificationConfigured &&
    shopifyWebhookConfigured &&
    exposedNextPublic.length === 0;

  return {
    environment: env.NODE_ENV || 'development',
    persistenceMode: 'JSON_SINGLE_WRITER',
    jwtConfigured,
    corsConfigured,
    razorpayConfigured,
    razorpayWebhookConfigured,
    emailVerificationConfigured,
    shopifyWebhookConfigured,
    trustedProxyConfigured,
    productionReady,
  };
}

export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.JWT_SECRET?.trim();
  const isProd = env.NODE_ENV === 'production';

  if (isProd) {
    if (!isProductionSecret(configured, 32)) {
      throw new Error(
        'CRITICAL SECURITY ERROR: A strong JWT_SECRET (>= 32 characters) must be configured in production.'
      );
    }
    return configured!;
  }

  if (configured && !isPlaceholderSecretValue(configured)) {
    return configured;
  }

  return NON_PROD_FALLBACK_JWT_SECRET;
}

export function validateProductionConfigOnStartup(env: NodeJS.ProcessEnv = process.env): void {
  getJwtSecret(env);
  parseTrustedProxyCidrs(env.TRUSTED_PROXY_CIDRS);

  const exposedNextPublic = findExposedNextPublicVariables(env);
  if (exposedNextPublic.length > 0) {
    throw new Error(
      `CRITICAL SECURITY ERROR: Secret or sensitive variable detected in client-exposed NEXT_PUBLIC_* environment (${exposedNextPublic.join(', ')}).`
    );
  }

  if (env.NODE_ENV !== 'production') {
    return;
  }

  const missingOrInvalid: string[] = [];
  const readiness = getOperationalReadiness(env);
  const catalogueEnquiryMode = env.CATALOGUE_ENQUIRY_MODE === 'true';

  if (!readiness.corsConfigured) {
    missingOrInvalid.push('CORS_ORIGIN (must specify explicit http/https origins, never "*")');
  }
  if (catalogueEnquiryMode) {
    if (!isValidPublicStorefrontUrl(env.STOREFRONT_PUBLIC_URL, true)) {
      missingOrInvalid.push('STOREFRONT_PUBLIC_URL (must be https:// in production)');
    }
  } else {
    if (!readiness.razorpayConfigured) {
      missingOrInvalid.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
    }
    if (!readiness.razorpayWebhookConfigured) {
      missingOrInvalid.push('RAZORPAY_WEBHOOK_SECRET');
    }
    if (!readiness.shopifyWebhookConfigured) {
      missingOrInvalid.push('SHOPIFY_WEBHOOK_SECRET');
    }
    if (!readiness.emailVerificationConfigured) {
      missingOrInvalid.push(
        'RESEND_API_KEY / EMAIL_FROM / STOREFRONT_PUBLIC_URL (must be https:// in production)'
      );
    }
  }

  if (missingOrInvalid.length > 0) {
    throw new Error(
      `CRITICAL PRODUCTION CONFIG ERROR: Missing or invalid required production configuration: ${missingOrInvalid.join('; ')}.`
    );
  }
}

export function validateAuthSecretsOnStartup(env: NodeJS.ProcessEnv = process.env): void {
  validateProductionConfigOnStartup(env);
}

export function isKnownRole(role: unknown): role is RoleName {
  return (
    typeof role === 'string' &&
    Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role) &&
    Array.isArray(ROLE_PERMISSIONS[role as RoleName])
  );
}

export function signAdminToken(payload: AuthenticatedAdmin): string {
  if (!isKnownRole(payload.role)) {
    throw new Error(`Cannot sign token for unknown admin role: ${String(payload.role)}`);
  }
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlHours = Number(process.env.SESSION_TTL_HOURS || 24);
  const expSec = nowSec + (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) * 3600;
  const body = Buffer.from(
    JSON.stringify({
      id: payload.id,
      email: payload.email,
      role: payload.role,
      purpose: 'ADMIN',
      iat: nowSec,
      exp: expSec,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyAdminToken(token: string): AuthenticatedAdmin | null {
  try {
    if (!token || typeof token !== 'string') return null;
    if (isSessionTokenRevoked(token)) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    if (!headerB64 || !bodyB64 || !sig) return null;

    // 1. Validate JWT header algorithm explicitly
    const headerRaw = Buffer.from(headerB64, 'base64url').toString('utf8');
    const headerObj = JSON.parse(headerRaw) as { alg?: unknown; typ?: unknown };
    if (headerObj.alg !== 'HS256' || (headerObj.typ && headerObj.typ !== 'JWT')) {
      return null;
    }

    // 2. Verify HMAC-SHA256 signature in constant time
    const secret = getJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    // 3. Validate required claims & mandatory expiration
    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      id?: unknown;
      email?: unknown;
      role?: unknown;
      purpose?: unknown;
      exp?: unknown;
    };

    // Reject customer or order-access tokens even if signed with the same secret
    if (decoded.purpose !== 'ADMIN') {
      return null;
    }

    if (
      typeof decoded.id !== 'string' ||
      !decoded.id.trim() ||
      typeof decoded.email !== 'string' ||
      !decoded.email.trim() ||
      !isKnownRole(decoded.role) ||
      typeof decoded.exp !== 'number' ||
      !Number.isFinite(decoded.exp)
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp <= nowSec) {
      return null;
    }

    // 4. Authoritative server-side user lookup & status/role verification
    const serverUser = dbStore
      .getState()
      .users.find(
        (u) => u.id === decoded.id && u.email.toLowerCase() === decoded.email!.toString().toLowerCase()
      );

    if (!serverUser || serverUser.isActive !== true) {
      return null;
    }

    if (!isKnownRole(serverUser.role) || serverUser.role !== decoded.role) {
      return null;
    }

    const authoritativePermissions = ROLE_PERMISSIONS[serverUser.role];
    if (!Array.isArray(authoritativePermissions) || authoritativePermissions.length === 0) {
      return null;
    }

    return {
      id: serverUser.id,
      email: serverUser.email,
      role: serverUser.role,
      permissions: [...authoritativePermissions],
    };
  } catch {
    return null;
  }
}

export async function verifyAdminTokenWithLookup(
  token: string,
  lookup?: AuthLookupProvider
): Promise<AuthenticatedAdmin | null> {
  if (!token || isSessionTokenRevoked(token)) return null;
  if (!lookup) {
    return verifyAdminToken(token);
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    if (!headerB64 || !bodyB64 || !sig) return null;

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const expectedSig = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      id?: unknown;
      email?: unknown;
      role?: unknown;
      purpose?: unknown;
      exp?: unknown;
    };
    if (decoded.purpose !== 'ADMIN') return null;
    if (
      typeof decoded.id !== 'string' ||
      !decoded.id.trim() ||
      typeof decoded.email !== 'string' ||
      !decoded.email.trim() ||
      !isKnownRole(decoded.role) ||
      typeof decoded.exp !== 'number' ||
      !Number.isFinite(decoded.exp)
    ) {
      return null;
    }
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;

    const serverUser = await lookup.findAdminByIdAndEmail(decoded.id, decoded.email);
    if (!serverUser || serverUser.isActive !== true) return null;
    if (!isKnownRole(serverUser.role) || serverUser.role !== decoded.role) return null;

    const authoritativePermissions = ROLE_PERMISSIONS[serverUser.role];
    if (!Array.isArray(authoritativePermissions) || authoritativePermissions.length === 0) {
      return null;
    }

    return {
      id: serverUser.id,
      email: serverUser.email,
      role: serverUser.role,
      permissions: [...authoritativePermissions],
    };
  } catch {
    return null;
  }
}

/**
 * Middleware: Authenticate Admin User via signed JWT Bearer token ONLY.
 * Client-supplied role/email headers, query parameters, or body fields are never trusted.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const resolved = resolveSessionToken(req, 'admin');
  if (!resolved) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Valid authentication is required.',
    });
    return;
  }

  const lookup = req.app?.locals?.authLookup as AuthLookupProvider | undefined;
  Promise.resolve(verifyAdminTokenWithLookup(resolved.token, lookup))
    .then((verified) => {
      if (!verified) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid, expired, or revoked authentication token.',
        });
        return;
      }

      req.adminUser = verified;
      req.sessionToken = resolved.token;
      req.sessionVia = resolved.via;
      next();
    })
    .catch(next);
}

/**
 * Middleware: Enforce Role-Based Access Control (RBAC) for specific permissions.
 * Denies access by default when role or permission definitions are missing or unknown.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }

    const role = req.adminUser.role;
    if (!permission || typeof permission !== 'string' || !isKnownRole(role)) {
      res.status(403).json({
        error: 'FORBIDDEN_INSUFFICIENT_ROLE',
        message: 'Access denied: unknown role or permission configuration.',
      });
      return;
    }

    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!Array.isArray(rolePermissions) || !rolePermissions.includes(permission)) {
      res.status(403).json({
        error: 'FORBIDDEN_INSUFFICIENT_ROLE',
        message: `Role '${role}' does not have required permission '${permission}'.`,
        requiredPermission: permission,
        currentRole: role,
      });
      return;
    }

    next();
  };
}

/**
 * Strict Owner-only gate for Pricing Run Approval & Publishing
 */
export function requireOwnerRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.adminUser) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    return;
  }

  if (req.adminUser.role !== 'OWNER' || !isKnownRole(req.adminUser.role)) {
    res.status(403).json({
      error: 'OWNER_APPROVAL_REQUIRED',
      message: 'Only an OWNER can approve or publish mass jewellery pricing changes to Shopify.',
      currentRole: req.adminUser.role,
    });
    return;
  }

  next();
}

/**
 * Issue a signed HS256 Customer JWT with explicit purpose: 'CUSTOMER'.
 * Customer tokens cannot authenticate as Admin users.
 */
export function signCustomerToken(payload: { id: string; email: string }): string {
  if (!payload.id || !payload.email) {
    throw new Error('Customer id and email are required to sign a customer token.');
  }
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlHours = Number(process.env.CUSTOMER_SESSION_TTL_HOURS || 24);
  const expSec = nowSec + (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) * 3600;
  const body = Buffer.from(
    JSON.stringify({
      id: payload.id,
      email: payload.email,
      purpose: 'CUSTOMER',
      iat: nowSec,
      exp: expSec,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a Customer JWT and resolve the authoritative server-side CustomerRecord.
 * Rejects Admin tokens, expired tokens, deactivated customers, and passwordless accounts.
 */
export function verifyCustomerToken(token: string): AuthenticatedCustomer | null {
  try {
    if (!token || typeof token !== 'string') return null;
    if (isSessionTokenRevoked(token)) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    if (!headerB64 || !bodyB64 || !sig) return null;

    const headerRaw = Buffer.from(headerB64, 'base64url').toString('utf8');
    const headerObj = JSON.parse(headerRaw) as { alg?: unknown; typ?: unknown };
    if (headerObj.alg !== 'HS256' || (headerObj.typ && headerObj.typ !== 'JWT')) {
      return null;
    }

    const secret = getJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      id?: unknown;
      email?: unknown;
      purpose?: unknown;
      role?: unknown;
      exp?: unknown;
    };

    // Strict domain separation: must explicitly carry purpose === 'CUSTOMER' and no admin role
    if (decoded.purpose !== 'CUSTOMER' || decoded.role !== undefined) {
      return null;
    }

    if (
      typeof decoded.id !== 'string' ||
      !decoded.id.trim() ||
      typeof decoded.email !== 'string' ||
      !decoded.email.trim() ||
      typeof decoded.exp !== 'number' ||
      !Number.isFinite(decoded.exp)
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp <= nowSec) {
      return null;
    }

    const serverCustomer = dbStore
      .getState()
      .customers.find(
        (c) => c.id === decoded.id && c.email.toLowerCase() === decoded.email!.toString().toLowerCase()
      );

    if (
      !serverCustomer ||
      serverCustomer.isActive === false ||
      serverCustomer.emailVerified !== true ||
      !serverCustomer.passwordHash
    ) {
      return null;
    }

    return {
      id: serverCustomer.id,
      email: serverCustomer.email,
      firstName: serverCustomer.firstName,
      lastName: serverCustomer.lastName,
    };
  } catch {
    return null;
  }
}

export async function verifyCustomerTokenWithLookup(
  token: string,
  lookup?: AuthLookupProvider
): Promise<AuthenticatedCustomer | null> {
  if (!token || isSessionTokenRevoked(token)) return null;
  if (!lookup) {
    return verifyCustomerToken(token);
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sig] = parts;
    if (!headerB64 || !bodyB64 || !sig) return null;

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const expectedSig = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      id?: unknown;
      email?: unknown;
      purpose?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (decoded.purpose !== 'CUSTOMER' || decoded.role !== undefined) return null;
    if (
      typeof decoded.id !== 'string' ||
      !decoded.id.trim() ||
      typeof decoded.email !== 'string' ||
      !decoded.email.trim() ||
      typeof decoded.exp !== 'number' ||
      !Number.isFinite(decoded.exp)
    ) {
      return null;
    }
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;

    const serverCustomer = await lookup.findCustomerByIdAndEmail(decoded.id, decoded.email);
    if (
      !serverCustomer ||
      serverCustomer.isActive === false ||
      serverCustomer.emailVerified !== true ||
      !serverCustomer.passwordHash
    ) {
      return null;
    }

    return {
      id: serverCustomer.id,
      email: serverCustomer.email,
      firstName: serverCustomer.firstName,
      lastName: serverCustomer.lastName,
    };
  } catch {
    return null;
  }
}

/**
 * Middleware: Require a valid Customer Bearer JWT.
 */
export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  const resolved = resolveSessionToken(req, 'customer');
  if (!resolved) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Valid customer authentication is required.',
    });
    return;
  }

  const lookup = req.app?.locals?.authLookup as AuthLookupProvider | undefined;
  Promise.resolve(verifyCustomerTokenWithLookup(resolved.token, lookup))
    .then((verified) => {
      if (!verified) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid, expired, or unauthorized customer authentication token.',
        });
        return;
      }

      req.customerUser = verified;
      req.sessionToken = resolved.token;
      req.sessionVia = resolved.via;
      next();
    })
    .catch(next);
}

/**
 * Middleware: Attach req.customerUser if a valid Customer JWT (Bearer or session cookie) is present, otherwise continue.
 */
export function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): void {
  const resolved = resolveSessionToken(req, 'customer');
  if (!resolved) {
    next();
    return;
  }
  const lookup = req.app?.locals?.authLookup as AuthLookupProvider | undefined;
  Promise.resolve(verifyCustomerTokenWithLookup(resolved.token, lookup))
    .then((verified) => {
      if (verified) {
        req.customerUser = verified;
        req.sessionToken = resolved.token;
        req.sessionVia = resolved.via;
      }
      next();
    })
    .catch(next);
}

/**
 * Sign an order-scoped access token for guest checkout confirmation & invoice access.
 */
export function signOrderAccessToken(orderId: string, customerEmail: string): string {
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 24 * 3600;
  const body = Buffer.from(
    JSON.stringify({
      orderId,
      email: customerEmail.trim().toLowerCase(),
      purpose: 'ORDER_ACCESS',
      iat: nowSec,
      exp: expSec,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyOrderAccessToken(
  token: string | undefined,
  expectedOrderId: string,
  expectedOrderNumber: string,
  expectedEmail: string
): boolean {
  try {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, bodyB64, sig] = parts;
    if (!headerB64 || !bodyB64 || !sig) return false;

    const headerObj = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (headerObj.alg !== 'HS256') return false;

    const secret = getJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }

    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      orderId?: unknown;
      email?: unknown;
      purpose?: unknown;
      exp?: unknown;
    };

    if (
      decoded.purpose !== 'ORDER_ACCESS' ||
      typeof decoded.orderId !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return false;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp <= nowSec) return false;

    const matchesOrder =
      decoded.orderId === expectedOrderId || decoded.orderId === expectedOrderNumber;
    const matchesEmail = decoded.email.toLowerCase() === expectedEmail.trim().toLowerCase();
    return matchesOrder && matchesEmail;
  } catch {
    return false;
  }
}

/**
 * Lightweight in-memory sliding-window rate limiter for authentication and public endpoints.
 */
const rateLimitBuckets = new Map<string, number[]>();
const MAX_RATE_LIMIT_BUCKETS = 50_000;

export function resetRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}

/**
 * Parses TRUSTED_PROXY_CIDRS. Only explicit IPs/CIDRs are accepted. Wildcards, "true", numeric hop
 * counts and zero-length prefixes (which would trust the whole internet) are rejected so a
 * spoofed X-Forwarded-For can never choose the rate-limit identity.
 */
export function parseTrustedProxyCidrs(value: string | undefined): string[] {
  const entries = (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const [address, prefix, ...rest] = entry.split('/');
    const family = net.isIP(address || '');
    if (rest.length > 0 || family === 0) {
      throw new Error(`INVALID_TRUSTED_PROXY_CIDRS: "${entry}" is not an IP address or CIDR.`);
    }
    if (prefix !== undefined) {
      const bits = Number(prefix);
      const max = family === 4 ? 32 : 128;
      if (!/^\d+$/.test(prefix) || bits < 1 || bits > max) {
        throw new Error(`INVALID_TRUSTED_PROXY_CIDRS: "${entry}" has an unsafe or invalid prefix length.`);
      }
      if (bits < (family === 4 ? 8 : 32)) {
        throw new Error(`INVALID_TRUSTED_PROXY_CIDRS: "${entry}" trusts an overly broad network.`);
      }
    }
  }
  return entries;
}

function pruneRateLimitBuckets(now: number, windowMs: number): void {
  if (rateLimitBuckets.size < MAX_RATE_LIMIT_BUCKETS) return;
  for (const [key, stamps] of rateLimitBuckets) {
    const last = stamps[stamps.length - 1];
    if (last === undefined || last <= now - windowMs) rateLimitBuckets.delete(key);
  }
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (isTest && process.env.MRS_ENFORCE_RATE_LIMIT_IN_TEST !== 'true') {
      next();
      return;
    }

    // Express resolves req.ip using only explicitly configured trusted proxies.
    // Never accept X-Forwarded-For directly from arbitrary clients.
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    const key = `${options.keyPrefix}:${clientIp}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;

    pruneRateLimitBuckets(now, options.windowMs);
    const existing = (rateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);
    if (existing.length >= options.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil(((existing[0] ?? now) + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please wait before trying again.',
      });
      return;
    }

    existing.push(now);
    rateLimitBuckets.set(key, existing);
    next();
  };
}
