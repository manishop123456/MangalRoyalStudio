import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { DataStore } from './store/data-store.js';
import { hashPassword } from './store/data-store.js';
import { generateSampleWorkbookBuffer } from './scripts/generate-sample-excel.js';
import { testSeedAdminPassword } from './test-support/test-credentials.js';

function createTempStore(): DataStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-p2-test-'));
  const store = new DataStore({
    filePath: path.join(dir, 'platform-state.json'),
    testMode: true,
    enforceLock: false,
  });
  const state = store.getState();

  // Seed one active customization profile for Rings
  const now = new Date().toISOString();
  state.customizationProfiles = [
    {
      id: 'prof-rings-1',
      code: 'BESPOKE_RINGS',
      name: 'Bespoke Ring Studio Profile',
      description: 'Test ring profile',
      eligibleCategories: ['Rings'],
      isActive: true,
      isDefault: false,
      createdBy: 'owner@mangalroyalstudio.com',
      createdAt: now,
      updatedAt: now,
      groups: [
        {
          id: 'grp-metal',
          profileId: 'prof-rings-1',
          code: 'metal_purity_color',
          name: 'Metal Purity & Tone',
          stepOrder: 1,
          selectionMode: 'SINGLE',
          optionCategory: 'METAL',
          isRequired: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          options: [
            {
              id: 'opt-18k-y',
              groupId: 'grp-metal',
              code: '18K_YELLOW',
              label: '18K Yellow Gold',
              value: '18K Yellow Gold',
              swatchHex: '#D4AF37',
              priceRuleType: 'METAL_RATE_PURITY',
              priceRuleValue: '0',
              metalType: 'GOLD',
              metalPurity: '18K',
              metalColor: 'YELLOW',
              isDefault: true,
              isActive: true,
              sortOrder: 1,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'opt-22k-y',
              groupId: 'grp-metal',
              code: '22K_YELLOW',
              label: '22K Royal Yellow Gold',
              value: '22K Royal Yellow Gold',
              swatchHex: '#C59B27',
              priceRuleType: 'METAL_RATE_PURITY',
              priceRuleValue: '0',
              metalType: 'GOLD',
              metalPurity: '22K',
              metalColor: 'YELLOW',
              isDefault: false,
              isActive: true,
              sortOrder: 2,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        {
          id: 'grp-engraving',
          profileId: 'prof-rings-1',
          code: 'engraving_text',
          name: 'Inside-Band Engraving',
          stepOrder: 2,
          selectionMode: 'TEXT',
          optionCategory: 'ENGRAVING',
          isRequired: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          options: [
            {
              id: 'opt-eng',
              groupId: 'grp-engraving',
              code: 'ENGRAVING_STANDARD',
              label: 'Laser Engraving',
              value: 'ENGRAVING',
              priceRuleType: 'FIXED_INR',
              priceRuleValue: '1500',
              isDefault: false,
              isActive: true,
              sortOrder: 1,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    },
  ];

  // Ensure a ring product has inventory >= 2
  const ringProduct = state.products.find((p) => p.category === 'Rings') || state.products[0]!;
  ringProduct.category = 'Rings';
  ringProduct.inventoryQuantity = 5;
  state.productCustomizationAssignments = [
    {
      id: 'assign-1',
      productMetadataId: ringProduct.id,
      productSku: ringProduct.sku,
      profileId: 'prof-rings-1',
      isCustomizable: true,
      allowDiamondSelection: true,
      allowEngraving: true,
      maxEngravingChars: 24,
      disabledOptionCodes: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Seed two verified customers for IDOR testing
  state.customers = [
    {
      id: 'cust-a',
      email: 'customera@example.com',
      passwordHash: hashPassword('CustomerPass!123'),
      firstName: 'Aarav',
      lastName: 'Mehta',
      isActive: true,
      emailVerified: true,
      totalOrdersCount: 0,
      totalSpentInr: '0.00',
      tags: ['REGISTERED'],
      createdAt: now,
    },
    {
      id: 'cust-b',
      email: 'customerb@example.com',
      passwordHash: hashPassword('CustomerPass!123'),
      firstName: 'Diya',
      lastName: 'Kapoor',
      isActive: true,
      emailVerified: true,
      totalOrdersCount: 0,
      totalSpentInr: '0.00',
      tags: ['REGISTERED'],
      createdAt: now,
    },
  ];

  return store;
}

describe('Phase 2 API, Security, Pricing & 3D Model Validation', () => {
  let store: DataStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    store = createTempStore();
    app = createApp(store);
  });

  afterEach(() => {
    store = createTempStore();
  });

  async function loginAdmin(email = 'owner@mangalroyalstudio.com', password = testSeedAdminPassword('OWNER')) {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return {
      agent,
      token: res.body.token as string,
      csrfToken: res.body.csrfToken as string,
    };
  }

  async function loginCustomer(email: string) {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/customer/login')
      .send({ email, password: 'CustomerPass!123' });
    expect(res.status).toBe(200);
    return {
      agent,
      token: res.body.token as string,
      csrfToken: res.body.csrfToken as string,
    };
  }

  it('computes authoritative customization quote and rejects invalid/disabled options', async () => {
    const prod = store.getState().products.find((p) => p.category === 'Rings')!;

    const cfgRes = await request(app).get(`/api/public/products/${prod.sku}/customization`);
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body.eligible).toBe(true);
    expect(cfgRes.body.profile.code).toBe('BESPOKE_RINGS');

    const quoteRes = await request(app)
      .post('/api/public/customization/quote')
      .send({
        productHandleOrSku: prod.sku,
        selections: {
          metal_purity_color: '18K_YELLOW',
          engraving_text: 'M & R 2026',
        },
        quantity: 1,
      });
    expect(quoteRes.status).toBe(200);
    expect(Number(quoteRes.body.quote.unitPriceInr)).toBeGreaterThan(0);
    expect(
      quoteRes.body.quote.selectionSnapshot.some(
        (s: any) => s.groupCode === 'engraving_text' && s.value === 'M & R 2026'
      )
    ).toBe(true);

    const badRes = await request(app)
      .post('/api/public/customization/quote')
      .send({
        productHandleOrSku: prod.sku,
        selections: { metal_purity_color: 'INVALID_OPTION' },
        quantity: 1,
      });
    expect(badRes.status).toBe(400);

    // 22K GST is not owner-confirmed: the customization path must not price it (no Price-on-request bypass).
    const porRes = await request(app)
      .post('/api/public/customization/quote')
      .send({ productHandleOrSku: prod.sku, selections: { metal_purity_color: '22K_YELLOW' }, quantity: 1 });
    expect(porRes.status).toBe(422);
    expect(porRes.body.error).toBe('PRICE_ON_REQUEST');
    expect(porRes.body.message).not.toMatch(/[A-Z]{2,}_[A-Z]{2,}/);
  });

  it('ignores client-manipulated prices on cart add and checkout order creation', async () => {
    const prod = store.getState().products.find((p) => p.category === 'Rings')!;
    const selections = { metal_purity_color: '18K_YELLOW', engraving_text: 'ROYAL' };

    const quoteRes = await request(app)
      .post('/api/public/customization/quote')
      .send({ productHandleOrSku: prod.sku, selections, quantity: 1 });
    expect(quoteRes.status).toBe(200);
    const serverUnitPrice = quoteRes.body.quote.unitPriceInr;

    const cartRes = await request(app)
      .post('/api/cart/test-cart-p2/items')
      .send({
        sku: prod.sku,
        quantity: 1,
        unitPriceInr: '1.00', // Manipulated client price
        selections,
      });
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.cart.items[0].unitPriceInr).toBe(serverUnitPrice);

    const orderRes = await request(app)
      .post('/api/checkout/create-order')
      .send({
        customerEmail: 'buyer@example.com',
        customerName: 'Test Buyer',
        customerPhone: '9876543210',
        shippingAddress: {
          line1: '101 Royal Chambers',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
        },
        items: [
          {
            sku: prod.sku,
            quantity: 1,
            selections,
          },
        ],
        paymentMethod: 'COD_STUDIO_PICKUP',
      });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.totalPriceInr).toBe(serverUnitPrice);
    expect(orderRes.body.order.lineItems[0].purchaseTimePriceInr).toBe(serverUnitPrice);
  });

  it('enforces strict IDOR ownership on customer saved designs', async () => {
    const prod = store.getState().products.find((p) => p.category === 'Rings')!;
    const custA = await loginCustomer('customera@example.com');
    const custB = await loginCustomer('customerb@example.com');

    const createRes = await custA.agent
      .post('/api/customer/designs')
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custA.csrfToken)
      .send({
        productHandleOrSku: prod.sku,
        name: 'Aarav Signature Ring',
        selections: { metal_purity_color: '18K_YELLOW' },
      });
    expect(createRes.status).toBe(201);
    const designId = createRes.body.design.id;

    // Customer B must receive 403 FORBIDDEN for GET, PATCH, DELETE, duplicate, add-to-cart
    const getB = await custB.agent.get(`/api/customer/designs/${designId}`);
    expect(getB.status).toBe(403);

    const patchB = await custB.agent
      .patch(`/api/customer/designs/${designId}`)
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custB.csrfToken)
      .send({ name: 'Stolen' });
    expect(patchB.status).toBe(403);

    const delB = await custB.agent
      .delete(`/api/customer/designs/${designId}`)
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custB.csrfToken);
    expect(delB.status).toBe(403);

    // Owner A can duplicate and delete cleanly
    const dupA = await custA.agent
      .post(`/api/customer/designs/${designId}/duplicate`)
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custA.csrfToken);
    expect(dupA.status).toBe(201);
  });

  it('validates .glb magic header on upload, serves valid model, and enforces RBAC', async () => {
    const prod = store.getState().products.find((p) => p.category === 'Rings')!;
    const owner = await loginAdmin();

    // Reject invalid .glb header
    const badUpload = await owner.agent
      .post(`/api/admin/model-assets/${prod.sku}/upload`)
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', owner.csrfToken)
      .attach('file', Buffer.from('NOT_A_GLB_FILE_123456'), 'fake.glb');
    expect(badUpload.status).toBe(400);
    expect(badUpload.body.error).toBe('INVALID_MODEL_FILE');

    // Accept valid minimal GLB header ("glTF" + version 2 + length)
    const glbHeader = Buffer.alloc(24);
    glbHeader.write('glTF', 0, 'ascii');
    glbHeader.writeUInt32LE(2, 4);
    glbHeader.writeUInt32LE(24, 8);

    const okUpload = await owner.agent
      .post(`/api/admin/model-assets/${prod.sku}/upload`)
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', owner.csrfToken)
      .attach('file', glbHeader, 'ring-sample.glb');
    expect(okUpload.status).toBe(201);
    expect(okUpload.body.modelAsset.assetUrl).toMatch(/^\/api\/public\/model-assets\//);

    // Public model fetch succeeds
    const fetchModel = await request(app).get(okUpload.body.modelAsset.assetUrl);
    expect(fetchModel.status).toBe(200);
    expect(fetchModel.headers['content-type']).toContain('model/gltf-binary');

    // Delete cleanup
    const delRes = await owner.agent
      .delete(`/api/admin/model-assets/${prod.sku}`)
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', owner.csrfToken);
    expect(delRes.status).toBe(200);
  });

  it('supports bulk Excel dry-run, commit, and rollback via RuntimeBackend', async () => {
    const owner = await loginAdmin();
    const workbook = generateSampleWorkbookBuffer();

    const dryRunRes = await owner.agent
      .post('/api/admin/imports/excel')
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', owner.csrfToken)
      .send({
        mode: 'DRY_RUN',
        fileName: `test-dry-${crypto.randomUUID()}.xlsx`,
        base64Content: workbook.toString('base64'),
      });
    expect(dryRunRes.status).toBe(201);
    expect(dryRunRes.body.importJob.dryRun).toBe(true);
    expect(dryRunRes.body.committedProductsCount).toBe(0);
  });
});
