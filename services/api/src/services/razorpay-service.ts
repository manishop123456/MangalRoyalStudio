import * as crypto from 'node:crypto';

const PLACEHOLDER_RAZORPAY_SECRETS = new Set([
  'replace_me_rzp_id',
  'replace_me_rzp_test_id',
  'replace_me_rzp_secret',
  'replace_me_rzp_webhook_secret',
  'changeme',
  'secret',
]);

export type RazorpayMode = 'test';

export interface RazorpayConfigStatus {
  mode: RazorpayMode;
  configured: boolean;
  webhookConfigured: boolean;
  keyIdPrefix: string | null;
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface RazorpayPaymentResponse {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}

function configuredSecret(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value || PLACEHOLDER_RAZORPAY_SECRETS.has(value.toLowerCase())) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

/**
 * Enforces Razorpay TEST MODE ONLY for Phase 5A.
 * Rejects RAZORPAY_MODE=live or any live key prefix (rzp_live_*).
 */
export function assertRazorpayTestMode(env: NodeJS.ProcessEnv = process.env): RazorpayMode {
  const rawMode = env.RAZORPAY_MODE?.trim().toLowerCase();
  if (rawMode && rawMode !== 'test') {
    throw new Error(
      `RAZORPAY_MODE="${rawMode}" is rejected. Only RAZORPAY_MODE=test is permitted in this milestone.`
    );
  }
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  if (keyId && keyId.startsWith('rzp_live_')) {
    throw new Error('Live Razorpay keys (rzp_live_*) are rejected in TEST MODE.');
  }
  return 'test';
}

export function validateRazorpayConfig(env: NodeJS.ProcessEnv = process.env): RazorpayConfigStatus {
  const mode = assertRazorpayTestMode(env);
  const keyId = env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() || '';
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';

  const keyIdValid =
    Boolean(keyId) &&
    !PLACEHOLDER_RAZORPAY_SECRETS.has(keyId.toLowerCase()) &&
    keyId.startsWith('rzp_test_');
  const keySecretValid =
    Boolean(keySecret) && !PLACEHOLDER_RAZORPAY_SECRETS.has(keySecret.toLowerCase());
  const webhookConfigured =
    Boolean(webhookSecret) && !PLACEHOLDER_RAZORPAY_SECRETS.has(webhookSecret.toLowerCase());

  return {
    mode,
    configured: keyIdValid && keySecretValid,
    webhookConfigured,
    keyIdPrefix: keyIdValid ? `${keyId.slice(0, 12)}...` : null,
  };
}

export function getRazorpayCredentials(
  env: NodeJS.ProcessEnv = process.env
): { keyId: string; keySecret: string; mode: RazorpayMode } {
  const mode = assertRazorpayTestMode(env);
  const keyId = configuredSecret('RAZORPAY_KEY_ID', env);
  const keySecret = configuredSecret('RAZORPAY_KEY_SECRET', env);
  if (keyId.startsWith('rzp_live_')) {
    throw new Error('Live Razorpay keys (rzp_live_*) are rejected in TEST MODE.');
  }
  if (!keyId.startsWith('rzp_test_')) {
    throw new Error('RAZORPAY_KEY_ID must be a Razorpay test key (rzp_test_*).');
  }
  return { keyId, keySecret, mode };
}

export function getRazorpayKeySecret(env: NodeJS.ProcessEnv = process.env): string {
  assertRazorpayTestMode(env);
  return configuredSecret('RAZORPAY_KEY_SECRET', env);
}

export function getRazorpayWebhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  assertRazorpayTestMode(env);
  return configuredSecret('RAZORPAY_WEBHOOK_SECRET', env);
}

/**
 * Converts an INR amount (string or number) to integer paise safely.
 */
export function inrToPaise(amountInr: number | string): number {
  const parsed = Number(amountInr);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Invalid INR amount for Razorpay payment.');
  }
  return Math.round(parsed * 100);
}

/**
 * Builds a unique Razorpay receipt identifier within Razorpay's 40-character limit.
 */
export function buildRazorpayReceipt(orderNumber: string): string {
  const clean = orderNumber.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 26);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${clean}-${suffix}`.slice(0, 40);
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    // Never include credentials, Authorization headers, or raw provider secrets in errors
    throw new Error(`Razorpay API request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error('Razorpay order amount must be a positive integer in paise.');
  }
  if (!input.receipt || input.receipt.length > 40) {
    throw new Error('Razorpay receipt must be between 1 and 40 characters.');
  }
  return razorpayRequest<RazorpayOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });
}

export function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
  return razorpayRequest<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrderResponse> {
  return razorpayRequest<RazorpayOrderResponse>(`/orders/${encodeURIComponent(orderId)}`);
}

export function verifyRazorpayCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret?: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    typeof razorpayOrderId !== 'string' ||
    typeof razorpayPaymentId !== 'string' ||
    typeof razorpaySignature !== 'string'
  ) {
    return false;
  }

  // Never accept synthetic prefix signatures in any environment
  if (razorpaySignature.startsWith('sig_verified_')) {
    return false;
  }

  let secret: string;
  try {
    secret = params.secret ?? getRazorpayKeySecret();
  } catch {
    return false;
  }
  if (!secret || PLACEHOLDER_RAZORPAY_SECRETS.has(secret.toLowerCase())) {
    return false;
  }

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHmac, 'utf8');
  const providedBuf = Buffer.from(razorpaySignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function verifyRazorpaySignature(
  payload: string | Buffer,
  signatureHeader: string | undefined,
  secret?: string
): boolean {
  if (!signatureHeader || signatureHeader.startsWith('sig_verified_')) return false;
  let resolvedSecret = secret;
  if (!resolvedSecret) {
    try {
      resolvedSecret = getRazorpayWebhookSecret();
    } catch {
      return false;
    }
  }
  if (!resolvedSecret || PLACEHOLDER_RAZORPAY_SECRETS.has(resolvedSecret.toLowerCase())) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', resolvedSecret)
    .update(payload)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function redactRazorpayError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/rzp_(test|live)_[A-Za-z0-9]+/g, 'rzp_***')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ***');
}
