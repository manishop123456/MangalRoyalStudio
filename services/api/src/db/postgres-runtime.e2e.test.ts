import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../app.js';
import { ensurePostgresStartup, resolveDataBackendMode } from './backend.js';
import { checkDatabaseConnection } from './prisma.js';
import { createTemporaryPostgresAdmin } from '../test-support/test-credentials.js';

const DEV_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://macbook@localhost:5432/mangal_royal_studio_dev?schema=public';

describe('PostgreSQL HTTP Runtime E2E & Security Verification (Phase 1 Closure)', () => {
  let prisma: PrismaClient;
  // Temporary admin with a random password (never a real account's password); removed in afterAll.
  let tempAdmin: Awaited<ReturnType<typeof createTemporaryPostgresAdmin>> | null = null;
  const ensureTempAdmin = async () => (tempAdmin ??= await createTemporaryPostgresAdmin(prisma, 'OWNER'));
  let dbReachable = false;
  let app: ReturnType<typeof createApp>;

  const testSku = `TEST-P1-${Date.now()}`;
  const testEmail = `test-p1-${Date.now()}@example.com`;
  const testCartId = `test-p1-cart-${Date.now()}`;
  const testWebhookId = `test-p1-wh-${Date.now()}`;

  const createdCustomerIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdRunIds: string[] = [];
  const createdMetalRateIds: string[] = [];

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-p1-jwt-secret-key-32-chars-min';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'test-p1-shopify-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-p1-razorpay-secret';
    process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'concierge@mangalroyalstudio.com';
    process.env.STOREFRONT_PUBLIC_URL = process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3000';

    prisma = new PrismaClient({
      datasources: { db: { url: DEV_DB_URL } },
    });

    const health = await checkDatabaseConnection(prisma);
    dbReachable = health.ok;
    if (dbReachable) {
      app = createApp({ backend: 'postgres', prisma });
    }
  });

  afterAll(async () => {
    await tempAdmin?.cleanup().catch(() => undefined);
    if (dbReachable) {
      // Clean up ONLY isolated test-created records; never touch imported business data or TEST-ORD-* rows.
      try {
        if (createdOrderIds.length > 0) {
          await prisma.refundRecord.deleteMany({ where: { orderMetadataId: { in: createdOrderIds } } });
          await prisma.paymentRecord.deleteMany({ where: { orderMetadataId: { in: createdOrderIds } } });
          await prisma.shipment.deleteMany({ where: { orderMetadataId: { in: createdOrderIds } } });
          await prisma.orderItem.deleteMany({ where: { orderMetadataId: { in: createdOrderIds } } });
          await prisma.orderMetadata.deleteMany({ where: { id: { in: createdOrderIds } } });
        }
        await prisma.inventoryMovement.deleteMany({ where: { sku: testSku } });
        await prisma.pricingSnapshot.deleteMany({
          where: {
            OR: [
              { sku: testSku },
              ...(createdRunIds.length > 0 ? [{ pricingRunId: { in: createdRunIds } }] : []),
            ],
          },
        });
        if (createdRunIds.length > 0) {
          await prisma.pricingRun.deleteMany({ where: { id: { in: createdRunIds } } });
        }
        if (createdMetalRateIds.length > 0) {
          await prisma.goldRate.deleteMany({ where: { id: { in: createdMetalRateIds } } });
        }
        if (createdProductIds.length > 0) {
          await prisma.productMetadata.deleteMany({ where: { id: { in: createdProductIds } } });
        } else {
          await prisma.productMetadata.deleteMany({ where: { sku: testSku } });
        }
        await prisma.cart.deleteMany({ where: { id: testCartId } });
        if (createdCustomerIds.length > 0) {
          await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
        } else {
          await prisma.customer.deleteMany({ where: { email: testEmail } });
        }
        await prisma.integrationEvent.deleteMany({ where: { eventId: testWebhookId } });
        await prisma.notification.deleteMany({ where: { recipientEmail: testEmail } });
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { entityId: testSku },
              { summary: { contains: testSku } },
              { summary: { contains: testEmail } },
              { entityId: { in: [...createdOrderIds, ...createdProductIds, ...createdRunIds, ...createdMetalRateIds, ...createdCustomerIds] } },
            ],
          },
        });
      } finally {
        await prisma.$disconnect();
      }
    } else if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
    process.env = originalEnv;
  });

  it('1. resolves DATA_BACKEND safely and fails closed on invalid mode or unreachable PostgreSQL', async () => {
    expect(resolveDataBackendMode({ DATA_BACKEND: 'json' })).toBe('json');
    expect(resolveDataBackendMode({ DATA_BACKEND: 'postgres' })).toBe('postgres');
    expect(() => resolveDataBackendMode({ DATA_BACKEND: 'sqlite' })).toThrow(/INVALID_DATA_BACKEND/);

    const savedDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(ensurePostgresStartup('')).rejects.toThrow(/POSTGRES_STARTUP_FAILED/);
    if (savedDbUrl) process.env.DATABASE_URL = savedDbUrl;

    if (!dbReachable) {
      console.warn('Skipping unreachable-DB startup check in sandbox');
      return;
    }

    await expect(
      ensurePostgresStartup('postgresql://macbook@localhost:5439/nonexistent_db?schema=public')
    ).rejects.toThrow(/POSTGRES_STARTUP_FAILED/);

    const info = await ensurePostgresStartup(DEV_DB_URL);
    expect(info.version).toContain('PostgreSQL');
  });

  it('2. GET /health and GET /api/products read live PostgreSQL data including MRS-EAR-2001 = 9', async () => {
    if (!dbReachable) return;

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.backend).toBe('postgres');
    expect(healthRes.body.counts.products).toBeGreaterThanOrEqual(8);
    expect(healthRes.body.counts.orders).toBeGreaterThanOrEqual(3);

    const prodRes = await request(app).get('/api/products?limit=50');
    expect(prodRes.status).toBe(200);
    const ear2001 = (prodRes.body.products as Array<{ sku: string; inventoryQuantity: number }>).find(
      (p) => p.sku === 'MRS-EAR-2001'
    );
    expect(ear2001).toBeDefined();
    expect(ear2001?.inventoryQuantity).toBe(9);
  });

  it('3. enforces HttpOnly cookie + CSRF + RBAC + transactional inventory + pricing run lifecycle in PostgreSQL', async () => {
    if (!dbReachable) return;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: (await ensureTempAdmin()).email, password: (await ensureTempAdmin()).password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.csrfToken).toBeTruthy();
    const cookies = (loginRes.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies.some((c) => c.includes('mrs_admin_session=') && c.includes('HttpOnly'))).toBe(true);

    // Cookie request without CSRF header must fail closed with 403
    const missingCsrf = await request(app)
      .post('/api/admin/inventory/adjust')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .send({ sku: 'MRS-EAR-2001', quantityDelta: 1, reason: 'No CSRF' });
    expect(missingCsrf.status).toBe(403);

    // Create isolated test product via PostgreSQL backend
    const createProdRes = await request(app)
      .post('/api/admin/products')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({
        sku: testSku,
        title: `Test Ring ${testSku}`,
        category: 'Rings',
        metalType: 'GOLD',
        metalPurity: '18K',
        metalColor: 'ROSE_GOLD',
        grossWeightGrams: '4.500',
        netMetalWeightGrams: '4.200',
        makingChargeMode: 'PER_GRAM_NET',
        makingChargeValue: '1250',
        inventoryQuantity: 5,
        currentPriceInr: '55000.00',
      });
    expect(createProdRes.status).toBe(201);
    createdProductIds.push(createProdRes.body.product.id);

    // Adjust inventory atomically
    const adjustRes = await request(app)
      .post('/api/admin/inventory/adjust')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({ sku: testSku, deltaQuantity: -2, reason: 'Phase 1 E2E test adjustment' });
    expect(adjustRes.status).toBe(200);
    expect(adjustRes.body.previousQuantity).toBe(5);
    expect(adjustRes.body.inventoryQuantity).toBe(3);

    // 24K is blocked pending owner confirmation; 18K rate update succeeds
    const blocked24kRes = await request(app)
      .post('/api/admin/rates/metals')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({
        metalType: 'GOLD',
        purity: '24K',
        ratePerGramInr: 15400,
        source: 'TEST_P1_E2E',
      });
    expect(blocked24kRes.status).toBe(409);

    const rateRes = await request(app)
      .post('/api/admin/rates/metals')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({
        metalType: 'GOLD',
        purity: '18K',
        ratePerGramInr: 12300,
        source: 'TEST_P1_E2E',
        isPlaceholder: false, // a confirmed (non-placeholder) rate; placeholder rates never price (fail-closed)
      });
    expect(rateRes.status).toBe(200);
    createdMetalRateIds.push(rateRes.body.metalRate.id);

    const previewRes = await request(app)
      .post('/api/admin/pricing/preview')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({ skus: [testSku], notes: 'Phase 1 E2E pricing test' });
    expect(previewRes.status).toBe(201);
    const runId = previewRes.body.pricingRun.id as string;
    createdRunIds.push(runId);
    expect(previewRes.body.pricingRun.status).toBe('PREVIEWED');

    const validateRes = await request(app)
      .post(`/api/admin/pricing/runs/${runId}/validate`)
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({});
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.pricingRun.status).toBe('VALIDATED');

    const approveRes = await request(app)
      .post(`/api/admin/pricing/runs/${runId}/approve`)
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.pricingRun.status).toBe('APPROVED');

    const publishRes = await request(app)
      .post(`/api/admin/pricing/runs/${runId}/publish`)
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', loginRes.body.csrfToken)
      .send({});
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.pricingRun.status).toBe('PUBLISHED');
    const snapCount = await prisma.pricingSnapshot.count({ where: { pricingRunId: runId } });
    expect(snapCount).toBeGreaterThanOrEqual(1);
  });

  it('4. executes customer verification, transactional checkout stock reservation, and cancellation restock in PostgreSQL', async () => {
    if (!dbReachable) return;

    let capturedVerifyUrl = '';
    const originalFetch = globalThis.fetch;
    process.env.RESEND_API_KEY = 're_test_p1_key';
    globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      if (typeof init?.body === 'string') {
        const parsed = JSON.parse(init.body) as { html?: string };
        const match = parsed.html?.match(/#token=([A-Za-z0-9_-]+)/);
        if (match) capturedVerifyUrl = match[1]!;
      }
      return new Response(JSON.stringify({ id: 'resend-test-p1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Customer@MRS2026!',
          firstName: 'PhaseOne',
          lastName: 'Tester',
          phone: '+919876543210',
        });
      expect(regRes.status).toBe(202);
      expect(capturedVerifyUrl).toBeTruthy();

      const customerRow = await prisma.customer.findUnique({ where: { email: testEmail } });
      expect(customerRow).not.toBeNull();
      createdCustomerIds.push(customerRow!.id);
      expect(customerRow!.emailVerified).toBe(false);

      // Login must fail before email verification
      const unverifiedLogin = await request(app)
        .post('/api/auth/customer/login')
        .send({ email: testEmail, password: 'Customer@MRS2026!' });
      expect(unverifiedLogin.status).toBe(401);

      // Verify email
      const verifyRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: capturedVerifyUrl });
      expect(verifyRes.status).toBe(200);

      // Login succeeds and issues HttpOnly cookie
      const custLogin = await request(app)
        .post('/api/auth/customer/login')
        .send({ email: testEmail, password: 'Customer@MRS2026!' });
      expect(custLogin.status).toBe(200);
      const custCookies = (custLogin.headers['set-cookie'] ?? []) as unknown as string[];
      expect(custCookies.some((c) => c.includes('mrs_customer_session=') && c.includes('HttpOnly'))).toBe(true);

      // Add test product to cart and place order
      const addCartRes = await request(app)
        .post(`/api/cart/${testCartId}/items`)
        .send({ sku: testSku, quantity: 2 });
      expect(addCartRes.status).toBe(200);

      const checkoutRes = await request(app)
        .post('/api/checkout/create-order')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', custCookies)
        .set('X-CSRF-Token', custLogin.body.csrfToken)
        .send({
          items: [{ sku: testSku, quantity: 2 }],
          customerName: 'PhaseOne Tester',
          customerEmail: testEmail,
          customerPhone: '+919876543210',
          shippingAddress: {
            line1: '101 Royal Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400050',
          },
          paymentMethod: 'COD_STUDIO_PICKUP',
        });
      expect(checkoutRes.status).toBe(201);
      const orderId = checkoutRes.body.order.id as string;
      createdOrderIds.push(orderId);

      // Verify stock reserved (3 -> 1)
      const invAfterOrder = await prisma.inventoryRecord.findFirst({
        where: { productMetadata: { sku: testSku } },
      });
      expect(invAfterOrder?.availableQuantity).toBe(1);

      // Customer cancels order -> restocks 1 -> 3
      const cancelRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', custCookies)
        .set('X-CSRF-Token', custLogin.body.csrfToken)
        .send({ reason: 'E2E test cancellation' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.order.fulfillmentStatus).toBe('CANCELLED');

      const invAfterCancel = await prisma.inventoryRecord.findFirst({
        where: { productMetadata: { sku: testSku } },
      });
      expect(invAfterCancel?.availableQuantity).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('5. verifies webhook HMAC signatures and idempotent replay persistence in PostgreSQL', async () => {
    if (!dbReachable) return;

    // Invalid Razorpay signature must be rejected
    const badWebhook = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'invalid-sig')
      .send({ event: 'payment.captured', payload: {} });
    expect(badWebhook.status).toBe(401);

    // Valid Shopify webhook + idempotent replay
    const body = JSON.stringify({ id: 999999, name: '#TEST-WH', financial_status: 'paid' });
    const hmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
      .update(body, 'utf8')
      .digest('base64');

    const first = await request(app)
      .post('/api/webhooks/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'orders/create')
      .set('X-Shopify-Webhook-Id', testWebhookId)
      .set('X-Shopify-Hmac-Sha256', hmac)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.received).toBe(true);
    expect(first.body.duplicate).toBeUndefined();

    const replay = await request(app)
      .post('/api/webhooks/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'orders/create')
      .set('X-Shopify-Webhook-Id', testWebhookId)
      .set('X-Shopify-Hmac-Sha256', hmac)
      .send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);

    const eventCount = await prisma.integrationEvent.count({ where: { eventId: testWebhookId } });
    expect(eventCount).toBe(1);
  });
});
