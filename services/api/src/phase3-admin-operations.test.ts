import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Application } from 'express';
import { ROLE_PERMISSIONS, type AdminRoleName } from '@mrs/shared';
import { createApp } from './app.js';
import { dbStore, DataStore } from './store/data-store.js';
import { JsonRuntimeBackend } from './db/runtime-backend.js';
import { signAdminToken, signCustomerToken } from './middleware/auth.js';
import { escapeCsvValue } from './app.js';

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
    reqEmitter.headers = rawHeaders;
    reqEmitter.query = {};
    const parsedUrl = new URL(options.url, 'http://localhost');
    reqEmitter.path = parsedUrl.pathname;
    reqEmitter.query = Object.fromEntries(parsedUrl.searchParams.entries());

    if (options.body !== undefined) {
      reqEmitter.body = options.body;
    }
    if (options.rawBody !== undefined) {
      reqEmitter.rawBody = options.rawBody;
    }

    const resHeaders: Record<string, string> = {};
    const chunks: Buffer[] = [];
    const resEmitter = new EventEmitter() as any;
    resEmitter.statusCode = 200;
    resEmitter.headersSent = false;

    resEmitter.setHeader = (k: string, v: string) => {
      resHeaders[k.toLowerCase()] = String(v);
      return resEmitter;
    };
    resEmitter.getHeader = (k: string) => resHeaders[k.toLowerCase()];
    resEmitter.status = (code: number) => {
      resEmitter.statusCode = code;
      return resEmitter;
    };
    resEmitter.sendStatus = (code: number) => {
      resEmitter.statusCode = code;
      resEmitter.end(String(code));
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

describe('Phase 3 Admin Business Operations & Hardening Suite', () => {
  let backend: JsonRuntimeBackend;
  let app: ReturnType<typeof createApp>;

  let ownerToken: string;
  let managerToken: string;
  let operatorToken: string;
  let customerToken: string;

  beforeEach(() => {
    const currentUsers = dbStore.getState().users;
    for (const u of currentUsers) {
      if (u.id === 'usr-manager-1') u.role = 'MANAGER';
      if (u.id === 'usr-operator-1') u.role = 'PRICING_OPERATOR';
      if (u.id === 'usr-owner-1') u.role = 'OWNER';
    }

    backend = new JsonRuntimeBackend(dbStore);
    app = createApp(dbStore);

    ownerToken = signAdminToken({
      id: 'usr-owner-1',
      email: 'owner@mangalroyalstudio.com',
      role: 'OWNER',
      permissions: [...ROLE_PERMISSIONS.OWNER],
    });

    managerToken = signAdminToken({
      id: 'usr-manager-1',
      email: 'manager@mangalroyalstudio.com',
      role: 'MANAGER',
      permissions: [...ROLE_PERMISSIONS.MANAGER],
    });

    operatorToken = signAdminToken({
      id: 'usr-operator-1',
      email: 'pricing@mangalroyalstudio.com',
      role: 'PRICING_OPERATOR',
      permissions: [...ROLE_PERMISSIONS.PRICING_OPERATOR],
    });

    customerToken = signCustomerToken({
      id: 'cust-001',
      email: 'ananya.sharma@example.com',
    });
  });

  describe('1. Executive Dashboard Overview & Honest Financial Semantics', () => {
    it('returns honest financial definitions and range filtering', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview?range=30d',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('kpis');
      expect(res.body).toHaveProperty('financialMetrics');
      expect(res.body).toHaveProperty('orderStatusDistribution');
      expect(res.body).toHaveProperty('topSellingProducts');
      expect(res.body).toHaveProperty('timeSeriesTrends');
      expect(res.body).toHaveProperty('inventoryAlerts');

      const fin = res.body.financialMetrics;
      expect(fin).toHaveProperty('grossCapturedInr');
      expect(fin).toHaveProperty('totalRefundedInr');
      expect(fin).toHaveProperty('netRevenueInr');
      expect(fin).toHaveProperty('paidOrdersTotalInr');
      expect(fin.currency).toBe('INR');
      expect(fin).toHaveProperty('disclaimer');

      expect(res.body.kpis).toHaveProperty('totalProducts');
      expect(res.body.kpis).toHaveProperty('totalCategories');
      expect(res.body.kpis).toHaveProperty('totalOrders');
    });

    it('masks customer PII in recentOrders for non-owner role', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { Authorization: `Bearer ${operatorToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.recentOrders.length).toBeGreaterThan(0);
      for (const order of res.body.recentOrders) {
        expect(order.customerName).toBe('Customer');
        expect(order.customerEmail).toContain('•••');
        expect(order.customerPhone).toBe('');
      }
    });

    it('shows unmasked customer PII in recentOrders for owner role', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/overview',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.recentOrders.length).toBeGreaterThan(0);
      const first = res.body.recentOrders[0];
      expect(first.customerEmail).not.toContain('•••');
    });
  });

  describe('2. Server-side Pagination, Search, Filter & Sort Contracts', () => {
    it('paginates products list and returns items, total, page, pageSize, totalPages', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products?page=1&pageSize=3&sortBy=sku&sortDirection=asc',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('pageSize', 3);
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('products');
      expect(res.body.items.length).toBeLessThanOrEqual(3);

      expect(res.body.items[0]).toHaveProperty('latestBreakdown');
      expect(res.body.items[0].latestBreakdown).toHaveProperty('finalProposedPriceInr');
    });

    it('filters products by search', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products?search=ring',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        const matches =
          item.title.toLowerCase().includes('ring') ||
          item.sku.toLowerCase().includes('ring') ||
          item.handle.toLowerCase().includes('ring');
        expect(matches).toBe(true);
      }
    });

    it('GET /api/admin/products/:sku returns single product or 404', async () => {
      const okRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products/MRS-EAR-2001',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(okRes.status).toBe(200);
      expect(okRes.body.product.sku).toBe('MRS-EAR-2001');
      expect(okRes.body).toHaveProperty('latestBreakdown');

      const notFoundRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products/NON-EXISTENT-SKU',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('paginates orders list and enforces CUSTOMERS_PII_VIEW gating', async () => {
      const mgrRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/orders?page=1&pageSize=5',
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body).toHaveProperty('items');
      expect(mgrRes.body).toHaveProperty('total');
      expect(mgrRes.body).toHaveProperty('orders');
      for (const o of mgrRes.body.items) {
        expect(o.customerName).toBe('Customer');
        expect(o.customerEmail).toContain('•••');
      }

      const ownerRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/orders?page=1&pageSize=5',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(ownerRes.status).toBe(200);
      const unmasked = ownerRes.body.items[0];
      expect(unmasked.customerEmail).not.toContain('•••');
    });

    it('paginates customers list with PII masking', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/customers?page=1&pageSize=10',
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('customers');
      for (const c of res.body.items) {
        expect(c.firstName).toBe('Customer');
        expect(c.email).toContain('•••');
      }
    });

    it('paginates inventory list and supports lowStockOnly filter', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/inventory?lowStockOnly=true',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('inventory');
      for (const item of res.body.items) {
        expect(item.inventoryQuantity).toBeLessThanOrEqual(2);
      }
    });

    it('paginates audit logs with date and action filtering', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/audit-logs?page=1&pageSize=5',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('auditLogs');
      expect(res.body).toHaveProperty('total');
    });

    it('paginates users list', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/users?page=1&pageSize=10',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('users');
      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });

  describe('3. Order Management, State Transitions & Fail-Closed Shipments', () => {
    it('GET /api/admin/orders/:orderId returns detail with payments, refunds, and shipments', async () => {
      const orders = await backend.listOrders();
      const target = orders[0]!;

      const res = await invokeApp(app, {
        method: 'GET',
        url: `/api/admin/orders/${target.id}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('order');
      expect(res.body.order.orderNumber).toBe(target.orderNumber);
      expect(res.body).toHaveProperty('payments');
      expect(res.body).toHaveProperty('refunds');
      expect(res.body).toHaveProperty('shipments');
    });

    it('transitions order status through allowed state machine and records audit log', async () => {
      const orders = await backend.listOrders();
      const target = (orders.find((o) => o.fulfillmentStatus === 'UNFULFILLED') || orders[0])!;

      const res = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/orders/${target.id}/transition`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { status: 'PROCESSING', reason: 'Order verification completed' },
      });

      expect(res.status).toBe(200);
      expect(res.body.order.fulfillmentStatus).toBe('PROCESSING');
      expect(res.body.newStatus).toBe('PROCESSING');

      const logs = await backend.listAuditLogs();
      const log = logs.find(
        (l) => l.action === 'ORDER_STATUS_UPDATED' && l.entityId === target.id
      );
      expect(log).toBeDefined();
    });

    it('rejects illegal transition from cancelled order', async () => {
      const orders = await backend.listOrders();
      const cancelledOrder = orders.find((o) => o.fulfillmentStatus === 'CANCELLED');

      if (cancelledOrder) {
        const res = await invokeApp(app, {
          method: 'POST',
          url: `/api/admin/orders/${cancelledOrder.id}/transition`,
          headers: { Authorization: `Bearer ${ownerToken}` },
          body: { status: 'CONFIRMED' },
        });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('transitions to CANCELLED triggers inventory restoration', async () => {
      const product = (await backend.listProducts()).find((p) => p.sku === 'MRS-RNG-1001')!;
      const initialStock = product.inventoryQuantity;

      const order = await backend.createOrderWithInventoryReservation({
        orderNumber: `TEST-ORD-${Date.now()}`,
        customerEmail: 'test.customer@example.com',
        customerName: 'Test Customer',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400001',
        shippingAddressJson: {},
        subtotalPriceInr: '50000.00',
        totalTaxInr: '1500.00',
        totalPriceInr: '51500.00',
        lineItems: [
          {
            sku: product.sku,
            title: product.title,
            quantity: 1,
            purchaseTimePriceInr: '50000.00',
          },
        ],
      });

      const stockAfterReservation = (await backend.findProductByHandleOrSku(product.sku))!.inventoryQuantity;
      expect(stockAfterReservation).toBe(initialStock - 1);

      const res = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/orders/${order.id}/transition`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { status: 'CANCELLED', reason: 'Customer changed mind before dispatch' },
      });

      expect(res.status).toBe(200);
      expect(res.body.order.fulfillmentStatus).toBe('CANCELLED');

      const stockAfterCancel = (await backend.findProductByHandleOrSku(product.sku))!.inventoryQuantity;
      expect(stockAfterCancel).toBe(initialStock);
    });

    it('GET /api/admin/orders/:orderId/invoice returns printable GST invoice metadata', async () => {
      const orders = await backend.listOrders();
      const target = orders[0]!;

      const res = await invokeApp(app, {
        method: 'GET',
        url: `/api/admin/orders/${target.id}/invoice`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('invoice');
      const inv = res.body.invoice;
      expect(inv.orderNumber).toBe(target.orderNumber);
      expect(inv).toHaveProperty('storeName');
      expect(inv).toHaveProperty('lineItems');
      expect(inv).toHaveProperty('totalPriceInr');
    });

    it('POST /api/admin/orders/:orderId/shipments fails closed with 503 SHIPMENT_PROVIDER_NOT_CONFIGURED', async () => {
      const orders = await backend.listOrders();
      const target = orders[0]!;

      const res = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/orders/${target.id}/shipments`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {},
      });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('SHIPMENT_PROVIDER_NOT_CONFIGURED');
    });
  });

  describe('4. Inventory Management, Concurrency Protection & Baseline Safety', () => {
    it('strictly forbids manual adjustment of MRS-EAR-2001 (403 PROTECTED_INVENTORY_RECORD)', async () => {
      const initialProd = await backend.findProductByHandleOrSku('MRS-EAR-2001');
      const initialQty = initialProd!.inventoryQuantity;

      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/inventory/adjust',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          sku: 'MRS-EAR-2001',
          deltaQuantity: 1,
          reason: 'Attempted manual modification of baseline stock',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PROTECTED_INVENTORY_RECORD');

      const prod = await backend.findProductByHandleOrSku('MRS-EAR-2001');
      expect(prod!.inventoryQuantity).toBe(initialQty);
    });

    it('rejects stale inventory update when expectedQuantity does not match (409 STALE_INVENTORY_UPDATE)', async () => {
      const product = (await backend.listProducts()).find((p) => p.sku === 'MRS-RNG-1001')!;
      const actualQty = product.inventoryQuantity;

      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/inventory/adjust',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          sku: 'MRS-RNG-1001',
          deltaQuantity: 1,
          expectedQuantity: actualQty + 5,
          reason: 'Concurrent test update',
        },
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('STALE_INVENTORY_UPDATE');
      expect(res.body.currentQuantity).toBe(actualQty);
    });

    it('executes valid inventory adjustment and records immutable movement history', async () => {
      const product = (await backend.listProducts()).find((p) => p.sku === 'MRS-RNG-1001')!;
      const prevQty = product.inventoryQuantity;

      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/inventory/adjust',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          sku: 'MRS-RNG-1001',
          deltaQuantity: 2,
          expectedQuantity: prevQty,
          reason: 'Physical inventory count reconciliation',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.previousQuantity).toBe(prevQty);
      expect(res.body.inventoryQuantity).toBe(prevQty + 2);
      expect(res.body.movement).toBeDefined();
      expect(res.body.movement.deltaQuantity).toBe(2);

      const movRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/inventory/movements?sku=MRS-RNG-1001',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(movRes.status).toBe(200);
      expect(movRes.body.items.length).toBeGreaterThan(0);
      expect(movRes.body.items[0].sku).toBe('MRS-RNG-1001');
    });
  });

  describe('5. Customer Management & Detail IDOR / PII Boundaries', () => {
    it('GET /api/admin/customers/:customerId returns profile with orders and saved designs', async () => {
      const customers = await backend.listCustomers();
      const target = customers[0]!;

      const res = await invokeApp(app, {
        method: 'GET',
        url: `/api/admin/customers/${target.id}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('customer');
      expect(res.body.customer.id).toBe(target.id);
      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('designs');
    });

    it('masks PII in customer profile for non-owner role', async () => {
      const customers = await backend.listCustomers();
      const target = customers[0]!;

      const res = await invokeApp(app, {
        method: 'GET',
        url: `/api/admin/customers/${target.id}`,
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.customer.firstName).toBe('Customer');
      expect(res.body.customer.email).toContain('•••');
    });
  });

  describe('6. Safe Excel Import Protocol (Preview -> Hash Binding -> Commit)', () => {
    it('enforces owner-only permission on import commit', async () => {
      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/imports/job-fake-123/commit',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: {
          jobId: 'job-fake-123',
          workbookHash: 'abcdef0123456789abcdef0123456789',
          confirmCommit: true,
        },
      });

      expect(res.status).toBe(403);
      expect(['OWNER_APPROVAL_REQUIRED', 'OWNER_ROLE_REQUIRED']).toContain(res.body.error);
    });

    it('rejects commit when confirmCommit is false or missing', async () => {
      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/imports/job-fake-123/commit',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          jobId: 'job-fake-123',
          workbookHash: 'abcdef0123456789abcdef0123456789',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects commit when job is not found', async () => {
      const res = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/imports/job-non-existent/commit',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          jobId: 'job-non-existent',
          workbookHash: 'abcdef0123456789abcdef0123456789',
          confirmCommit: true,
        },
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('IMPORT_JOB_NOT_FOUND');
    });

    it('creates a preview import job and commits it safely', async () => {
      const previewRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/imports/excel',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { mode: 'DRY_RUN' },
      });

      expect(previewRes.status).toBe(201);
      const job = previewRes.body.importJob;
      expect(job.status).toBe('PREVIEWED');
      expect(job.workbookHash).toBeDefined();
      expect(job.expiresAt).toBeDefined();

      const commitRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/imports/${job.id}/commit`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          jobId: job.id,
          workbookHash: job.workbookHash,
          confirmCommit: true,
        },
      });

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.job.status).toBe('COMMITTED');

      const idempotentRes = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/imports/${job.id}/commit`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          jobId: job.id,
          workbookHash: job.workbookHash,
          confirmCommit: true,
        },
      });

      expect(idempotentRes.status).toBe(200);
      expect(idempotentRes.body.alreadyCommitted).toBe(true);
    });

    it('rejects commit when workbookHash does not match', async () => {
      const previewRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/imports/excel',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { mode: 'DRY_RUN' },
      });

      expect(previewRes.status).toBe(201);
      const job = previewRes.body.importJob;

      const res = await invokeApp(app, {
        method: 'POST',
        url: `/api/admin/imports/${job.id}/commit`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          jobId: job.id,
          workbookHash: '00000000000000000000000000000000',
          confirmCommit: true,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WORKBOOK_HASH_MISMATCH');
    });
  });

  describe('7. Reports CSV Export & Formula Injection Escaping', () => {
    it('escapes risky formula injection characters (=, +, -, @, tab, cr)', () => {
      expect(escapeCsvValue('=1+2')).toBe("'=1+2");
      expect(escapeCsvValue('+cmd|/c')).toBe("'+cmd|/c");
      expect(escapeCsvValue('-2+3')).toBe("'-2+3");
      expect(escapeCsvValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(escapeCsvValue('Normal Product Title')).toBe('Normal Product Title');
      expect(escapeCsvValue('Title with, comma')).toBe('"Title with, comma"');
    });

    it('enforces CUSTOMERS_PII_VIEW on order report CSV export', async () => {
      const deniedRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/reports/export.csv?type=orders',
        headers: { Authorization: `Bearer ${operatorToken}` },
      });
      expect(deniedRes.status).toBe(403);

      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/reports/export.csv?type=orders',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Order Number');
    });

    it('exports products and inventory CSV safely', async () => {
      const res = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/reports/export.csv?type=products',
        headers: { Authorization: `Bearer ${operatorToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('SKU');
      expect(res.text).toContain('MRS-EAR-2001');
    });
  });

  describe('8. User Management & Owner Protection', () => {
    it('updates user role and records audit log', async () => {
      const users = await backend.listAdminUsers();
      const targetUser = (users.find((u) => u.role !== 'OWNER') || users[1])!;

      const res = await invokeApp(app, {
        method: 'PUT',
        url: `/api/admin/users/${targetUser.id}/role`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { role: 'PRICING_OPERATOR' },
      });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('PRICING_OPERATOR');

      const logs = await backend.listAuditLogs();
      const log = logs.find(
        (l) => l.action === 'ADMIN_ROLE_UPDATED' && l.entityId === targetUser.id
      );
      expect(log).toBeDefined();
    });

    it('rejects non-owner attempting to change user role (403)', async () => {
      const users = await backend.listAdminUsers();
      const targetUser = users[0]!;

      const res = await invokeApp(app, {
        method: 'PUT',
        url: `/api/admin/users/${targetUser.id}/role`,
        headers: { Authorization: `Bearer ${managerToken}` },
        body: { role: 'PRICING_OPERATOR' },
      });

      expect(res.status).toBe(403);
    });

    it('prevents downgrading the last active owner (409 CANNOT_DOWNGRADE_LAST_OWNER)', async () => {
      const users = await backend.listAdminUsers();
      const owner = users.find((u) => u.role === 'OWNER')!;
      expect(owner).toBeDefined();

      for (const u of users) {
        if (u.id !== owner.id && u.role === 'OWNER') {
          u.role = 'MANAGER';
        }
      }

      const res = await invokeApp(app, {
        method: 'PUT',
        url: `/api/admin/users/${owner.id}/role`,
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { role: 'MANAGER' },
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CANNOT_DOWNGRADE_LAST_OWNER');
    });
  });

  describe('7. Owner-Updated Market Rates Controlled in Admin & Storefront Propagation', () => {
    it('enforces confirmation before publishing rate changes and blocks conflicting 24K activation', async () => {
      const unauthRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/market-card',
        body: { confirmPublish: true },
      });
      expect(unauthRes.status).toBe(401);

      const unconfirmedRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/market-card',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          gold14kPerGramInr: '10200.00',
          gold18kPerGramInr: '12300.00',
          gold22kPerGramInr: '11510.00',
          platinum950PerGramInr: '3911.00',
          makingChargePerGramInr: '2500.00',
          diamondUnder1CaratPerCaratInr: '30000.00',
          diamondOver1CaratPerCaratInr: '45000.00',
          confirmPublish: false,
        },
      });
      expect(unconfirmedRes.status).toBe(400);
      expect(unconfirmedRes.body.error).toBe('RATE_PUBLISH_CONFIRMATION_REQUIRED');

      const blocked24kRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/market-card',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          gold14kPerGramInr: '10200.00',
          gold18kPerGramInr: '12300.00',
          gold22kPerGramInr: '11510.00',
          gold24kPerGramInr: '15400.00',
          platinum950PerGramInr: '3911.00',
          makingChargePerGramInr: '2500.00',
          diamondUnder1CaratPerCaratInr: '30000.00',
          diamondOver1CaratPerCaratInr: '45000.00',
          confirmPublish: true,
        },
      });
      expect(blocked24kRes.status).toBe(409);
      expect(blocked24kRes.body.error).toBe('24K_RATE_BLOCKED_PENDING_CONFIRMATION');

      const blockedSingle24kRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/metals',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          metalType: 'GOLD',
          purity: '24K',
          ratePerGramInr: '154000.00',
          source: 'Owner-updated market rates',
          isPlaceholder: false,
        },
      });
      expect(blockedSingle24kRes.status).toBe(409);
      expect(blockedSingle24kRes.body.error).toBe('24K_RATE_BLOCKED_PENDING_CONFIRMATION');
    });

    it('updates Owner-updated market rates, records audit history, and propagates across products, PDP, cart, andoverrides', async () => {
      const updateRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/admin/rates/market-card',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          gold14kPerGramInr: '10200.00',
          gold18kPerGramInr: '12300.00',
          gold22kPerGramInr: '11510.00',
          platinum950PerGramInr: '3911.00',
          makingChargePerGramInr: '2500.00',
          diamondUnder1CaratPerCaratInr: '30000.00',
          diamondOver1CaratPerCaratInr: '45000.00',
          confirmPublish: true,
          notes: 'Owner-supplied market rates verified in audit',
        },
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.rateCard.label).toBe('Owner-updated market rates');
      expect(updateRes.body.rateCard.rates.gold14kPerGramInr).toBe('10200.00');
      expect(updateRes.body.rateCard.rates.gold18kPerGramInr).toBe('12300.00');
      expect(updateRes.body.rateCard.rates.gold22kPerGramInr).toBe('11510.00');
      expect(updateRes.body.rateCard.rates.platinum950PerGramInr).toBe('3911.00');
      expect(updateRes.body.rateCard.rates.makingChargePerGramInr).toBe('2500.00');
      expect(updateRes.body.rateCard.rates.diamondUnder1CaratPerCaratInr).toBe('30000.00');
      expect(updateRes.body.rateCard.rates.diamondOver1CaratPerCaratInr).toBe('45000.00');
      expect(updateRes.body.rateCard.rates.gold24kStatus).toBe('BLOCKED_PENDING_CONFIRMATION');
      expect(updateRes.body.rateCard.rates.diamondExact1CaratStatus).toBe('PENDING_OWNER_INPUT');

      // Audit history recorded with beforeData, afterData, actor, and version
      const auditEntry = updateRes.body.rateAuditHistory.find(
        (a: any) => a.action === 'OWNER_MARKET_RATE_CARD_UPDATED'
      );
      expect(auditEntry).toBeDefined();
      expect(auditEntry.actorEmail).toBe('owner@mangalroyalstudio.com');
      expect(auditEntry.beforeData).toBeDefined();
      expect(auditEntry.afterData.rates.gold18kPerGramInr).toBe('12300.00');

      // Deactivate legacy seed diamond brackets so only < 1.00 ct and > 1.00 ct are active
      const state = dbStore.getState();
      for (const dr of state.diamondRates) {
        if (Number(dr.sizeMinCarat) <= 1 && Number(dr.sizeMaxCarat) >= 1) {
          dr.isActive = false;
        }
      }

      // Check catalog propagation (/api/products) and PDP (/api/products/:handle)
      const catalogRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/products',
      });
      expect(catalogRes.status).toBe(200);
      expect(catalogRes.body.rateCard.label).toBe('Owner-updated market rates');

      const rng1001 = catalogRes.body.products.find((p: any) => p.sku === 'MRS-RNG-1001');
      expect(rng1001).toBeDefined();
      expect(rng1001.priceOnRequest).toBe(false);
      // Owner rate card: tier by COMBINED carat weight; certification/hallmark/wastage not included.
      // 18K 3.8g * 12300 = 46740; Making 3.8g * 2500 = 9500; Diamonds combined 1.50 + 0.25 = 1.75ct (>1ct @ 45000) = 78750
      // -> Subtotal 134990 + 3% GST (4049.70) = 139039.70 -> rounded ₹139,040.00
      expect(rng1001.currentShopifyPriceInr).toBe('139040.00');
      expect(rng1001.priceBreakup.finalProposedPriceInr).toBe('139040.00');
      expect(rng1001.priceBreakup.certificationFeeInr).toBe('0.00');
      expect(rng1001.priceBreakup.hallmarkFeeInr).toBe('0.00');
      expect(rng1001.priceBreakup.diamondTierBasis).toBe('TOTAL_PRODUCT_CARAT');

      const pdpRes = await invokeApp(app, {
        method: 'GET',
        url: '/api/products/MRS-RNG-1001',
      });
      expect(pdpRes.status).toBe(200);
      expect(pdpRes.body.product.currentShopifyPriceInr).toBe('139040.00');
      expect(pdpRes.body.priceBreakup.finalProposedPriceInr).toBe('139040.00');

      // Cart uses the exact same server-calculated price
      const cartRes = await invokeApp(app, {
        method: 'POST',
        url: '/api/cart/test-market-cart/items',
        body: { sku: 'MRS-RNG-1001', quantity: 1 },
      });
      expect(cartRes.status).toBe(200);
      expect(cartRes.body.cart.items[0].unitPriceInr).toBe('139040.00');

      // MRS-RNG-1002: 1.000 ct centre + 0.200 ct melee = 1.20 ct combined (>1ct @ 45000) -> priced, not held.
      // 18K 3.6g: metal 44280 + making 9000 + diamonds 54000 = 107280 + GST 3218.40 = 110498.40 -> ₹110,498.00
      const rng1002 = catalogRes.body.products.find((p: any) => p.sku === 'MRS-RNG-1002');
      expect(rng1002.priceOnRequest).toBe(false);
      expect(rng1002.priceBreakup.finalProposedPriceInr).toBe('110498.00');

      // Exactly 1.00 ct combined (MRS-EAR-2001: 2 x 0.50 ct = 1.00 ct) -> Price on request
      const ear2001 = catalogRes.body.products.find((p: any) => p.sku === 'MRS-EAR-2001');
      expect(ear2001.priceOnRequest).toBe(true);
      expect(ear2001.priceOnRequestReason).toBe('DIAMOND_RATE_MISSING_EXACT_1CT');
      expect(ear2001.displayPriceLabel).toBe('Price on request');
      // Public payload never carries a stale stored price or internal fee inputs for a Price-on-request item
      expect(ear2001.currentShopifyPriceInr).toBe('0.00');
      expect(ear2001.certificationFeeInr).toBeUndefined();
      expect(ear2001.makingChargeValue).toBeUndefined();

      const blockedCart1ct = await invokeApp(app, {
        method: 'POST',
        url: '/api/cart/test-market-cart/items',
        body: { sku: 'MRS-EAR-2001', quantity: 1 },
      });
      expect(blockedCart1ct.status).toBe(422);
      expect(blockedCart1ct.body.error).toBe('PRICE_ON_REQUEST');

      // 22K product (MRS-ANT-7001) -> Price on request because GST for 22K is unconfirmed
      const ant7001 = catalogRes.body.products.find((p: any) => p.sku === 'MRS-ANT-7001');
      expect(ant7001.priceOnRequest).toBe(true);
      expect(ant7001.priceOnRequestReason).toBe('GST_UNCONFIRMED_FOR_PURITY');
      expect(ant7001.displayPriceLabel).toBe('Price on request');

      // Manual price override is distinguished and preserved across rate changes
      const adminEar = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/products/MRS-EAR-2001',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(adminEar.status).toBe(200);
      const overrideRes = await invokeApp(app, {
        method: 'PUT',
        url: '/api/admin/products/MRS-EAR-2001',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          ...(adminEar.body.product ?? adminEar.body),
          manualPriceOverrideInr: '88888.00',
        },
      });
      expect(overrideRes.status).toBe(200);
      expect(overrideRes.body.recalculatedBreakdown.manualOverrideApplied).toBe(true);
      expect(overrideRes.body.recalculatedBreakdown.priceSource).toBe('OWNER_MANUAL_OVERRIDE');
      expect(overrideRes.body.recalculatedBreakdown.finalProposedPriceInr).toBe('88888.00');
      expect(overrideRes.body.recalculatedBreakdown.priceOnRequest).toBe(false);
    });
  });

  describe('9. Appointment requests', () => {
    it('accepts a valid public request, rejects bad input, and lists it for staff only', async () => {
      const bad = await invokeApp(app, {
        method: 'POST',
        url: '/api/public/appointment-requests',
        body: { name: 'A', phone: 'x', preferredDate: '' },
      });
      expect(bad.status).toBe(400);

      const ok = await invokeApp(app, {
        method: 'POST',
        url: '/api/public/appointment-requests',
        body: {
          name: 'Test Visitor',
          phone: '+91 90000 00000',
          preferredDate: '2026-12-05',
          preferredTime: 'Afternoon',
          productOfInterest: 'MRS-RNG-1001',
        },
      });
      expect(ok.status).toBe(201);
      expect(ok.body.reference).toMatch(/^APT-/);

      const anon = await invokeApp(app, { method: 'GET', url: '/api/admin/appointment-requests' });
      expect(anon.status).toBe(401);

      const staff = await invokeApp(app, {
        method: 'GET',
        url: '/api/admin/appointment-requests',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(staff.status).toBe(200);
      expect(staff.body.requests[0].details.name).toBe('Test Visitor');
    });
  });
});
