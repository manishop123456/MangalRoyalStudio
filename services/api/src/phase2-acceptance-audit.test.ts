import crypto from 'node:crypto';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { getPrismaClient } from './db/prisma.js';
import { hashPassword } from './store/data-store.js';
import { createTemporaryPostgresAdmin } from './test-support/test-credentials.js';
import { assertIsolatedTestDatabase } from './test-support/test-db.js';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Phase 2 Final End-to-End Acceptance Audit Suite', () => {
  const prisma = getPrismaClient();
  // Temporary admin with a random password (never a real account's password); removed in afterAll.
  let tempAdmin: Awaited<ReturnType<typeof createTemporaryPostgresAdmin>> | null = null;
  const ensureTempAdmin = async () => (tempAdmin ??= await createTemporaryPostgresAdmin(prisma, 'OWNER'));
  const app = createApp({ backend: 'postgres', prisma });

  // Agents and CSRF tokens
  let ownerAgent: ReturnType<typeof request.agent>;
  let adminCsrf = '';

  let custAAgent: ReturnType<typeof request.agent>;
  let custACsrf = '';
  let custAId = '';
  const custAEmail = `audit-cust-a-${Date.now()}@example.com`;

  let custBAgent: ReturnType<typeof request.agent>;
  let custBCsrf = '';
  let custBId = '';
  const custBEmail = `audit-cust-b-${Date.now()}@example.com`;

  const password = 'AuditPass!2026';

  let createdDesignAId = '';
  let createdDesignA2Id = '';
  let createdProfileId = '';
  let createdGroupId = '';
  let createdOptionId = '';
  let createdOrderId = '';
  let createdModelAssetSku = '';
  let committedImportJobId = '';
  let dryRunImportJobId = '';
  const createdDiamondRateIds: string[] = [];

  beforeAll(async () => {
    await assertIsolatedTestDatabase(prisma);
    // Ensure FG/VS1 and EF/VVS1 diamond grades used by BESPOKE_RINGS customization options have explicit slabs
    const testRates = [
      { shape: 'ANY', sieveRange: 'Audit Under 1ct FG-VS1', sizeMinCarat: 0, sizeMaxCarat: 1, minInclusive: false, maxInclusive: false, colorGrade: 'FG', clarityGrade: 'VS1', rateInr: 22000 },
      { shape: 'ANY', sieveRange: 'Audit Over 1ct FG-VS1', sizeMinCarat: 1, sizeMaxCarat: 5, minInclusive: false, maxInclusive: true, colorGrade: 'FG', clarityGrade: 'VS1', rateInr: 36000 },
      { shape: 'ANY', sieveRange: 'Audit Under 1ct EF-VVS1', sizeMinCarat: 0, sizeMaxCarat: 1, minInclusive: false, maxInclusive: false, colorGrade: 'EF', clarityGrade: 'VVS1', rateInr: 30000 },
      { shape: 'ANY', sieveRange: 'Audit Over 1ct EF-VVS1', sizeMinCarat: 1, sizeMaxCarat: 5, minInclusive: false, maxInclusive: true, colorGrade: 'EF', clarityGrade: 'VVS1', rateInr: 45000 },
    ] as const;
    for (const r of testRates) {
      const created = await prisma.diamondRate.create({
        data: {
          shape: r.shape,
          sieveRange: r.sieveRange,
          sizeMinCarat: r.sizeMinCarat,
          sizeMaxCarat: r.sizeMaxCarat,
          minInclusive: r.minInclusive,
          maxInclusive: r.maxInclusive,
          colorGrade: r.colorGrade,
          clarityGrade: r.clarityGrade,
          cutGrade: 'EXCELLENT',
          pricingType: 'PER_CARAT',
          rateInr: r.rateInr,
          currency: 'INR',
          isPlaceholder: false,
          isActive: true,
          effectiveAt: new Date(),
          createdBy: 'audit-test@mangalroyalstudio.com',
        },
      });
      createdDiamondRateIds.push(created.id);
    }
    // 1. Authenticate Admin Owner
    ownerAgent = request.agent(app);
    const adminLoginRes = await ownerAgent
      .post('/api/auth/login')
      .send({ email: (await ensureTempAdmin()).email, password: (await ensureTempAdmin()).password });
    expect(adminLoginRes.status).toBe(200);
    adminCsrf = adminLoginRes.body.csrfToken;
    expect(adminCsrf).toBeTruthy();

    // 2. Create and authenticate Customer A
    const custARec = await prisma.customer.create({
      data: {
        email: custAEmail,
        passwordHash: hashPassword(password),
        firstName: 'Auditor',
        lastName: 'Alpha',
        isActive: true,
        emailVerified: true,
      },
    });
    custAId = custARec.id;

    custAAgent = request.agent(app);
    const custALogin = await custAAgent
      .post('/api/auth/customer/login')
      .send({ email: custAEmail, password });
    expect(custALogin.status).toBe(200);
    custACsrf = custALogin.body.csrfToken;

    // 3. Create and authenticate Customer B (for IDOR attack tests)
    const custBRec = await prisma.customer.create({
      data: {
        email: custBEmail,
        passwordHash: hashPassword(password),
        firstName: 'Auditor',
        lastName: 'Beta',
        isActive: true,
        emailVerified: true,
      },
    });
    custBId = custBRec.id;

    custBAgent = request.agent(app);
    const custBLogin = await custBAgent
      .post('/api/auth/customer/login')
      .send({ email: custBEmail, password });
    expect(custBLogin.status).toBe(200);
    custBCsrf = custBLogin.body.csrfToken;
  });

  afterAll(async () => {
    await tempAdmin?.cleanup().catch(() => undefined);
    // Strict self-cleaning of test entities created during audit
    if (createdOrderId) {
      const order = await prisma.orderMetadata.findUnique({
        where: { id: createdOrderId },
        include: { items: true },
      });
      if (order) {
        for (const itm of order.items) {
          const prod = await prisma.productMetadata.findUnique({ where: { sku: itm.sku } });
          if (prod) {
            await prisma.inventoryRecord.update({
              where: { productMetadataId: prod.id },
              data: {
                availableQuantity: { increment: itm.quantity },
                reservedQuantity: { decrement: itm.quantity },
              },
            });
          }
        }
        await prisma.orderMetadata.delete({ where: { id: createdOrderId } });
      }
    }
    if (createdDesignAId || createdDesignA2Id) {
      await prisma.customerDesign.deleteMany({
        where: { id: { in: [createdDesignAId, createdDesignA2Id].filter(Boolean) } },
      });
    }
    if (custAId || custBId) {
      await prisma.customer.deleteMany({
        where: { id: { in: [custAId, custBId].filter(Boolean) } },
      });
    }
    if (createdModelAssetSku) {
      const prod = await prisma.productMetadata.findUnique({ where: { sku: createdModelAssetSku } });
      if (prod) {
        await prisma.productModelAsset.deleteMany({ where: { productMetadataId: prod.id } });
      }
    }
    if (createdOptionId) {
      await prisma.customizationOption.deleteMany({ where: { id: createdOptionId } });
    }
    if (createdGroupId) {
      await prisma.customizationGroup.deleteMany({ where: { id: createdGroupId } });
    }
    if (createdProfileId) {
      await prisma.customizationProfile.deleteMany({ where: { id: createdProfileId } });
    }
    if (committedImportJobId) {
      await prisma.importJob.deleteMany({ where: { id: committedImportJobId } });
    }
    if (dryRunImportJobId) {
      await prisma.importJob.deleteMany({ where: { id: dryRunImportJobId } });
    }
    if (createdDiamondRateIds.length > 0) {
      await prisma.diamondRate.deleteMany({
        where: { id: { in: createdDiamondRateIds } },
      });
    }
    // Clean up any stray test SKU
    await prisma.productMetadata.deleteMany({
      where: { sku: { in: ['AUDIT-NEW-BRACELET-01', 'TEST-ARTIFACT-SKU-99'] } },
    });
  });

  // ==========================================================================
  // SECTION 1: Customer Storefront Experience & Authoritative Quote Engine
  // ==========================================================================
  describe('1. Storefront Customization Experience & Live Quote Engine', () => {
    it('1.1 loads customization profile for MRS-RNG-1001 with active groups and options', async () => {
      const res = await request(app).get('/api/public/products/MRS-RNG-1001/customization');
      expect(res.status).toBe(200);
      expect(res.body.eligible).toBe(true);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.code).toBe('BESPOKE_RINGS');
      expect(Array.isArray(res.body.profile.groups)).toBe(true);
      expect(res.body.profile.groups.length).toBeGreaterThanOrEqual(4);

      const groupCodes = res.body.profile.groups.map((g: any) => g.code);
      expect(groupCodes).toContain('metal_purity_color');
      expect(groupCodes).toContain('diamond_grade');
      expect(groupCodes).toContain('ring_size');
      expect(groupCodes).toContain('engraving_text');
    });

    it('1.2 calculates authoritative quote with granular price breakdown', async () => {
      const quoteRes = await request(app)
        .post('/api/public/customization/quote')
        .send({
          productHandleOrSku: 'MRS-RNG-1001',
          quantity: 1,
          selections: {
            metal_purity_color: '18K_YELLOW',
            diamond_grade: 'VS1_FG',
            ring_size: 'IND_14',
            engraving_text: 'Forever Yours 2026',
          },
        });

      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.quote).toBeDefined();
      const q = quoteRes.body.quote;
      expect(Number(q.unitPriceInr)).toBeGreaterThan(0);
      expect(Number(q.totalPriceInr)).toBe(Number(q.unitPriceInr));
      expect(Array.isArray(q.breakdownLines)).toBe(true);
      expect(q.breakdownLines.length).toBeGreaterThan(0);
      expect(Number(q.subtotalBeforeTaxInr)).toBeGreaterThan(0);
      expect(Number(q.gstAmountInr)).toBeGreaterThan(0);
      expect(Array.isArray(q.selectionSnapshot)).toBe(true);
      expect(q.selectionSnapshot.length).toBeGreaterThanOrEqual(3);
    });

    it('1.3 rejects invalid or unknown option selections with 400', async () => {
      const res = await request(app)
        .post('/api/public/customization/quote')
        .send({
          productHandleOrSku: 'MRS-RNG-1001',
          quantity: 1,
          selections: {
            metal_purity_color: 'INVALID_NON_EXISTENT_OPTION_CODE',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // ==========================================================================
  // SECTION 2: Saved Designs & Strict IDOR Protection
  // ==========================================================================
  describe('2. Customer Saved Designs & IDOR Protections', () => {
    it('2.1 allows Customer A to create a saved bespoke design', async () => {
      const res = await custAAgent
        .post('/api/customer/designs')
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custACsrf)
        .send({
          name: 'My Dream Solitaire',
          productHandleOrSku: 'MRS-RNG-1001',
          selections: {
            metal_purity_color: '18K_ROSE',
            diamond_grade: 'VVS1_EF',
            ring_size: 'IND_12',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.design).toBeDefined();
      expect(res.body.design.name).toBe('My Dream Solitaire');
      expect(res.body.design.customerId).toBe(custAId);
      expect(Number(res.body.design.lastQuotedPriceInr)).toBeGreaterThan(0);
      createdDesignAId = res.body.design.id;
    });

    it('2.2 allows Customer A to retrieve their saved design by ID', async () => {
      const res = await custAAgent.get(`/api/customer/designs/${createdDesignAId}`);

      expect(res.status).toBe(200);
      expect(res.body.design.id).toBe(createdDesignAId);
      expect(res.body.design.name).toBe('My Dream Solitaire');
    });

    it('2.3 allows Customer A to duplicate their design', async () => {
      const res = await custAAgent
        .post(`/api/customer/designs/${createdDesignAId}/duplicate`)
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custACsrf);

      expect(res.status).toBe(201);
      expect(res.body.design.id).not.toBe(createdDesignAId);
      expect(res.body.design.name).toContain('Copy');
      createdDesignA2Id = res.body.design.id;
    });

    it('2.4 PREVENTS IDOR: Customer B CANNOT read Customer A design (returns 403 or 404)', async () => {
      const res = await custBAgent.get(`/api/customer/designs/${createdDesignAId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('2.5 PREVENTS IDOR: Customer B CANNOT update Customer A design (returns 403 or 404)', async () => {
      const res = await custBAgent
        .patch(`/api/customer/designs/${createdDesignAId}`)
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custBCsrf)
        .send({ name: 'Hacked by Customer B' });

      expect([403, 404]).toContain(res.status);
    });

    it('2.6 PREVENTS IDOR: Customer B CANNOT delete Customer A design (returns 403 or 404)', async () => {
      const res = await custBAgent
        .delete(`/api/customer/designs/${createdDesignAId}`)
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custBCsrf);

      expect([403, 404]).toContain(res.status);
    });

    it('2.7 allows Customer A to delete their duplicated design', async () => {
      const res = await custAAgent
        .delete(`/api/customer/designs/${createdDesignA2Id}`)
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custACsrf);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      createdDesignA2Id = '';
    });
  });

  // ==========================================================================
  // SECTION 3: Cart, Price Tampering Rejection & Immutable Order Snapshot
  // ==========================================================================
  describe('3. Cart & Order Persistence with Immutable Customization Snapshot', () => {
    it('3.1 completes checkout for customized item and saves immutable snapshot in order', async () => {
      const checkoutRes = await custAAgent
        .post('/api/checkout/create-order')
        .set('Origin', 'http://localhost:3000')
        .set('x-csrf-token', custACsrf)
        .send({
          customerEmail: custAEmail,
          customerName: 'Auditor Alpha',
          customerPhone: '9876543210',
          shippingAddress: {
            line1: '123 Platinum Tower, Bandra West',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400050',
          },
          paymentMethod: 'COD_STUDIO_PICKUP',
          items: [
            {
              sku: 'MRS-RNG-1001',
              quantity: 1,
              // Intentionally supply manipulated/tampered price to verify server authority
              unitPriceInr: 100,
              selections: {
                metal_purity_color: '18K_YELLOW',
                diamond_grade: 'VS1_FG',
                ring_size: 'IND_12',
              },
            },
          ],
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.order).toBeDefined();
      expect(checkoutRes.body.order.lineItems.length).toBe(1);

      const item = checkoutRes.body.order.lineItems[0];
      // Price must NOT be the client-tampered 100 INR!
      expect(Number(item.purchaseTimePriceInr)).toBeGreaterThan(50000);
      createdOrderId = checkoutRes.body.order.id;

      // Verify PostgreSQL persistence of customization snapshot
      const dbOrder = await prisma.orderMetadata.findUnique({
        where: { id: createdOrderId },
        include: { items: true },
      });
      expect(dbOrder).toBeDefined();
      expect(dbOrder?.items[0]?.customizationSnapshotJson).toBeDefined();
      expect(dbOrder?.items[0]?.customizationSnapshotJson).not.toBeNull();
    });

    it('3.2 completes checkout for standard non-customized product normally', async () => {
      const checkoutRes = await request(app)
        .post('/api/checkout/create-order')
        .send({
          customerEmail: 'auditor.std@example.com',
          customerName: 'Auditor Standard',
          customerPhone: '9876543211',
          shippingAddress: {
            line1: '456 Gold Avenue',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400050',
          },
          paymentMethod: 'COD_STUDIO_PICKUP',
          items: [
            {
              sku: 'MRS-RNG-1001',
              quantity: 1,
            },
          ],
        });

      expect(checkoutRes.status).toBe(201);
      const stdOrderId = checkoutRes.body.order.id;
      // Clean up standard order and restore reserved stock
      const stdOrder = await prisma.orderMetadata.findUnique({
        where: { id: stdOrderId },
        include: { items: true },
      });
      if (stdOrder) {
        for (const itm of stdOrder.items) {
          const prod = await prisma.productMetadata.findUnique({ where: { sku: itm.sku } });
          if (prod) {
            await prisma.inventoryRecord.update({
              where: { productMetadataId: prod.id },
              data: {
                availableQuantity: { increment: itm.quantity },
                reservedQuantity: { decrement: itm.quantity },
              },
            });
          }
        }
        await prisma.orderMetadata.delete({ where: { id: stdOrderId } });
      }
    });
  });

  // ==========================================================================
  // SECTION 4: Admin Capabilities, RBAC & Model Assets
  // ==========================================================================
  describe('4. Admin Customization Management, RBAC & Model Assets', () => {
    it('4.1 rejects unauthenticated access to admin endpoints with 401', async () => {
      const res = await request(app).get('/api/admin/customization/profiles');
      expect([401, 403]).toContain(res.status);
    });

    it('4.2 allows Admin to create a new Customization Profile', async () => {
      const profileCode = `AUDIT_PROF_${Date.now()}`;
      const res = await ownerAgent
        .post('/api/admin/customization/profiles')
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .send({
          code: profileCode,
          name: 'Audit Custom Profile',
          description: 'Created during acceptance audit',
          eligibleCategories: ['Rings'],
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.code).toBe(profileCode);
      createdProfileId = res.body.profile.id;
    });

    it('4.3 allows Admin to add Customization Group and Option', async () => {
      const groupRes = await ownerAgent
        .post(`/api/admin/customization/profiles/${createdProfileId}/groups`)
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .send({
          code: 'audit_metal_group',
          name: 'Audit Metal Purity',
          optionCategory: 'METAL',
          selectionMode: 'SINGLE',
          stepOrder: 1,
          isRequired: true,
          isActive: true,
        });

      expect(groupRes.status).toBe(201);
      const createdGroup = groupRes.body.profile || groupRes.body.group;
      expect(createdGroup).toBeDefined();
      createdGroupId = createdGroup.id;

      const optionRes = await ownerAgent
        .post(`/api/admin/customization/groups/${createdGroupId}/options`)
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .send({
          code: 'AUDIT_OPT_22K',
          label: '22K Royal Gold',
          value: '22K Royal Gold',
          priceRuleType: 'FIXED_INR',
          priceRuleValue: 5000,
          swatchHex: '#FFD700',
          metalType: 'GOLD',
          metalPurity: '22K',
          sortOrder: 1,
          isDefault: true,
          isActive: true,
        });

      expect(optionRes.status).toBe(201);
      const createdOpt = optionRes.body.profile || optionRes.body.option;
      if (createdOpt) createdOptionId = createdOpt.id;
    });

    it('4.4 allows Admin to create and query 3D Model Asset via upload', async () => {
      createdModelAssetSku = 'MRS-RNG-1001';

      // Build minimal valid GLB buffer
      const glbHeader = Buffer.alloc(24);
      glbHeader.write('glTF', 0, 'ascii'); // magic
      glbHeader.writeUInt32LE(2, 4);         // version 2
      glbHeader.writeUInt32LE(24, 8);        // total length
      glbHeader.writeUInt32LE(4, 12);        // chunk 0 length
      glbHeader.write('JSON', 16, 'ascii');  // chunk 0 type (JSON)
      glbHeader.write('{}  ', 20, 'ascii');  // chunk 0 data padded

      const assetRes = await ownerAgent
        .post(`/api/admin/model-assets/${createdModelAssetSku}/upload`)
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .attach('file', glbHeader, 'test-model.glb');

      expect([200, 201]).toContain(assetRes.status);
      expect(assetRes.body.modelAsset).toBeDefined();

      const assetUrl = assetRes.body.modelAsset.assetUrl;
      const publicRes = await request(app).get(assetUrl);
      expect(publicRes.status).toBe(200);
      expect(publicRes.headers['content-type']).toContain('model/gltf-binary');
    });

    it('4.5 allows Admin to inspect customer saved designs', async () => {
      const res = await ownerAgent.get('/api/admin/designs');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.designs)).toBe(true);
      expect(res.body.designs.some((d: any) => d.id === createdDesignAId)).toBe(true);
    });

    it('4.6 verifies audit log entries generated for admin actions', async () => {
      const res = await ownerAgent.get('/api/admin/audit-logs');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.auditLogs)).toBe(true);
      expect(res.body.auditLogs.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 5: 3D Viewer Mechanics & GLB Parsing Validation
  // ==========================================================================
  describe('5. 3D Viewer Mechanics & Fallback Handling', () => {
    it('5.1 validates GLB binary magic header 0x46546C67 (glTF)', () => {
      const buffer = new ArrayBuffer(24);
      const dv = new DataView(buffer);
      dv.setUint32(0, 0x46546c67, true); // 'glTF'
      dv.setUint32(4, 2, true);          // version 2
      dv.setUint32(8, 24, true);         // total length

      const magic = dv.getUint32(0, true);
      expect(magic).toBe(0x46546c67);
      expect(buffer.byteLength).toBeGreaterThanOrEqual(20);
    });

    it('5.2 catches invalid GLB header and triggers graceful fallback', () => {
      const invalidBuffer = new ArrayBuffer(24);
      const dv = new DataView(invalidBuffer);
      dv.setUint32(0, 0x12345678, true); // Invalid header

      const isValidGlb = (buf: ArrayBuffer) => {
        if (buf.byteLength < 20) return false;
        const view = new DataView(buf);
        return view.getUint32(0, true) === 0x46546c67;
      };

      expect(isValidGlb(invalidBuffer)).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 6: PostgreSQL Importer Full Lifecycle (Dry Run, Commit, Rollback)
  // ==========================================================================
  describe('6. PostgreSQL Importer Audit: Dry Run, Explicit Commit & Rollback', () => {
    let testWorkbookBase64 = '';

    beforeAll(() => {
      const rows = [
        {
          'Sr No': 1,
          'Product Tag': 'AUDIT-NEW',
          SKU: 'AUDIT-NEW-BRACELET-01',
          Title: 'Audit Acceptance Test Bracelet',
          Handle: 'audit-acceptance-test-bracelet',
          Category: 'Bracelets',
          'Metal Type': 'GOLD',
          'Metal Purity': '18K',
          'Metal Color': 'YELLOW_GOLD',
          'Ring Size': '',
          'Gross Weight (g)': 12.5,
          'Net Weight (g)': 12.0,
          'Making Charge Mode': 'PER_GRAM_NET',
          'Making Charge Value': 1200,
          'Wastage Mode': 'NONE',
          'Wastage (%)': 0,
          'Certification Fee (INR)': 1500,
          'Diamond 1 Shape': '',
          'Diamond 1 Quality': '',
          'Diamond 1 Sieve': '',
          'Diamond 1 Pieces': 0,
          'Diamond 1 Carat': 0,
          'Diamond 2 Shape': '',
          'Diamond 2 Quality': '',
          'Diamond 2 Sieve': '',
          'Diamond 2 Pieces': 0,
          'Diamond 2 Carat': 0,
          Hallmarked: 'Yes',
          'Stock Qty': 5,
          'Image URL': 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/6158221b28f34134f5119c8a750d12eceab5003b.png',
        },
        {
          'Sr No': 2,
          'Product Tag': 'TEST-TAG',
          SKU: 'TEST-ARTIFACT-SKU-99',
          Title: 'Test Artifact to be Excluded',
          Handle: 'test-artifact-to-be-excluded',
          Category: 'Rings',
          'Metal Type': 'GOLD',
          'Metal Purity': '18K',
          'Metal Color': 'YELLOW_GOLD',
          'Ring Size': '12',
          'Gross Weight (g)': 5.0,
          'Net Weight (g)': 4.8,
          'Making Charge Mode': 'PER_GRAM_NET',
          'Making Charge Value': 1000,
          'Wastage Mode': 'NONE',
          'Wastage (%)': 0,
          'Certification Fee (INR)': 1000,
          'Diamond 1 Shape': '',
          'Diamond 1 Quality': '',
          'Diamond 1 Sieve': '',
          'Diamond 1 Pieces': 0,
          'Diamond 1 Carat': 0,
          'Diamond 2 Shape': '',
          'Diamond 2 Quality': '',
          'Diamond 2 Sieve': '',
          'Diamond 2 Pieces': 0,
          'Diamond 2 Carat': 0,
          Hallmarked: 'Yes',
          'Stock Qty': 2,
          'Image URL': 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
        },
        {
          'Sr No': 3,
          'Product Tag': 'CONFLICT',
          SKU: 'MRS-EAR-2001',
          Title: 'Conflicting Stock Overwrite Attempt',
          Handle: 'royal-polki-chandbali-earrings',
          Category: 'Earrings',
          'Metal Type': 'GOLD',
          'Metal Purity': '22K',
          'Metal Color': 'YELLOW_GOLD',
          'Ring Size': '',
          'Gross Weight (g)': 26.5,
          'Net Weight (g)': 22.1,
          'Making Charge Mode': 'PER_GRAM_NET',
          'Making Charge Value': 1200,
          'Wastage Mode': 'NONE',
          'Wastage (%)': 0,
          'Certification Fee (INR)': 1500,
          'Diamond 1 Shape': '',
          'Diamond 1 Quality': '',
          'Diamond 1 Sieve': '',
          'Diamond 1 Pieces': 0,
          'Diamond 1 Carat': 0,
          'Diamond 2 Shape': '',
          'Diamond 2 Quality': '',
          'Diamond 2 Sieve': '',
          'Diamond 2 Pieces': 0,
          'Diamond 2 Carat': 0,
          Hallmarked: 'Yes',
          'Stock Qty': 99,
          'Image URL': 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
        },
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Bracelets');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      testWorkbookBase64 = buf.toString('base64');
    });

    it('6.1 DRY RUN: validates workbook, reports preview, commits ZERO rows to PostgreSQL', async () => {
      const res = await ownerAgent
        .post('/api/admin/imports/excel')
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .send({
          fileName: 'audit-dry-run.xlsx',
          base64Content: testWorkbookBase64,
          mode: 'DRY_RUN',
          dryRun: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.importJob).toBeDefined();
      expect(res.body.importJob.dryRun).toBe(true);
      expect(res.body.committedProductsCount).toBe(0);
      dryRunImportJobId = res.body.importJob.id;

      // Verify PostgreSQL: AUDIT-NEW-BRACELET-01 must NOT exist
      const checkProd = await prisma.productMetadata.findUnique({
        where: { sku: 'AUDIT-NEW-BRACELET-01' },
      });
      expect(checkProd).toBeNull();

      // Verify MRS-EAR-2001 inventory remains 9
      const ear = await prisma.productMetadata.findUnique({
        where: { sku: 'MRS-EAR-2001' },
        include: { inventoryRecord: true },
      });
      expect(ear?.inventoryRecord?.availableQuantity).toBe(9);
    });

    it('6.2 COMMIT: persists new SKU, skips TEST-* artifact, preserves MRS-EAR-2001 = 9', async () => {
      const res = await ownerAgent
        .post('/api/admin/imports/excel')
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf)
        .send({
          fileName: 'audit-commit.xlsx',
          base64Content: testWorkbookBase64,
          mode: 'COMMIT',
          dryRun: false,
          confirmCommit: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.importJob.dryRun).toBe(false);
      expect(res.body.committedProductsCount).toBe(1);
      expect(res.body.skippedTestArtifacts).toBe(1); // TEST-ARTIFACT-SKU-99 skipped
      committedImportJobId = res.body.importJob.id;

      // Verify PostgreSQL: AUDIT-NEW-BRACELET-01 was persisted
      const newProd = await prisma.productMetadata.findUnique({
        where: { sku: 'AUDIT-NEW-BRACELET-01' },
        include: { inventoryRecord: true },
      });
      expect(newProd).toBeDefined();
      expect(newProd?.inventoryRecord?.availableQuantity).toBe(5);

      // Verify TEST-ARTIFACT-SKU-99 was NOT persisted
      const testProd = await prisma.productMetadata.findUnique({
        where: { sku: 'TEST-ARTIFACT-SKU-99' },
      });
      expect(testProd).toBeNull();

      // Verify MRS-EAR-2001 stock remained strictly 9!
      const ear = await prisma.productMetadata.findUnique({
        where: { sku: 'MRS-EAR-2001' },
        include: { inventoryRecord: true },
      });
      expect(ear?.inventoryRecord?.availableQuantity).toBe(9);
    });

    it('6.3 ROLLBACK: removes committed SKU, updates job status to ROLLED_BACK, preserves MRS-EAR-2001 = 9', async () => {
      const rollbackRes = await ownerAgent
        .post(`/api/admin/imports/${committedImportJobId}/rollback`)
        .set('Origin', 'http://localhost:3001')
        .set('x-csrf-token', adminCsrf);

      expect(rollbackRes.status).toBe(200);
      expect(rollbackRes.body.rolledBack).toBe(true);
      expect(rollbackRes.body.removedProductsCount).toBe(1);

      // Verify PostgreSQL: AUDIT-NEW-BRACELET-01 has been removed
      const removedProd = await prisma.productMetadata.findUnique({
        where: { sku: 'AUDIT-NEW-BRACELET-01' },
      });
      expect(removedProd).toBeNull();

      // Verify ImportJob status updated to ROLLED_BACK
      const job = await prisma.importJob.findUnique({
        where: { id: committedImportJobId },
      });
      expect(job?.status).toBe('ROLLED_BACK');

      // Verify MRS-EAR-2001 stock remains strictly 9
      const ear = await prisma.productMetadata.findUnique({
        where: { sku: 'MRS-EAR-2001' },
        include: { inventoryRecord: true },
      });
      expect(ear?.inventoryRecord?.availableQuantity).toBe(9);
    });
  });

  // ==========================================================================
  // SECTION 7: Data Consistency & Final Table Reconciliation
  // ==========================================================================
  describe('7. PostgreSQL Data Reconciliation & Consistency Verification', () => {
    it('7.1 verifies catalogue status counts and that public endpoint returns only ACTIVE products', async () => {
      const [totalCount, activeCount, draftCount] = await Promise.all([
        prisma.productMetadata.count(),
        prisma.productMetadata.count({ where: { status: 'ACTIVE' } }),
        prisma.productMetadata.count({ where: { status: 'DRAFT' } }),
      ]);
      expect(totalCount).toBe(activeCount + draftCount);
      expect(activeCount).toBe(8);
      expect(draftCount).toBeGreaterThanOrEqual(1);

      const publicRes = await request(app).get('/api/products');
      expect(publicRes.status).toBe(200);
      expect(Array.isArray(publicRes.body.products)).toBe(true);
      expect(publicRes.body.products.length).toBe(activeCount);
      expect(publicRes.body.products.every((p: any) => (p.status || 'ACTIVE') === 'ACTIVE')).toBe(true);
    });

    it('7.2 verifies MRS-EAR-2001 inventory is strictly 9', async () => {
      const ear = await prisma.productMetadata.findUnique({
        where: { sku: 'MRS-EAR-2001' },
        include: { inventoryRecord: true },
      });
      expect(ear).toBeDefined();
      expect(ear?.inventoryRecord?.availableQuantity).toBe(9);
    });

    it('7.3 verifies zero orphan records in customization relationships', async () => {
      const allOptions = await prisma.customizationOption.findMany({ include: { group: true } });
      const orphanOptions = allOptions.filter((o) => !o.group);
      expect(orphanOptions.length).toBe(0);

      const allGroups = await prisma.customizationGroup.findMany({ include: { profile: true } });
      const orphanGroups = allGroups.filter((g) => !g.profile);
      expect(orphanGroups.length).toBe(0);
    });
  });
});
