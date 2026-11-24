import * as crypto from 'node:crypto';
import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';
import { ROLE_PERMISSIONS } from '@mrs/shared';
import { createApp } from './app.js';
import { getJwtSecret, requirePermission, resetRateLimitBuckets, signCustomerToken, signOrderAccessToken } from './middleware/auth.js';
import { getRazorpayKeySecret } from './services/shiprocket-service.js';
import { DataStore, dbStore, hashPassword, verifyPassword } from './store/data-store.js';
import { issueSessionCookie } from './middleware/session.js';
import { testSeedAdminPassword, testSeedCustomerPassword } from './test-support/test-credentials.js';

interface SimulatedHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  text: string;
}

/**
 * Dispatches an HTTP request directly into the Express application in-memory
 * without opening a loopback TCP socket, so tests run deterministically inside
 * strict sandbox environments.
 */
async function invokeApp(
  app: Application,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: Buffer;
  }
): Promise<SimulatedHttpResponse> {
  return new Promise((resolve, reject) => {
    const reqEmitter = new EventEmitter() as any;
    const rawHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers || {})) {
      rawHeaders[k.toLowerCase()] = v;
    }

    reqEmitter.method = options.method;
    reqEmitter.url = options.url;
    reqEmitter.originalUrl = options.url;
    reqEmitter.headers = rawHeaders;
    reqEmitter.body = options.body ?? {};
    if (options.rawBody) {
      reqEmitter.rawBody = options.rawBody;
    }
    reqEmitter.connection = {};
    reqEmitter.socket = {};
    reqEmitter.get = (name: string) => rawHeaders[name.toLowerCase()];
    reqEmitter.header = reqEmitter.get;

    const resHeaders: Record<string, string> = {};
    const chunks: Buffer[] = [];

    const resEmitter = new EventEmitter() as any;
    resEmitter.statusCode = 200;
    resEmitter.headersSent = false;

    resEmitter.setHeader = (name: string, val: string) => {
      resHeaders[name.toLowerCase()] = Array.isArray(val) ? (val as string[]).join('\n') : String(val);
      return resEmitter;
    };
    resEmitter.getHeader = (name: string) => {
      const value = resHeaders[name.toLowerCase()];
      return name.toLowerCase() === 'set-cookie' && value ? value.split('\n') : value;
    };
    resEmitter.removeHeader = (name: string) => {
      delete resHeaders[name.toLowerCase()];
    };
    resEmitter.status = (code: number) => {
      resEmitter.statusCode = code;
      return resEmitter;
    };
    resEmitter.writeHead = (code: number, hdrs?: Record<string, string>) => {
      resEmitter.statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          resHeaders[k.toLowerCase()] = String(v);
        }
      }
      return resEmitter;
    };
    resEmitter.write = (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    resEmitter.json = (data: unknown) => {
      resHeaders['content-type'] = 'application/json';
      const str = JSON.stringify(data);
      resEmitter.end(str);
      return resEmitter;
    };
    resEmitter.send = (data: unknown) => {
      if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
        return resEmitter.json(data);
      }
      resEmitter.end(data ? String(data) : '');
      return resEmitter;
    };
    resEmitter.end = (chunk?: string | Buffer) => {
      if (chunk !== undefined) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resEmitter.headersSent = true;
      const text = Buffer.concat(chunks).toString('utf8');
      let parsedBody: any = text;
      if ((resHeaders['content-type'] || '').includes('application/json') && text) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = text;
        }
      }
      resolve({
        status: resEmitter.statusCode,
        headers: resHeaders,
        body: parsedBody,
        text,
      });
      return resEmitter;
    };

    try {
      (app as any).handle(reqEmitter, resEmitter, (err?: Error) => {
        if (err) {
          reject(err);
        } else if (!resEmitter.headersSent) {
          resEmitter.status(404).end();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

describe('Mangal Royal Studio API (@mrs/api)', () => {
  const app = createApp();
  const priorEnv = new Map<string, string | undefined>();
  const sentVerificationTokens: string[] = [];
  const providerOrders = new Map<string, { amount: number; currency: string }>();
  let latestProviderOrder: { id: string; amount: number; currency: string } | null = null;
  let providerPaymentStatus = 'captured';
  let providerCaptured = true;
  let providerPaymentAmountOffset = 0;
  let providerPaymentCurrency = 'INR';
  let providerPaymentDelayMs = 0;
  let providerOrderDelayMs = 0;
  let originalFetch: typeof fetch;

  beforeAll(() => {
    for (const name of ['NODE_ENV', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'STOREFRONT_PUBLIC_URL']) {
      priorEnv.set(name, process.env[name]);
    }
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mrs_audit';
    process.env.RAZORPAY_KEY_SECRET = 'test-only-razorpay-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-only-webhook-secret';
    process.env.RESEND_API_KEY = 'test-only-resend-key';
    process.env.EMAIL_FROM = 'accounts@test.invalid';
    process.env.STOREFRONT_PUBLIC_URL = 'http://localhost:3000';
    originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.resend.com/emails') {
        const body = JSON.parse(String(init?.body || '{}')) as { html?: string };
        const match = body.html?.match(/#token=([A-Za-z0-9_-]+)/);
        if (match?.[1]) sentVerificationTokens.push(match[1]);
        return new Response('{}', { status: 200 });
      }
      if (url === 'https://api.razorpay.com/v1/orders' && init?.method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as { amount: number; currency: string; receipt: string };
        if (providerOrderDelayMs) await new Promise((resolve) => setTimeout(resolve, providerOrderDelayMs));
        const providerOrder = { id: `order_test_${body.receipt}`, amount: body.amount, currency: body.currency };
        providerOrders.set(providerOrder.id, { amount: body.amount, currency: body.currency });
        latestProviderOrder = providerOrder;
        return new Response(JSON.stringify({ ...providerOrder, status: 'created' }), { status: 200 });
      }
      if (url.startsWith('https://api.razorpay.com/v1/orders/')) {
        const rzpOrderId = decodeURIComponent(url.split('/').pop() || '');
        const providerOrder = providerOrders.get(rzpOrderId) || latestProviderOrder;
        if (!providerOrder) return new Response('{}', { status: 404 });
        const paid = providerCaptured && providerPaymentStatus === 'captured';
        return new Response(
          JSON.stringify({
            id: rzpOrderId,
            amount: providerOrder.amount,
            amount_paid: paid ? providerOrder.amount : 0,
            amount_due: paid ? 0 : providerOrder.amount,
            currency: providerOrder.currency,
            status: paid ? 'paid' : 'attempted',
          }),
          { status: 200 }
        );
      }
      if (url.startsWith('https://api.razorpay.com/v1/payments/')) {
        if (providerPaymentDelayMs) await new Promise((resolve) => setTimeout(resolve, providerPaymentDelayMs));
        const paymentId = decodeURIComponent(url.split('/').pop() || '');
        const providerOrder = latestProviderOrder;
        if (!providerOrder) return new Response('{}', { status: 404 });
        const payment = {
          id: paymentId,
          order_id: providerOrder.id,
          amount: providerOrder.amount + providerPaymentAmountOffset,
          currency: providerPaymentCurrency,
          status: providerPaymentStatus,
          captured: providerCaptured,
          method: 'upi',
        };
        return new Response(JSON.stringify(payment), { status: 200 });
      }
      return new Response('{}', { status: 503 });
    });
  });

  afterAll(() => {
    vi.stubGlobal('fetch', originalFetch);
    for (const [name, value] of priorEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  beforeEach(() => {
    resetRateLimitBuckets();
    for (const customer of dbStore.getState().customers) {
      customer.emailVerified = true;
      if (!customer.passwordHash) {
        customer.passwordHash = hashPassword(testSeedCustomerPassword());
      }
    }
    providerPaymentStatus = 'captured';
    providerCaptured = true;
    providerPaymentAmountOffset = 0;
    providerPaymentCurrency = 'INR';
    providerPaymentDelayMs = 0;
    providerOrderDelayMs = 0;
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    return res.body.token as string;
  }

  it('returns health status and architecture verification on GET /health', async () => {
    const res = await invokeApp(app, {
      method: 'GET',
      url: '/health',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.architecture.customerStorefront).toContain('Shopify Liquid Theme');
    expect(res.body.shopify.mode).toBe('SAFE_DRY_RUN_DEFAULT');
    expect(res.body.counts.products).toBeGreaterThanOrEqual(8);
    expect(res.body.counts.categories).toBe(11);
  });

  it('enforces RBAC permissions between PRICING_OPERATOR and OWNER on repricing runs', async () => {
    const operatorToken = await loginAs(
      'pricing@mangalroyalstudio.com',
      testSeedAdminPassword('PRICING_OPERATOR')
    );
    const ownerToken = await loginAs(
      'owner@mangalroyalstudio.com',
      testSeedAdminPassword('OWNER')
    );

    // 1. Operator can generate a pricing preview run
    const previewRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/admin/pricing/preview',
      headers: { authorization: `Bearer ${operatorToken}` },
      body: { notes: 'Automated test repricing preview' },
    });

    expect(previewRes.status).toBe(201);
    const runId = previewRes.body.pricingRun.id as string;
    expect(previewRes.body.pricingRun.status).toBe('PREVIEWED');

    // 2. Operator can validate the run
    const validateRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/admin/pricing/runs/${runId}/validate`,
      headers: { authorization: `Bearer ${operatorToken}` },
      body: {},
    });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.pricingRun.status).toBe('VALIDATED');

    // 3. Operator CANNOT approve or publish the run (Owner-only gate)
    const forbiddenApprove = await invokeApp(app, {
      method: 'POST',
      url: `/api/admin/pricing/runs/${runId}/approve`,
      headers: { authorization: `Bearer ${operatorToken}` },
      body: {},
    });

    expect(forbiddenApprove.status).toBe(403);
    expect(forbiddenApprove.body.error).toBe('OWNER_APPROVAL_REQUIRED');

    // 4. Owner CAN approve and publish the run
    const ownerApprove = await invokeApp(app, {
      method: 'POST',
      url: `/api/admin/pricing/runs/${runId}/approve`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: { approvalNotes: 'Approved by Owner in integration test' },
    });

    expect(ownerApprove.status).toBe(200);
    expect(ownerApprove.body.pricingRun.status).toBe('APPROVED');

    const ownerPublish = await invokeApp(app, {
      method: 'POST',
      url: `/api/admin/pricing/runs/${runId}/publish`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {},
    });

    expect(ownerPublish.status).toBe(200);
    expect(ownerPublish.body.pricingRun.status).toBe('PUBLISHED');
    expect(ownerPublish.body.shopifySync.liveWriteExecuted).toBe(false);
  });

  it('parses the 11-sheet MANGAL JEWELLERY.xlsx workbook in DRY_RUN mode and generates CSV error report', async () => {
    const managerToken = await loginAs(
      'manager@mangalroyalstudio.com',
      testSeedAdminPassword('MANAGER')
    );

    const importRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/admin/imports/excel',
      headers: { authorization: `Bearer ${managerToken}` },
      body: { mode: 'DRY_RUN' },
    });

    expect(importRes.status).toBe(201);
    const job = importRes.body.importJob;
    expect(job.detectedSheets).toHaveLength(11);
    expect(job.validRows).toBeGreaterThanOrEqual(10);
    expect(job.failedRows).toBeGreaterThanOrEqual(2);
    expect(job.duplicateSkus).toBeGreaterThanOrEqual(1);

    // Download CSV error report
    const csvRes = await invokeApp(app, {
      method: 'GET',
      url: `/api/admin/imports/${job.id}/errors.csv`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('NET_EXCEEDS_GROSS_WEIGHT');
    expect(csvRes.text).toContain('DUPLICATE_SKU');
  });

  it('requires owner role and explicit confirmation before any catalog import commit', async () => {
    const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
    const ownerToken = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
    const previousImportCount = dbStore.getState().importJobs.length;

    const managerAttempt = await invokeApp(app, {
      method: 'POST',
      url: '/api/admin/imports/excel',
      headers: { authorization: `Bearer ${managerToken}` },
      body: { mode: 'COMMIT', confirmCommit: true },
    });
    expect(managerAttempt.status).toBe(403);
    expect(managerAttempt.body.error).toBe('OWNER_APPROVAL_REQUIRED');

    const unconfirmedOwnerAttempt = await invokeApp(app, {
      method: 'POST',
      url: '/api/admin/imports/excel',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: { mode: 'COMMIT' },
    });
    expect(unconfirmedOwnerAttempt.status).toBe(400);
    expect(unconfirmedOwnerAttempt.body.error).toBe('IMPORT_COMMIT_CONFIRMATION_REQUIRED');
    expect(dbStore.getState().importJobs).toHaveLength(previousImportCount);
  });

  it('verifies Shopify webhook HMAC signatures and rejects forged payloads', async () => {
    const priorShopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test-only-shopify-webhook-secret';
    try {
    const payload = JSON.stringify({ id: 99001, order_number: '#MRS-1099' });
    const rawBuf = Buffer.from(payload);

    // Forged signature should return 401
    const badRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/webhooks/shopify',
      headers: { 'x-shopify-hmac-sha256': 'forged-signature' },
      body: JSON.parse(payload),
      rawBody: rawBuf,
    });
    expect(badRes.status).toBe(401);

    // Valid HMAC signature should return 200
    const validHmac = crypto
      .createHmac('sha256', 'test-only-shopify-webhook-secret')
      .update(rawBuf)
      .digest('base64');

    const okRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/webhooks/shopify',
      headers: {
        'x-shopify-hmac-sha256': validHmac,
        'x-shopify-topic': 'orders/paid',
        'x-shopify-webhook-id': 'wh-shopify-basic-0001',
      },
      body: JSON.parse(payload),
      rawBody: rawBuf,
    });
    expect(okRes.status).toBe(200);
    expect(okRes.body.received).toBe(true);
    } finally {
      if (priorShopifySecret === undefined) delete process.env.SHOPIFY_WEBHOOK_SECRET;
      else process.env.SHOPIFY_WEBHOOK_SECRET = priorShopifySecret;
    }
  });

  it('validates all 296 records in MANGAL JEWELLERY.xlsx across 11 sheets via /api/v1/admin/imports/excel', async () => {
    const ownerToken = await loginAs(
      'owner@mangalroyalstudio.com',
      testSeedAdminPassword('OWNER')
    );

    const res = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/admin/imports/excel',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: { mode: 'DRY_RUN' },
    });

    expect(res.status).toBe(201);
    expect(res.body.importJob.totalRows).toBe(296);
    expect(res.body.importJob.detectedSheets).toHaveLength(11);
    expect(res.body.importJob.validRows).toBe(294);
    expect(res.body.importJob.failedRows).toBe(2);
    expect(res.body.importJob.duplicateSkus).toBe(1);
  });

  it('supports Product CRUD, active-order deletion protection, and Inventory stock movement logs', async () => {
    const ownerToken = await loginAs(
      'owner@mangalroyalstudio.com',
      testSeedAdminPassword('OWNER')
    );

    const testSku = `MRS-TST-${Date.now()}`;
    const createRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        sku: testSku,
        title: 'Test Solitaire Ring 18K',
        category: 'Rings',
        metalType: 'GOLD',
        metalPurity: '18K',
        metalColor: 'ROSE_GOLD',
        grossWeightGrams: '3.800',
        netMetalWeightGrams: '3.600',
        makingChargeMode: 'PER_GRAM_NET',
        makingChargeValue: '1500',
        inventoryQuantity: 5,
      },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.product.sku).toBe(testSku);

    // Prevent negative stock adjustment
    const badStock = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        sku: testSku,
        deltaQuantity: -20,
        reason: 'Attempted negative stock',
      },
    });
    expect(badStock.status).toBe(400);
    expect(badStock.body.error).toBe('INSUFFICIENT_STOCK');

    // Valid stock adjustment
    const goodStock = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        sku: testSku,
        deltaQuantity: 3,
        movementType: 'RESTOCK',
        reason: 'Vault restock verification',
      },
    });
    expect(goodStock.status).toBe(200);
    expect(goodStock.body.inventoryQuantity).toBe(8);

    // Active-order deletion safeguard on MRS-RNG-1001
    const blockedDelete = await invokeApp(app, {
      method: 'DELETE',
      url: '/api/v1/products/MRS-RNG-1001',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.error).toBe('PRODUCT_IN_ACTIVE_ORDER');

    // Delete newly created product that has no orders
    const okDelete = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/v1/products/${testSku}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(okDelete.status).toBe(200);
    expect(okDelete.body.deleted).toBe(true);
  });

  it('handles Cart, Discount Code, Checkout Order Creation, Oversell Protection, Razorpay Verification, and Refunds', async () => {
    const ownerToken = await loginAs(
      'owner@mangalroyalstudio.com',
      testSeedAdminPassword('OWNER')
    );

    const cartId = `cart-test-${Date.now()}`;
    const addCartRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/v1/cart/${cartId}/items`,
      body: {
        sku: 'MRS-EAR-2001',
        quantity: 1,
        metalPurity: '18K',
        metalColor: 'YELLOW_GOLD',
      },
    });
    expect(addCartRes.status).toBe(200);
    expect(addCartRes.body.cart.items).toHaveLength(1);

    // Apply discount code ENGAGEMENT10
    const discRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/v1/cart/${cartId}/discount`,
      body: { code: 'ENGAGEMENT10' },
    });
    expect(discRes.status).toBe(200);
    expect(Number(discRes.body.cart.discountAmountInr)).toBeGreaterThan(0);

    // Oversell protection when requesting 999 units
    const oversellRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'buyer@example.com',
        customerName: 'Kavita Nair',
        customerPhone: '+91 98200 12345',
        shippingAddress: {
          line1: '14 Linking Road, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
        },
        items: [{ sku: 'MRS-EAR-2001', quantity: 999 }],
      },
    });
    expect(oversellRes.status).toBe(409);
    expect(oversellRes.body.error).toBe('INSUFFICIENT_STOCK');

    // Valid checkout order creation
    const checkoutRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'buyer@example.com',
        customerName: 'Kavita Nair',
        customerPhone: '+91 98200 12345',
        shippingAddress: {
          line1: '14 Linking Road, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
        },
        items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
        discountCode: 'ENGAGEMENT10',
      },
    });
    expect(checkoutRes.status).toBe(201);
    const createdOrderId = checkoutRes.body.order.id as string;
    const rzpOrderId = checkoutRes.body.razorpayOrder.id as string;
    const orderAccessToken = checkoutRes.body.orderAccessToken as string;
    expect(orderAccessToken).toBeTruthy();

    // Verify Razorpay payment with real HMAC-SHA256 signature
    const paymentId = `pay_test_verified_${crypto.randomUUID()}`;
    const validSignature = crypto
      .createHmac('sha256', getRazorpayKeySecret())
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    const verifyRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/payments/razorpay/verify',
      body: {
        orderId: createdOrderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature,
      },
    });
    expect(verifyRes.status, JSON.stringify(verifyRes.body)).toBe(200);
    expect(verifyRes.body.order.financialStatus).toBe('PAID');

    // Fetch GST Tax Invoice using the signed order access token issued at checkout
    const invRes = await invokeApp(app, {
      method: 'GET',
      url: `/api/v1/orders/${createdOrderId}/invoice`,
      headers: { 'x-mrs-order-token': orderAccessToken },
    });
    expect(invRes.status).toBe(200);
    expect(invRes.body.seller.hsnCode).toContain('7113');

    // Initiate Partial Refund
    const refundRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/v1/admin/orders/${createdOrderId}/refund`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        orderId: createdOrderId,
        amountInr: '5000.00',
        reason: 'Ring size exchange credit adjustment',
        restockItems: false,
      },
    });
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.order.financialStatus).toBe('PARTIALLY_REFUNDED');
  });

  describe('Phase 1, Step 1.2.1 — Admin Authentication & RBAC Hardening', () => {
    function signCustomJwt(payload: Record<string, unknown>, secret = getJwtSecret()): string {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const sig = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
      return `${header}.${body}.${sig}`;
    }

    it('1. rejects admin route requests without an Authorization Bearer token with 401', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('2. rejects admin route requests with an invalid or tampered Bearer token with 401', async () => {
      const malformedRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products',
        headers: { authorization: 'Bearer invalid.jwt.token' },
      });
      expect(malformedRes.status).toBe(401);

      const wrongSecretToken = signCustomJwt(
        {
          id: 'usr-owner-1',
          email: 'owner@mangalroyalstudio.com',
          role: 'OWNER',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        'wrong_signing_secret_32_characters_long_000'
      );
      const wrongSigRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products',
        headers: { authorization: `Bearer ${wrongSecretToken}` },
      });
      expect(wrongSigRes.status).toBe(401);
    });

    it('3. rejects admin route requests with an expired Bearer token with 401', async () => {
      const expiredToken = signCustomJwt({
        id: 'usr-owner-1',
        email: 'owner@mangalroyalstudio.com',
        role: 'OWNER',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('4. rejects x-mrs-admin-role: OWNER header without a valid Bearer token with 401', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users',
        headers: {
          'x-mrs-admin-role': 'OWNER',
          'x-mrs-admin-email': 'owner@mangalroyalstudio.com',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('5. rejects x-mrs-admin-role: MANAGER header without a valid Bearer token with 401', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/orders',
        headers: {
          'x-mrs-admin-role': 'MANAGER',
          'x-mrs-admin-email': 'manager@mangalroyalstudio.com',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('6. resolves the actual server-side role for each valid authenticated admin account', async () => {
      const ownerToken = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));

      const ownerMe = await invokeApp(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ownerMe.status).toBe(200);
      expect(ownerMe.body.user.role).toBe('OWNER');
      expect(ownerMe.body.user.permissions).toContain('PRICING_APPROVE');
      expect(ownerMe.body.user.permissions).toContain('USERS_MANAGE');

      const managerMe = await invokeApp(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(managerMe.status).toBe(200);
      expect(managerMe.body.user.role).toBe('MANAGER');
      expect(managerMe.body.user.permissions).not.toContain('RATES_WRITE');
      expect(managerMe.body.user.permissions).not.toContain('PRICING_APPROVE');
      expect(managerMe.body.user.permissions).not.toContain('USERS_MANAGE');

      const operatorMe = await invokeApp(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(operatorMe.status).toBe(200);
      expect(operatorMe.body.user.role).toBe('PRICING_OPERATOR');
      expect(operatorMe.body.user.permissions).toContain('RATES_VIEW');
      expect(operatorMe.body.user.permissions).not.toContain('RATES_WRITE');
      expect(operatorMe.body.user.permissions).not.toContain('ORDERS_VIEW');
    });

    it('7. denies lower-privilege roles (PRICING_OPERATOR and MANAGER) from accessing OWNER-only routes with 403', async () => {
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));
      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));

      // PRICING_OPERATOR denied from ORDERS_VIEW, USERS_MANAGE, SETTINGS_MANAGE
      const opOrders = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/orders',
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(opOrders.status).toBe(403);

      const opUsers = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(opUsers.status).toBe(403);

      // MANAGER denied from OWNER-only USERS_MANAGE and SETTINGS_MANAGE
      const mgrUsers = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(mgrUsers.status).toBe(403);

      const mgrSettingsGet = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/settings',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(mgrSettingsGet.status).toBe(403);

      const mgrSettingsPut = await invokeApp(app, {
        method: 'PUT',
        url: '/api/admin/settings',
        headers: { authorization: `Bearer ${managerToken}` },
        body: { shopifyLiveWritesEnabled: true },
      });
      expect(mgrSettingsPut.status).toBe(403);
    });

    it('7b. restricts rate publishing (RATES_WRITE) strictly to OWNER and rejects MANAGER and PRICING_OPERATOR with 403', async () => {
      const ownerToken = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));

      for (const token of [managerToken, operatorToken]) {
        const marketCardRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/admin/rates/market-card',
          headers: { authorization: `Bearer ${token}` },
          body: {
            confirmPublish: true,
            gold14kPerGramInr: 10200,
            gold18kPerGramInr: 12300,
            gold22kPerGramInr: 11510,
            platinum950PerGramInr: 3911,
            makingChargePerGramInr: 2500,
            diamondBelow1CtInr: 30000,
            diamondAbove1CtInr: 45000,
          },
        });
        expect(marketCardRes.status).toBe(403);

        const metalRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/admin/rates/metals',
          headers: { authorization: `Bearer ${token}` },
          body: {
            metalType: 'GOLD',
            purity: '18K',
            ratePerGramInr: 12300,
            source: 'RBAC_TEST',
            isPlaceholder: false,
            confirmPublish: true,
          },
        });
        expect(metalRes.status).toBe(403);

        const diamondRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${token}` },
          body: {
            shape: 'ROUND',
            sieveRange: 'Under 1 ct',
            sizeMinCarat: '0.010',
            sizeMaxCarat: '0.990',
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            rateInr: 30000,
            confirmPublish: true,
          },
        });
        expect(diamondRes.status).toBe(403);
      }

      const ownerMetalRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/metals',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: {
          metalType: 'GOLD',
          purity: '18K',
          ratePerGramInr: 12300,
          source: 'OWNER_RBAC_VERIFICATION',
          isPlaceholder: false,
          confirmPublish: true,
        },
      });
      expect(ownerMetalRes.status).toBe(200);
    });

    it('8. denies tokens or accounts with an unknown role with 401', async () => {
      const unknownRoleToken = signCustomJwt({
        id: 'usr-owner-1',
        email: 'owner@mangalroyalstudio.com',
        role: 'SUPER_ROOT_ADMIN',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: `Bearer ${unknownRoleToken}` },
      });
      expect(res.status).toBe(401);
    });

    it('9. denies disabled admin accounts (isActive: false) on login and active token verification with 401', async () => {
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));
      const operatorRecord = dbStore
        .getState()
        .users.find((u) => u.email === 'pricing@mangalroyalstudio.com')!;

      operatorRecord.isActive = false;
      try {
        // Login attempt while disabled must fail
        const loginRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/auth/login',
          body: { email: 'pricing@mangalroyalstudio.com', password: testSeedAdminPassword('PRICING_OPERATOR') },
        });
        expect(loginRes.status).toBe(401);

        // Existing valid JWT for now-disabled account must also be rejected immediately
        const apiRes = await invokeApp(app, {
          method: 'GET',
          url: '/api/admin/rates/metals',
          headers: { authorization: `Bearer ${operatorToken}` },
        });
        expect(apiRes.status).toBe(401);
      } finally {
        operatorRecord.isActive = true;
      }
    });

    it('10. denies access by default when permission definitions are missing or unknown', () => {
      const middleware = requirePermission('NON_EXISTENT_PERMISSION' as any);
      const mockReq: any = {
        adminUser: {
          id: 'usr-owner-1',
          email: 'owner@mangalroyalstudio.com',
          role: 'OWNER',
          permissions: ['PRODUCTS_VIEW'],
        },
      };
      let statusCode = 200;
      let jsonBody: any = null;
      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: unknown) {
          jsonBody = payload;
          return this;
        },
      };
      let nextCalled = false;
      middleware(mockReq, mockRes, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(jsonBody.error).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
    });

    it('11. never exposes passwordHash or secrets in login, /api/admin/users, or /api/admin/customers responses and rejects legacy test backdoor passwords', async () => {
      const legacyLogin = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: { email: 'owner@mangalroyalstudio.com', password: 'MangalOwner!2025' },
      });
      expect(legacyLogin.status).toBe(401);

      const loginRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: { email: 'owner@mangalroyalstudio.com', password: testSeedAdminPassword('OWNER') },
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

      const ownerToken = loginRes.body.token as string;
      const usersRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(usersRes.status).toBe(200);
      expect(JSON.stringify(usersRes.body)).not.toContain('passwordHash');

      const custRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/customers',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(custRes.status).toBe(200);
      expect(JSON.stringify(custRes.body)).not.toContain('passwordHash');

      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
      const managerCustomersRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/customers',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(managerCustomersRes.status).toBe(200);
      expect(managerCustomersRes.body.customers.length).toBeGreaterThan(0);
      expect(managerCustomersRes.body.customers.every((customer: any) => customer.email.includes('•••@'))).toBe(true);
      expect(managerCustomersRes.body.customers.every((customer: any) => customer.totalSpentInr === undefined)).toBe(true);
      for (const customer of managerCustomersRes.body.customers) {
        const privateRecord = dbStore.getState().customers.find((item) => item.id === customer.id);
        expect(customer.email).not.toBe(privateRecord?.email);
      }

      const managerOrdersRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/orders',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(managerOrdersRes.status).toBe(200);
      expect(managerOrdersRes.body.orders.every((order: any) => order.customerName === 'Customer')).toBe(true);
      expect(managerOrdersRes.body.orders.every((order: any) => order.customerEmail.includes('•••@'))).toBe(true);
      for (const order of managerOrdersRes.body.orders) {
        const privateRecord = dbStore.getState().orders.find((item) => item.id === order.id);
        expect(order.customerEmail).not.toBe(privateRecord?.customerEmail);
      }

      const managerOverviewRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(managerOverviewRes.status).toBe(200);
      expect(managerOverviewRes.body.recentOrders.every((order: any) => order.customerName === 'Customer')).toBe(true);
      expect(managerOverviewRes.body.recentOrders.every((order: any) => order.customerEmail.includes('•••@'))).toBe(true);

      const managerOrderExportRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/reports/export.csv?type=orders',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(managerOrderExportRes.status).toBe(403);
      expect(managerOrderExportRes.body.error).toBe('CUSTOMERS_PII_PERMISSION_REQUIRED');

      // Verify salted scrypt hashing works cleanly
      const newHash = hashPassword('TestSecurePass#2026');
      expect(newHash.startsWith('scrypt$')).toBe(true);
      expect(verifyPassword('TestSecurePass#2026', newHash)).toBe(true);
      expect(verifyPassword('WrongPass#2026', newHash)).toBe(false);
    });

    it('12. prevents client-controlled role values in headers, query, body, or forged JWT claims from escalating permissions', async () => {
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));

      // Attempt to escalate PRICING_OPERATOR session by supplying x-mrs-admin-role: OWNER header, query & body
      const headerEscalationRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users?role=OWNER&adminRole=OWNER',
        headers: {
          authorization: `Bearer ${operatorToken}`,
          'x-mrs-admin-role': 'OWNER',
          'x-mrs-admin-email': 'owner@mangalroyalstudio.com',
        },
        body: { role: 'OWNER', permissions: ['USERS_MANAGE'] },
      });
      expect(headerEscalationRes.status).toBe(403);

      // Attempt to forge a JWT where PRICING_OPERATOR claims role: OWNER in the signed payload
      const forgedClaimToken = signCustomJwt({
        id: 'usr-operator-1',
        email: 'pricing@mangalroyalstudio.com',
        role: 'OWNER',
        permissions: ['USERS_MANAGE', 'SETTINGS_MANAGE'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const forgedClaimRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${forgedClaimToken}` },
      });
      expect(forgedClaimRes.status).toBe(401);
    });

    it('disables shipment booking until an approved provider integration is configured', async () => {
      const ownerToken = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
      const existingShipmentCount = dbStore.getState().shipments.length;
      const response = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/orders/ord-1041/shipments',
        headers: { authorization: `Bearer ${ownerToken}` },
        body: { courierName: 'Test Courier', isInsured: true },
      });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('SHIPMENT_PROVIDER_NOT_CONFIGURED');
      expect(dbStore.getState().shipments).toHaveLength(existingShipmentCount);
    });

    it('13. requires ORDERS_MANAGE mutation permission for order cancellation and refunds (denying read-only roles and allowing MANAGER/OWNER)', async () => {
      const operatorToken = await loginAs('pricing@mangalroyalstudio.com', testSeedAdminPassword('PRICING_OPERATOR'));
      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
      const targetOrder = dbStore.getState().orders[0]!;
      const prevStatus = targetOrder.fulfillmentStatus;

      // 1. PRICING_OPERATOR (lacks ORDERS_MANAGE) cannot cancel orders
      const opCancelRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/orders/${targetOrder.id}/cancel`,
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(opCancelRes.status).toBe(403);
      expect(opCancelRes.body.error).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
      expect(opCancelRes.body.requiredPermission).toBe('ORDERS_MANAGE');

      // 2. Temporarily restrict MANAGER to read-only ORDERS_VIEW (without ORDERS_MANAGE) to prove ORDERS_VIEW alone cannot cancel orders
      const originalManagerPerms = [...ROLE_PERMISSIONS.MANAGER];
      ROLE_PERMISSIONS.MANAGER = originalManagerPerms.filter((p) => p !== 'ORDERS_MANAGE');
      try {
        // Can still view orders with ORDERS_VIEW
        const viewRes = await invokeApp(app, {
          method: 'GET',
          url: '/api/admin/orders',
          headers: { authorization: `Bearer ${managerToken}` },
        });
        expect(viewRes.status).toBe(200);

        // Cannot cancel order with only ORDERS_VIEW
        const readOnlyCancelRes = await invokeApp(app, {
          method: 'POST',
          url: `/api/admin/orders/${targetOrder.id}/cancel`,
          headers: { authorization: `Bearer ${managerToken}` },
        });
        expect(readOnlyCancelRes.status).toBe(403);
        expect(readOnlyCancelRes.body.requiredPermission).toBe('ORDERS_MANAGE');
      } finally {
        ROLE_PERMISSIONS.MANAGER = originalManagerPerms;
      }

      // 3. Authorized role with ORDERS_MANAGE (MANAGER) can cancel the order
      try {
        targetOrder.fulfillmentStatus = 'UNFULFILLED';
        const mgrCancelRes = await invokeApp(app, {
          method: 'POST',
          url: `/api/admin/orders/${targetOrder.id}/cancel`,
          headers: { authorization: `Bearer ${managerToken}` },
        });
        expect(mgrCancelRes.status).toBe(200);
        expect(mgrCancelRes.body.order.fulfillmentStatus).toBe('CANCELLED');
      } finally {
        targetOrder.fulfillmentStatus = prevStatus;
      }
    });
  });

  describe('Phase 1, Step 1.2.2 — Customer Authentication, Order Privacy & Payment Security Hardening', () => {
    async function loginCustomerAs(email: string, password: string): Promise<string> {
      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/customer/login',
        body: { email, password },
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      return res.body.token as string;
    }

    it('1. hashes password on customer registration, never exposes passwordHash, and issues a valid customer JWT', async () => {
      const uniqueEmail = `member.${Date.now()}@example.com`;
      const regRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          firstName: 'Meera',
          lastName: 'Kapoor',
          email: uniqueEmail,
          phone: '+91 98209 11223',
          password: 'RoyalMemberPassword#2026',
        },
      });

      expect(regRes.status).toBe(202);
      expect(regRes.body.verificationRequired).toBe(true);
      expect(regRes.body.token).toBeUndefined();

      const storedCustomer = dbStore
        .getState()
        .customers.find((c) => c.email.toLowerCase() === uniqueEmail.toLowerCase());
      expect(storedCustomer).toBeDefined();
      expect(storedCustomer!.passwordHash).toMatch(/^scrypt\$/);
      expect(storedCustomer!.passwordHash).not.toBe('RoyalMemberPassword#2026');
      expect(verifyPassword('RoyalMemberPassword#2026', storedCustomer!.passwordHash!)).toBe(true);
      expect(storedCustomer!.email).toBe(uniqueEmail.toLowerCase());
      expect(storedCustomer!.emailVerified).toBe(false);
      const verificationToken = sentVerificationTokens.pop()!;
      const verifyRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/verify-email',
        body: { token: verificationToken },
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeTruthy();
      expect(dbStore.getState().customers.find((c) => c.id === storedCustomer!.id)?.emailVerified).toBe(true);
    });

    it('2. authenticates valid customer login with correct password and rejects wrong password, unknown email, inactive, or passwordless accounts with 401', async () => {
      // Valid login for seeded customer Ananya Sharma
      const okRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/customer/login',
        body: {
          email: 'ananya.sharma@example.com',
          password: testSeedCustomerPassword(),
        },
      });
      expect(okRes.status).toBe(200);
      expect(okRes.body.token).toBeTruthy();
      expect(okRes.body.customer.email).toBe('ananya.sharma@example.com');
      expect(okRes.body.customer.passwordHash).toBeUndefined();

      // Wrong password must fail with 401
      const wrongPassRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/customer/login',
        body: {
          email: 'ananya.sharma@example.com',
          password: `${testSeedCustomerPassword()}-definitely-wrong`,
        },
      });
      expect(wrongPassRes.status).toBe(401);
      expect(wrongPassRes.body.error).toBe('INVALID_CREDENTIALS');
      expect(wrongPassRes.body.token).toBeUndefined();

      // Unknown email must fail with generic 401
      const unknownEmailRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/auth/customer/login',
        body: {
          email: 'nonexistent.buyer@example.com',
          password: testSeedCustomerPassword(),
        },
      });
      expect(unknownEmailRes.status).toBe(401);
      expect(unknownEmailRes.body.error).toBe('INVALID_CREDENTIALS');
      expect(unknownEmailRes.body.message).toBe(wrongPassRes.body.message);

      // Deactivated customer account must fail with 401
      const targetCust = dbStore
        .getState()
        .customers.find((c) => c.email === 'rohan.mehta@example.com')!;
      const prevActive = targetCust.isActive;
      const prevHash = targetCust.passwordHash;
      try {
        targetCust.isActive = false;
        const inactiveRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/auth/customer/login',
          body: {
            email: 'rohan.mehta@example.com',
            password: testSeedCustomerPassword(),
          },
        });
        expect(inactiveRes.status).toBe(401);

        // Passwordless customer account must also fail with 401
        targetCust.isActive = true;
        targetCust.passwordHash = undefined;
        const passwordlessRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/auth/customer/login',
          body: {
            email: 'rohan.mehta@example.com',
            password: testSeedCustomerPassword(),
          },
        });
        expect(passwordlessRes.status).toBe(401);
      } finally {
        targetCust.isActive = prevActive;
        targetCust.passwordHash = prevHash;
      }
    });

    it('3. enforces strict token separation: customer JWT cannot access admin endpoints and admin JWT cannot access customer endpoints', async () => {
      const customerToken = await loginCustomerAs(
        'ananya.sharma@example.com',
        testSeedCustomerPassword()
      );
      const adminToken = await loginAs(
        'owner@mangalroyalstudio.com',
        testSeedAdminPassword('OWNER')
      );

      // Customer token rejected on admin overview & admin orders
      const custOnAdminOverview = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(custOnAdminOverview.status).toBe(401);

      const custOnAdminCancel = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/orders/ord-1042/cancel',
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(custOnAdminCancel.status).toBe(401);

      // Admin token rejected on customer-only profile/orders endpoints
      const adminOnCustomerMe = await invokeApp(app, {
        method: 'GET',
        url: '/api/auth/customer/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminOnCustomerMe.status).toBe(401);

      const adminOnCustomerOrders = await invokeApp(app, {
        method: 'GET',
        url: '/api/customer/orders',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminOnCustomerOrders.status).toBe(401);
    });

    it('4. scopes GET /api/customer/orders strictly to the authenticated customer and never leaks another customer orders', async () => {
      const ananyaToken = await loginCustomerAs(
        'ananya.sharma@example.com',
        testSeedCustomerPassword()
      );
      const rohanToken = await loginCustomerAs(
        'rohan.mehta@example.com',
        testSeedCustomerPassword()
      );

      const ananyaOrdersRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/customer/orders',
        headers: { authorization: `Bearer ${ananyaToken}` },
      });
      expect(ananyaOrdersRes.status).toBe(200);
      expect(ananyaOrdersRes.body.orders.length).toBeGreaterThanOrEqual(1);
      expect(ananyaOrdersRes.body.orders.every((ord: { customerEmail?: string }) => ord.customerEmail === undefined)).toBe(true);

      const rohanOrdersRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/customer/orders',
        headers: { authorization: `Bearer ${rohanToken}` },
      });
      expect(rohanOrdersRes.status).toBe(200);
      expect(rohanOrdersRes.body.orders.every((ord: { customerEmail?: string }) => ord.customerEmail === undefined)).toBe(true);
    });

    it('5. blocks unauthenticated and cross-customer order cancellation, allows owner customer cancellation once, and keeps repeated cancellation idempotent', async () => {
      const ananyaToken = await loginCustomerAs(
        'ananya.sharma@example.com',
        testSeedCustomerPassword()
      );
      const rohanToken = await loginCustomerAs(
        'rohan.mehta@example.com',
        testSeedCustomerPassword()
      );

      // Create an unfulfilled order for Rohan Mehta
      const prod = dbStore.getState().products.find((p) => p.sku === 'MRS-EAR-2001')!;
      const stockBeforeOrder = prod.inventoryQuantity;

      const createOrderRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/checkout/create-order',
        headers: { authorization: `Bearer ${rohanToken}` },
        body: {
          customerEmail: 'rohan.mehta@example.com',
          customerName: 'Rohan Mehta',
          customerPhone: '+91 98112 77890',
          shippingAddress: {
            line1: '22 Khan Market',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110003',
          },
          items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
        },
      });
      expect(createOrderRes.status).toBe(201);
      const rohanOrderId = createOrderRes.body.order.id as string;
      expect(prod.inventoryQuantity).toBe(stockBeforeOrder - 1);

      // 1. Unauthenticated POST /api/orders/:orderId/cancel must fail with 401
      const unauthCancelRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/orders/${rohanOrderId}/cancel`,
      });
      expect(unauthCancelRes.status).toBe(401);
      expect(prod.inventoryQuantity).toBe(stockBeforeOrder - 1);

      // 2. Customer A (Ananya) cannot cancel Customer B's (Rohan's) order -> 403
      const crossCustomerCancelRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/orders/${rohanOrderId}/cancel`,
        headers: { authorization: `Bearer ${ananyaToken}` },
      });
      expect(crossCustomerCancelRes.status).toBe(403);
      expect(crossCustomerCancelRes.body.error).toBe('FORBIDDEN_NOT_ORDER_OWNER');
      expect(prod.inventoryQuantity).toBe(stockBeforeOrder - 1);

      // 3. Rohan can cancel his own unfulfilled order -> 200 and stock restored once
      const auditCountBeforeCancel = dbStore.getState().auditLogs.length;
      const ownerCancelRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/orders/${rohanOrderId}/cancel`,
        headers: { authorization: `Bearer ${rohanToken}` },
      });
      expect(ownerCancelRes.status).toBe(200);
      expect(ownerCancelRes.body.order.fulfillmentStatus).toBe('CANCELLED');
      expect(ownerCancelRes.body.idempotent).toBe(false);
      expect(prod.inventoryQuantity).toBe(stockBeforeOrder);
      expect(dbStore.getState().auditLogs.length).toBe(auditCountBeforeCancel + 1);
      expect(dbStore.getState().auditLogs[0]?.actorRole).toBe('CUSTOMER');

      // 4. Repeated cancellation is idempotent and does NOT restore stock a second time
      const movementsCountAfterFirstCancel = dbStore.getState().inventoryMovements.length;
      const repeatCancelRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/orders/${rohanOrderId}/cancel`,
        headers: { authorization: `Bearer ${rohanToken}` },
      });
      expect(repeatCancelRes.status).toBe(200);
      expect(repeatCancelRes.body.idempotent).toBe(true);
      expect(prod.inventoryQuantity).toBe(stockBeforeOrder);
      expect(dbStore.getState().inventoryMovements.length).toBe(movementsCountAfterFirstCancel);
    });

    it('6. enforces real Razorpay HMAC-SHA256 verification and rejects sig_verified_* prefixes, invalid signatures, non-prod bypasses, missing secrets, and order/amount mismatches', async () => {
      // Create a fresh checkout order
      const checkoutRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/checkout/create-order',
        body: {
          customerEmail: 'priya.desai@example.com',
          customerName: 'Priya Desai',
          customerPhone: '+91 99250 33120',
          shippingAddress: {
            line1: 'CG Road, Navrangpura',
            city: 'Ahmedabad',
            state: 'Gujarat',
            pincode: '380009',
          },
          items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
        },
      });
      expect(checkoutRes.status).toBe(201);
      const orderId = checkoutRes.body.order.id as string;
      const rzpOrderId = checkoutRes.body.razorpayOrder.id as string;
      const expectedPaise = checkoutRes.body.razorpayOrder.amountPaise as number;

      // 1. Reject sig_verified_* synthetic signature even in test/development mode
      const fakePrefixRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: `pay_fake_${crypto.randomUUID()}`,
          razorpaySignature: 'sig_verified_bypass_attempt',
        },
      });
      expect(fakePrefixRes.status).toBe(401);
      expect(fakePrefixRes.body.error).toBe('INVALID_PAYMENT_SIGNATURE');
      expect(
        dbStore.getState().orders.find((o) => o.id === orderId)!.financialStatus
      ).toBe('PENDING');

      // 2. Reject invalid HMAC signature in non-production environment
      const invalidHmacRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: `pay_fake_${crypto.randomUUID()}`,
          razorpaySignature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      });
      expect(invalidHmacRes.status).toBe(401);
      expect(
        dbStore.getState().orders.find((o) => o.id === orderId)!.financialStatus
      ).toBe('PENDING');

      // 3. Fail securely (503) when RAZORPAY_KEY_SECRET is missing/empty
      const prevRzpSecret = process.env.RAZORPAY_KEY_SECRET;
      try {
        process.env.RAZORPAY_KEY_SECRET = '';
        const missingSecretRes = await invokeApp(app, {
          method: 'POST',
          url: '/api/payments/razorpay/verify',
          body: {
            orderId,
            razorpayOrderId: rzpOrderId,
            razorpayPaymentId: `pay_real_${crypto.randomUUID()}`,
            razorpaySignature: 'any_sig',
          },
        });
        expect(missingSecretRes.status).toBe(503);
        expect(missingSecretRes.body.error).toBe('PAYMENT_CONFIGURATION_ERROR');
      } finally {
        if (prevRzpSecret === undefined) {
          delete process.env.RAZORPAY_KEY_SECRET;
        } else {
          process.env.RAZORPAY_KEY_SECRET = prevRzpSecret;
        }
      }

      // 4. Reject valid HMAC signed for a DIFFERENT razorpayOrderId than the checkout order
      const wrongRzpOrderId = 'order_MrsRzpOtherOrder999';
      const paymentId = `pay_MrsRzpRealCapture${crypto.randomUUID()}`;
      const sigForWrongOrder = crypto
        .createHmac('sha256', getRazorpayKeySecret())
        .update(`${wrongRzpOrderId}|${paymentId}`)
        .digest('hex');

      const mismatchOrderRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: wrongRzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: sigForWrongOrder,
        },
      });
      expect(mismatchOrderRes.status).toBe(400);
      expect(mismatchOrderRes.body.error).toBe('ORDER_PAYMENT_MISMATCH');
      expect(
        dbStore.getState().orders.find((o) => o.id === orderId)!.financialStatus
      ).toBe('PENDING');

      // 5. Client-supplied totals are ignored; authoritative provider amount must match stored order.
      const validSig = crypto
        .createHmac('sha256', getRazorpayKeySecret())
        .update(`${rzpOrderId}|${paymentId}`)
        .digest('hex');

      providerPaymentAmountOffset = 100;
      const mismatchAmountRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
          amountPaise: expectedPaise,
        },
      });
      expect(mismatchAmountRes.status).toBe(400);
      expect(mismatchAmountRes.body.error).toBe('PAYMENT_MISMATCH');
      providerPaymentAmountOffset = 0;

      providerPaymentCurrency = 'USD';
      const mismatchCurrencyRes = await invokeApp(app, {
        method: 'POST', url: '/api/payments/razorpay/verify',
        body: { orderId, razorpayOrderId: rzpOrderId, razorpayPaymentId: paymentId, razorpaySignature: validSig },
      });
      expect(mismatchCurrencyRes.status).toBe(400);
      expect(mismatchCurrencyRes.body.error).toBe('PAYMENT_MISMATCH');
      providerPaymentCurrency = 'INR';

      const paymentsCountBefore = dbStore.getState().payments.length;
      providerPaymentStatus = 'authorized';
      providerCaptured = false;
      const notCapturedRes = await invokeApp(app, {
        method: 'POST', url: '/api/payments/razorpay/verify',
        body: { orderId, razorpayOrderId: rzpOrderId, razorpayPaymentId: paymentId, razorpaySignature: validSig },
      });
      expect(notCapturedRes.status).toBe(409);
      expect(notCapturedRes.body.error).toBe('PAYMENT_NOT_CAPTURED');
      expect(dbStore.getState().orders.find((o) => o.id === orderId)!.financialStatus).toBe('PENDING');
      providerPaymentStatus = 'captured';
      providerCaptured = true;

      // 6. Succeed only after server-side Razorpay reports captured INR payment for the exact amount.
      const validVerifyRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        },
      });
      expect(validVerifyRes.status).toBe(200);
      expect(validVerifyRes.body.verified).toBe(true);
      expect(validVerifyRes.body.idempotent).toBe(false);
      expect(validVerifyRes.body.order.financialStatus).toBe('PAID');
      expect(dbStore.getState().payments.length).toBe(paymentsCountBefore + 1);

      // 7. Replay with identical paymentId is idempotent and does not create duplicate payment records
      const replayVerifyRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        },
      });
      expect(replayVerifyRes.status).toBe(200);
      expect(replayVerifyRes.body.idempotent).toBe(true);
      expect(dbStore.getState().payments.length).toBe(paymentsCountBefore + 1);

      // 8. Attempt to capture a second different paymentId on an already-PAID order returns 409
      const secondPaymentId = `pay_MrsRzpDuplicateCapture${crypto.randomUUID()}`;
      const secondValidSig = crypto
        .createHmac('sha256', getRazorpayKeySecret())
        .update(`${rzpOrderId}|${secondPaymentId}`)
        .digest('hex');

      const conflictVerifyRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/payments/razorpay/verify',
        body: {
          orderId,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: secondPaymentId,
          razorpaySignature: secondValidSig,
        },
      });
      expect(conflictVerifyRes.status).toBe(409);
      expect(conflictVerifyRes.body.error).toBe('ORDER_ALREADY_PAID');
    });

    it('7. protects GST invoices against unauthenticated or cross-customer access while allowing the owning customer or authorized admin', async () => {
      const ananyaToken = await loginCustomerAs(
        'ananya.sharma@example.com',
        testSeedCustomerPassword()
      );
      const rohanToken = await loginCustomerAs(
        'rohan.mehta@example.com',
        testSeedCustomerPassword()
      );
      const managerToken = await loginAs(
        'manager@mangalroyalstudio.com',
        testSeedAdminPassword('MANAGER')
      );

      // 1. Unauthenticated invoice lookup for ord-1041 (Ananya's order) -> 401
      const unauthInvoiceRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/orders/ord-1041/invoice',
      });
      expect(unauthInvoiceRes.status).toBe(401);

      // 2. Customer B (Rohan) attempting to fetch Customer A's (Ananya's) invoice -> 403
      const crossCustomerInvoiceRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/orders/ord-1041/invoice',
        headers: { authorization: `Bearer ${rohanToken}` },
      });
      expect(crossCustomerInvoiceRes.status).toBe(403);
      expect(crossCustomerInvoiceRes.body.error).toBe('FORBIDDEN_NOT_ORDER_OWNER');

      // 3. Owning Customer A (Ananya) can fetch her own invoice -> 200
      const ownerCustomerInvoiceRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/orders/ord-1041/invoice',
        headers: { authorization: `Bearer ${ananyaToken}` },
      });
      expect(ownerCustomerInvoiceRes.status).toBe(200);
      expect(ownerCustomerInvoiceRes.body.invoiceNumber).toBe('INV-MRS-1041');

      // 4. Authorized Admin with ORDERS_VIEW (MANAGER) can fetch invoice -> 200
      const adminInvoiceRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/orders/ord-1041/invoice',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(adminInvoiceRes.status).toBe(200);
      expect(adminInvoiceRes.body.invoiceNumber).toBe('INV-MRS-1041');
    });

    it('8. sanitizes GET /api/public/orders/track so no buyer PII, email, phone, address, or lineItems are exposed', async () => {
      const trackingToken = signOrderAccessToken('ord-1041', 'ananya.sharma@example.com');
      const trackRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/public/orders/track?orderNumber=MRS-1041',
        headers: { 'x-mrs-order-token': trackingToken },
      });
      expect(trackRes.status).toBe(200);
      expect(trackRes.body.tracking).toBeDefined();
      expect(trackRes.body.tracking.orderNumber).toBe('MRS-1041');
      expect(trackRes.body.shipment).toBeDefined();

      // Verify raw order object and sensitive customer PII are completely absent
      expect(trackRes.body.order).toBeUndefined();
      const rawJson = JSON.stringify(trackRes.body);
      expect(rawJson).not.toContain('ananya.sharma@example.com');
      expect(rawJson).not.toContain('98201 44510');
      expect(rawJson).not.toContain('Ananya Sharma');
      expect(rawJson).not.toContain('400050');
      expect(rawJson).not.toContain('pay_MrsRzp99201441');
    });

    it('9. refuses customer authentication and guest-order access until email ownership is verified', async () => {
      const customer = dbStore.getState().customers.find((entry) => entry.email === 'ananya.sharma@example.com')!;
      const previousVerified = customer.emailVerified;
      customer.emailVerified = false;
      try {
        const loginRes = await invokeApp(app, {
          method: 'POST', url: '/api/auth/customer/login',
          body: { email: customer.email, password: testSeedCustomerPassword() },
        });
        expect(loginRes.status).toBe(401);

        const forgedSession = signCustomerToken({ id: customer.id, email: customer.email });
        const customerOrdersRes = await invokeApp(app, {
          method: 'GET', url: '/api/customer/orders',
          headers: { authorization: `Bearer ${forgedSession}` },
        });
        expect(customerOrdersRes.status).toBe(401);

        const guestOrderRes = await invokeApp(app, {
          method: 'POST', url: '/api/checkout/create-order',
          body: {
            customerEmail: customer.email, customerName: 'Guest Buyer', customerPhone: '+91 9800012345',
            shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
            items: [{ sku: 'MRS-EAR-2001', quantity: 1 }], paymentMethod: 'COD_STUDIO_PICKUP',
          },
        });
        expect(guestOrderRes.status).toBe(201);
        const guestOrderId = guestOrderRes.body.order.id as string;
        expect(guestOrderRes.body.order.customerId).toBe('cust-guest');
        const guestInvoiceUsingUnverifiedCustomer = await invokeApp(app, {
          method: 'GET', url: `/api/orders/${guestOrderId}/invoice`,
          headers: { authorization: `Bearer ${forgedSession}` },
        });
        expect(guestInvoiceUsingUnverifiedCustomer.status).toBe(401);
      } finally {
        customer.emailVerified = previousVerified;
      }
    });

    it('10. fails registration closed when email provider configuration is missing and issues no session token', async () => {
      const originalKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;
      const email = `no-provider-${Date.now()}@example.net`;
      try {
        const response = await invokeApp(app, {
          method: 'POST', url: '/api/auth/register',
          body: { firstName: 'Test', lastName: 'Buyer', email, password: 'StrongPassword#2026' },
        });
        expect(response.status).toBe(503);
        expect(response.body.token).toBeUndefined();
        expect(dbStore.getState().customers.some((entry) => entry.email === email)).toBe(false);
      } finally {
        if (originalKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalKey;
      }
    });

    it('10a. storefront auth and checkout components contain no client-side success fallback or unauthenticated sample profile', () => {
      const root = path.resolve(process.cwd(), '../..');
      const registerSource = readFileSync(path.join(root, 'apps/storefront/src/app/account/register/page.tsx'), 'utf8');
      const accountSource = readFileSync(path.join(root, 'apps/storefront/src/app/account/page.tsx'), 'utf8');
      const checkoutSource = readFileSync(path.join(root, 'apps/storefront/src/app/checkout/page.tsx'), 'utf8');
      expect(registerSource).not.toContain('setCustomer({');
      expect(registerSource).not.toContain("router.push('/account')");
      expect(registerSource).toContain('verificationRequired === true');
      expect(accountSource).not.toContain('ananya.sharma@example.com');
      expect(accountSource).toContain('if (!customerToken || !customer)');
      expect(checkoutSource).not.toContain('Math.random()');
      expect(checkoutSource).not.toContain('pay_MrsRzp_');
      expect(checkoutSource).toContain('No confirmation was created');
    });

    it('10b. missing Razorpay credentials create no order and do not change stock', async () => {
      const previousKeyId = process.env.RAZORPAY_KEY_ID;
      const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      const product = dbStore.getState().products.find((entry) => entry.sku === 'MRS-EAR-2001')!;
      const stockBefore = product.inventoryQuantity;
      const orderCountBefore = dbStore.getState().orders.length;
      try {
        const response = await invokeApp(app, {
          method: 'POST', url: '/api/checkout/create-order',
          body: {
            customerEmail: 'buyer@example.net', customerName: 'Test Buyer', customerPhone: '+91 9800012345',
            shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
            items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
          },
        });
        expect(response.status).toBe(503);
        expect(response.body.error).toBe('PAYMENT_UNAVAILABLE');
        expect(product.inventoryQuantity).toBe(stockBefore);
        expect(dbStore.getState().orders.length).toBe(orderCountBefore);
      } finally {
        if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
        else process.env.RAZORPAY_KEY_ID = previousKeyId;
        if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
        else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
      }
    });

    it('10c. concurrent payment verification produces at most one financial transition per order', async () => {
      const checkout = await invokeApp(app, {
        method: 'POST', url: '/api/checkout/create-order',
        body: {
          customerEmail: `concurrent-${crypto.randomUUID()}@example.net`, customerName: 'Test Buyer', customerPhone: '+91 9800012345',
          shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
          items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
        },
      });
      expect(checkout.status).toBe(201);
      const { id: orderId } = checkout.body.order as { id: string };
      const { id: razorpayOrderId } = checkout.body.razorpayOrder as { id: string };
      const paymentId = `pay_concurrent_${crypto.randomUUID()}`;
      const signature = crypto.createHmac('sha256', getRazorpayKeySecret()).update(`${razorpayOrderId}|${paymentId}`).digest('hex');
      const before = dbStore.getState().payments.filter((entry) => entry.orderId === orderId).length;
      providerPaymentDelayMs = 40;
      try {
        const requests = await Promise.all([
          invokeApp(app, { method: 'POST', url: '/api/payments/razorpay/verify', body: { orderId, razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature } }),
          invokeApp(app, { method: 'POST', url: '/api/payments/razorpay/verify', body: { orderId, razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature } }),
        ]);
        expect(requests.filter((response) => response.status === 200)).toHaveLength(1);
        expect(requests.filter((response) => response.status === 409)).toHaveLength(1);
        expect(dbStore.getState().payments.filter((entry) => entry.orderId === orderId)).toHaveLength(before + 1);
        expect(dbStore.getState().orders.find((entry) => entry.id === orderId)?.financialStatus).toBe('PAID');
      } finally {
        providerPaymentDelayMs = 0;
      }
    });

    it('10d. concurrent checkout requests for one SKU do not double-reserve within one API process', async () => {
      const product = dbStore.getState().products.find((entry) => entry.sku === 'MRS-EAR-2001')!;
      const stockBefore = product.inventoryQuantity;
      providerOrderDelayMs = 40;
      try {
        const createOrder = () => invokeApp(app, {
          method: 'POST', url: '/api/checkout/create-order',
          body: {
            customerEmail: `checkout-${crypto.randomUUID()}@example.net`, customerName: 'Test Buyer', customerPhone: '+91 9800012345',
            shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
            items: [{ sku: 'MRS-EAR-2001', quantity: 1 }],
          },
        });
        const responses = await Promise.all([createOrder(), createOrder()]);
        expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
        expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
        expect(product.inventoryQuantity).toBe(stockBefore - 1);
      } finally {
        providerOrderDelayMs = 0;
      }
    });

    it('11. rejects admin cancellation for shipped and fulfilled orders without restoring stock', async () => {
      const managerToken = await loginAs('manager@mangalroyalstudio.com', testSeedAdminPassword('MANAGER'));
      const order = dbStore.getState().orders.find((entry) => entry.id === 'ord-1041')!;
      const product = dbStore.getState().products.find((entry) => entry.sku === order.lineItems[0]!.sku)!;
      const oldStatus = order.fulfillmentStatus;
      const oldStock = product.inventoryQuantity;
      try {
        for (const status of ['IN_TRANSIT', 'FULFILLED'] as const) {
          order.fulfillmentStatus = status;
          const response = await invokeApp(app, {
            method: 'POST', url: `/api/admin/orders/${order.id}/cancel`,
            headers: { authorization: `Bearer ${managerToken}` },
          });
          expect(response.status).toBe(409);
          expect(product.inventoryQuantity).toBe(oldStock);
        }
      } finally {
        order.fulfillmentStatus = oldStatus;
      }
    });

    it('12. guest invoice tokens are order-scoped and invoice DTO omits internal order fields', async () => {
      const testedProduct = dbStore.getState().products.find((entry) => entry.sku === 'MRS-PND-4001')!;
      const priorStock = testedProduct.inventoryQuantity;
      testedProduct.inventoryQuantity = 100;
      const makeGuestOrder = async (sku: string) => {
        const response = await invokeApp(app, {
          method: 'POST', url: '/api/checkout/create-order',
          body: {
            customerEmail: `guest-${Date.now()}-${sku}@example.net`, customerName: 'Guest Buyer', customerPhone: '+91 9800012345',
            shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
            items: [{ sku, quantity: 1 }], paymentMethod: 'COD_STUDIO_PICKUP',
          },
        });
        expect(response.status).toBe(201);
        return response.body as { order: { id: string }; orderAccessToken: string };
      };
      const first = await makeGuestOrder('MRS-PND-4001');
      const second = await makeGuestOrder('MRS-PND-4001');
      testedProduct.inventoryQuantity = priorStock;
      const denied = await invokeApp(app, {
        method: 'GET', url: `/api/orders/${second.order.id}/invoice`,
        headers: { 'x-mrs-order-token': first.orderAccessToken },
      });
      expect(denied.status).toBe(401);
      const allowed = await invokeApp(app, {
        method: 'GET', url: `/api/orders/${first.order.id}/invoice`,
        headers: { 'x-mrs-order-token': first.orderAccessToken },
      });
      expect(allowed.status).toBe(200);
      expect(allowed.body.order.customerEmail).toBeUndefined();
      expect(allowed.body.order.customerPhone).toBeUndefined();
      expect(allowed.body.order.shippingPincode).toBeUndefined();
      expect(allowed.body.order.razorpayPaymentId).toBeUndefined();
    });

    it('13. changing X-Forwarded-For does not bypass the per-client in-memory limiter', async () => {
      const previous = process.env.MRS_ENFORCE_RATE_LIMIT_IN_TEST;
      process.env.MRS_ENFORCE_RATE_LIMIT_IN_TEST = 'true';
      resetRateLimitBuckets();
      try {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const response = await invokeApp(app, {
            method: 'POST', url: '/api/auth/customer/login',
            headers: { 'x-forwarded-for': `198.51.100.${attempt + 1}` },
            body: { email: 'nobody@example.net', password: 'IncorrectPassword' },
          });
          expect(response.status).toBe(401);
        }
        const limited = await invokeApp(app, {
          method: 'POST', url: '/api/auth/customer/login',
          headers: { 'x-forwarded-for': '203.0.113.44' },
          body: { email: 'nobody@example.net', password: 'IncorrectPassword' },
        });
        expect(limited.status).toBe(429);
      } finally {
        if (previous === undefined) delete process.env.MRS_ENFORCE_RATE_LIMIT_IN_TEST;
        else process.env.MRS_ENFORCE_RATE_LIMIT_IN_TEST = previous;
        resetRateLimitBuckets();
      }
    });

    it('14. mutation routes return 503 and restore in-memory state when atomic persistence fails', async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-route-persistence-'));
      const store = new DataStore({
        filePath: path.join(directory, 'platform-state.json'),
        testMode: false,
        enforceLock: true,
      });
      try {
        const isolatedApp = createApp(store);
        const token = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
        const fileBefore = fs.readFileSync(store.getFilePath(), 'utf8');
        const sku = store.getState().products[0]!.sku;
        const stockBefore = store.getState().products[0]!.inventoryQuantity;
        vi.spyOn(fs, 'renameSync').mockImplementation(() => {
          throw Object.assign(new Error('forced rename failure'), { code: 'EIO' });
        });

        const response = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/inventory/adjust',
          headers: { authorization: `Bearer ${token}` },
          body: { sku, deltaQuantity: 1, movementType: 'ADJUSTMENT', reason: 'forced persistence failure' },
        });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('PERSISTENCE_UNAVAILABLE');
        expect(store.getState().products[0]!.inventoryQuantity).toBe(stockBefore);
        expect(fs.readFileSync(store.getFilePath(), 'utf8')).toBe(fileBefore);
        expect(fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toEqual([]);
      } finally {
        vi.restoreAllMocks();
        store.releaseLock();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('17. email verification: resend cooldown, single-use tokens, expiry and token rotation', async () => {
      const email = `verify-${Date.now()}@example.net`;
      sentVerificationTokens.length = 0;
      const reg = await invokeApp(app, {
        method: 'POST', url: '/api/auth/register',
        body: { firstName: 'Verify', lastName: 'Buyer', email, password: 'StrongPassword#2026' },
      });
      expect(reg.status).toBe(202);
      expect(reg.body.token).toBeUndefined();
      expect(sentVerificationTokens).toHaveLength(1);
      const firstToken = sentVerificationTokens[0]!;

      // Immediate resend is inside the cooldown: generic 202, no new email, token unchanged.
      const resend1 = await invokeApp(app, { method: 'POST', url: '/api/auth/verification/resend', body: { email } });
      expect(resend1.status).toBe(202);
      expect(sentVerificationTokens).toHaveLength(1);

      const customer = dbStore.getState().customers.find((c) => c.email === email)!;
      customer.emailVerificationLastSentAt = new Date(Date.now() - 120_000).toISOString();
      const resend2 = await invokeApp(app, { method: 'POST', url: '/api/auth/verification/resend', body: { email } });
      expect(resend2.status).toBe(202);
      expect(sentVerificationTokens).toHaveLength(2);
      const secondToken = sentVerificationTokens[1]!;

      // Rotated: the first token no longer works.
      const stale = await invokeApp(app, { method: 'POST', url: '/api/auth/verify-email', body: { token: firstToken } });
      expect(stale.status).toBe(400);

      // Unknown account gets the same generic response and no email.
      const unknown = await invokeApp(app, {
        method: 'POST', url: '/api/auth/verification/resend', body: { email: `nobody-${Date.now()}@example.net` },
      });
      expect(unknown.status).toBe(202);
      expect(sentVerificationTokens).toHaveLength(2);

      // Expired token is rejected.
      const savedExpiry = customer.emailVerificationExpiresAt;
      customer.emailVerificationExpiresAt = new Date(Date.now() - 1000).toISOString();
      const expired = await invokeApp(app, { method: 'POST', url: '/api/auth/verify-email', body: { token: secondToken } });
      expect(expired.status).toBe(400);
      customer.emailVerificationExpiresAt = savedExpiry;

      // Valid token verifies once, then cannot be reused.
      const ok = await invokeApp(app, { method: 'POST', url: '/api/auth/verify-email', body: { token: secondToken } });
      expect(ok.status).toBe(200);
      expect(customer.emailVerified).toBe(true);
      expect(customer.emailVerificationTokenHash).toBeUndefined();
      const reuse = await invokeApp(app, { method: 'POST', url: '/api/auth/verify-email', body: { token: secondToken } });
      expect(reuse.status).toBe(400);
    });

    it('18. Shopify webhooks: no built-in secret, raw-body HMAC, required id, idempotent replay', async () => {
      const prior = process.env.SHOPIFY_WEBHOOK_SECRET;
      const payload = Buffer.from(JSON.stringify({ id: 1 }));
      const sign = (secret: string) => crypto.createHmac('sha256', secret).update(payload).digest('base64');
      const send = (headers: Record<string, string>, rawBody: Buffer | null = payload) =>
        invokeApp(app, { method: 'POST', url: '/api/webhooks/shopify', headers, body: { id: 1 }, rawBody: rawBody ?? undefined });
      try {
        delete process.env.SHOPIFY_WEBHOOK_SECRET;
        const unconfigured = await send({
          'x-shopify-hmac-sha256': sign('mrs-dev-shopify-webhook-secret'), 'x-shopify-topic': 'orders/paid', 'x-shopify-webhook-id': 'wh-unconfigured-1',
        });
        expect(unconfigured.status).toBe(503);

        process.env.SHOPIFY_WEBHOOK_SECRET = 'test-only-shopify-webhook-secret';
        const good = { 'x-shopify-hmac-sha256': sign('test-only-shopify-webhook-secret'), 'x-shopify-topic': 'orders/paid' };
        expect((await send({ ...good, 'x-shopify-webhook-id': 'wh-shopify-18-a' }, null)).status).toBe(401);
        expect((await send({ ...good, 'x-shopify-hmac-sha256': sign('wrong-secret-value'), 'x-shopify-webhook-id': 'wh-shopify-18-a' })).status).toBe(401);
        expect((await send(good)).status).toBe(400);

        const before = dbStore.getState().integrationEvents.length;
        const first = await send({ ...good, 'x-shopify-webhook-id': 'wh-shopify-18-a' });
        expect(first.status).toBe(200);
        expect(first.body.duplicate).toBeUndefined();
        const replay = await send({ ...good, 'x-shopify-webhook-id': 'wh-shopify-18-a' });
        expect(replay.status).toBe(200);
        expect(replay.body.duplicate).toBe(true);
        expect(dbStore.getState().integrationEvents.length).toBe(before + 1);
      } finally {
        if (prior === undefined) delete process.env.SHOPIFY_WEBHOOK_SECRET;
        else process.env.SHOPIFY_WEBHOOK_SECRET = prior;
      }
    });

    it('19. Razorpay webhooks: raw-body signature, idempotency, verified capture reconciliation and mismatch isolation', async () => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
      const send = (event: object, eventId: string | undefined, opts: { sign?: boolean; raw?: boolean } = {}) => {
        const raw = Buffer.from(JSON.stringify(event));
        const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
        return invokeApp(app, {
          method: 'POST', url: '/api/webhooks/razorpay',
          headers: {
            ...(opts.sign === false ? { 'x-razorpay-signature': 'bad' } : { 'x-razorpay-signature': signature }),
            ...(eventId ? { 'x-razorpay-event-id': eventId } : {}),
          },
          body: event,
          rawBody: opts.raw === false ? undefined : raw,
        });
      };
      const checkout = await invokeApp(app, {
        method: 'POST', url: '/api/checkout/create-order',
        body: {
          customerEmail: `webhook-${crypto.randomUUID()}@example.net`, customerName: 'Test Buyer', customerPhone: '+91 9800012345',
          shippingAddress: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
          items: [{ sku: 'MRS-PND-4001', quantity: 1 }],
        },
      });
      expect(checkout.status, JSON.stringify(checkout.body)).toBe(201);
      const order = dbStore.getState().orders.find((o) => o.id === checkout.body.order.id)!;
      const entity = (over: object = {}) => ({
        event: 'payment.captured',
        payload: { payment: { entity: {
          id: `pay_wh_${crypto.randomUUID().slice(0, 8)}`, order_id: order.razorpayOrderId,
          amount: Math.round(Number(order.totalPriceInr) * 100), currency: 'INR', status: 'captured', captured: true, method: 'upi', ...over,
        } } },
      });

      expect((await send(entity(), 'evt-razorpay-19-a', { sign: false })).status).toBe(401);
      expect((await send(entity(), 'evt-razorpay-19-a', { raw: false })).status).toBe(401);
      expect((await send(entity(), undefined)).status).toBe(400);

      // Amount mismatch must not change the order.
      const mismatch = await send(entity({ amount: 1 }), 'evt-razorpay-19-mismatch');
      expect(mismatch.status).toBe(200);
      expect(order.financialStatus).toBe('PENDING');
      expect(dbStore.getState().integrationEvents.find((e) => e.eventId === 'evt-razorpay-19-mismatch')?.status).toBe('IGNORED_MISMATCH');

      // Verified capture reconciles exactly once, even across different event ids.
      const paymentsBefore = dbStore.getState().payments.length;
      const capture = entity();
      expect((await send(capture, 'evt-razorpay-19-ok')).status).toBe(200);
      expect(order.financialStatus).toBe('PAID');
      expect(dbStore.getState().payments.length).toBe(paymentsBefore + 1);
      const replay = await send(capture, 'evt-razorpay-19-ok');
      expect(replay.body.duplicate).toBe(true);
      expect((await send(capture, 'evt-razorpay-19-second')).status).toBe(200);
      expect(dbStore.getState().payments.length).toBe(paymentsBefore + 1);
    });

    it('20. admin sessions use HttpOnly cookies with session-bound CSRF protection; Bearer clients are unaffected', async () => {
      const login = await invokeApp(app, {
        method: 'POST', url: '/api/auth/login',
        headers: { origin: 'http://localhost:3001' },
        body: { email: 'owner@mangalroyalstudio.com', password: testSeedAdminPassword('OWNER') },
      });
      expect(login.status).toBe(200);
      const setCookie = String(login.headers['set-cookie']);
      expect(setCookie).toContain('mrs_admin_session=');
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/SameSite=Strict/);
      expect(setCookie).toMatch(/Path=\//);
      const cookie = `mrs_admin_session=${encodeURIComponent(login.body.token)}`;
      const csrfToken = login.body.csrfToken as string;
      expect(csrfToken).toMatch(/^[a-f0-9]{64}$/);

      // Cookie-authenticated reads work without a token header.
      const me = await invokeApp(app, { method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(me.status).toBe(200);
      expect(me.body.csrfToken).toBe(csrfToken);

      const mutate = (headers: Record<string, string>) =>
        invokeApp(app, { method: 'POST', url: '/api/auth/logout', headers: { cookie, ...headers }, body: {} });
      // Missing token, wrong token, missing origin and foreign origin are all rejected.
      expect((await mutate({ origin: 'http://localhost:3001' })).status).toBe(403);
      expect((await mutate({ origin: 'http://localhost:3001', 'x-csrf-token': 'f'.repeat(64) })).status).toBe(403);
      expect((await mutate({ 'x-csrf-token': csrfToken })).status).toBe(403);
      const foreign = await mutate({ origin: 'https://evil.example', 'x-csrf-token': csrfToken });
      expect(foreign.status).toBe(403);
      expect(foreign.body.error).toBe('CSRF_ORIGIN_REJECTED');

      // A CSRF token derived for another session does not work.
      const other = await invokeApp(app, {
        method: 'POST', url: '/api/auth/login', headers: { origin: 'http://localhost:3001' },
        body: { email: 'manager@mangalroyalstudio.com', password: testSeedAdminPassword('MANAGER') },
      });
      if (other.status === 200) {
        expect((await mutate({ origin: 'http://localhost:3001', 'x-csrf-token': other.body.csrfToken })).status).toBe(403);
      }

      // Valid origin + token succeeds and clears the cookie.
      const ok = await mutate({ origin: 'http://localhost:3001', 'x-csrf-token': csrfToken });
      expect(ok.status).toBe(200);
      expect(String(ok.headers['set-cookie'])).toMatch(/mrs_admin_session=; .*Max-Age=0/);

      // Login from a foreign origin is refused, and Bearer clients need no CSRF token.
      const foreignLogin = await invokeApp(app, {
        method: 'POST', url: '/api/auth/login', headers: { origin: 'https://evil.example' },
        body: { email: 'owner@mangalroyalstudio.com', password: testSeedAdminPassword('OWNER') },
      });
      expect(foreignLogin.status).toBe(403);
      const bearer = await invokeApp(app, {
        method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${login.body.token}` }, body: {},
      });
      expect(bearer.status).toBe(200);
    });

    it('21. production cookies are Secure and customer sessions work via cookie', async () => {
      const prior = process.env.NODE_ENV;
      const customer = dbStore.getState().customers.find((entry) => entry.email === 'ananya.sharma@example.com')!;
      const priorVerified = customer.emailVerified;
      customer.emailVerified = true;
      try {
        const token = signCustomerToken({ id: customer.id, email: customer.email });
        process.env.NODE_ENV = 'production';
        const res = { setHeader: vi.fn(), getHeader: vi.fn() } as any;
        issueSessionCookie(res, 'customer', token);
        const header = (res.setHeader.mock.calls[0][1] as string[])[0]!;
        expect(header).toMatch(/; Secure/);
        expect(header).toMatch(/HttpOnly/);
        expect(header).toMatch(/SameSite=Lax/);
        process.env.NODE_ENV = prior;

        const orders = await invokeApp(app, {
          method: 'GET', url: '/api/customer/orders', headers: { cookie: `mrs_customer_session=${token}` },
        });
        expect(orders.status).toBe(200);
        // A customer cookie cannot reach admin endpoints.
        const admin = await invokeApp(app, {
          method: 'GET', url: '/api/auth/me', headers: { cookie: `mrs_admin_session=${token}` },
        });
        expect(admin.status).toBe(401);
      } finally {
        process.env.NODE_ENV = prior;
        customer.emailVerified = priorVerified;
      }
    });

    it('15. a successful audited mutation persists business change and audit entry in one write; a failed one rolls back both', async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-atomic-audit-'));
      const store = new DataStore({
        filePath: path.join(directory, 'platform-state.json'),
        testMode: false,
        enforceLock: true,
      });
      try {
        const isolatedApp = createApp(store);
        const token = await loginAs('owner@mangalroyalstudio.com', testSeedAdminPassword('OWNER'));
        const sku = store.getState().products[0]!.sku;
        const stockBefore = store.getState().products[0]!.inventoryQuantity;
        const auditsBefore = store.getState().auditLogs.length;
        const adjust = () =>
          invokeApp(isolatedApp, {
            method: 'POST',
            url: '/api/admin/inventory/adjust',
            headers: { authorization: `Bearer ${token}` },
            body: { sku, deltaQuantity: 1, movementType: 'ADJUSTMENT', reason: 'atomic audit test' },
          });

        const ok = await adjust();
        expect(ok.status).toBeLessThan(300);
        const onDisk = JSON.parse(fs.readFileSync(store.getFilePath(), 'utf8'));
        expect(onDisk.products[0].inventoryQuantity).toBe(stockBefore + 1);
        expect(onDisk.auditLogs.length).toBeGreaterThan(auditsBefore);

        const diskBeforeFailure = fs.readFileSync(store.getFilePath(), 'utf8');
        const auditsAfterOk = store.getState().auditLogs.length;
        vi.spyOn(fs, 'renameSync').mockImplementation(() => {
          throw Object.assign(new Error('forced rename failure'), { code: 'EIO' });
        });
        const failed = await adjust();
        expect(failed.status).toBe(503);
        expect(store.getState().products[0]!.inventoryQuantity).toBe(stockBefore + 1);
        expect(store.getState().auditLogs.length).toBe(auditsAfterOk);
        expect(fs.readFileSync(store.getFilePath(), 'utf8')).toBe(diskBeforeFailure);
      } finally {
        vi.restoreAllMocks();
        store.releaseLock();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('16. GET /api/cart/:cartId never writes to disk', async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-cart-read-'));
      const store = new DataStore({
        filePath: path.join(directory, 'platform-state.json'),
        testMode: false,
        enforceLock: true,
      });
      try {
        const isolatedApp = createApp(store);
        const before = fs.readFileSync(store.getFilePath(), 'utf8');
        const renameSpy = vi.spyOn(fs, 'renameSync');
        const response = await invokeApp(isolatedApp, { method: 'GET', url: '/api/cart/read-only-cart' });
        expect(response.status).toBe(200);
        expect(renameSpy).not.toHaveBeenCalled();
        expect(fs.readFileSync(store.getFilePath(), 'utf8')).toBe(before);
      } finally {
        vi.restoreAllMocks();
        store.releaseLock();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  });

  describe('Diamond Rate Matrix boundary & overlap enforcement', () => {
    it('enforces OWNER RBAC, rejects invalid min>=max (400), rejects 1.0000ct and overlapping slabs (409), and supports PATCH lifecycle', async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-diamond-matrix-'));
      const store = new DataStore({
        filePath: path.join(directory, 'platform-state.json'),
        testMode: true,
        enforceLock: false,
      });
      try {
        const isolatedApp = createApp(store);
        const ownerLogin = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/auth/login',
          body: { email: 'owner@mangalroyalstudio.com', password: testSeedAdminPassword('OWNER') },
        });
        expect(ownerLogin.status).toBe(200);
        const ownerToken = ownerLogin.body.token as string;

        const opsLogin = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/auth/login',
          body: { email: 'manager@mangalroyalstudio.com', password: testSeedAdminPassword('MANAGER') },
        });
        expect(opsLogin.status).toBe(200);
        const opsToken = opsLogin.body.token as string;

        // Non-OWNER rejected with 403
        const forbiddenCreate = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${opsToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Under 1.00 ct',
            sizeMinCarat: '0',
            sizeMaxCarat: '1',
            minInclusive: false,
            maxInclusive: false,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '32000',
            isActive: true,
          },
        });
        expect(forbiddenCreate.status).toBe(403);

        // min >= max rejected with 400
        const badRange = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${ownerToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Invalid Range',
            sizeMinCarat: '2',
            sizeMaxCarat: '1',
            minInclusive: false,
            maxInclusive: true,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '32000',
          },
        });
        expect(badRange.status).toBe(400);

        // Slab covering exact 1.0000 ct rejected with 409
        const coversOneCt = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${ownerToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Covers 1ct',
            sizeMinCarat: '0.5',
            sizeMaxCarat: '2',
            minInclusive: true,
            maxInclusive: true,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '32000',
          },
        });
        expect(coversOneCt.status).toBe(409);

        // Create valid < 1.0000 ct slab (> 0 to < 1)
        const createUnder = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${ownerToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Above 0 ct to Below 1.0000 ct',
            sizeMinCarat: '0',
            sizeMaxCarat: '1',
            minInclusive: false,
            maxInclusive: false,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '30000',
          },
        });
        expect(createUnder.status).toBe(200);
        const underId = createUnder.body.diamondRate.id as string;

        // Overlapping active slab rejected with 409
        const overlapCreate = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${ownerToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Overlapping',
            sizeMinCarat: '0.5',
            sizeMaxCarat: '0.9',
            minInclusive: true,
            maxInclusive: true,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '29000',
          },
        });
        expect(overlapCreate.status).toBe(409);

        // Create valid > 1.0000 ct slab (> 1 to <= 5)
        const createOver = await invokeApp(isolatedApp, {
          method: 'POST',
          url: '/api/admin/rates/diamonds',
          headers: { authorization: `Bearer ${ownerToken}` },
          body: {
            shape: 'PRINCESS',
            sieveRange: 'Above 1.0000 ct to 5.0000 ct',
            sizeMinCarat: '1',
            sizeMaxCarat: '5',
            minInclusive: false,
            maxInclusive: true,
            colorGrade: 'EF',
            clarityGrade: 'VVS',
            cutGrade: 'EXCELLENT',
            pricingType: 'PER_CARAT',
            rateInr: '45000',
          },
        });
        expect(createOver.status).toBe(200);
        const overId = createOver.body.diamondRate.id as string;

        // Non-OWNER PATCH rejected with 403
        const forbiddenPatch = await invokeApp(isolatedApp, {
          method: 'PATCH',
          url: `/api/admin/rates/diamonds/${overId}`,
          headers: { authorization: `Bearer ${opsToken}` },
          body: { isActive: false },
        });
        expect(forbiddenPatch.status).toBe(403);

        // PATCH overId into 1.0000 ct rejected with 409
        const patchCoversOne = await invokeApp(isolatedApp, {
          method: 'PATCH',
          url: `/api/admin/rates/diamonds/${overId}`,
          headers: { authorization: `Bearer ${ownerToken}` },
          body: { minInclusive: true },
        });
        expect(patchCoversOne.status).toBe(409);

        // PATCH overId into overlapping range rejected with 409
        const patchOverlap = await invokeApp(isolatedApp, {
          method: 'PATCH',
          url: `/api/admin/rates/diamonds/${overId}`,
          headers: { authorization: `Bearer ${ownerToken}` },
          body: { sizeMinCarat: '0.5', sizeMaxCarat: '0.9', minInclusive: true, maxInclusive: true },
        });
        expect(patchOverlap.status).toBe(409);

        // Deactivate and re-activate underId via PATCH
        const deactivate = await invokeApp(isolatedApp, {
          method: 'PATCH',
          url: `/api/admin/rates/diamonds/${underId}`,
          headers: { authorization: `Bearer ${ownerToken}` },
          body: { isActive: false },
        });
        expect(deactivate.status).toBe(200);
        expect(deactivate.body.diamondRate.isActive).toBe(false);

        const reactivate = await invokeApp(isolatedApp, {
          method: 'PATCH',
          url: `/api/admin/rates/diamonds/${underId}`,
          headers: { authorization: `Bearer ${ownerToken}` },
          body: { isActive: true, rateInr: '31000' },
        });
        expect(reactivate.status).toBe(200);
        expect(reactivate.body.diamondRate.isActive).toBe(true);
        expect(reactivate.body.diamondRate.rateInr).toBe('31000.00');
      } finally {
        store.releaseLock();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  });
});
