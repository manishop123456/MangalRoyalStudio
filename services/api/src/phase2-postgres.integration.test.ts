import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { getPrismaClient } from './db/prisma.js';
import { hashPassword } from './store/data-store.js';
import { generateSampleWorkbookBuffer } from './scripts/generate-sample-excel.js';
import { createTemporaryPostgresAdmin } from './test-support/test-credentials.js';
import { assertIsolatedTestDatabase } from './test-support/test-db.js';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Phase 2 Live PostgreSQL Integration & E2E', () => {
  const prisma = getPrismaClient();
  // Temporary admin with a random password (never a real account's password); removed in afterAll.
  let tempAdmin: Awaited<ReturnType<typeof createTemporaryPostgresAdmin>> | null = null;
  const ensureTempAdmin = async () => (tempAdmin ??= await createTemporaryPostgresAdmin(prisma, 'OWNER'));
  const app = createApp({ backend: 'postgres', prisma });
  const testSku = `TEST-P2-RING-${Date.now().toString(36).toUpperCase()}`;
  const testHandle = testSku.toLowerCase();
  const testEmail = `test-p2-${Date.now()}@example.com`;
  let createdProductId = '';
  let createdCustomerId = '';
  let createdOrderId = '';
  let createdImportJobId = '';

  beforeAll(async () => {
    await assertIsolatedTestDatabase(prisma);
    const cat = await prisma.category.upsert({
      where: { slug: 'rings' },
      update: {},
      create: { name: 'Rings', slug: 'rings' },
    });

    const prod = await prisma.productMetadata.create({
      data: {
        sku: testSku,
        handle: testHandle,
        title: 'Phase 2 Test Solitaire Ring',
        categoryId: cat.id,
        currentShopifyPrice: 85000,
        currency: 'INR',
        status: 'ACTIVE',
      },
    });
    createdProductId = prod.id;

    await prisma.jewellerySpecification.create({
      data: {
        productMetadataId: prod.id,
        metalType: 'GOLD',
        metalPurity: '18K',
        metalColor: 'YELLOW_GOLD',
        grossWeightGrams: 5.5,
        netMetalWeightGrams: 5.1,
        netWeightMode: 'EXPLICIT_NET_WEIGHT',
        makingChargeMode: 'PER_GRAM_NET',
        makingChargeValue: 1400,
        wastageMode: 'NONE',
        wastageValue: 0,
        certificationFeeInr: 1500,
        hallmarkFeeInr: 100,
        fixedAdjustmentInr: 0,
        pricingEnabled: true,
      },
    });

    await prisma.inventoryRecord.create({
      data: {
        productMetadataId: prod.id,
        availableQuantity: 4,
        reservedQuantity: 0,
      },
    });

    const cust = await prisma.customer.create({
      data: {
        email: testEmail,
        firstName: 'PhaseTwo',
        lastName: 'Tester',
        passwordHash: hashPassword('TestCust!1234'),
        isActive: true,
        emailVerified: true,
      },
    });
    createdCustomerId = cust.id;
  });

  afterAll(async () => {
    await tempAdmin?.cleanup().catch(() => undefined);
    if (createdOrderId) {
      await prisma.orderMetadata.deleteMany({ where: { id: createdOrderId } });
    }
    if (createdImportJobId) {
      await prisma.importJob.deleteMany({ where: { id: createdImportJobId } });
    }
    if (createdCustomerId) {
      await prisma.customerDesign.deleteMany({ where: { customerId: createdCustomerId } });
      await prisma.customer.deleteMany({ where: { id: createdCustomerId } });
    }
    if (createdProductId) {
      await prisma.productCustomizationAssignment.deleteMany({ where: { productMetadataId: createdProductId } });
      await prisma.productMetadata.deleteMany({ where: { id: createdProductId } });
    }
  });

  it('persists customization assignment, customer design, customized order snapshot, and preserves MRS-EAR-2001 = 9', async () => {
    // 1. Verify seeded customization profiles exist
    const ownerAgent = request.agent(app);
    const loginRes = await ownerAgent.post('/api/auth/login').send({
      email: (await ensureTempAdmin()).email, password: (await ensureTempAdmin()).password,
    });
    expect(loginRes.status).toBe(200);
    const adminCsrf = loginRes.body.csrfToken as string;

    const profRes = await ownerAgent.get('/api/admin/customization/profiles');
    expect(profRes.status).toBe(200);
    const ringProfile = profRes.body.profiles.find((p: any) => p.code === 'BESPOKE_RINGS');
    expect(ringProfile).toBeTruthy();

    // 2. Assign BESPOKE_RINGS with engraving enabled to test product
    const assignRes = await ownerAgent
      .put(`/api/admin/customization/products/${testSku}/assignment`)
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', adminCsrf)
      .send({
        profileId: ringProfile.id,
        isCustomizable: true,
        allowDiamondSelection: true,
        allowEngraving: true,
        maxEngravingChars: 24,
        disabledOptionCodes: [],
      });
    expect(assignRes.status).toBe(200);

    // 3. Quote customized piece
    const selections = {
      metal_purity_color: '18K_YELLOW',
      ring_size: 'IND_14',
      finish_style: 'SATIN_MATTE',
      engraving_text: 'ROYAL 1975',
    };
    const quoteRes = await request(app)
      .post('/api/public/customization/quote')
      .send({ productHandleOrSku: testSku, selections, quantity: 1 });
    expect(quoteRes.status).toBe(200);
    const serverUnitPrice = quoteRes.body.quote.unitPriceInr;

    // 4. Customer saves design & checks out
    const custAgent = request.agent(app);
    const custLogin = await custAgent
      .post('/api/auth/customer/login')
      .send({ email: testEmail, password: 'TestCust!1234' });
    expect(custLogin.status).toBe(200);
    const custCsrf = custLogin.body.csrfToken as string;

    const saveRes = await custAgent
      .post('/api/customer/designs')
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custCsrf)
      .send({
        productHandleOrSku: testSku,
        name: 'My Royal Ring',
        selections,
      });
    expect(saveRes.status).toBe(201);
    const designId = saveRes.body.design.id as string;

    const orderRes = await custAgent
      .post('/api/checkout/create-order')
      .set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', custCsrf)
      .send({
        customerEmail: testEmail,
        customerName: 'PhaseTwo Tester',
        customerPhone: '9876543210',
        shippingAddress: {
          line1: '201 Royal Heritage',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
        },
        items: [{ sku: testSku, quantity: 1, customerDesignId: designId }],
        paymentMethod: 'COD_STUDIO_PICKUP',
      });
    expect(orderRes.status).toBe(201);
    createdOrderId = orderRes.body.order.id;
    expect(orderRes.body.order.totalPriceInr).toBe(serverUnitPrice);

    const dbOrderItems = await prisma.orderItem.findMany({
      where: { orderMetadataId: createdOrderId },
    });
    expect(dbOrderItems).toHaveLength(1);
    expect(dbOrderItems[0]?.customerDesignId).toBe(designId);
    expect(dbOrderItems[0]?.customizationSnapshotJson).toBeTruthy();

    // 5. Verify Excel dry-run via PostgreSQL backend and confirm MRS-EAR-2001 = 9
    const wb = generateSampleWorkbookBuffer();
    const impRes = await ownerAgent
      .post('/api/admin/imports/excel')
      .set('Origin', 'http://localhost:3001')
      .set('x-csrf-token', adminCsrf)
      .send({
        mode: 'DRY_RUN',
        fileName: `pg-dry-${crypto.randomUUID()}.xlsx`,
        base64Content: wb.toString('base64'),
      });
    expect(impRes.status).toBe(201);
    createdImportJobId = impRes.body.importJob.id;

    const mrsEar = await prisma.inventoryRecord.findFirst({
      where: { productMetadata: { sku: 'MRS-EAR-2001' } },
    });
    expect(mrsEar?.availableQuantity).toBe(9);
  });
});
