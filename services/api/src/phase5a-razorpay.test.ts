import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import { dbStore } from './store/data-store.js';
import { resetRateLimitBuckets } from './middleware/auth.js';
import {
  assertRazorpayTestMode,
  buildRazorpayReceipt,
  inrToPaise,
  redactRazorpayError,
  validateRazorpayConfig,
} from './services/razorpay-service.js';

interface InvokeResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: any;
  text: string;
}

function invokeApp(
  app: ReturnType<typeof createApp>,
  opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: Buffer;
  }
): Promise<InvokeResponse> {
  return new Promise((resolve, reject) => {
    const reqHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...Object.fromEntries(
        Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      ),
    };
    const reqEmitter = new EventEmitter() as any;
    reqEmitter.method = opts.method.toUpperCase();
    reqEmitter.url = opts.url;
    reqEmitter.originalUrl = opts.url;
    reqEmitter.headers = reqHeaders;
    reqEmitter.socket = { remoteAddress: '127.0.0.1' };
    reqEmitter.ip = '127.0.0.1';
    reqEmitter.body = opts.body;
    reqEmitter.rawBody = opts.rawBody;
    reqEmitter._body = opts.body !== undefined;
    reqEmitter.get = (name: string) => reqHeaders[name.toLowerCase()];
    reqEmitter.header = reqEmitter.get;

    const resHeaders: Record<string, string | string[]> = {};
    const chunks: Buffer[] = [];
    const resEmitter = new EventEmitter() as any;
    resEmitter.statusCode = 200;
    resEmitter.headersSent = false;
    resEmitter.locals = {};
    resEmitter.status = (code: number) => {
      resEmitter.statusCode = code;
      return resEmitter;
    };
    resEmitter.setHeader = (name: string, val: string | string[]) => {
      resHeaders[name.toLowerCase()] = val;
    };
    resEmitter.getHeader = (name: string) => resHeaders[name.toLowerCase()];
    resEmitter.removeHeader = (name: string) => {
      delete resHeaders[name.toLowerCase()];
    };
    resEmitter.set = (name: string, val: string | string[]) => {
      resEmitter.setHeader(name, val);
      return resEmitter;
    };
    resEmitter.json = (data: unknown) => {
      if (!resHeaders['content-type']) {
        resHeaders['content-type'] = 'application/json; charset=utf-8';
      }
      resEmitter.end(JSON.stringify(data));
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
      resolve({ status: resEmitter.statusCode, headers: resHeaders, body: parsedBody, text });
      return resEmitter;
    };

    try {
      (app as any).handle(reqEmitter, resEmitter, (err?: Error) => {
        if (err) reject(err);
        else if (!resEmitter.headersSent) resEmitter.status(404).end();
      });
    } catch (err) {
      reject(err);
    }
  });
}

describe('Phase 5A: Razorpay Payment Gateway Integration (Test Mode Only)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-phase5a-'));
  const tempDataFile = path.join(tempDir, 'platform-state.json');
  const priorEnv = new Map<string, string | undefined>();
  const providerOrders = new Map<string, { amount: number; currency: string; status: string }>();
  let latestProviderOrderId = '';
  let mockOrderStatus = 'paid';
  let mockPaymentStatus = 'captured';
  let mockPaymentCaptured = true;
  let mockPaymentAmountOffset = 0;
  let mockPaymentCurrency = 'INR';
  let mockCreateOrderFails = false;
  let originalFetch: typeof fetch;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    for (const key of [
      'NODE_ENV',
      'JWT_SECRET',
      'MRS_DATA_FILE_PATH',
      'RAZORPAY_MODE',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ]) {
      priorEnv.set(key, process.env[key]);
    }

    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'phase5a-test-only-jwt-secret-that-is-32-chars';
    process.env.MRS_DATA_FILE_PATH = tempDataFile;
    process.env.RAZORPAY_MODE = 'test';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mrs_phase5a';
    process.env.RAZORPAY_KEY_SECRET = 'phase5a-test-key-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'phase5a-test-webhook-secret';

    app = createApp();
    originalFetch = globalThis.fetch;

    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.razorpay.com/v1/orders' && init?.method === 'POST') {
        if (mockCreateOrderFails) {
          return new Response('{"error":{"description":"Provider error"}}', { status: 502 });
        }
        const body = JSON.parse(String(init.body || '{}')) as {
          amount: number;
          currency: string;
          receipt: string;
        };
        const id = `order_p5a_${crypto.randomBytes(6).toString('hex')}`;
        providerOrders.set(id, { amount: body.amount, currency: body.currency, status: 'created' });
        latestProviderOrderId = id;
        return new Response(
          JSON.stringify({
            id,
            amount: body.amount,
            amount_paid: 0,
            amount_due: body.amount,
            currency: body.currency,
            receipt: body.receipt,
            status: 'created',
          }),
          { status: 200 }
        );
      }

      if (url.startsWith('https://api.razorpay.com/v1/orders/')) {
        const orderId = decodeURIComponent(url.split('/').pop() || '');
        const entry = providerOrders.get(orderId);
        if (!entry) return new Response('{}', { status: 404 });
        const paid = mockOrderStatus === 'paid';
        return new Response(
          JSON.stringify({
            id: orderId,
            amount: entry.amount,
            amount_paid: paid ? entry.amount : 0,
            amount_due: paid ? 0 : entry.amount,
            currency: entry.currency,
            status: mockOrderStatus,
          }),
          { status: 200 }
        );
      }

      if (url.startsWith('https://api.razorpay.com/v1/payments/')) {
        const paymentId = decodeURIComponent(url.split('/').pop() || '');
        const entry = providerOrders.get(latestProviderOrderId);
        if (!entry) return new Response('{}', { status: 404 });
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: latestProviderOrderId,
            amount: entry.amount + mockPaymentAmountOffset,
            currency: mockPaymentCurrency,
            status: mockPaymentStatus,
            captured: mockPaymentCaptured,
            method: 'upi',
            error_description: mockPaymentStatus === 'failed' ? 'Insufficient funds' : null,
          }),
          { status: 200 }
        );
      }

      return new Response('{}', { status: 503 });
    });
  });

  afterAll(() => {
    vi.stubGlobal('fetch', originalFetch);
    for (const [key, value] of priorEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    resetRateLimitBuckets();
    mockOrderStatus = 'paid';
    mockPaymentStatus = 'captured';
    mockPaymentCaptured = true;
    mockPaymentAmountOffset = 0;
    mockPaymentCurrency = 'INR';
    mockCreateOrderFails = false;
  });

  it('1. validates Razorpay test-mode configuration, rejects live mode/keys, converts INR to paise, and redacts secrets', () => {
    const valid = validateRazorpayConfig({
      RAZORPAY_MODE: 'test',
      RAZORPAY_KEY_ID: 'rzp_test_1234567890',
      RAZORPAY_KEY_SECRET: 'secret_abc',
      RAZORPAY_WEBHOOK_SECRET: 'whsec_xyz',
    });
    expect(valid.mode).toBe('test');
    expect(valid.configured).toBe(true);
    expect(valid.webhookConfigured).toBe(true);

    expect(() =>
      assertRazorpayTestMode({ RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_test_123' })
    ).toThrow(/RAZORPAY_MODE="live" is rejected/);
    expect(() =>
      assertRazorpayTestMode({ RAZORPAY_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_live_123' })
    ).toThrow(/rzp_live_/);

    expect(inrToPaise('149999.00')).toBe(14999900);
    expect(inrToPaise(100.5)).toBe(10050);
    expect(() => inrToPaise(0)).toThrow();
    expect(buildRazorpayReceipt('MRS-LONG-ORDER-NUMBER-1234567890-EXTRA').length).toBeLessThanOrEqual(40);

    const redacted = redactRazorpayError(
      new Error('Failed with rzp_test_SecretKey123 and Basic dXNlcjpwYXNz')
    );
    expect(redacted).not.toContain('rzp_test_SecretKey123');
    expect(redacted).not.toContain('dXNlcjpwYXNz');
    expect(redacted).toContain('rzp_***');
    expect(redacted).toContain('Basic ***');
  });

  it('2. calculates server-side amount in paise, enforces idempotencyKey, and handles Razorpay order failure safely', async () => {
    const prod = dbStore.getState().products.find((p) => p.inventoryQuantity >= 2)!;
    const stockBefore = prod.inventoryQuantity;

    mockCreateOrderFails = true;
    const failRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'buyer5a@example.com',
        customerName: 'Aarav Mehta',
        customerPhone: '+91 9820012345',
        shippingAddress: { line1: '12 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400020' },
        items: [{ sku: prod.sku, quantity: 1 }],
        paymentMethod: 'RAZORPAY',
        idempotencyKey: `idem-fail-${crypto.randomUUID()}`,
      },
    });
    expect(failRes.status).toBe(503);
    expect(failRes.body.error).toBe('PAYMENT_UNAVAILABLE');
    expect(prod.inventoryQuantity).toBe(stockBefore);

    mockCreateOrderFails = false;
    const idemKey = `idem-ok-${crypto.randomUUID()}`;
    const payload = {
      customerEmail: 'buyer5a@example.com',
      customerName: 'Aarav Mehta',
      customerPhone: '+91 9820012345',
      shippingAddress: { line1: '12 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400020' },
      items: [{ sku: prod.sku, quantity: 1 }],
      paymentMethod: 'RAZORPAY',
      idempotencyKey: idemKey,
    };
    const first = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: payload,
    });
    expect(first.status).toBe(201);
    expect(first.body.razorpayOrder.amountPaise).toBe(Math.round(Number(prod.currentShopifyPriceInr) * 100));
    expect(first.body.razorpayOrder.currency).toBe('INR');
    expect(prod.inventoryQuantity).toBe(stockBefore - 1);

    const retry = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: payload,
    });
    expect(retry.status).toBe(200);
    expect(retry.body.idempotent).toBe(true);
    expect(retry.body.order.id).toBe(first.body.order.id);
    expect(prod.inventoryQuantity).toBe(stockBefore - 1);
  });

  it('3. verifies callback signature, order status, ownership, authorized-not-captured, and payment retry', async () => {
    const prod = dbStore.getState().products.find((p) => p.inventoryQuantity >= 2)!;
    const checkout = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'verify5a@example.com',
        customerName: 'Diya Kapoor',
        customerPhone: '+91 9820099999',
        shippingAddress: { line1: '88 Pedder Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400026' },
        items: [{ sku: prod.sku, quantity: 1 }],
        paymentMethod: 'RAZORPAY',
      },
    });
    expect(checkout.status).toBe(201);
    const { order, orderAccessToken, razorpayOrder } = checkout.body;

    const retryOrderRes = await invokeApp(app, {
      method: 'POST',
      url: `/api/v1/checkout/orders/${order.id}/razorpay-order`,
      body: { orderAccessToken },
    });
    expect(retryOrderRes.status).toBe(200);
    const freshRzpOrderId = retryOrderRes.body.razorpayOrder.id as string;
    expect(freshRzpOrderId).not.toBe(razorpayOrder.id);

    const badTokenRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/payments/razorpay/verify',
      body: {
        orderId: order.id,
        razorpayOrderId: freshRzpOrderId,
        razorpayPaymentId: 'pay_p5a_unauth',
        razorpaySignature: 'bad',
        orderAccessToken: 'invalid-token',
      },
    });
    expect(badTokenRes.status).toBe(403);
    expect(badTokenRes.body.error).toBe('INVALID_ORDER_ACCESS_TOKEN');

    const paymentId = `pay_p5a_${crypto.randomBytes(4).toString('hex')}`;
    const validSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${freshRzpOrderId}|${paymentId}`)
      .digest('hex');

    mockPaymentStatus = 'authorized';
    mockPaymentCaptured = false;
    mockOrderStatus = 'attempted';
    const authOnlyRes = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/payments/razorpay/verify',
      body: {
        orderId: order.id,
        razorpayOrderId: freshRzpOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        orderAccessToken,
      },
    });
    expect(authOnlyRes.status).toBe(409);
    expect(authOnlyRes.body.error).toBe('PAYMENT_NOT_CAPTURED');
    expect(dbStore.getState().orders.find((o) => o.id === order.id)!.financialStatus).toBe('PENDING');

    mockPaymentStatus = 'captured';
    mockPaymentCaptured = true;
    mockOrderStatus = 'paid';
    const verifyOk = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/payments/razorpay/verify',
      body: {
        orderId: order.id,
        razorpayOrderId: freshRzpOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        orderAccessToken,
      },
    });
    expect(verifyOk.status).toBe(200);
    expect(verifyOk.body.verified).toBe(true);
    expect(verifyOk.body.order.financialStatus).toBe('PAID');

    const retryAfterPaid = await invokeApp(app, {
      method: 'POST',
      url: `/api/v1/checkout/orders/${order.id}/razorpay-order`,
      body: { orderAccessToken },
    });
    expect(retryAfterPaid.status).toBe(409);
  });

  it('4. processes payment.failed, order.paid, duplicate webhooks, and prevents downgrading a PAID order', async () => {
    const prod = dbStore.getState().products.find((p) => p.inventoryQuantity >= 2)!;
    const checkout = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'webhook5a@example.com',
        customerName: 'Kabir Shah',
        customerPhone: '+91 9820077777',
        shippingAddress: { line1: '5 Worli Sea Face', city: 'Mumbai', state: 'Maharashtra', pincode: '400018' },
        items: [{ sku: prod.sku, quantity: 1 }],
        paymentMethod: 'RAZORPAY',
      },
    });
    expect(checkout.status).toBe(201);
    const { order, razorpayOrder } = checkout.body;
    const whSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    const signAndSend = (payload: object, eventId: string) => {
      const raw = Buffer.from(JSON.stringify(payload));
      const sig = crypto.createHmac('sha256', whSecret).update(raw).digest('hex');
      return invokeApp(app, {
        method: 'POST',
        url: '/api/v1/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': sig,
          'x-razorpay-event-id': eventId,
        },
        body: payload,
        rawBody: raw,
      });
    };

    const failedEvent = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `pay_fail_${crypto.randomBytes(4).toString('hex')}`,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amountPaise,
            currency: 'INR',
            status: 'failed',
            method: 'card',
            error_description: 'Card declined',
          },
        },
      },
    };
    const failWhRes = await signAndSend(failedEvent, `evt-p5a-fail-${crypto.randomBytes(4).toString('hex')}`);
    expect(failWhRes.status).toBe(200);
    expect(dbStore.getState().orders.find((o) => o.id === order.id)!.financialStatus).toBe('PENDING');

    const orderPaidEvent = {
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amountPaise,
            amount_paid: razorpayOrder.amountPaise,
            currency: 'INR',
            status: 'paid',
          },
        },
        payment: {
          entity: {
            id: `pay_op_${crypto.randomBytes(4).toString('hex')}`,
            method: 'netbanking',
          },
        },
      },
    };
    const opEventId = `evt-p5a-op-${crypto.randomBytes(4).toString('hex')}`;
    const opRes = await signAndSend(orderPaidEvent, opEventId);
    expect(opRes.status).toBe(200);
    expect(dbStore.getState().orders.find((o) => o.id === order.id)!.financialStatus).toBe('PAID');

    const opDupRes = await signAndSend(orderPaidEvent, opEventId);
    expect(opDupRes.status).toBe(200);
    expect(opDupRes.body.duplicate).toBe(true);

    const delayedFailRes = await signAndSend(
      failedEvent,
      `evt-p5a-delayed-fail-${crypto.randomBytes(4).toString('hex')}`
    );
    expect(delayedFailRes.status).toBe(200);
    expect(dbStore.getState().orders.find((o) => o.id === order.id)!.financialStatus).toBe('PAID');
  });

  it('5. handles callback and webhook race condition with at most one captured payment record', async () => {
    const prod = dbStore.getState().products.find((p) => p.inventoryQuantity >= 2)!;
    const checkout = await invokeApp(app, {
      method: 'POST',
      url: '/api/v1/checkout/create-order',
      body: {
        customerEmail: 'race5a@example.com',
        customerName: 'Rohan Joshi',
        customerPhone: '+91 9820055555',
        shippingAddress: { line1: '10 Pali Hill', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        items: [{ sku: prod.sku, quantity: 1 }],
        paymentMethod: 'RAZORPAY',
      },
    });
    expect(checkout.status).toBe(201);
    const { order, orderAccessToken, razorpayOrder } = checkout.body;
    const paymentId = `pay_race_${crypto.randomBytes(4).toString('hex')}`;
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrder.id}|${paymentId}`)
      .digest('hex');

    const whBody = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amountPaise,
            currency: 'INR',
            status: 'captured',
            captured: true,
            method: 'upi',
          },
        },
      },
    };
    const whRaw = Buffer.from(JSON.stringify(whBody));
    const whSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(whRaw)
      .digest('hex');

    const [verifyRes, whRes] = await Promise.all([
      invokeApp(app, {
        method: 'POST',
        url: '/api/v1/payments/razorpay/verify',
        body: {
          orderId: order.id,
          razorpayOrderId: razorpayOrder.id,
          razorpayPaymentId: paymentId,
          razorpaySignature: sig,
          orderAccessToken,
        },
      }),
      invokeApp(app, {
        method: 'POST',
        url: '/api/v1/webhooks/razorpay',
        headers: {
          'x-razorpay-signature': whSig,
          'x-razorpay-event-id': `evt-race-${crypto.randomBytes(4).toString('hex')}`,
        },
        body: whBody,
        rawBody: whRaw,
      }),
    ]);

    expect(verifyRes.status).toBe(200);
    expect(whRes.status).toBe(200);
    const orderPayments = dbStore
      .getState()
      .payments.filter((p) => p.orderId === order.id && p.status === 'CAPTURED');
    expect(orderPayments).toHaveLength(1);
    expect(dbStore.getState().orders.find((o) => o.id === order.id)!.financialStatus).toBe('PAID');
  });
});
