import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { DataStore } from './store/data-store.js';
import { testSeedAdminPassword } from './test-support/test-credentials.js';

/**
 * Public catalogue exposure & Price-on-request enforcement (MRS final audit, 2026-11-21).
 * - Draft products are invisible on every public route (list, detail, pricing, customization, quote, cart).
 * - Public payloads carry no internal stored fee inputs, Shopify GIDs or engine diagnostics.
 * - Price-on-request products show no stale price and cannot be carted or checked out (documented 4xx).
 */

const INTERNAL_FIELDS = [
  'makingChargeValue',
  'wastageMode',
  'wastageValue',
  'certificationFeeInr',
  'hallmarkFeeInr',
  'fixedAdjustmentInr',
  'manualPriceOverrideInr',
  'shopifyProductGid',
  'shopifyVariantGid',
  'latestBreakdown',
];

const DRAFT_SKU = 'MRS-DRAFT-9001';
const POR_SKU = 'MRS-EAR-2001'; // 2 × 0.50 ct = exactly 1.00 ct combined -> owner rate not supplied

function createTempStore(): DataStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-exposure-test-'));
  const store = new DataStore({
    filePath: path.join(dir, 'platform-state.json'),
    testMode: true,
    enforceLock: false,
  });
  const state = store.getState();
  // Only the owner-approved < 1.00 ct and > 1.00 ct brackets are active (as in the live rate card).
  for (const dr of state.diamondRates) {
    if (Number(dr.sizeMinCarat) <= 1 && Number(dr.sizeMaxCarat) >= 1) dr.isActive = false;
  }
  const template = state.products.find((p) => p.sku === 'MRS-RNG-1001')!;
  state.products.push({
    ...template,
    id: 'prod-draft-9001',
    sku: DRAFT_SKU,
    handle: 'supplier-draft-ring-9001',
    title: 'Supplier Draft Ring (must stay hidden)',
    status: 'DRAFT',
  });
  return store;
}

describe('Public catalogue exposure and Price-on-request enforcement', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(createTempStore());
  });

  it('public list returns ACTIVE products only, with no internal fields', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const skus = res.body.products.map((p: { sku: string }) => p.sku);
    expect(skus).not.toContain(DRAFT_SKU);
    expect(res.body.products.length).toBeGreaterThan(0);
    for (const p of res.body.products) {
      expect(p.status === undefined || p.status === 'ACTIVE').toBe(true);
      for (const f of INTERNAL_FIELDS) expect(p[f], `${p.sku}.${f}`).toBeUndefined();
      expect(p.priceBreakup.warnings).toEqual([]);
      if (p.priceOnRequest) {
        expect(p.currentShopifyPriceInr).toBe('0.00');
        expect(p.displayPriceLabel).toBe('Price on request');
      } else {
        expect(p.currentShopifyPriceInr).toBe(p.priceBreakup.finalProposedPriceInr);
        expect(Number(p.currentShopifyPriceInr)).toBeGreaterThan(0);
      }
    }
    const search = await request(app).get(`/api/products?search=${encodeURIComponent('supplier draft')}`);
    expect(search.body.products).toHaveLength(0);
  });

  it.each([
    ['GET', `/api/products/${DRAFT_SKU}`],
    ['GET', '/api/products/supplier-draft-ring-9001'],
    ['GET', `/api/public/pricing/${DRAFT_SKU}`],
    ['GET', `/api/public/products/${DRAFT_SKU}/customization`],
  ])('%s %s returns 404 for a draft product', async (_m, url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Supplier Draft Ring');
  });

  it('draft products cannot be quoted or added to cart', async () => {
    const quote = await request(app)
      .post('/api/public/customization/quote')
      .send({ productHandleOrSku: DRAFT_SKU, selections: {}, quantity: 1 });
    expect(quote.status).toBe(404);
    const cart = await request(app).post('/api/cart/exposure-cart/items').send({ sku: DRAFT_SKU, quantity: 1 });
    expect(cart.status).toBe(404);
  });

  it('collections never list draft products', async () => {
    const res = await request(app).get('/api/collections/rings');
    expect(res.status).toBe(200);
    expect(res.body.products.map((p: { sku: string }) => p.sku)).not.toContain(DRAFT_SKU);
  });

  it('detail exposes one server price per offered purity, identical to the list price', async () => {
    const list = await request(app).get('/api/products');
    const listed = list.body.products.find((p: { sku: string }) => p.sku === 'MRS-RNG-1001');
    const detail = await request(app).get('/api/products/MRS-RNG-1001');
    expect(detail.status).toBe(200);
    expect(detail.body.priceBreakup.finalProposedPriceInr).toBe(listed.priceBreakup.finalProposedPriceInr);
    expect(detail.body.product.purityBreakups['18K'].finalProposedPriceInr).toBe(
      listed.priceBreakup.finalProposedPriceInr
    );
    const pricing = await request(app).get('/api/public/pricing/MRS-RNG-1001');
    expect(pricing.status).toBe(200);
    expect(pricing.body.priceBreakup.finalProposedPriceInr).toBe(listed.priceBreakup.finalProposedPriceInr);
    for (const f of INTERNAL_FIELDS) expect(pricing.body.product[f]).toBeUndefined();
  });

  it('Price-on-request product: no stale price, cart 422, checkout 422 even with a manipulated client price', async () => {
    const detail = await request(app).get(`/api/products/${POR_SKU}`);
    expect(detail.status).toBe(200);
    expect(detail.body.product.priceOnRequest).toBe(true);
    expect(detail.body.product.priceOnRequestReason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');
    expect(detail.body.product.currentShopifyPriceInr).toBe('0.00');

    const cart = await request(app)
      .post('/api/cart/por-cart/items')
      .send({ sku: POR_SKU, quantity: 1, unitPriceInr: '100.00' });
    expect(cart.status).toBe(422);
    expect(cart.body.error).toBe('PRICE_ON_REQUEST');
    // Customer-facing message carries no internal reason code or SKU; the code stays in machine fields.
    expect(cart.body.message).not.toMatch(/[A-Z]{2,}_[A-Z]{2,}|MRS-[A-Z]{3}-\d/);
    expect(cart.body.reason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');

    const checkout = await request(app)
      .post('/api/checkout/create-order')
      .send({
        customerEmail: 'buyer@example.com',
        customerName: 'Test Buyer',
        customerPhone: '9876543210',
        shippingAddress: { line1: '101 Royal Chambers', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        items: [{ sku: POR_SKU, quantity: 1, unitPriceInr: '100.00', priceInr: '100.00' }],
        paymentMethod: 'COD_STUDIO_PICKUP',
      });
    expect(checkout.status).toBe(422);
    expect(checkout.body.error).toBe('PRICE_ON_REQUEST');
    expect(checkout.body.message).not.toMatch(/[A-Z]{2,}_[A-Z]{2,}|MRS-[A-Z]{3}-\d/);
  });

  it('checkout rejects a draft SKU with 404', async () => {
    const checkout = await request(app)
      .post('/api/checkout/create-order')
      .send({
        customerEmail: 'buyer@example.com',
        customerName: 'Test Buyer',
        customerPhone: '9876543210',
        shippingAddress: { line1: '101 Royal Chambers', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
        items: [{ sku: DRAFT_SKU, quantity: 1 }],
        paymentMethod: 'COD_STUDIO_PICKUP',
      });
    expect(checkout.status).toBe(404);
  });

  it('malformed request returns 4xx with no internal error text', async () => {
    const res = await request(app).get('/api/products/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(JSON.stringify(res.body)).not.toMatch(/decode param|node_modules|\.js:\d+/);
  });

  it('admin catalogue (with drafts) is not reachable without authentication', async () => {
    const res = await request(app).get('/api/admin/products');
    expect([401, 403]).toContain(res.status);
  });
});

describe('Session revocation on logout', () => {
  it('a copied admin token is rejected after logout (server-side revocation)', async () => {
    const app = createApp(createTempStore());
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@mangalroyalstudio.com', password: testSeedAdminPassword('OWNER') });
    expect(login.status).toBe(200);
    const token = login.body.token as string;
    const before = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);
    const after = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});

describe('Fail-closed pricing when the rate card is not owner-approved', () => {
  const checkoutBody = (sku: string) => ({
    customerEmail: 'buyer@example.com',
    customerName: 'Test Buyer',
    customerPhone: '9876543210',
    shippingAddress: { line1: '101 Royal Chambers', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
    items: [{ sku, quantity: 1, unitPriceInr: '100.00' }],
    paymentMethod: 'COD_STUDIO_PICKUP',
  });

  it('placeholder rate card (as on staging before owner publish): every product Price on request, no sale', async () => {
    const store = createTempStore();
    // Real environments: rule carries no test opt-in -> placeholder rates must never price.
    for (const r of store.getState().pricingRules) r.allowPlaceholderPricing = false;
    for (const d of store.getState().diamondRates) d.isActive = true;
    const app = createApp(store);
    const list = await request(app).get('/api/products');
    expect(list.status).toBe(200);
    expect(list.body.products.length).toBeGreaterThan(0);
    for (const p of list.body.products) {
      expect(p.priceOnRequest, p.sku).toBe(true);
      expect(p.currentShopifyPriceInr).toBe('0.00');
      expect(p.displayPriceLabel).toBe('Price on request');
    }
    const cart = await request(app).post('/api/cart/fc-cart/items').send({ sku: 'MRS-RNG-1001', quantity: 1 });
    expect(cart.status).toBe(422);
    expect(cart.body.reason).toBe('PRICING_RULE_NOT_APPROVED');
    const checkout = await request(app).post('/api/checkout/create-order').send(checkoutBody('MRS-RNG-1001'));
    expect(checkout.status).toBe(422);
    expect(checkout.body.error).toBe('PRICE_ON_REQUEST');
  });

  it('no approved pricing rule at all: Price on request everywhere, checkout 422, no crash', async () => {
    const store = createTempStore();
    for (const r of store.getState().pricingRules) r.status = 'RETIRED';
    const app = createApp(store);
    const list = await request(app).get('/api/products');
    expect(list.status).toBe(200);
    expect(list.body.products.every((p: { priceOnRequest: boolean }) => p.priceOnRequest)).toBe(true);
    const detail = await request(app).get('/api/products/MRS-RNG-1001');
    expect(detail.status).toBe(200);
    expect(detail.body.product.priceOnRequest).toBe(true);
    const pricing = await request(app).get('/api/public/pricing/MRS-RNG-1001');
    expect(pricing.status).toBe(503);
    const cart = await request(app).post('/api/cart/nr-cart/items').send({ sku: 'MRS-RNG-1001', quantity: 1 });
    expect(cart.status).toBe(422);
    expect(cart.body.reason).toBe('NO_APPROVED_PRICING_RULE');
    const checkout = await request(app).post('/api/checkout/create-order').send(checkoutBody('MRS-RNG-1001'));
    expect(checkout.status).toBe(422);
    expect(checkout.body.reason).toBe('NO_APPROVED_PRICING_RULE');
  });
});
