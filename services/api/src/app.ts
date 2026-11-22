import * as fs from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import {
  AdjustInventorySchema,
  AssignProductCustomizationSchema,
  AssociateModelAssetSchema,
  buildOwnerMarketRateCard,
  calculateCustomizationQuote,
  calculateJewelleryPrice,
  CartItemInputSchema,
  CheckoutCreateOrderSchema,
  CreateCustomerDesignSchema,
  CreateCustomizationGroupSchema,
  CreateCustomizationOptionSchema,
  CreateCustomizationProfileSchema,
  CreateDiamondRateInputSchema,
  CreateMetalRateInputSchema,
  AuditLogListQuerySchema,
  CreatePricingRuleSchema,
  CreateProductSchema,
  CustomerListQuerySchema,
  CustomerRegisterSchema,
  CustomizationQuoteError,
  CustomizationQuoteInputSchema,
  DashboardOverviewQuerySchema,
  ImportCommitInputSchema,
  InventoryListQuerySchema,
  LoginInputSchema,
  OrderListQuerySchema,
  OrderTransitionSchema,
  OWNER_MARKET_RATE_CARD_LABEL,
  PaginationQuerySchema,
  ProductListQuerySchema,
  RazorpayRetryOrderSchema,
  RazorpayVerifyPaymentSchema,
  RefundCreateSchema,
  resolveEligibleCustomizationProfile,
  ROLE_PERMISSIONS,
  UpdateCustomerDesignSchema,
  UpdateOwnerMarketRateCardSchema,
  UpdateProductJewellerySpecSchema,
  UpdateUserRoleSchema,
  type DashboardFinancialMetrics,
  type DashboardKpiSummary,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MetalPurity,
  type MetalRateRecord,
  type PriceCalculationBreakdown,
  type PricingFormulaRule,
  type PricingRunStatus,
  type TopSellerItem,
  type TrendBucketItem,
} from '@mrs/shared';
import type { PrismaClient } from '@prisma/client';
import {
  dbStore as defaultDataStore,
  hashPassword,
  verifyPassword,
  type PricingRunRecord,
  type DataStore,
} from './store/data-store.js';
import { getPrismaClient } from './db/prisma.js';
import { resolveDataBackendMode } from './db/backend.js';
import {
  JsonRuntimeBackend,
  PostgresRuntimeBackend,
  type RuntimeBackend,
} from './db/runtime-backend.js';
import {
  createRateLimiter,
  getJwtSecret,
  getOperationalReadiness,
  isKnownRole,
  optionalCustomerAuth,
  parseTrustedProxyCidrs,  requireAuth,
  requireCustomerAuth,
  requireOwnerRole,
  requirePermission,
  signAdminToken,
  signCustomerToken,
  signOrderAccessToken,
  verifyAdminToken,
  verifyAdminTokenWithLookup,
  verifyCustomerToken,
  verifyCustomerTokenWithLookup,
  verifyOrderAccessToken,
} from './middleware/auth.js';
import {
  formatImportErrorsCsv,
  getDefaultSampleWorkbookPath,
  MANGAL_EXCEL_SHEETS,
  parseAndValidateWorkbook,
} from './services/excel-importer.js';
import {
  generateSampleWorkbookBuffer,
  writeSampleWorkbookToDisk,
} from './scripts/generate-sample-excel.js';
import {
  getShopifyConfigStatus,
  SHOPIFY_API_VERSION,
  syncApprovedPricesToShopify,
  getShopifyWebhookSecret,
  verifyShopifyWebhookHmac,
} from './services/shopify-service.js';
import {
  buildRazorpayReceipt,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
  getRazorpayKeySecret,
  inrToPaise,
  redactRazorpayError,
  verifyRazorpayCheckoutSignature,
  verifyRazorpaySignature,
} from './services/razorpay-service.js';
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  isEmailVerificationConfigured,
  isResendCooldownActive,
  verificationHashesMatch,
  normalizeEmail,
  sendEmailVerification,
} from './services/customer-email-verification.js';
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  CSRF_HEADER,
  parseCookies,
  clearSessionCookie,
  createCsrfProtection,
  deriveCsrfToken,
  getAllowedOrigins,
  issueSessionCookie,
  resolveSessionToken,
} from './middleware/session.js';
import { revokeSessionToken } from './middleware/token-revocation.js';

import {
  defaultModelStorage,
  MAX_MODEL_ASSET_BYTES,
  validateModelBuffer,
} from './services/model-storage.js';
import { paginateList } from './utils/pagination.js';

export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Protect against CSV formula injection (CVE-2014-3524 / OWASP CSV Injection)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MODEL_ASSET_BYTES },
});

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function enrichProductWithAuthoritativePrice(
  product: JewelleryProductSpec,
  metalRates: MetalRateRecord[],
  diamondRates: DiamondRateMatrixEntry[],
  activeRule: PricingFormulaRule | null
): JewelleryProductSpec {
  if (!activeRule) {
    // No owner-approved pricing rule: fail closed. Never fall back to a stored/stale price.
    return {
      ...product,
      effectivePriceInr: '0.00',
      priceOnRequest: true,
      priceOnRequestReason: 'NO_APPROVED_PRICING_RULE',
      displayPriceLabel: 'Price on request',
      priceSource: 'PRICE_ON_REQUEST',
      priceBreakup: undefined,
      latestBreakdown: null,
    };
  }
  const priceBreakup = calculateJewelleryPrice({
    product,
    metalRates,
    diamondRates,
    rule: activeRule,
  });
  const useLiveMarketRatePrice =
    !activeRule.isPlaceholderFormula || Boolean(activeRule.useRateCardMakingCharge);
  const effectivePriceInr = priceBreakup.priceOnRequest
    ? '0.00'
    : useLiveMarketRatePrice
      ? priceBreakup.finalProposedPriceInr
      : product.currentShopifyPriceInr;

  return {
    ...product,
    currentShopifyPriceInr:
      useLiveMarketRatePrice && !priceBreakup.priceOnRequest
        ? priceBreakup.finalProposedPriceInr
        : product.currentShopifyPriceInr,
    effectivePriceInr,
    priceOnRequest: Boolean(priceBreakup.priceOnRequest),
    priceOnRequestReason: priceBreakup.priceOnRequestReason ?? null,
    displayPriceLabel: priceBreakup.displayPriceLabel,
    priceSource: priceBreakup.priceSource,
    rateCardLabel: priceBreakup.rateCardLabel || OWNER_MARKET_RATE_CARD_LABEL,
    rateCardUpdatedAt: priceBreakup.rateCardUpdatedAt,
    priceBreakup,
    latestBreakdown: priceBreakup,
  };
}

/**
 * Shapes an enriched product for PUBLIC responses. Internal stored inputs that the owner rate card does not
 * use (supplier making value, wastage, certification/hallmark fees, override value, Shopify GIDs) and internal
 * engine diagnostics are removed. The public price field always equals the authoritative server result, so a
 * stale stored price can never reach the storefront for a Price-on-request product.
 */
export function toPublicProduct(enriched: JewelleryProductSpec): JewelleryProductSpec {
  const {
    makingChargeValue: _mcv,
    wastageMode: _wm,
    wastageValue: _wv,
    certificationFeeInr: _cf,
    hallmarkFeeInr: _hf,
    fixedAdjustmentInr: _fa,
    manualPriceOverrideInr: _mo,
    shopifyProductGid: _spg,
    shopifyVariantGid: _svg,
    latestBreakdown: _lb,
    ...rest
  } = enriched;
  const breakup = enriched.priceBreakup;
  const publicBreakup: PriceCalculationBreakdown | undefined = breakup
    ? {
        ...breakup,
        oldPriceInr: '0.00',
        priceDeltaInr: '0.00',
        priceDeltaPercent: '0.00',
        exceedsMaxDeltaThreshold: false,
        warnings: [],
      }
    : undefined;
  const isPor = Boolean(enriched.priceOnRequest ?? breakup?.priceOnRequest ?? !breakup);
  const publicPrice = isPor ? '0.00' : breakup?.finalProposedPriceInr ?? enriched.currentShopifyPriceInr;
  return {
    ...rest,
    currentShopifyPriceInr: publicPrice,
    effectivePriceInr: publicPrice,
    priceOnRequest: isPor,
    displayPriceLabel: isPor ? 'Price on request' : breakup?.displayPriceLabel,
    priceBreakup: publicBreakup,
    purityBreakups: enriched.purityBreakups
      ? Object.fromEntries(
          Object.entries(enriched.purityBreakups).map(([k, b]) => [
            k,
            { ...b, oldPriceInr: '0.00', priceDeltaInr: '0.00', priceDeltaPercent: '0.00', warnings: [] },
          ])
        )
      : undefined,
  } as unknown as JewelleryProductSpec;
}

function isPublicProduct(product: JewelleryProductSpec | null | undefined): product is JewelleryProductSpec {
  return Boolean(product && (!product.status || product.status === 'ACTIVE'));
}

export type CreateAppOptions =
  | DataStore
  | {
      backend: 'postgres';
      prisma: PrismaClient;
    };

function isPostgresOptions(opt: CreateAppOptions | undefined): opt is { backend: 'postgres'; prisma: PrismaClient } {
  return Boolean(opt && typeof opt === 'object' && 'backend' in opt && opt.backend === 'postgres');
}

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function createApp(storeOrOptions?: CreateAppOptions) {
  let backend: RuntimeBackend;
  let dbStore: DataStore;

  if (isPostgresOptions(storeOrOptions)) {
    backend = new PostgresRuntimeBackend(storeOrOptions.prisma);
    dbStore = defaultDataStore;
  } else if (storeOrOptions) {
    dbStore = storeOrOptions;
    backend = new JsonRuntimeBackend(dbStore);
  } else if (resolveDataBackendMode() === 'postgres') {
    backend = new PostgresRuntimeBackend(getPrismaClient());
    dbStore = defaultDataStore;
  } else {
    dbStore = defaultDataStore;
    backend = new JsonRuntimeBackend(dbStore);
  }

  const app = express();
  app.locals.authLookup = backend.authLookup;
  const checkoutSkusInFlight = new Set<string>();
  const paymentOrdersInFlight = new Set<string>();

  const persistenceUnavailable = (res: Response, message = 'Unable to save this change. Please retry.') => {
    res.status(503).json({ error: 'PERSISTENCE_UNAVAILABLE', message });
  };
  const commitState = (res: Response, message?: string): boolean => {
    if (dbStore.persist()) return true;
    persistenceUnavailable(res, message);
    return false;
  };
  const commitAudit = (
    res: Response,
    entry: Parameters<DataStore['addAuditLog']>[0],
    message = 'Unable to save the audit record. Please retry.'
  ): boolean => {
    if (dbStore.addAuditLog(entry)) return true;
    persistenceUnavailable(res, message);
    return false;
  };

  const trustedProxyCidrs = parseTrustedProxyCidrs(process.env.TRUSTED_PROXY_CIDRS);
  app.set('trust proxy', trustedProxyCidrs.length ? trustedProxyCidrs : false);

  const isAllowedOrigin = (origin: string | undefined): boolean =>
    !origin || getAllowedOrigins().includes(origin.replace(/\/$/, ''));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER, 'x-mrs-order-token'],
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(createCsrfProtection(() => getJwtSecret()));

  // Versioned API prefix support: map /api/v1/* seamlessly to /api/* while keeping dedicated /api/v1 routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url === '/api/v1/health') {
      req.url = '/health';
    } else if (req.url.startsWith('/api/v1/')) {
      req.url = '/api/' + req.url.slice('/api/v1/'.length);
    }
    next();
  });

  // Public product images static route (serves PRODUCT_ASSETS_ROOT or local processed-product-assets safely)
  const configuredAssetsRoot = (process.env.PRODUCT_ASSETS_ROOT || '').trim();
  const productAssetsBaseDir = configuredAssetsRoot
    ? fs.existsSync(path.resolve(configuredAssetsRoot))
      ? path.resolve(configuredAssetsRoot)
      : path.resolve(process.cwd(), '..', '..', configuredAssetsRoot)
    : fs.existsSync(path.resolve(process.cwd(), 'processed-product-assets'))
    ? path.resolve(process.cwd(), 'processed-product-assets')
    : path.resolve(process.cwd(), '..', '..', 'processed-product-assets');
  const ALLOWED_PRODUCT_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

  app.get('/api/public/product-images/:category/:assetId/:filename', (req: Request, res: Response) => {
    const category = getParam(req.params.category).replace(/[^a-zA-Z0-9_-]/g, '');
    const assetId = getParam(req.params.assetId).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = path.basename(getParam(req.params.filename));
    if (!category || !assetId || !filename) {
      res.status(400).json({ error: 'INVALID_IMAGE_PATH' });
      return;
    }
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_PRODUCT_IMAGE_EXTS.has(ext)) {
      res.status(400).json({ error: 'UNSUPPORTED_IMAGE_FORMAT' });
      return;
    }
    const resolved = path.resolve(productAssetsBaseDir, category, assetId, filename);
    if (
      !resolved.startsWith(productAssetsBaseDir + path.sep) ||
      !fs.existsSync(resolved) ||
      !fs.statSync(resolved).isFile()
    ) {
      res.status(404).json({ error: 'PRODUCT_IMAGE_NOT_FOUND' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(resolved);
  });

  // ---------------------------------------------------------------------------
  // 1. HEALTH & ARCHITECTURE STATUS
  // ---------------------------------------------------------------------------
  app.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response) => {
      const [health, settings] = await Promise.all([
        backend.healthCheck(),
        backend.getSettings(),
      ]);
      const shopifyStatus = getShopifyConfigStatus(settings.shopifyLiveWritesEnabled);
      const readiness = getOperationalReadiness();
      if (!health.ok) {
        res.status(503).json({
          status: 'degraded',
          service: '@mrs/api',
          backend: health.backend,
          error: health.error,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      res.json({
        status: 'ok',
        service: '@mrs/api',
        backend: health.backend,
        timestamp: new Date().toISOString(),
        architecture: {
          customerStorefront: 'Shopify Liquid Theme (apps/shopify-theme)',
          commerceSystemOfRecord: 'Shopify GraphQL Admin API + Hosted Checkout',
          adminDashboard: 'Next.js Custom Admin Dashboard (apps/admin)',
          backend:
            health.backend === 'postgres'
              ? 'Node.js + Express + Prisma PostgreSQL (Active) + Decimal.js Pricing Engine'
              : 'Node.js + Express + JSON DataStore + Decimal.js Pricing Engine',
        },
        readiness,
        shopify: shopifyStatus,
        counts: health.counts,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 2. AUTHENTICATION & RBAC SESSION
  // ---------------------------------------------------------------------------
  const authRateLimit = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'auth',
  });
  const publicTrackingRateLimit = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'public-track',
  });
  const paymentVerifyRateLimit = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'payment-verify',
  });

  app.post(
    '/api/auth/login',
    authRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = LoginInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
        return;
      }

      const user = await backend.findAdminUserByEmail(parsed.data.email);

      if (
        !user ||
        user.isActive !== true ||
        !isKnownRole(user.role) ||
        !verifyPassword(parsed.data.password, user.passwordHash)
      ) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        });
        return;
      }

      const authoritativePermissions = [...ROLE_PERMISSIONS[user.role]];
      const token = signAdminToken({
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: authoritativePermissions,
      });

      await backend.updateAdminLastLogin(user.id);
      await backend.addAuditLog({
        actorEmail: user.email,
        actorRole: user.role,
        action: 'AUTH_LOGIN',
        entityType: 'AdminUser',
        entityId: user.id,
        summary: `${user.displayName} (${user.role}) signed in to Mangal Royal Studio Admin.`,
      });

      issueSessionCookie(res, 'admin', token);
      res.json({
        token,
        csrfToken: deriveCsrfToken(token, getJwtSecret()),
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          permissions: authoritativePermissions,
        },
      });
    })
  );

  app.get(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const users = await backend.listAdminUsers();
      const serverUser = users.find((u) => u.id === req.adminUser!.id);
      res.json({
        csrfToken: deriveCsrfToken(req.sessionToken!, getJwtSecret()),
        user: {
          ...req.adminUser!,
          displayName: serverUser?.displayName || req.adminUser!.email,
        },
      });
    })
  );

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    // Revoke the presented session token server-side so a copied token cannot be replayed after logout.
    revokeSessionToken(resolveSessionToken(req, 'admin')?.token);
    clearSessionCookie(res, 'admin');
    res.json({ loggedOut: true });
  });

  app.post('/api/auth/customer/logout', (req: Request, res: Response) => {
    revokeSessionToken(resolveSessionToken(req, 'customer')?.token);
    clearSessionCookie(res, 'customer');
    res.json({ loggedOut: true });
  });

  // ---------------------------------------------------------------------------
  // 3. PUBLIC STOREFRONT BRIDGE ENDPOINTS (FOR SHOPIFY LIQUID THEME)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/public/pricing/:handleOrSku',
    asyncHandler(async (req: Request, res: Response) => {
      const key = getParam(req.params.handleOrSku).toLowerCase();
      const product = await backend.findProductByHandleOrSku(key);

      // Public endpoint: only ACTIVE catalogue products are visible (drafts return 404, not their specs).
      if (!isPublicProduct(product)) {
        res.status(404).json({
          error: 'PRODUCT_NOT_FOUND',
          message: `No jewellery specification found for "${key}".`,
        });
        return;
      }

      const [metalRates, diamondRates, activeRule] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      if (!activeRule) {
        res.status(503).json({ error: 'PRICING_RULE_UNAVAILABLE', message: 'No approved pricing rule is active.' });
        return;
      }
      const publicProduct = toPublicProduct(
        enrichProductWithAuthoritativePrice(product, metalRates, diamondRates, activeRule)
      );

      res.json({
        sku: publicProduct.sku,
        handle: publicProduct.handle,
        title: publicProduct.title,
        currentPriceInr: publicProduct.currentShopifyPriceInr,
        product: publicProduct,
        priceBreakup: publicProduct.priceBreakup,
      });
    })
  );

  app.get(
    '/api/public/orders/track',
    publicTrackingRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const orderNumber = String(req.query.orderNumber || '').trim();
      const awb = String(req.query.awb || '').trim();
      const accessToken =
        typeof req.headers['x-mrs-order-token'] === 'string'
          ? req.headers['x-mrs-order-token'].trim()
          : '';
      const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      const customerBearer = authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : parseCookies(req.headers.cookie)[CUSTOMER_SESSION_COOKIE] || '';
      if (!orderNumber && !awb) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'An order-scoped access token and order number or AWB are required.',
        });
        return;
      }

      const [orders, shipments] = await Promise.all([
        backend.listOrders(),
        backend.listShipments(),
      ]);
      let order = orders.find(
        (o) =>
          orderNumber &&
          o.orderNumber.replace('#', '').toLowerCase() ===
            orderNumber.replace('#', '').toLowerCase()
      );
      let shipment = shipments.find(
        (s) =>
          (order && s.orderId === order.id) ||
          (awb && s.awbCode.toLowerCase() === awb.toLowerCase())
      );
      if (!order && shipment) order = orders.find((candidate) => candidate.id === shipment!.orderId);
      if (order && !shipment) shipment = shipments.find((candidate) => candidate.orderId === order!.id);

      const authenticatedCustomer = customerBearer
        ? await verifyCustomerTokenWithLookup(customerBearer, backend.authLookup)
        : null;
      const authorized = Boolean(
        order &&
          ((authenticatedCustomer && order.customerId === authenticatedCustomer.id) ||
            (accessToken && verifyOrderAccessToken(accessToken, order.id, order.orderNumber, order.customerEmail)))
      );
      if (!order || (awb && shipment?.awbCode.toLowerCase() !== awb.toLowerCase()) || !authorized) {
        res.status(404).json({
          error: 'ORDER_NOT_FOUND',
          message: 'No matching order found or access is not authorized.',
        });
        return;
      }

    const sanitizedShipment = shipment
      ? {
          orderNumber: shipment.orderNumber,
          awbCode: shipment.awbCode,
          courierName: shipment.courierName,
          status: shipment.status,
          isInsured: shipment.isInsured,
          trackingHistory: shipment.trackingHistory.map(({ timestamp, status }) => ({ timestamp, status })),
          updatedAt: shipment.updatedAt,
        }
      : null;

    const resolvedOrderNumber =
      order?.orderNumber || sanitizedShipment?.orderNumber || orderNumber.toUpperCase();
    const resolvedFulfillmentStatus =
      order?.fulfillmentStatus ||
      (sanitizedShipment?.status === 'DELIVERED'
        ? 'FULFILLED'
        : sanitizedShipment?.status === 'IN_TRANSIT'
          ? 'IN_TRANSIT'
          : 'UNFULFILLED');

    res.json({
      tracking: {
        orderNumber: resolvedOrderNumber,
        fulfillmentStatus: resolvedFulfillmentStatus,
        awbCode: sanitizedShipment?.awbCode || null,
        courierName: sanitizedShipment?.courierName || 'BlueDart Insured Jewellery Air',
        status: sanitizedShipment?.status || resolvedFulfillmentStatus,
        latestMilestone: `Order status: ${resolvedFulfillmentStatus.replace('_', ' ')}`,
        isInsured: sanitizedShipment?.isInsured ?? true,
        trackingHistory: sanitizedShipment?.trackingHistory || [],
      },
      shipment: sanitizedShipment,
    });
  }));

  // ---------------------------------------------------------------------------
  // 4. ADMIN OVERVIEW & ANALYTICS (MODULE 1 & MODULE 16)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/overview',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = DashboardOverviewQuerySchema.safeParse(req.query);
      const overviewQuery = parsedQuery.success ? parsedQuery.data : { range: 'all' as const };

      const [products, categories, orders, pricingRuns, shipments, customers, metalRates, auditLogs, settings, payments, refunds] =
        await Promise.all([
          backend.listProducts(),
          backend.listCategories(),
          backend.listOrders(),
          backend.listPricingRuns(),
          backend.listShipments(),
          backend.listCustomers(),
          backend.getActiveMetalRates(),
          backend.listAuditLogs(),
          backend.getSettings(),
          backend.listPayments(),
          backend.listRefunds(),
        ]);

      const now = Date.now();
      let fromTimestamp = 0;
      let toTimestamp = now;

      if (overviewQuery.range === '7d') fromTimestamp = now - 7 * 86400000;
      else if (overviewQuery.range === '30d') fromTimestamp = now - 30 * 86400000;
      else if (overviewQuery.range === '90d') fromTimestamp = now - 90 * 86400000;
      else if (overviewQuery.range === '1y') fromTimestamp = now - 365 * 86400000;
      else if (overviewQuery.range === 'custom') {
        if (overviewQuery.dateFrom) fromTimestamp = new Date(overviewQuery.dateFrom).getTime();
        if (overviewQuery.dateTo) toTimestamp = new Date(overviewQuery.dateTo).getTime();
      }

      const inRangeOrders = orders.filter((o) => {
        const t = new Date(o.placedAt).getTime();
        return t >= fromTimestamp && t <= toTimestamp;
      });

      const inRangePayments = payments.filter((p) => {
        const t = new Date(p.capturedAt).getTime();
        return t >= fromTimestamp && t <= toTimestamp;
      });

      const inRangeRefunds = refunds.filter((r) => {
        const t = new Date(r.processedAt).getTime();
        return t >= fromTimestamp && t <= toTimestamp;
      });

      const grossCapturedInr = inRangePayments
        .filter((p) => p.status === 'CAPTURED')
        .reduce((acc, p) => acc + Number(p.amountInr), 0);

      const totalRefundedInr = inRangeRefunds
        .filter((r) => r.status === 'PROCESSED')
        .reduce((acc, r) => acc + Number(r.amountInr), 0);

      const netRevenueInr = Math.max(0, grossCapturedInr - totalRefundedInr);

      const paidOrdersTotalInr = inRangeOrders
        .filter((o) => o.financialStatus === 'PAID')
        .reduce((acc, o) => acc + Number(o.totalPriceInr), 0);

      const financialMetrics: DashboardFinancialMetrics = {
        grossCapturedInr: grossCapturedInr.toFixed(2),
        totalRefundedInr: totalRefundedInr.toFixed(2),
        netRevenueInr: netRevenueInr.toFixed(2),
        paidOrdersTotalInr: paidOrdersTotalInr.toFixed(2),
        currency: 'INR',
        disclaimer:
          'Financial totals represent captured and settled customer payments minus processed refunds in store records.',
      };

      // Top Selling Products aggregation
      const salesBySku = new Map<string, { title: string; unitsSold: number; totalRevenueInr: number }>();
      for (const o of inRangeOrders) {
        if (o.financialStatus === 'PAID') {
          for (const item of o.lineItems) {
            const existing = salesBySku.get(item.sku) || { title: item.title, unitsSold: 0, totalRevenueInr: 0 };
            existing.unitsSold += item.quantity;
            existing.totalRevenueInr += Number(item.purchaseTimePriceInr) * item.quantity;
            salesBySku.set(item.sku, existing);
          }
        }
      }
      const topSellingProducts: TopSellerItem[] = Array.from(salesBySku.entries())
        .map(([sku, data]) => ({
          sku,
          title: data.title,
          totalUnitsSold: data.unitsSold,
          totalRevenueInr: data.totalRevenueInr.toFixed(2),
        }))
        .sort((a, b) => Number(b.totalRevenueInr) - Number(a.totalRevenueInr))
        .slice(0, 10);

      // Time series trends (daily buckets)
      const buckets = new Map<string, { orderCount: number; revenueInr: number; refundInr: number }>();
      for (const o of inRangeOrders) {
        const day = o.placedAt.slice(0, 10);
        const b = buckets.get(day) || { orderCount: 0, revenueInr: 0, refundInr: 0 };
        b.orderCount += 1;
        if (o.financialStatus === 'PAID') b.revenueInr += Number(o.totalPriceInr);
        buckets.set(day, b);
      }
      for (const r of inRangeRefunds) {
        if (r.status === 'PROCESSED') {
          const day = r.processedAt.slice(0, 10);
          const b = buckets.get(day) || { orderCount: 0, revenueInr: 0, refundInr: 0 };
          b.refundInr += Number(r.amountInr);
          buckets.set(day, b);
        }
      }
      const timeSeriesTrends: TrendBucketItem[] = Array.from(buckets.entries())
        .map(([date, b]) => ({
          date,
          orderCount: b.orderCount,
          revenueInr: b.revenueInr.toFixed(2),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Order Status Distribution
      const orderStatusDistribution = {
        byFinancialStatus: {
          PAID: inRangeOrders.filter((o) => o.financialStatus === 'PAID').length,
          PENDING: inRangeOrders.filter((o) => o.financialStatus === 'PENDING').length,
          REFUNDED: inRangeOrders.filter((o) => o.financialStatus === 'REFUNDED').length,
          PARTIALLY_REFUNDED: inRangeOrders.filter((o) => o.financialStatus === 'PARTIALLY_REFUNDED').length,
        },
        byFulfillmentStatus: {
          UNFULFILLED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'UNFULFILLED').length,
          CONFIRMED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'CONFIRMED').length,
          PROCESSING: inRangeOrders.filter((o) => o.fulfillmentStatus === 'PROCESSING').length,
          SHIPPED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'SHIPPED').length,
          IN_TRANSIT: inRangeOrders.filter((o) => o.fulfillmentStatus === 'IN_TRANSIT').length,
          DELIVERED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'DELIVERED').length,
          FULFILLED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'FULFILLED').length,
          CANCELLED: inRangeOrders.filter((o) => o.fulfillmentStatus === 'CANCELLED').length,
        },
      };

      // Inventory Alerts
      const inventoryAlerts = products
        .filter((p) => p.inventoryQuantity <= 5)
        .map((p) => ({
          sku: p.sku,
          title: p.title,
          inventoryQuantity: p.inventoryQuantity,
          isLowStock: p.inventoryQuantity <= 2,
        }));

      const lowStockCount = products.filter((p) => p.inventoryQuantity <= 2).length;
      const pendingRunsCount = pricingRuns.filter((r) =>
        ['DRAFT', 'PREVIEWED', 'VALIDATED', 'APPROVED'].includes(r.status)
      ).length;
      const recentOrders = inRangeOrders.slice(0, 5);
      const dashboardOrders = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW')
        ? recentOrders
        : recentOrders.map((order) => {
            const [localPart, domain] = order.customerEmail.split('@');
            return {
              ...order,
              customerName: 'Customer',
              customerEmail: localPart && domain ? `${localPart.slice(0, 1)}•••@${domain}` : '••••',
              customerPhone: '',
              shippingCity: '',
              shippingState: '',
              shippingPincode: '',
            };
          });

      res.json({
        kpis: {
          totalProducts: products.length,
          totalCategories: categories.length,
          totalOrders: inRangeOrders.length,
          totalRevenueInr: paidOrdersTotalInr.toFixed(2),
          grossCapturedInr: grossCapturedInr.toFixed(2),
          totalRefundedInr: totalRefundedInr.toFixed(2),
          netRevenueInr: netRevenueInr.toFixed(2),
          lowStockCount,
          pendingPricingRuns: pendingRunsCount,
          activeShipments: shipments.length,
          totalCustomers: customers.length,
        },
        financialMetrics,
        orderStatusDistribution,
        topSellingProducts,
        timeSeriesTrends,
        inventoryAlerts,
        shopifyStatus: getShopifyConfigStatus(settings.shopifyLiveWritesEnabled),
        metalRates,
        recentOrders: dashboardOrders,
        recentPricingRuns: pricingRuns.slice(0, 5),
        recentAuditLogs: auditLogs.slice(0, 8),
        settings,
      });
    })
  );

  app.get(
    '/api/admin/analytics',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const [categories, products, pricingSnapshots, importJobs] = await Promise.all([
        backend.listCategories(),
        backend.listProducts(),
        backend.listPricingSnapshots(),
        backend.listImportJobs(),
      ]);
      const categoryBreakdown = categories.map((cat) => {
        const catProducts = products.filter(
          (p) => p.category.toLowerCase() === cat.name.toLowerCase()
        );
        const totalCatalogValue = catProducts.reduce(
          (sum, p) => sum + Number(p.currentShopifyPriceInr) * p.inventoryQuantity,
          0
        );
        return {
          categoryName: cat.name,
          slug: cat.slug,
          productCount: catProducts.length,
          totalStockUnits: catProducts.reduce((sum, p) => sum + p.inventoryQuantity, 0),
          totalInventoryValuationInr: totalCatalogValue.toFixed(2),
        };
      });

      res.json({
        categoryBreakdown,
        pricingSnapshotsCount: pricingSnapshots.length,
        importJobsCount: importJobs.length,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 5. PRODUCTS & JEWELLERY SPECIFICATIONS (MODULE 2)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/products',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = ProductListQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : ProductListQuerySchema.parse({});

      const [products, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts({ includeDrafts: true }),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);

      const searchTerm = (query.search || '').trim().toLowerCase();
      const categoryTerm = (query.category || '').trim().toLowerCase();
      const statusTerm = (query.status || '').trim().toUpperCase();
      const metalTerm = (query.metalType || '').trim().toUpperCase();
      const purityTerm = (query.purity || '').trim().toUpperCase();

      const filtered = products
        .filter((p) => {
          if (
            searchTerm &&
            !p.sku.toLowerCase().includes(searchTerm) &&
            !p.title.toLowerCase().includes(searchTerm) &&
            !p.handle.toLowerCase().includes(searchTerm) &&
            !(p.description || '').toLowerCase().includes(searchTerm)
          ) {
            return false;
          }
          if (categoryTerm && p.category.toLowerCase() !== categoryTerm) {
            return false;
          }
          if (statusTerm && (p.status || 'ACTIVE').toUpperCase() !== statusTerm) {
            return false;
          }
          if (metalTerm && p.metalType?.toUpperCase() !== metalTerm) {
            return false;
          }
          if (purityTerm && p.metalPurity?.toUpperCase() !== purityTerm) {
            return false;
          }
          if (query.minPrice !== undefined && Number(p.currentShopifyPriceInr) < query.minPrice) {
            return false;
          }
          if (query.maxPrice !== undefined && Number(p.currentShopifyPriceInr) > query.maxPrice) {
            return false;
          }
          return true;
        })
        .map((p) =>
          enrichProductWithAuthoritativePrice(p, metalRates, diamondRates, activeRule)
        );

      const paginated = paginateList(filtered, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection || query.sortOrder || 'asc',
        sortMap: {
          sku: (a, b) => a.sku.localeCompare(b.sku),
          title: (a, b) => a.title.localeCompare(b.title),
          currentShopifyPriceInr: (a, b) =>
            Number(a.currentShopifyPriceInr) - Number(b.currentShopifyPriceInr),
          inventoryQuantity: (a, b) => a.inventoryQuantity - b.inventoryQuantity,
        },
      });

      res.json({
        ...paginated,
        products: paginated.items,
      });
    })
  );

  app.get(
    '/api/admin/products/:sku',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const targetSku = getParam(req.params.sku);
      const product = await backend.findProductByHandleOrSku(targetSku);
      if (!product) {
        res.status(404).json({
          error: 'PRODUCT_NOT_FOUND',
          message: `Product SKU "${targetSku}" not found.`,
        });
        return;
      }
      const [metalRates, diamondRates, activeRule] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const enriched = enrichProductWithAuthoritativePrice(
        product,
        metalRates,
        diamondRates,
        activeRule
      );
      res.json({ product: enriched, latestBreakdown: enriched.latestBreakdown ?? null });
    })
  );

  const handleUpdateProductAttributes = asyncHandler(async (req: Request, res: Response) => {
    const targetSku = getParam(req.params.sku);
    const existing = await backend.findProductByHandleOrSku(targetSku);

    if (!existing) {
      res.status(404).json({
        error: 'PRODUCT_NOT_FOUND',
        message: `Product SKU "${targetSku}" not found.`,
      });
      return;
    }

    const parsed = UpdateProductJewellerySpecSchema.safeParse({
      ...existing,
      ...req.body,
      sku: existing.sku,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const updated = await backend.updateProductAttributes(
      existing.sku,
      parsed.data,
      req.adminUser!.email,
      req.adminUser!.role
    );
    if (!updated) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const [metalRates, diamondRates, activeRule] = await Promise.all([
      backend.getActiveMetalRates(),
      backend.getActiveDiamondRates(),
      backend.getActivePricingRule(),
    ]);
    const breakdown = activeRule
      ? calculateJewelleryPrice({
          product: updated,
          metalRates,
          diamondRates,
          rule: activeRule,
        })
      : null;

    res.json({
      product: updated,
      recalculatedBreakdown: breakdown,
    });
  });

  app.put(
    '/api/admin/pricing/products/:sku/attributes',
    requireAuth,
    requirePermission('PRODUCTS_WRITE'),
    handleUpdateProductAttributes
  );

  app.put(
    '/api/admin/products/:sku',
    requireAuth,
    requirePermission('PRODUCTS_WRITE'),
    handleUpdateProductAttributes
  );

  // ---------------------------------------------------------------------------
  // 6. CATEGORIES & INVENTORY (MODULES 3 & 4)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/categories',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ categories: await backend.listCategories() });
    })
  );

  app.get(
    '/api/admin/inventory',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = InventoryListQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : InventoryListQuerySchema.parse({});

      const [products, invRows] = await Promise.all([
        backend.listProducts(),
        backend.listInventory(),
      ]);
      const invBySku = new Map(invRows.map((i) => [i.sku, i]));
      const inventoryList = products.map((p) => {
        const inv = invBySku.get(p.sku);
        return {
          sku: p.sku,
          title: p.title,
          category: p.category,
          shopifyVariantGid: p.shopifyVariantGid,
          metalPurity: p.metalPurity,
          netMetalWeightGrams: p.netMetalWeightGrams,
          inventoryQuantity: p.inventoryQuantity,
          isLowStock: p.inventoryQuantity <= 2,
          isProvisional: inv?.isProvisional ?? false,
          provisionalNote: inv?.provisionalNote,
          currentShopifyPriceInr: p.currentShopifyPriceInr,
          updatedAt: p.updatedAt,
        };
      });

      const searchTerm = (query.search || '').trim().toLowerCase();
      const filtered = inventoryList.filter((item) => {
        if (
          searchTerm &&
          !item.sku.toLowerCase().includes(searchTerm) &&
          !item.title.toLowerCase().includes(searchTerm) &&
          !item.category.toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
        if (query.lowStockOnly && item.inventoryQuantity > 2) {
          return false;
        }
        return true;
      });

      const paginated = paginateList(filtered, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection || query.sortOrder || 'asc',
        sortMap: {
          sku: (a, b) => a.sku.localeCompare(b.sku),
          title: (a, b) => a.title.localeCompare(b.title),
          inventoryQuantity: (a, b) => a.inventoryQuantity - b.inventoryQuantity,
          category: (a, b) => a.category.localeCompare(b.category),
        },
      });

      res.json({
        ...paginated,
        inventory: paginated.items,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 7. ORDERS & CUSTOMERS (MODULES 5 & 6)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/orders',
    requireAuth,
    requirePermission('ORDERS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = OrderListQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : OrderListQuerySchema.parse({});

      const orders = await backend.listOrders();
      const canViewPii = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW');

      const searchTerm = (query.search || '').trim().toLowerCase();
      const statusTerm = (query.status || '').trim().toUpperCase();
      const paymentTerm = (query.paymentStatus || query.financialStatus || '').trim().toUpperCase();

      const filtered = orders.filter((o) => {
        if (
          searchTerm &&
          !o.orderNumber.toLowerCase().includes(searchTerm) &&
          !o.customerName.toLowerCase().includes(searchTerm) &&
          !o.customerEmail.toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
        if (statusTerm && o.fulfillmentStatus?.toUpperCase() !== statusTerm) {
          return false;
        }
        if (paymentTerm && o.financialStatus?.toUpperCase() !== paymentTerm) {
          return false;
        }
        if (query.dateFrom && new Date(o.placedAt).getTime() < new Date(query.dateFrom).getTime()) {
          return false;
        }
        if (query.dateTo && new Date(o.placedAt).getTime() > new Date(query.dateTo).getTime()) {
          return false;
        }
        return true;
      });

      const sanitized = canViewPii
        ? filtered
        : filtered.map((order) => {
            const [localPart, domain] = order.customerEmail.split('@');
            return {
              ...order,
              customerName: 'Customer',
              customerEmail: localPart && domain ? `${localPart.slice(0, 1)}•••@${domain}` : '••••',
              customerPhone: order.customerPhone
                ? `••••${order.customerPhone.replace(/\D/g, '').slice(-4)}`
                : '',
              shippingCity: '',
              shippingState: '',
              shippingPincode: '',
            };
          });

      const paginated = paginateList(sanitized, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection || query.sortOrder || 'desc',
        sortMap: {
          placedAt: (a, b) => a.placedAt.localeCompare(b.placedAt),
          totalPriceInr: (a, b) => Number(a.totalPriceInr) - Number(b.totalPriceInr),
          orderNumber: (a, b) => a.orderNumber.localeCompare(b.orderNumber),
        },
      });

      res.json({
        ...paginated,
        orders: paginated.items,
      });
    })
  );

  app.get(
    '/api/admin/orders/:orderId',
    requireAuth,
    requirePermission('ORDERS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const orderId = getParam(req.params.orderId);
      const order = await backend.findOrderByIdOrNumber(orderId);
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order "${orderId}" not found.` });
        return;
      }
      const canViewPii = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW');
      const orderEmailParts = (order.customerEmail || '').split('@');
      const orderLocal = orderEmailParts[0];
      const orderDomain = orderEmailParts[1];
      const safeOrder = canViewPii
        ? order
        : {
            ...order,
            customerName: 'Customer',
            customerEmail:
              orderLocal && orderDomain ? `${orderLocal.slice(0, 1)}•••@${orderDomain}` : '••••',
            customerPhone: order.customerPhone
              ? `••••${order.customerPhone.replace(/\D/g, '').slice(-4)}`
              : '',
            shippingCity: '',
            shippingState: '',
            shippingPincode: '',
          };

      const [payments, refunds, shipments] = await Promise.all([
        backend.listPayments(),
        backend.listRefunds(),
        backend.listShipments(),
      ]);

      const orderPayments = payments.filter((p) => p.orderId === order.id || p.orderId === order.orderNumber);
      const orderRefunds = refunds.filter((r) => r.orderId === order.id || r.orderId === order.orderNumber);
      const orderShipments = shipments.filter(
        (s) => s.orderId === order.id || s.orderNumber === order.orderNumber
      );

      res.json({
        order: safeOrder,
        payments: orderPayments,
        refunds: orderRefunds,
        shipments: orderShipments,
      });
    })
  );

  app.post(
    '/api/admin/orders/:orderId/transition',
    requireAuth,
    requirePermission('ORDERS_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const orderId = getParam(req.params.orderId);
      const parsed = OrderTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const order = await backend.findOrderByIdOrNumber(orderId);
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order "${orderId}" not found.` });
        return;
      }

      const { status: targetStatus, reason, trackingNumber, carrier } = parsed.data;
      const currentStatus = order.fulfillmentStatus;

      if (currentStatus === 'CANCELLED') {
        res.status(409).json({
          error: 'INVALID_STATE_TRANSITION',
          message: 'Cancelled orders cannot be transitioned.',
        });
        return;
      }
      if (currentStatus === 'DELIVERED' || currentStatus === 'FULFILLED') {
        res.status(409).json({
          error: 'INVALID_STATE_TRANSITION',
          message: 'Delivered orders cannot be transitioned to another state.',
        });
        return;
      }

      const updated = await backend.updateOrderStatus({
        orderId: order.id,
        newStatus: targetStatus,
        reason,
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        trackingNumber,
        carrier,
      });

      res.json({
        order: updated,
        previousStatus: currentStatus,
        newStatus: targetStatus,
      });
    })
  );

  app.get(
    '/api/admin/orders/:orderId/invoice',
    requireAuth,
    requirePermission('ORDERS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const orderId = getParam(req.params.orderId);
      const [order, settings] = await Promise.all([
        backend.findOrderByIdOrNumber(orderId),
        backend.getSettings(),
      ]);
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order "${orderId}" not found.` });
        return;
      }
      res.json({
        invoice: {
          invoiceNumber: `INV-${order.orderNumber}`,
          orderNumber: order.orderNumber,
          placedAt: order.placedAt,
          storeName: settings.storeName,
          legalEntityName: settings.legalEntityName,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          shippingCity: order.shippingCity,
          shippingState: order.shippingState,
          shippingPincode: order.shippingPincode,
          lineItems: order.lineItems,
          subtotalPriceInr: order.subtotalPriceInr,
          totalTaxInr: order.totalTaxInr,
          totalPriceInr: order.totalPriceInr,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
        },
      });
    })
  );

  app.get(
    '/api/admin/customers',
    requireAuth,
    requirePermission('ORDERS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = CustomerListQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : CustomerListQuerySchema.parse({});

      const customers = await backend.listCustomers();
      const canViewSensitiveCustomerData = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW');

      const searchTerm = (query.search || '').trim().toLowerCase();
      const filtered = customers.filter((c) => {
        if (
          searchTerm &&
          !c.firstName.toLowerCase().includes(searchTerm) &&
          !c.lastName.toLowerCase().includes(searchTerm) &&
          !c.email.toLowerCase().includes(searchTerm) &&
          !(c.phone || '').toLowerCase().includes(searchTerm) &&
          !(c.city || '').toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
        return true;
      });

      const sanitizedCustomers = filtered.map((customer) => {
        const {
          passwordHash: _passwordHash,
          emailVerificationTokenHash: _emailVerificationTokenHash,
          emailVerificationExpiresAt: _emailVerificationExpiresAt,
          emailVerificationLastSentAt: _emailVerificationLastSentAt,
          addresses: _addresses,
          ...safeCustomer
        } = customer;
        if (canViewSensitiveCustomerData) return safeCustomer;

        const [localPart, domain] = customer.email.split('@');
        return {
          ...safeCustomer,
          email: localPart && domain ? `${localPart.slice(0, 1)}•••@${domain}` : '••••',
          firstName: 'Customer',
          lastName: '',
          phone: customer.phone ? `••••${customer.phone.replace(/\D/g, '').slice(-4)}` : undefined,
          city: undefined,
          state: undefined,
          totalSpentInr: undefined,
          tags: [],
        };
      });

      const paginated = paginateList(sanitizedCustomers, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection || query.sortOrder || 'desc',
        sortMap: {
          createdAt: (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
          email: (a, b) => a.email.localeCompare(b.email),
          firstName: (a, b) => a.firstName.localeCompare(b.firstName),
          totalSpentInr: (a, b) =>
            Number(a.totalSpentInr || 0) - Number(b.totalSpentInr || 0),
          totalOrdersCount: (a, b) => (a.totalOrdersCount || 0) - (b.totalOrdersCount || 0),
        },
      });

      res.json({
        ...paginated,
        customers: paginated.items,
      });
    })
  );

  app.get(
    '/api/admin/customers/:customerId',
    requireAuth,
    requirePermission('ORDERS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const customerId = getParam(req.params.customerId);
      const customer =
        (await backend.findCustomerById(customerId)) ||
        (await backend.findCustomerByEmail(customerId));
      if (!customer) {
        res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: `Customer "${customerId}" not found.` });
        return;
      }

      const canViewSensitiveCustomerData = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW');
      const {
        passwordHash: _passwordHash,
        emailVerificationTokenHash: _emailVerificationTokenHash,
        emailVerificationExpiresAt: _emailVerificationExpiresAt,
        emailVerificationLastSentAt: _emailVerificationLastSentAt,
        addresses: _addresses,
        ...safeCustomer
      } = customer;

      const custEmailParts = (customer.email || '').split('@');
      const custLocal = custEmailParts[0];
      const custDomain = custEmailParts[1];
      const sanitizedCustomer = canViewSensitiveCustomerData
        ? safeCustomer
        : {
            ...safeCustomer,
            email:
              custLocal && custDomain ? `${custLocal.slice(0, 1)}•••@${custDomain}` : '••••',
            firstName: 'Customer',
            lastName: '',
            phone: customer.phone ? `••••${customer.phone.replace(/\D/g, '').slice(-4)}` : undefined,
            city: undefined,
            state: undefined,
            totalSpentInr: undefined,
            tags: [],
          };

      const [orders, designs] = await Promise.all([
        backend.listOrdersByCustomer(customer.id, customer.email),
        backend.listCustomerDesigns(customer.id),
      ]);

      const sanitizedOrders = canViewSensitiveCustomerData
        ? orders
        : orders.map((o) => ({
            ...o,
            customerName: 'Customer',
            customerEmail: '••••',
            customerPhone: '',
            shippingCity: '',
            shippingState: '',
            shippingPincode: '',
          }));

      res.json({
        customer: sanitizedCustomer,
        orders: sanitizedOrders,
        designs,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 8. GOLD/METAL & DIAMOND RATE CARDS (MODULES 8 & 9)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/public/rates/market-card',
    asyncHandler(async (_req: Request, res: Response) => {
      const [metalRates, diamondRates, activeRule] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const rateCard = buildOwnerMarketRateCard({
        metalRates,
        diamondRates,
        rule: activeRule,
      });
      res.json({
        rateCard,
        metalRates,
        diamondRates,
        activeRule,
      });
    })
  );

  app.get(
    '/api/admin/rates/market-card',
    requireAuth,
    requirePermission('RATES_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const [metalRates, diamondRates, activeRule, auditLogs] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
        backend.listAuditLogs(),
      ]);
      const rateCard = buildOwnerMarketRateCard({
        metalRates,
        diamondRates,
        rule: activeRule,
      });
      const rateAuditHistory = auditLogs
        .filter((l) =>
          [
            'METAL_RATE_UPDATED',
            'DIAMOND_RATE_UPDATED',
            'PRICING_RULE_CREATED',
            'OWNER_MARKET_RATE_CARD_UPDATED',
          ].includes(l.action)
        )
        .slice(0, 30);
      res.json({
        rateCard,
        metalRates,
        diamondRates,
        activeRule,
        rateAuditHistory,
      });
    })
  );

  app.post(
    '/api/admin/rates/market-card',
    requireAuth,
    requirePermission('RATES_WRITE'),
    asyncHandler(async (req: Request, res: Response) => {
      if (req.body?.confirmPublish !== true) {
        res.status(400).json({
          error: 'RATE_PUBLISH_CONFIRMATION_REQUIRED',
          message: 'Explicit confirmation (confirmPublish: true) is required before publishing rate changes.',
        });
        return;
      }

      if (
        req.body?.gold24kPerGramInr !== undefined &&
        req.body?.gold24kPerGramInr !== null &&
        String(req.body?.gold24kPerGramInr).trim() !== '' &&
        req.body?.confirm24kOwnerResolution !== true
      ) {
        res.status(409).json({
          error: '24K_RATE_BLOCKED_PENDING_CONFIRMATION',
          message:
            '24K gold rate is BLOCKED pending owner confirmation (conflicting values supplied: ₹15,400/g inclusive GST vs ₹154,000/g). Do not activate either.',
        });
        return;
      }

      const parsed = UpdateOwnerMarketRateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
        return;
      }

      const input = parsed.data;
      const [prevMetalRates, prevDiamondRates, prevRule] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const beforeRateCard = buildOwnerMarketRateCard({
        metalRates: prevMetalRates,
        diamondRates: prevDiamondRates,
        rule: prevRule,
      });

      const actorEmail = req.adminUser!.email;
      const actorRole = req.adminUser!.role;

      await backend.recordGoldRate({
        metalType: 'GOLD',
        purity: '14K',
        ratePerGramInr: input.gold14kPerGramInr,
        source: OWNER_MARKET_RATE_CARD_LABEL,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });
      await backend.recordGoldRate({
        metalType: 'GOLD',
        purity: '18K',
        ratePerGramInr: input.gold18kPerGramInr,
        source: OWNER_MARKET_RATE_CARD_LABEL,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });
      await backend.recordGoldRate({
        metalType: 'GOLD',
        purity: '22K',
        ratePerGramInr: input.gold22kPerGramInr,
        source: OWNER_MARKET_RATE_CARD_LABEL,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });
      await backend.recordGoldRate({
        metalType: 'PLATINUM',
        purity: '950_PLATINUM',
        ratePerGramInr: input.platinum950PerGramInr,
        source: OWNER_MARKET_RATE_CARD_LABEL,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });

      await backend.recordDiamondRate({
        shape: 'ANY',
        caratMin: '0.0001',
        caratMax: '0.9999',
        colorGrade: 'ANY',
        clarityGrade: 'ANY',
        cutGrade: 'EXCELLENT',
        ratePerCaratInr: input.diamondUnder1CaratPerCaratInr,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });
      await backend.recordDiamondRate({
        shape: 'ANY',
        caratMin: '1.0001',
        caratMax: '99.0000',
        colorGrade: 'ANY',
        clarityGrade: 'ANY',
        cutGrade: 'EXCELLENT',
        ratePerCaratInr: input.diamondOver1CaratPerCaratInr,
        isPlaceholder: false,
        createdBy: actorEmail,
        actorRole,
      });

      const newRule = await backend.createPricingRule({
        name: `${OWNER_MARKET_RATE_CARD_LABEL}`,
        description: `${
          input.notes || 'Owner-updated market rates published via Admin'
        } [MAKING_CHARGE_PER_GRAM_INR:${Number(input.makingChargePerGramInr).toFixed(2)}]`,
        stoneWeightToGramsFactor: prevRule?.stoneWeightToGramsFactor || '0.2000',
        gstRatePercent: '3.00',
        gstMode: prevRule?.gstMode || 'INCLUSIVE',
        roundingMode: prevRule?.roundingMode || 'NEAREST_1',
        maxPriceDeltaPercentThreshold: prevRule?.maxPriceDeltaPercentThreshold || '15.00',
        defaultCertificationFeeInr: '0.00',
        defaultHallmarkFeeInr: '0.00',
        isPlaceholderFormula: false,
        createdBy: actorEmail,
        actorRole,
      });

      const [nextMetalRates, nextDiamondRates] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
      ]);
      const afterRateCard = buildOwnerMarketRateCard({
        metalRates: nextMetalRates,
        diamondRates: nextDiamondRates,
        rule: newRule,
      });

      await backend.addAuditLog({
        actorEmail,
        actorRole,
        action: 'OWNER_MARKET_RATE_CARD_UPDATED',
        entityType: 'OwnerMarketRateCard',
        entityId: `v${afterRateCard.version}`,
        summary: `Updated "${OWNER_MARKET_RATE_CARD_LABEL}" to v${afterRateCard.version} (14K ₹${input.gold14kPerGramInr}/g, 18K ₹${input.gold18kPerGramInr}/g, 22K ₹${input.gold22kPerGramInr}/g, Pt950 ₹${input.platinum950PerGramInr}/g, Making ₹${input.makingChargePerGramInr}/g, Diamond <1ct ₹${input.diamondUnder1CaratPerCaratInr}/ct, >1ct ₹${input.diamondOver1CaratPerCaratInr}/ct)`,
        beforeData: beforeRateCard,
        afterData: afterRateCard,
      });

      const auditLogs = await backend.listAuditLogs();
      const rateAuditHistory = auditLogs
        .filter((l) =>
          [
            'METAL_RATE_UPDATED',
            'DIAMOND_RATE_UPDATED',
            'PRICING_RULE_CREATED',
            'OWNER_MARKET_RATE_CARD_UPDATED',
          ].includes(l.action)
        )
        .slice(0, 30);

      res.json({
        rateCard: afterRateCard,
        metalRates: nextMetalRates,
        diamondRates: nextDiamondRates,
        activeRule: newRule,
        rateAuditHistory,
      });
    })
  );

  app.get(
    '/api/admin/rates/metals',
    requireAuth,
    requirePermission('RATES_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ metalRates: await backend.listMetalRates() });
    })
  );

  app.post(
    '/api/admin/rates/metals',
    requireAuth,
    requirePermission('RATES_WRITE'),
    asyncHandler(async (req: Request, res: Response) => {
      if (req.body?.confirmPublish === false) {
        res.status(400).json({
          error: 'RATE_PUBLISH_CONFIRMATION_REQUIRED',
          message: 'Confirmation is required before publishing rate changes.',
        });
        return;
      }

      const normalizedPurity =
        req.body.purity === 'SILVER_925'
          ? '925_SILVER'
          : req.body.purity === 'PLATINUM_950'
            ? '950_PLATINUM'
            : req.body.purity;

      if (normalizedPurity === '24K' && req.body?.confirm24kOwnerResolution !== true) {
        res.status(409).json({
          error: '24K_RATE_BLOCKED_PENDING_CONFIRMATION',
          message:
            '24K gold rate is BLOCKED pending owner confirmation (conflicting values supplied: ₹15,400/g inclusive GST vs ₹154,000/g). Do not activate either.',
        });
        return;
      }

      const parsed = CreateMetalRateInputSchema.safeParse({
        ...req.body,
        purity: normalizedPurity,
      });

      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
        return;
      }

      const input = parsed.data;
      const updatedRecord = await backend.recordGoldRate({
        metalType: input.metalType,
        purity: input.purity,
        ratePerGramInr: input.ratePerGramInr,
        source: input.source,
        isPlaceholder: input.isPlaceholder,
        createdBy: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });

      res.json({ metalRate: updatedRecord });
    })
  );

  app.get(
    '/api/admin/rates/diamonds',
    requireAuth,
    requirePermission('RATES_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ diamondRates: await backend.listDiamondRates() });
    })
  );

  app.post(
    '/api/admin/rates/diamonds',
    requireAuth,
    requirePermission('RATES_WRITE'),
    asyncHandler(async (req: Request, res: Response) => {
      if (req.body?.confirmPublish === false) {
        res.status(400).json({
          error: 'RATE_PUBLISH_CONFIRMATION_REQUIRED',
          message: 'Confirmation is required before publishing rate changes.',
        });
        return;
      }

      const candidate = {
        shape: req.body.shape || 'ROUND',
        sieveRange: req.body.sieveRange || req.body.sieveGroup || 'All Sizes',
        sizeMinCarat: req.body.sizeMinCarat || req.body.caratMin || '0.010',
        sizeMaxCarat: req.body.sizeMaxCarat || req.body.caratMax || '5.000',
        colorGrade: req.body.colorGrade || 'EF',
        clarityGrade: req.body.clarityGrade || 'VVS',
        cutGrade: req.body.cutGrade || 'EXCELLENT',
        pricingType: req.body.pricingType || 'PER_CARAT',
        rateInr: req.body.rateInr || req.body.ratePerCaratInr || '55000.00',
        isPlaceholder: req.body.isPlaceholder ?? true,
      };

      const parsed = CreateDiamondRateInputSchema.safeParse(candidate);
      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
        return;
      }

      const newEntry = await backend.recordDiamondRate({
        shape: parsed.data.shape,
        caratMin: parsed.data.sizeMinCarat,
        caratMax: parsed.data.sizeMaxCarat,
        colorGrade: parsed.data.colorGrade,
        clarityGrade: parsed.data.clarityGrade,
        cutGrade: parsed.data.cutGrade,
        ratePerCaratInr: parsed.data.rateInr,
        isPlaceholder: parsed.data.isPlaceholder,
        createdBy: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });

      res.json({ diamondRate: newEntry });
    })
  );

  // ---------------------------------------------------------------------------
  // 9. JEWELLERY PRICING ENGINE: PREVIEW -> VALIDATE -> OWNER APPROVE -> PUBLISH
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/pricing/rules',
    requireAuth,
    requirePermission('PRICING_PREVIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const [pricingRules, pricingRuns, pricingSnapshots] = await Promise.all([
        backend.listPricingRules(),
        backend.listPricingRuns(),
        backend.listPricingSnapshots(),
      ]);
      res.json({
        pricingRules,
        pricingRuns,
        pricingSnapshots: pricingSnapshots.slice(0, 50),
      });
    })
  );

  app.post(
    '/api/admin/pricing/rules',
    requireAuth,
    requirePermission('PRICING_VALIDATE'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreatePricingRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
        return;
      }

      const newRule = await backend.createPricingRule({
        ...parsed.data,
        createdBy: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });

      res.status(201).json({ pricingRule: newRule });
    })
  );

  // Step 1: Preview Repricing Run
  app.post(
    '/api/admin/pricing/preview',
    requireAuth,
    requirePermission('PRICING_PREVIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const [products, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      if (!activeRule) {
        res.status(400).json({ error: 'NO_ACTIVE_PRICING_RULE', message: 'No approved pricing rule is configured.' });
        return;
      }

      const items = products.map((product: JewelleryProductSpec) => {
        const breakdown = calculateJewelleryPrice({
          product,
          metalRates,
          diamondRates,
          rule: activeRule,
        });
        return {
          sku: product.sku,
          title: product.title,
          shopifyVariantGid: product.shopifyVariantGid,
          oldPriceInr: breakdown.oldPriceInr,
          proposedPriceInr: breakdown.finalProposedPriceInr,
          priceDeltaInr: breakdown.priceDeltaInr,
          priceDeltaPercent: breakdown.priceDeltaPercent,
          exceedsThreshold: breakdown.exceedsMaxDeltaThreshold,
          breakdown,
        };
      });

      const runRecord = await backend.createPricingRun({
        pricingRuleId: activeRule.id,
        rateSnapshot: { metalRates, diamondRates },
        notes: String(req.body.notes || 'Preview repricing run created via Admin API.'),
        createdBy: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        summary: {
          totalProducts: items.length,
          increasedCount: items.filter((i) => Number(i.priceDeltaInr) > 0).length,
          decreasedCount: items.filter((i) => Number(i.priceDeltaInr) < 0).length,
          unchangedCount: items.filter((i) => Number(i.priceDeltaInr) === 0).length,
          flaggedThresholdCount: items.filter((i) => i.exceedsThreshold).length,
          isPlaceholderRun: true,
        },
        items,
      });

      res.status(201).json({ pricingRun: runRecord });
    })
  );

  // Step 2: Validate Repricing Run
  app.post(
    '/api/admin/pricing/runs/:runId/validate',
    requireAuth,
    requirePermission('PRICING_VALIDATE'),
    asyncHandler(async (req: Request, res: Response) => {
      const runId = getParam(req.params.runId);
      const target = await backend.findPricingRunById(runId);

      if (!target) {
        res.status(404).json({ error: 'PRICING_RUN_NOT_FOUND' });
        return;
      }

      const updated = await backend.validatePricingRun(runId, req.adminUser!.email, req.adminUser!.role);
      res.json({ pricingRun: updated });
    })
  );

  // Step 3: Owner Approval (Strictly OWNER role)
  app.post(
    '/api/admin/pricing/runs/:runId/approve',
    requireAuth,
    requireOwnerRole,
    requirePermission('PRICING_APPROVE'),
    asyncHandler(async (req: Request, res: Response) => {
      const runId = getParam(req.params.runId);
      const target = await backend.findPricingRunById(runId);

      if (!target) {
        res.status(404).json({ error: 'PRICING_RUN_NOT_FOUND' });
        return;
      }

      const updated = await backend.approvePricingRun(runId, req.adminUser!.email, req.adminUser!.role);
      res.json({ pricingRun: updated });
    })
  );

  // Step 4: Publish Approved Run & Persist Immutable Snapshots (Strictly OWNER role)
  app.post(
    '/api/admin/pricing/runs/:runId/publish',
    requireAuth,
    requireOwnerRole,
    requirePermission('PRICING_PUBLISH'),
    asyncHandler(async (req: Request, res: Response) => {
      const runId = getParam(req.params.runId);
      const target = await backend.findPricingRunById(runId);

      if (!target) {
        res.status(404).json({ error: 'PRICING_RUN_NOT_FOUND' });
        return;
      }

      if (target.status !== ('APPROVED' as PricingRunStatus)) {
        res.status(400).json({
          error: 'OWNER_APPROVAL_REQUIRED_BEFORE_PUBLISH',
          message: `Pricing run ${runId} must be in "APPROVED" state before publishing (current state: "${target.status}").`,
        });
        return;
      }

      const [products, settings] = await Promise.all([
        backend.listProducts(),
        backend.getSettings(),
      ]);
      const itemsToSync = target.items
        .map((item) => {
          const prod = products.find((p) => p.sku === item.sku);
          return prod ? { product: prod, newPriceInr: item.proposedPriceInr } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const shopifySyncResult = await syncApprovedPricesToShopify(
        itemsToSync,
        settings.shopifyLiveWritesEnabled
      );

      const result = await backend.publishPricingRun(runId, req.adminUser!.email, req.adminUser!.role);

      res.json({
        pricingRun: result.run,
        shopifySync: shopifySyncResult,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 10. BULK 11-SHEET EXCEL / CSV IMPORT SYSTEM (MODULE 10)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/imports',
    requireAuth,
    requirePermission('IMPORTS_RUN'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = PaginationQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : PaginationQuerySchema.parse({});

      const importJobs = await backend.listImportJobs();
      const paginated = paginateList(importJobs, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy || 'createdAt',
        sortDirection: query.sortDirection || query.sortOrder || 'desc',
        sortMap: {
          createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
          sourceFileName: (a, b) => a.sourceFileName.localeCompare(b.sourceFileName),
          totalRows: (a, b) => a.totalRows - b.totalRows,
        },
      });

      res.json({
        ...paginated,
        supportedSheets: MANGAL_EXCEL_SHEETS,
        sampleWorkbookPath: 'samples/MANGAL JEWELLERY.xlsx',
        importJobs: paginated.items,
      });
    })
  );

  app.post(
    '/api/admin/imports/:jobId/commit',
    requireAuth,
    requireOwnerRole,
    requirePermission('IMPORTS_RUN'),
    asyncHandler(async (req: Request, res: Response) => {
      const jobId = getParam(req.params.jobId);
      const parsed = ImportCommitInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      if (!parsed.data.confirmCommit) {
        res.status(400).json({
          error: 'IMPORT_COMMIT_CONFIRMATION_REQUIRED',
          message: 'Set confirmCommit to true after reviewing the import preview before committing.',
        });
        return;
      }

      try {
        const result = await backend.commitImportJob({
          jobId,
          workbookHash: parsed.data.workbookHash,
          actorEmail: req.adminUser!.email,
          actorRole: req.adminUser!.role,
        });
        res.json({
          job: result.job,
          committedProductsCount: result.committedProductsCount,
          skippedTestArtifacts: result.skippedTestArtifacts,
          alreadyCommitted: result.alreadyCommitted ?? false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('IMPORT_JOB_NOT_FOUND:')) {
          res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND', message: msg });
          return;
        }
        if (msg.startsWith('WORKBOOK_HASH_MISMATCH:')) {
          res.status(400).json({ error: 'WORKBOOK_HASH_MISMATCH', message: msg });
          return;
        }
        if (msg.startsWith('IMPORT_JOB_EXPIRED:')) {
          res.status(400).json({ error: 'IMPORT_JOB_EXPIRED', message: msg });
          return;
        }
        if (msg.startsWith('INVALID_IMPORT_JOB_STATE:')) {
          res.status(400).json({ error: 'INVALID_IMPORT_JOB_STATE', message: msg });
          return;
        }
        throw err;
      }
    })
  );

  app.post(
    '/api/admin/imports/excel',
    requireAuth,
    requirePermission('IMPORTS_RUN'),
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      const commitRequested =
        String(req.body.mode || 'DRY_RUN').toUpperCase() === 'COMMIT' || req.body.dryRun === false;
      if (commitRequested && req.adminUser!.role !== 'OWNER') {
        res.status(403).json({
          error: 'OWNER_APPROVAL_REQUIRED',
          message: 'Only an owner can commit catalog imports.',
        });
        return;
      }
      if (commitRequested && req.body.confirmCommit !== true) {
        res.status(400).json({
          error: 'IMPORT_COMMIT_CONFIRMATION_REQUIRED',
          message: 'Set confirmCommit to true after reviewing the import preview before committing.',
        });
        return;
      }
      const dryRun = !commitRequested;

      let fileName = 'MANGAL JEWELLERY.xlsx';
      let buffer: Buffer;

      if (req.file && req.file.buffer) {
        fileName = req.file.originalname || 'uploaded-workbook.xlsx';
        buffer = req.file.buffer;
      } else if (req.body.base64Content) {
        fileName = String(req.body.fileName || 'uploaded-workbook.xlsx');
        buffer = Buffer.from(String(req.body.base64Content), 'base64');
      } else {
        const defaultPath = getDefaultSampleWorkbookPath();
        if (fs.existsSync(defaultPath)) {
          buffer = fs.readFileSync(defaultPath);
        } else {
          buffer = generateSampleWorkbookBuffer();
          try {
            writeSampleWorkbookToDisk(defaultPath);
          } catch {
            // Ignore write errors in restricted environments
          }
        }
      }

      const [existingProducts, categories, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts(),
        backend.listCategories(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);

      if (!activeRule) {
        res.status(422).json({
          error: 'PRICING_CONFIGURATION_INCOMPLETE',
          message: 'An active pricing rule is required to validate/import jewellery products.',
        });
        return;
      }

      const { job, validNewProducts } = parseAndValidateWorkbook({
        fileName,
        buffer,
        dryRun,
        createdByEmail: req.adminUser!.email,
        existingProducts,
        categories,
        metalRates,
        diamondRates,
        activePricingRule: activeRule,
      });

      job.validNewProducts = validNewProducts;

      const result = await backend.createImportJob({
        job,
        newProducts: validNewProducts,
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });

      res.status(201).json({
        importJob: result.job,
        committedProductsCount: result.committedProductsCount,
        skippedTestArtifacts: result.skippedTestArtifacts,
      });
    })
  );

  app.get(
    '/api/admin/imports/:jobId/errors.csv',
    requireAuth,
    requirePermission('IMPORTS_RUN'),
    asyncHandler(async (req: Request, res: Response) => {
      const jobId = getParam(req.params.jobId);
      const job = await backend.findImportJobById(jobId);
      if (!job) {
        res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND' });
        return;
      }

      const csv = formatImportErrorsCsv(job);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="import-errors-${job.id}.csv"`
      );
      res.send(csv);
    })
  );

  app.post(
    '/api/admin/imports/:jobId/sync-shopify',
    requireAuth,
    requireOwnerRole,
    requirePermission('IMPORTS_SYNC_SHOPIFY'),
    asyncHandler(async (req: Request, res: Response) => {
      const jobId = getParam(req.params.jobId);
      const [job, settings] = await Promise.all([
        backend.findImportJobById(jobId),
        backend.getSettings(),
      ]);
      if (!job) {
        res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND' });
        return;
      }

      const shopifyStatus = getShopifyConfigStatus(settings.shopifyLiveWritesEnabled);
      const updatedJob = await backend.updateImportJobStatus(
        job.id,
        'SYNCED_TO_SHOPIFY',
        req.adminUser!.email,
        req.adminUser!.role,
        `Owner triggered controlled Shopify sync for import job ${job.id} (${job.validRows} valid SKUs, mode: ${shopifyStatus.mode}).`
      );

      if (!updatedJob) {
        res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND' });
        return;
      }

      res.json({
        jobId: updatedJob.id,
        syncedRows: updatedJob.validRows,
        shopifyStatus,
        apiVersion: SHOPIFY_API_VERSION,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 11. DISCOUNTS, BANNERS & CONTENT MANAGEMENT (MODULES 11, 12, 13)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/discounts',
    requireAuth,
    requirePermission('DISCOUNTS_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ discounts: await backend.listDiscounts() });
    })
  );

  app.get(
    '/api/admin/banners',
    requireAuth,
    requirePermission('CONTENT_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ banners: await backend.listBanners() });
    })
  );

  app.get(
    '/api/admin/content',
    requireAuth,
    requirePermission('CONTENT_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ contents: await backend.listContents() });
    })
  );

  // ---------------------------------------------------------------------------
  // 12. SHIPPING (SHIPROCKET) & PAYMENTS (RAZORPAY) (MODULES 14 & 15)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/shipping/shipments',
    requireAuth,
    requirePermission('SHIPMENTS_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ shipments: await backend.listShipments() });
    })
  );

  app.post(
    '/api/admin/orders/:orderId/shipments',
    requireAuth,
    requirePermission('SHIPMENTS_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(503).json({
        error: 'SHIPMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Shipment booking is disabled until an approved Shiprocket integration is configured.',
      });
    })
  );

  app.get(
    '/api/admin/payments',
    requireAuth,
    requirePermission('PAYMENTS_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        payments: await backend.listPayments(),
        checkoutMode: 'Shopify Hosted Checkout + Razorpay Authorized Payment Provider',
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 13. ADMIN USERS, ROLES, SETTINGS & AUDIT LOGS (MODULES 17, 18, 19)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/admin/users',
    requireAuth,
    requirePermission('USERS_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = PaginationQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : PaginationQuerySchema.parse({});

      const allUsers = await backend.listAdminUsers();
      const usersList = allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        permissions: isKnownRole(u.role) ? [...ROLE_PERMISSIONS[u.role]] : [],
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));

      const searchTerm = (query.search || '').trim().toLowerCase();
      const filtered = usersList.filter((u) => {
        if (
          searchTerm &&
          !u.email.toLowerCase().includes(searchTerm) &&
          !u.displayName.toLowerCase().includes(searchTerm) &&
          !u.role.toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
        return true;
      });

      const paginated = paginateList(filtered, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy || 'createdAt',
        sortDirection: query.sortDirection || query.sortOrder || 'asc',
        sortMap: {
          createdAt: (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
          email: (a, b) => a.email.localeCompare(b.email),
          displayName: (a, b) => a.displayName.localeCompare(b.displayName),
          role: (a, b) => a.role.localeCompare(b.role),
        },
      });

      res.json({
        ...paginated,
        users: paginated.items,
      });
    })
  );

  app.put(
    '/api/admin/users/:userId/role',
    requireAuth,
    requireOwnerRole,
    requirePermission('USERS_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getParam(req.params.userId);
      const parsed = UpdateUserRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      try {
        const updated = await backend.updateAdminUserRole({
          userId,
          role: parsed.data.role,
          actorEmail: req.adminUser!.email,
          actorRole: req.adminUser!.role,
        });
        res.json({ user: updated });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('ADMIN_USER_NOT_FOUND:')) {
          res.status(404).json({ error: 'ADMIN_USER_NOT_FOUND', message: msg });
          return;
        }
        if (msg.startsWith('CANNOT_DOWNGRADE_LAST_OWNER:')) {
          res.status(409).json({ error: 'CANNOT_DOWNGRADE_LAST_OWNER', message: msg });
          return;
        }
        throw err;
      }
    })
  );

  app.get(
    '/api/admin/settings',
    requireAuth,
    requirePermission('SETTINGS_MANAGE'),
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await backend.getSettings();
      res.json({
        settings,
        shopifyStatus: getShopifyConfigStatus(settings.shopifyLiveWritesEnabled),
      });
    })
  );

  app.put(
    '/api/admin/settings',
    requireAuth,
    requirePermission('SETTINGS_MANAGE'),
    requireOwnerRole,
    asyncHandler(async (req: Request, res: Response) => {
      const updated = await backend.updateSettings(
        req.body,
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.json({ settings: updated });
    })
  );

  app.get(
    '/api/admin/audit-logs',
    requireAuth,
    requirePermission('AUDIT_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = AuditLogListQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : AuditLogListQuerySchema.parse({});

      const auditLogs = await backend.listAuditLogs();
      const canViewPii = req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW');

      const searchTerm = (query.search || '').trim().toLowerCase();
      const actionTerm = (query.action || '').trim().toUpperCase();
      const actorTerm = (query.actorEmail || '').trim().toLowerCase();
      const entityTerm = (query.entityType || '').trim().toLowerCase();

      const filtered = auditLogs.filter((log) => {
        if (
          searchTerm &&
          !log.summary.toLowerCase().includes(searchTerm) &&
          !log.action.toLowerCase().includes(searchTerm) &&
          !log.actorEmail.toLowerCase().includes(searchTerm)
        ) {
          return false;
        }
        if (actionTerm && log.action.toUpperCase() !== actionTerm) return false;
        if (actorTerm && !log.actorEmail.toLowerCase().includes(actorTerm)) return false;
        if (entityTerm && log.entityType.toLowerCase() !== entityTerm) return false;
        if (query.dateFrom && new Date(log.createdAt).getTime() < new Date(query.dateFrom).getTime()) {
          return false;
        }
        if (query.dateTo && new Date(log.createdAt).getTime() > new Date(query.dateTo).getTime()) {
          return false;
        }
        return true;
      });

      const sanitized = canViewPii
        ? filtered
        : filtered.map((log) => {
            if (log.actorRole === 'CUSTOMER' && log.actorEmail.includes('@')) {
              const [localPart, domain] = log.actorEmail.split('@');
              return {
                ...log,
                actorEmail: localPart && domain ? `${localPart.slice(0, 1)}•••@${domain}` : '••••',
              };
            }
            return log;
          });

      const paginated = paginateList(sanitized, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy || 'createdAt',
        sortDirection: query.sortDirection || query.sortOrder || 'desc',
        sortMap: {
          createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
          action: (a, b) => a.action.localeCompare(b.action),
          actorEmail: (a, b) => a.actorEmail.localeCompare(b.actorEmail),
        },
      });

      res.json({
        ...paginated,
        auditLogs: paginated.items,
      });
    })
  );

  // ---------------------------------------------------------------------------
  // 14. IDEMPOTENT WEBHOOK HANDLERS (SHOPIFY, SHIPROCKET, RAZORPAY)
  // ---------------------------------------------------------------------------
  const WEBHOOK_EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

  app.post(
    '/api/webhooks/shopify',
    asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
      if (!getShopifyWebhookSecret()) {
        res.status(503).json({ error: 'WEBHOOK_NOT_CONFIGURED', message: 'Shopify webhook verification is not configured.' });
        return;
      }
      const raw = req.rawBody;
      const hmac = req.headers['x-shopify-hmac-sha256'];
      if (!raw || typeof hmac !== 'string' || !verifyShopifyWebhookHmac(raw, hmac)) {
        res.status(401).json({
          error: 'INVALID_SHOPIFY_HMAC',
          message: 'Shopify webhook HMAC-SHA256 verification failed.',
        });
        return;
      }

      const topic = String(req.headers['x-shopify-topic'] || '').slice(0, 64);
      const webhookId = req.headers['x-shopify-webhook-id'];
      if (!/^[a-z_]+\/[a-z_]+$/.test(topic) || typeof webhookId !== 'string' || !WEBHOOK_EVENT_ID_PATTERN.test(webhookId)) {
        res.status(400).json({ error: 'INVALID_WEBHOOK_HEADERS', message: 'Missing or malformed webhook topic or id.' });
        return;
      }
      if (await backend.hasIntegrationEvent('SHOPIFY', webhookId)) {
        res.status(200).json({ received: true, duplicate: true, topic, webhookId });
        return;
      }

      await backend.recordIntegrationEvent({
        provider: 'SHOPIFY',
        eventId: webhookId,
        eventType: topic,
        payloadHash: crypto.createHash('sha256').update(raw).digest('hex'),
        status: 'PROCESSED',
      });
      await backend.addAuditLog({
        actorEmail: 'webhook@shopify.com',
        actorRole: 'SYSTEM',
        action: `SHOPIFY_WEBHOOK_${topic.toUpperCase().replace('/', '_')}`,
        entityType: 'IntegrationEvent',
        entityId: webhookId,
        summary: `Verified Shopify webhook recorded (${topic}, ID: ${webhookId}). No commerce state is mutated from Shopify webhooks.`,
      });

      res.status(200).json({ received: true, topic, webhookId });
    })
  );

  app.post(
    '/api/webhooks/razorpay',
    asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
      const signature = req.headers['x-razorpay-signature'];
      const raw = req.rawBody;
      if (!raw || typeof signature !== 'string' || !verifyRazorpaySignature(raw, signature)) {
        res.status(401).json({
          error: 'INVALID_RAZORPAY_SIGNATURE',
          message: 'Razorpay webhook HMAC-SHA256 signature verification failed.',
        });
        return;
      }

      const eventId = req.headers['x-razorpay-event-id'];
      if (typeof eventId !== 'string' || !WEBHOOK_EVENT_ID_PATTERN.test(eventId)) {
        res.status(400).json({ error: 'INVALID_WEBHOOK_HEADERS', message: 'Missing or malformed Razorpay event id.' });
        return;
      }
      if (await backend.hasIntegrationEvent('RAZORPAY', eventId)) {
        res.status(200).json({ received: true, duplicate: true, eventId });
        return;
      }

      const body = (req.body ?? {}) as {
        event?: unknown;
        payload?: {
          payment?: { entity?: Record<string, unknown> };
          order?: { entity?: Record<string, unknown> };
        };
      };
      const eventType = typeof body.event === 'string' ? body.event.slice(0, 64) : 'unknown';
      let outcome = 'recorded';
      let eventStatus: 'PROCESSED' | 'IGNORED_MISMATCH' = 'PROCESSED';

      if (eventType === 'payment.captured') {
        const entity = body.payload?.payment?.entity ?? {};
        const paymentId = typeof entity.id === 'string' ? entity.id : '';
        const providerOrderId = typeof entity.order_id === 'string' ? entity.order_id : '';
        const [orders, payments] = await Promise.all([
          backend.listOrders(),
          backend.listPayments(),
        ]);
        const order = providerOrderId ? orders.find((o) => o.razorpayOrderId === providerOrderId) : undefined;
        const expectedPaise = order ? Math.round(Number(order.totalPriceInr) * 100) : -1;
        const valid =
          order &&
          paymentId &&
          entity.amount === expectedPaise &&
          entity.currency === 'INR' &&
          entity.status === 'captured' &&
          entity.captured === true;
        if (!order || !valid) {
          outcome = 'ignored_mismatch';
          eventStatus = 'IGNORED_MISMATCH';
        } else if (
          order.financialStatus === 'PENDING' &&
          !payments.some((p) => p.providerPaymentId === paymentId && p.status === 'CAPTURED')
        ) {
          await backend.confirmPaymentCapture({
            orderId: order.id,
            providerPaymentId: paymentId,
            providerOrderId,
            amountInr: order.totalPriceInr,
            method: typeof entity.method === 'string' ? entity.method : 'unknown',
            webhookEventId: eventId,
            actorEmail: 'webhook@razorpay.com',
            actorRole: 'SYSTEM',
          });
          outcome = 'payment_reconciled';
        } else {
          outcome = 'already_reconciled';
        }
      } else if (eventType === 'payment.failed') {
        const entity = body.payload?.payment?.entity ?? {};
        const paymentId = typeof entity.id === 'string' ? entity.id : '';
        const providerOrderId = typeof entity.order_id === 'string' ? entity.order_id : '';
        const orders = await backend.listOrders();
        const order = providerOrderId ? orders.find((o) => o.razorpayOrderId === providerOrderId) : undefined;
        const expectedPaise = order ? Math.round(Number(order.totalPriceInr) * 100) : -1;
        const valid =
          order &&
          paymentId &&
          entity.amount === expectedPaise &&
          entity.currency === 'INR';
        if (!order || !valid) {
          outcome = 'ignored_mismatch';
          eventStatus = 'IGNORED_MISMATCH';
        } else if (order.financialStatus === 'PAID') {
          // Never downgrade a paid order because a delayed failure event arrives.
          outcome = 'ignored_already_paid';
        } else {
          const failureReason =
            typeof entity.error_description === 'string'
              ? entity.error_description
              : typeof entity.error_reason === 'string'
                ? entity.error_reason
                : 'Payment failed at Razorpay';
          await backend.recordPaymentAttemptStatus({
            orderId: order.id,
            providerPaymentId: paymentId,
            providerOrderId,
            amountInr: order.totalPriceInr,
            status: 'FAILED',
            method: typeof entity.method === 'string' ? entity.method : 'unknown',
            failureReason,
            webhookEventId: eventId,
            actorEmail: 'webhook@razorpay.com',
            actorRole: 'SYSTEM',
          });
          outcome = 'payment_failure_recorded';
        }
      } else if (eventType === 'order.paid') {
        const orderEntity = body.payload?.order?.entity ?? {};
        const paymentEntity = body.payload?.payment?.entity ?? {};
        const providerOrderId = typeof orderEntity.id === 'string' ? orderEntity.id : '';
        const paymentId =
          typeof paymentEntity.id === 'string' && paymentEntity.id
            ? paymentEntity.id
            : providerOrderId
              ? `pay_ord_${providerOrderId}`
              : '';
        const [orders, payments] = await Promise.all([
          backend.listOrders(),
          backend.listPayments(),
        ]);
        const order = providerOrderId ? orders.find((o) => o.razorpayOrderId === providerOrderId) : undefined;
        const expectedPaise = order ? Math.round(Number(order.totalPriceInr) * 100) : -1;
        const amountPaid = typeof orderEntity.amount_paid === 'number' ? orderEntity.amount_paid : orderEntity.amount;
        const valid =
          order &&
          providerOrderId &&
          paymentId &&
          orderEntity.amount === expectedPaise &&
          amountPaid === expectedPaise &&
          orderEntity.currency === 'INR' &&
          orderEntity.status === 'paid';
        if (!order || !valid) {
          outcome = 'ignored_mismatch';
          eventStatus = 'IGNORED_MISMATCH';
        } else if (
          order.financialStatus === 'PENDING' &&
          !payments.some((p) => p.providerPaymentId === paymentId && p.status === 'CAPTURED')
        ) {
          await backend.confirmPaymentCapture({
            orderId: order.id,
            providerPaymentId: paymentId,
            providerOrderId,
            amountInr: order.totalPriceInr,
            method: typeof paymentEntity.method === 'string' ? paymentEntity.method : 'razorpay_order_paid',
            webhookEventId: eventId,
            actorEmail: 'webhook@razorpay.com',
            actorRole: 'SYSTEM',
          });
          outcome = 'order_paid_reconciled';
        } else {
          outcome = 'already_reconciled';
        }
      }

      await backend.recordIntegrationEvent({
        provider: 'RAZORPAY',
        eventId,
        eventType,
        payloadHash: crypto.createHash('sha256').update(raw).digest('hex'),
        status: eventStatus,
      });
      await backend.addAuditLog({
        actorEmail: 'webhook@razorpay.com',
        actorRole: 'SYSTEM',
        action: `RAZORPAY_WEBHOOK_${eventType.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
        entityType: 'IntegrationEvent',
        entityId: eventId,
        summary: `Verified Razorpay webhook ${eventType} (${eventId}): ${outcome}.`,
      });

      res.status(200).json({ received: true, eventId });
    })
  );

  // ---------------------------------------------------------------------------
  // 15. COMPLETE STOREFRONT & ADMIN V1 EXTENSIONS (PRODUCTS, COLLECTIONS, CART,
  //     WISHLIST, CHECKOUT, RAZORPAY PAYMENTS, REFUNDS, INVENTORY, ROLLBACK)
  // ---------------------------------------------------------------------------

  // Public Storefront Catalog Listing & Filtering
  app.get(
    '/api/products',
    asyncHandler(async (req: Request, res: Response) => {
      const [products, collections, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts(),
        backend.listCollections(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const search = String(req.query.search || req.query.q || '').trim().toLowerCase();
      const category = String(req.query.category || '').trim().toLowerCase();
      const collection = String(req.query.collection || '').trim().toLowerCase();
      const shape = String(req.query.shape || '').trim().toUpperCase();
      const metalPurity = String(req.query.metalPurity || '').trim().toUpperCase();
      const metalColor = String(req.query.metalColor || '').trim().toUpperCase();
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
      const sort = String(req.query.sort || 'featured').trim().toLowerCase();

      const matchedCollection = collection
        ? collections.find((c) => c.handle.toLowerCase() === collection)
        : null;

      const enrichedProducts = products.map((p) =>
        enrichProductWithAuthoritativePrice(p, metalRates, diamondRates, activeRule)
      );

      const filtered = enrichedProducts.filter((p) => {
        if (
          search &&
          !p.title.toLowerCase().includes(search) &&
          !p.sku.toLowerCase().includes(search) &&
          !p.category.toLowerCase().includes(search)
        ) {
          return false;
        }
        if (category && p.category.toLowerCase() !== category) {
          return false;
        }
        if (collection) {
          if (collection === 'best-sellers') {
            if (!p.isFeaturedBestseller && !matchedCollection?.productSkus.includes(p.sku)) {
              return false;
            }
          } else if (collection === 'under-15k') {
            if (p.priceOnRequest || Number(p.currentShopifyPriceInr) >= 15000) return false;
          } else if (collection === '15k-to-25k') {
            const pr = Number(p.currentShopifyPriceInr);
            if (p.priceOnRequest || pr < 15000 || pr > 25000) return false;
          } else if (collection === '25k-to-50k') {
            const pr = Number(p.currentShopifyPriceInr);
            if (p.priceOnRequest || pr < 25000 || pr > 50000) return false;
          } else if (collection === '50k-and-above') {
            if (p.priceOnRequest || Number(p.currentShopifyPriceInr) < 50000) return false;
          } else if (collection !== 'all') {
            const inCategory = p.category.toLowerCase().replace(/\s+/g, '-') === collection;
            const inColList = matchedCollection?.productSkus.includes(p.sku);
            if (!inCategory && !inColList) return false;
          }
        }
        if (shape && !p.diamondComponents.some((d) => d.shape.toUpperCase() === shape)) {
          return false;
        }
        if (metalPurity && p.metalPurity.toUpperCase() !== metalPurity) {
          return false;
        }
        if (metalColor && p.metalColor.toUpperCase() !== metalColor) {
          return false;
        }
        const priceNum = Number(p.currentShopifyPriceInr);
        if (minPrice !== null && !Number.isNaN(minPrice) && (p.priceOnRequest || priceNum < minPrice)) {
          return false;
        }
        if (maxPrice !== null && !Number.isNaN(maxPrice) && (p.priceOnRequest || priceNum > maxPrice)) {
          return false;
        }
        return true;
      });

      if (sort === 'price-asc' || sort === 'price-ascending') {
        filtered.sort(
          (a, b) => Number(a.currentShopifyPriceInr) - Number(b.currentShopifyPriceInr)
        );
      } else if (sort === 'price-desc' || sort === 'price-descending') {
        filtered.sort(
          (a, b) => Number(b.currentShopifyPriceInr) - Number(a.currentShopifyPriceInr)
        );
      } else if (sort === 'title-asc' || sort === 'title-ascending') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
      } else if (sort === 'title-desc' || sort === 'title-descending') {
        filtered.sort((a, b) => b.title.localeCompare(a.title));
      }

      const rateCard = buildOwnerMarketRateCard({
        metalRates,
        diamondRates,
        rule: activeRule,
      });

      res.json({
        total: filtered.length,
        rateCard,
        products: filtered.map(toPublicProduct),
      });
    })
  );

  // Public Storefront Product Detail by Handle or SKU
  app.get(
    '/api/products/:handleOrSku',
    asyncHandler(async (req: Request, res: Response) => {
      const key = getParam(req.params.handleOrSku).toLowerCase();
      const product = await backend.findProductByHandleOrSku(key);

      if (!product || (product.status && product.status !== 'ACTIVE')) {
        res.status(404).json({
          error: 'PRODUCT_NOT_FOUND',
          message: `Product "${key}" not found.`,
        });
        return;
      }

      const [products, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const enrichedProduct = enrichProductWithAuthoritativePrice(
        product,
        metalRates,
        diamondRates,
        activeRule
      );

      // Server-computed price per offered purity (variants), so the storefront never recalculates locally.
      if (activeRule) {
        const offeredPurities = Array.from(
          new Set([product.metalPurity, ...(product.variants || []).map((v) => v.metalPurity)])
        ) as MetalPurity[];
        enrichedProduct.purityBreakups = Object.fromEntries(
          offeredPurities.map((purity) => [
            purity,
            purity === product.metalPurity && enrichedProduct.priceBreakup
              ? enrichedProduct.priceBreakup
              : calculateJewelleryPrice({
                  product: {
                    ...product,
                    metalPurity: purity,
                    metalType: purity === '950_PLATINUM' ? 'PLATINUM' : 'GOLD',
                  },
                  metalRates,
                  diamondRates,
                  rule: activeRule,
                }),
          ])
        );
      }

      const relatedProducts = products
        .filter((p) => p.sku !== product.sku)
        .slice(0, 4)
        .map((p) => toPublicProduct(enrichProductWithAuthoritativePrice(p, metalRates, diamondRates, activeRule)));

      const rateCard = buildOwnerMarketRateCard({
        metalRates,
        diamondRates,
        rule: activeRule,
      });

      const publicProduct = toPublicProduct(enrichedProduct);
      res.json({
        product: publicProduct,
        priceBreakup: publicProduct.priceBreakup,
        rateCard,
        relatedProducts,
      });
    })
  );

  // Admin Create Product
  const handleCreateProduct = asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const input = parsed.data;

    if (Number(input.netMetalWeightGrams) > Number(input.grossWeightGrams)) {
      res.status(400).json({
        error: 'NET_EXCEEDS_GROSS_WEIGHT',
        message: 'Net metal weight cannot exceed gross weight.',
      });
      return;
    }

    const existing = await backend.findProductByHandleOrSku(input.sku);
    if (existing) {
      res.status(409).json({
        error: 'DUPLICATE_SKU',
        message: `A product with SKU "${input.sku}" already exists.`,
      });
      return;
    }

    const slugHandle = (input.handle || `${input.title}-${input.sku}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const [metalRates, diamondRates, activeRule] = await Promise.all([
      backend.getActiveMetalRates(),
      backend.getActiveDiamondRates(),
      backend.getActivePricingRule(),
    ]);
    const tempProduct: JewelleryProductSpec = {
      id: 'temp',
      sku: input.sku,
      handle: slugHandle,
      title: input.title,
      description: input.description,
      category: input.category,
      shopifyProductGid: 'gid://shopify/Product/temp',
      shopifyVariantGid: 'gid://shopify/ProductVariant/temp',
      currentShopifyPriceInr: '0.00',
      metalType: input.metalType,
      metalPurity: input.metalPurity,
      metalColor: input.metalColor,
      ringSize: input.ringSize || '12',
      grossWeightGrams: Number(input.grossWeightGrams).toFixed(3),
      netMetalWeightGrams: Number(input.netMetalWeightGrams).toFixed(3),
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      diamondComponents: input.diamondComponents,
      makingChargeMode: input.makingChargeMode,
      makingChargeValue: Number(input.makingChargeValue).toFixed(2),
      wastageMode: input.wastageMode,
      wastageValue: Number(input.wastageValue).toFixed(2),
      certificationFeeInr: Number(input.certificationFeeInr).toFixed(2),
      hallmarkFeeInr: Number(input.hallmarkFeeInr).toFixed(2),
      fixedAdjustmentInr: '0.00',
      manualPriceOverrideInr: input.manualPriceOverrideInr || null,
      pricingEnabled: true,
      inventoryQuantity: input.inventoryQuantity,
      updatedAt: new Date().toISOString(),
    };
    // Without an approved rule the product is stored at ₹0 and shows Price on request until one is published.
    const breakdown = activeRule
      ? calculateJewelleryPrice({ product: tempProduct, metalRates, diamondRates, rule: activeRule })
      : null;

    const newProduct = await backend.createProduct({
      sku: input.sku,
      handle: slugHandle,
      title: input.title,
      description: input.description,
      categoryName: input.category,
      priceInr: breakdown && !breakdown.priceOnRequest ? Number(breakdown.finalProposedPriceInr) : 0,
      metalType: input.metalType,
      metalPurity: input.metalPurity,
      metalColor: input.metalColor,
      grossWeightGrams: Number(input.grossWeightGrams),
      netMetalWeightGrams: Number(input.netMetalWeightGrams),
      makingChargeMode: input.makingChargeMode,
      makingChargeValue: Number(input.makingChargeValue),
      wastageMode: input.wastageMode,
      wastageValue: Number(input.wastageValue),
      certificationFeeInr: Number(input.certificationFeeInr),
      hallmarkFeeInr: Number(input.hallmarkFeeInr),
      inventoryQuantity: input.inventoryQuantity,
      // Never attach another SKU's photo: no image means the storefront shows its neutral placeholder.
      imageUrl: input.imageUrl || undefined,
      diamondComponents: input.diamondComponents,
      actorEmail: req.adminUser!.email,
      actorRole: req.adminUser!.role,
    });

    res.status(201).json({ product: newProduct, priceBreakup: breakdown });
  });

  app.post('/api/admin/products', requireAuth, requirePermission('PRODUCTS_WRITE'), handleCreateProduct);
  app.post('/api/products', requireAuth, requirePermission('PRODUCTS_WRITE'), handleCreateProduct);

  // Admin Delete Product (with active order safeguard)
  const handleDeleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const targetSku = getParam(req.params.sku);
    const product = await backend.findProductByHandleOrSku(targetSku);

    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const orders = await backend.listOrders();
    const hasActiveOrder = orders.some(
      (o) =>
        o.fulfillmentStatus !== 'CANCELLED' &&
        o.lineItems.some((li) => li.sku.toUpperCase() === product.sku.toUpperCase())
    );

    if (hasActiveOrder) {
      res.status(409).json({
        error: 'PRODUCT_IN_ACTIVE_ORDER',
        message: `Cannot delete SKU "${product.sku}" because it is referenced by an active customer order.`,
      });
      return;
    }

    await backend.deleteProduct(product.sku, req.adminUser!.email, req.adminUser!.role);
    res.json({ deleted: true, sku: product.sku });
  });

  app.delete('/api/admin/products/:sku', requireAuth, requirePermission('PRODUCTS_WRITE'), handleDeleteProduct);
  app.delete('/api/products/:sku', requireAuth, requirePermission('PRODUCTS_WRITE'), handleDeleteProduct);

  // Collections Public & Admin Endpoints
  app.get(
    '/api/collections',
    asyncHandler(async (_req: Request, res: Response) => {
      const [collections, categories] = await Promise.all([
        backend.listCollections(),
        backend.listCategories(),
      ]);
      res.json({ collections, categories });
    })
  );

  app.get(
    '/api/collections/:handle',
    asyncHandler(async (req: Request, res: Response) => {
      const handle = getParam(req.params.handle).toLowerCase();
      const [collections, categories, allProducts, metalRates, diamondRates, activeRule] =
        await Promise.all([
          backend.listCollections(),
          backend.listCategories(),
          backend.listProducts(),
          backend.getActiveMetalRates(),
          backend.getActiveDiamondRates(),
          backend.getActivePricingRule(),
        ]);
      const collection = collections.find((c) => c.handle.toLowerCase() === handle);
      const category = categories.find((c) => c.slug.toLowerCase() === handle);

      if (!collection && !category && handle !== 'all' && handle !== 'best-sellers') {
        res.status(404).json({ error: 'COLLECTION_NOT_FOUND' });
        return;
      }

      const products = allProducts
        .filter((p) => {
          if (handle === 'all') return true;
          if (handle === 'best-sellers') return Boolean(p.isFeaturedBestseller);
          if (collection && collection.productSkus.includes(p.sku)) return true;
          return p.category.toLowerCase().replace(/\s+/g, '-') === handle;
        })
        .map((p) => toPublicProduct(enrichProductWithAuthoritativePrice(p, metalRates, diamondRates, activeRule)));

      res.json({
        collection: collection || {
          id: category?.id || `col-${handle}`,
          handle,
          title: category?.name || handle.toUpperCase(),
          description: category?.description || '',
          imageUrl: products[0]?.imageUrl || '',
          isFeatured: true,
          isActive: true,
          productSkus: products.map((p) => p.sku),
        },
        products,
      });
    })
  );

  // Inventory Stock Adjustment & Movements
  const handleAdjustInventory = asyncHandler(async (req: Request, res: Response) => {
    const parsed = AdjustInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      return;
    }

    const { sku, deltaQuantity, setQuantity, expectedQuantity, reason } = parsed.data;

    // Strict safeguard 1: MRS-EAR-2001 is protected baseline inventory
    if (sku.toUpperCase() === 'MRS-EAR-2001') {
      res.status(403).json({
        error: 'PROTECTED_INVENTORY_RECORD',
        message: 'MRS-EAR-2001 inventory is strictly protected and cannot be manually modified.',
      });
      return;
    }

    const product = await backend.findProductByHandleOrSku(sku);

    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product SKU "${sku}" not found.` });
      return;
    }

    // Strict safeguard 2: Concurrency / Stale-write check
    if (expectedQuantity !== undefined && product.inventoryQuantity !== expectedQuantity) {
      res.status(409).json({
        error: 'STALE_INVENTORY_UPDATE',
        message: `Inventory quantity was modified concurrently (current: ${product.inventoryQuantity}, expected: ${expectedQuantity}).`,
        currentQuantity: product.inventoryQuantity,
        expectedQuantity,
      });
      return;
    }

    const prev = product.inventoryQuantity;
    const computedDelta =
      setQuantity !== undefined ? setQuantity - prev : deltaQuantity !== undefined ? deltaQuantity : 0;

    if (prev + computedDelta < 0) {
      res.status(400).json({
        error: 'INSUFFICIENT_STOCK',
        message: `Inventory cannot become negative (current: ${prev}, requested change: ${computedDelta}).`,
      });
      return;
    }

    const result = await backend.adjustInventory({
      sku: product.sku,
      quantityDelta: computedDelta,
      reason,
      actorEmail: req.adminUser!.email,
      actorRole: req.adminUser!.role,
    });

    res.json({
      sku: product.sku,
      previousQuantity: result.previousQuantity,
      inventoryQuantity: result.newQuantity,
      movement: result.movement,
    });
  });

  app.post('/api/admin/inventory/adjust', requireAuth, requirePermission('PRODUCTS_WRITE'), handleAdjustInventory);
  app.post('/api/inventory/adjust', requireAuth, requirePermission('PRODUCTS_WRITE'), handleAdjustInventory);

  app.get(
    '/api/admin/inventory/movements',
    requireAuth,
    requirePermission('PRODUCTS_VIEW'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsedQuery = PaginationQuerySchema.safeParse(req.query);
      const query = parsedQuery.success ? parsedQuery.data : PaginationQuerySchema.parse({});
      const skuFilter = String(req.query.sku || '').trim().toLowerCase();
      const typeFilter = String(req.query.movementType || '').trim().toUpperCase();

      const allMovements = await backend.listInventoryMovements();
      const filtered = allMovements.filter((m) => {
        if (skuFilter && !m.sku.toLowerCase().includes(skuFilter)) return false;
        if (typeFilter && m.movementType !== typeFilter) return false;
        return true;
      });

      const paginated = paginateList(filtered, {
        page: query.page,
        pageSize: query.pageSize || query.limit || 25,
        sortBy: query.sortBy || 'createdAt',
        sortDirection: query.sortDirection || query.sortOrder || 'desc',
        sortMap: {
          createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
          deltaQuantity: (a, b) => a.deltaQuantity - b.deltaQuantity,
          sku: (a, b) => a.sku.localeCompare(b.sku),
        },
      });

      res.json({
        ...paginated,
        movements: paginated.items,
      });
    })
  );

  // Excel Importer Rollback
  app.post(
    '/api/admin/imports/:jobId/rollback',
    requireAuth,
    requirePermission('IMPORTS_RUN'),
    requireOwnerRole,
    asyncHandler(async (req: Request, res: Response) => {
      const jobId = getParam(req.params.jobId);
      const job = await backend.findImportJobById(jobId);
      if (!job) {
        res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND' });
        return;
      }

      const result = await backend.rollbackImportJob(
        job.id,
        req.adminUser!.email,
        req.adminUser!.role
      );

      if (!result) {
        res.status(404).json({ error: 'IMPORT_JOB_NOT_FOUND' });
        return;
      }

      res.json({
        rolledBack: true,
        jobId: result.job.id,
        removedProductsCount: result.removedProductsCount,
      });
    })
  );

  // Customer Registration & Login
  const toCustomerOrderSummary = (order: ReturnType<typeof dbStore.getState>['orders'][number]) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    totalPriceInr: order.totalPriceInr,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    placedAt: order.placedAt,
    lineItems: order.lineItems.map(({ sku, title, quantity, purchaseTimePriceInr, metalPurity }) => ({
      sku,
      title,
      quantity,
      purchaseTimePriceInr,
      metalPurity,
    })),
  });

  app.post(
    '/api/auth/register',
    authRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CustomerRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      if (!isEmailVerificationConfigured()) {
        res.status(503).json({
          error: 'EMAIL_VERIFICATION_UNAVAILABLE',
          message: 'Account registration is temporarily unavailable because email verification is not configured.',
        });
        return;
      }

      const email = normalizeEmail(parsed.data.email);
      const existing = await backend.findCustomerByEmail(email);
      if (existing) {
        res.status(409).json({
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists.',
        });
        return;
      }

      const now = new Date();
      const verification = createEmailVerificationToken();
      const customer = await backend.createCustomer({
        email,
        passwordHash: hashPassword(parsed.data.password),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        city: parsed.data.city,
        state: parsed.data.state,
        emailVerified: false,
        emailVerificationTokenHash: verification.tokenHash,
        emailVerificationExpiresAt: new Date(verification.expiresAt),
        emailVerificationLastSentAt: now,
      });

      try {
        await sendEmailVerification(customer.email, verification.token);
      } catch {
        res.status(503).json({
          error: 'VERIFICATION_EMAIL_UNAVAILABLE',
          message: 'Your account is pending email verification, but the verification message could not be delivered. Use the resend verification option or contact support.',
        });
        return;
      }

      res.status(202).json({
        verificationRequired: true,
        message: 'Check your email for a verification link. No account session is active yet.',
      });
    })
  );

  app.post(
    '/api/auth/verification/resend',
    authRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = LoginInputSchema.pick({ email: true }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      if (!isEmailVerificationConfigured()) {
        res.status(503).json({ error: 'EMAIL_VERIFICATION_UNAVAILABLE', message: 'Email verification is not configured.' });
        return;
      }
      const customer = await backend.findCustomerByEmail(normalizeEmail(parsed.data.email));
      if (
        customer &&
        customer.isActive !== false &&
        customer.emailVerified !== true &&
        !isResendCooldownActive(customer.emailVerificationLastSentAt)
      ) {
        const verification = createEmailVerificationToken();
        await backend.updateVerificationToken(
          customer.id,
          verification.tokenHash,
          new Date(verification.expiresAt),
          new Date()
        );
        try {
          await sendEmailVerification(customer.email, verification.token);
        } catch {
          res.status(503).json({ error: 'VERIFICATION_EMAIL_UNAVAILABLE', message: 'Unable to send verification email.' });
          return;
        }
      }
      // Avoid disclosing whether an address has a pending account.
      res.status(202).json({ message: 'If the address has a pending account, a verification message will be sent.' });
    })
  );

  app.post(
    '/api/auth/verify-email',
    authRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token || token.length > 200) {
        res.status(400).json({ error: 'INVALID_VERIFICATION_TOKEN', message: 'Verification link is invalid or expired.' });
        return;
      }
      const tokenHash = hashEmailVerificationToken(token);
      const customers = await backend.listCustomers();
      const customer = customers.find((candidate) =>
        verificationHashesMatch(tokenHash, candidate.emailVerificationTokenHash)
      );
      if (
        !customer ||
        customer.emailVerified === true ||
        !customer.emailVerificationExpiresAt ||
        Date.parse(customer.emailVerificationExpiresAt) <= Date.now()
      ) {
        res.status(400).json({ error: 'INVALID_VERIFICATION_TOKEN', message: 'Verification link is invalid or expired.' });
        return;
      }
      const verifiedCustomer = await backend.markEmailVerified(customer.id);
      const tokenValue = signCustomerToken({ id: verifiedCustomer.id, email: verifiedCustomer.email });
      issueSessionCookie(res, 'customer', tokenValue);
      res.json({
        token: tokenValue,
        csrfToken: deriveCsrfToken(tokenValue, getJwtSecret()),
        customer: {
          id: verifiedCustomer.id,
          email: verifiedCustomer.email,
          firstName: verifiedCustomer.firstName,
          lastName: verifiedCustomer.lastName,
          phone: verifiedCustomer.phone,
          city: verifiedCustomer.city,
          state: verifiedCustomer.state,
        },
      });
    })
  );

  app.post(
    '/api/auth/customer/login',
    authRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = LoginInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const customer = await backend.findCustomerByEmail(parsed.data.email);

      if (
        !customer ||
        customer.isActive === false ||
        customer.emailVerified !== true ||
        !customer.passwordHash ||
        !verifyPassword(parsed.data.password, customer.passwordHash)
      ) {
        res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
        return;
      }

      const token = signCustomerToken({ id: customer.id, email: customer.email });
      const orders = await backend.listOrdersByCustomer(customer.id, customer.email);

      issueSessionCookie(res, 'customer', token);
      res.json({
        token,
        csrfToken: deriveCsrfToken(token, getJwtSecret()),
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          city: customer.city,
          state: customer.state,
          totalOrdersCount: customer.totalOrdersCount,
          totalSpentInr: customer.totalSpentInr,
        },
        orders: orders.map(toCustomerOrderSummary),
      });
    })
  );

  const handleCustomerMeAndOrders = asyncHandler(async (req: Request, res: Response) => {
    const customer = await backend.findCustomerById(req.customerUser!.id);
    if (!customer || customer.isActive === false) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Customer session is no longer valid.' });
      return;
    }

    const orders = await backend.listOrdersByCustomer(customer.id, customer.email);

    res.json({
      csrfToken: deriveCsrfToken(req.sessionToken!, getJwtSecret()),
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        city: customer.city,
        state: customer.state,
        totalOrdersCount: customer.totalOrdersCount,
        totalSpentInr: customer.totalSpentInr,
      },
      orders: orders.map(toCustomerOrderSummary),
    });
  });

  app.get('/api/auth/customer/me', requireCustomerAuth, handleCustomerMeAndOrders);
  app.get('/api/customer/orders', requireCustomerAuth, handleCustomerMeAndOrders);

  // Cart Endpoints
  async function recalculateCart(cartId: string, persistIfChanged = true) {
    let cart = await backend.getCart(cartId);
    if (!cart) {
      cart = {
        id: cartId,
        items: [],
        discountAmountInr: '0.00',
        subtotalInr: '0.00',
        taxAmountInr: '0.00',
        totalInr: '0.00',
        updatedAt: new Date().toISOString(),
      };
    }

    if (cart.items.length > 0) {
      const [products, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listProducts(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      for (const item of cart.items) {
        if (!item.customizationSelections || Object.keys(item.customizationSelections).length === 0) {
          const prod = products.find((p) => p.sku === item.sku);
          if (prod && activeRule) {
            const enriched = enrichProductWithAuthoritativePrice(
              prod,
              metalRates,
              diamondRates,
              activeRule
            );
            if (!enriched.priceOnRequest) {
              const latestUnit = Number(enriched.currentShopifyPriceInr);
              item.unitPriceInr = latestUnit.toFixed(2);
              item.lineTotalInr = (item.quantity * latestUnit).toFixed(2);
            }
          }
        }
      }
    }

    const subtotal = cart.items.reduce((sum, item) => sum + Number(item.lineTotalInr), 0);
    let discountAmt = 0;
    if (cart.discountCode) {
      const disc = await backend.findDiscountByCode(cart.discountCode);
      if (disc && disc.isActive && subtotal >= Number(disc.minOrderAmountInr)) {
        if (disc.discountType === 'PERCENTAGE') {
          discountAmt = subtotal * (Number(disc.value) / 100);
        } else {
          discountAmt = Number(disc.value);
        }
      }
    }

    const totalAfterDiscount = Math.max(0, subtotal - discountAmt);
    const gstIncluded = totalAfterDiscount - totalAfterDiscount / 1.03;

    cart.subtotalInr = subtotal.toFixed(2);
    cart.discountAmountInr = discountAmt.toFixed(2);
    cart.taxAmountInr = gstIncluded.toFixed(2);
    cart.totalInr = totalAfterDiscount.toFixed(2);
    cart.updatedAt = new Date().toISOString();
    return persistIfChanged ? await backend.saveCart(cart) : cart;
  }

  async function resolveCustomizedItemPricing(params: {
    product: JewelleryProductSpec;
    selections?: Record<string, string>;
    customerDesignId?: string;
    authenticatedCustomerId?: string;
  }) {
    let effectiveSelections = params.selections;
    let resolvedDesignId = params.customerDesignId;

    if (params.customerDesignId && (!effectiveSelections || Object.keys(effectiveSelections).length === 0)) {
      const design = await backend.findCustomerDesignById(params.customerDesignId);
      if (!design) {
        throw new CustomizationQuoteError('DESIGN_NOT_FOUND', 'Saved design was not found.', 404);
      }
      if (params.authenticatedCustomerId && design.customerId !== params.authenticatedCustomerId) {
        throw new CustomizationQuoteError('FORBIDDEN', 'You do not have access to this saved design.', 403);
      }
      if (design.productSku !== params.product.sku) {
        throw new CustomizationQuoteError(
          'DESIGN_PRODUCT_MISMATCH',
          'Saved design does not match the requested product SKU.',
          400
        );
      }
      effectiveSelections = design.selections;
      resolvedDesignId = design.id;
    }

    if (!effectiveSelections || Object.keys(effectiveSelections).length === 0) {
      return null;
    }

    const [profiles, assignment, metalRates, diamondRates, activeRule] = await Promise.all([
      backend.listCustomizationProfiles(),
      backend.findCustomizationAssignmentByProductId(params.product.id),
      backend.getActiveMetalRates(),
      backend.getActiveDiamondRates(),
      backend.getActivePricingRule(),
    ]);

    const eligibility = resolveEligibleCustomizationProfile({
      product: params.product,
      assignment,
      profiles,
    });
    if (!eligibility.eligible || !eligibility.profile) {
      throw new CustomizationQuoteError(
        'PRODUCT_NOT_CUSTOMIZABLE',
        `Product "${params.product.sku}" is not configured for customization.`,
        400
      );
    }

    const quote = calculateCustomizationQuote({
      product: params.product,
      profile: eligibility.profile,
      assignment: eligibility.assignment,
      selections: effectiveSelections,
      quantity: 1,
      metalRates,
      diamondRates,
      rule: activeRule,
    });

    return {
      selections: effectiveSelections,
      customerDesignId: resolvedDesignId,
      quote,
    };
  }

  app.get(
    '/api/cart/:cartId',
    asyncHandler(async (req: Request, res: Response) => {
      const cartId = getParam(req.params.cartId);
      const cart = await recalculateCart(cartId, false);
      res.json({ cart });
    })
  );

  app.post(
    '/api/cart/:cartId/items',
    optionalCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const cartId = getParam(req.params.cartId);
      const parsed = CartItemInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const product = await backend.findProductByHandleOrSku(parsed.data.sku);

      if (!isPublicProduct(product)) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }

      if (product.inventoryQuantity < parsed.data.quantity) {
        res.status(400).json({
          error: 'INSUFFICIENT_STOCK',
          message: `Only ${product.inventoryQuantity} unit(s) of "${product.title}" available in vault.`,
        });
        return;
      }

      let customResult: Awaited<ReturnType<typeof resolveCustomizedItemPricing>> = null;
      try {
        customResult = await resolveCustomizedItemPricing({
          product,
          selections: parsed.data.selections,
          customerDesignId: parsed.data.customerDesignId,
          authenticatedCustomerId: req.customerUser?.id,
        });
      } catch (err) {
        if (err instanceof CustomizationQuoteError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      const cart = await recalculateCart(cartId, false);
      const metalPurity =
        customResult?.quote.selectionSnapshot.find((s) => s.groupCode === 'metal_purity_color')?.label ||
        parsed.data.metalPurity ||
        product.metalPurity;
      const metalColor = customResult?.quote.resolvedMetalColor || parsed.data.metalColor || product.metalColor;
      const ringSize =
        customResult?.quote.selectionSnapshot.find((s) => s.groupCode === 'ring_size')?.value ||
        parsed.data.ringSize ||
        product.ringSize ||
        '12';

      const selectionFingerprint = customResult
        ? JSON.stringify(
            Object.entries(customResult.selections).sort(([a], [b]) => a.localeCompare(b))
          )
        : '';

      const existingItem = cart.items.find((i) => {
        const itemFingerprint = i.customizationSelections
          ? JSON.stringify(
              Object.entries(i.customizationSelections).sort(([a], [b]) => a.localeCompare(b))
            )
          : '';
        return (
          i.sku === product.sku &&
          i.metalPurity === metalPurity &&
          i.metalColor === metalColor &&
          i.ringSize === ringSize &&
          itemFingerprint === selectionFingerprint
        );
      });

      const [metalRates, diamondRates, activeRule] = await Promise.all([
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);
      const enrichedProduct = enrichProductWithAuthoritativePrice(
        product,
        metalRates,
        diamondRates,
        activeRule
      );

      if (!customResult && enrichedProduct.priceOnRequest) {
        res.status(422).json({
          error: 'PRICE_ON_REQUEST',
          reason: enrichedProduct.priceOnRequestReason,
          message: `"${product.title}" is priced on request. Please contact our studio for a personalised quote.`,
        });
        return;
      }

      const unitPrice = customResult
        ? Number(customResult.quote.unitPriceInr)
        : Number(enrichedProduct.currentShopifyPriceInr);
      if (existingItem) {
        if (product.inventoryQuantity < existingItem.quantity + parsed.data.quantity) {
          res.status(400).json({
            error: 'INSUFFICIENT_STOCK',
            message: `Only ${product.inventoryQuantity} unit(s) of "${product.title}" available in vault.`,
          });
          return;
        }
        existingItem.quantity += parsed.data.quantity;
        existingItem.unitPriceInr = unitPrice.toFixed(2);
        existingItem.lineTotalInr = (existingItem.quantity * unitPrice).toFixed(2);
        if (customResult) {
          existingItem.customizationSelections = customResult.selections;
          existingItem.customizationSnapshot = customResult.quote.selectionSnapshot;
          existingItem.pricingBreakdown = customResult.quote.breakdownLines;
          existingItem.customerDesignId = customResult.customerDesignId;
        }
      } else {
        cart.items.push({
          id: crypto.randomUUID(),
          sku: product.sku,
          handle: product.handle,
          title: product.title,
          imageUrl: product.imageUrl || '',
          quantity: parsed.data.quantity,
          unitPriceInr: unitPrice.toFixed(2),
          lineTotalInr: (parsed.data.quantity * unitPrice).toFixed(2),
          metalPurity,
          metalColor,
          ringSize,
          customizationSelections: customResult?.selections,
          customizationSnapshot: customResult?.quote.selectionSnapshot,
          pricingBreakdown: customResult?.quote.breakdownLines,
          customerDesignId: customResult?.customerDesignId,
        });
      }

      await backend.saveCart(cart);
      const updatedCart = await recalculateCart(cartId, true);
      res.json({ cart: updatedCart });
    })
  );

  app.patch(
    '/api/cart/:cartId/items/:itemId',
    asyncHandler(async (req: Request, res: Response) => {
      const cartId = getParam(req.params.cartId);
      const itemId = getParam(req.params.itemId);
      const quantity = Number(req.body?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        res.status(400).json({ error: 'INVALID_QUANTITY', message: 'Quantity must be between 1 and 20.' });
        return;
      }
      const cart = await recalculateCart(cartId, false);
      const item = cart.items.find((i) => i.id === itemId);
      if (!item) {
        res.status(404).json({ error: 'CART_ITEM_NOT_FOUND' });
        return;
      }
      const product = await backend.findProductByHandleOrSku(item.sku);
      if (product && product.inventoryQuantity < quantity) {
        res.status(400).json({
          error: 'INSUFFICIENT_STOCK',
          message: `Only ${product.inventoryQuantity} unit(s) of "${product.title}" available in vault.`,
        });
        return;
      }
      item.quantity = quantity;
      item.lineTotalInr = (quantity * Number(item.unitPriceInr)).toFixed(2);
      await backend.saveCart(cart);
      const updatedCart = await recalculateCart(cartId, true);
      res.json({ cart: updatedCart });
    })
  );

  app.delete(
    '/api/cart/:cartId/items/:itemId',
    asyncHandler(async (req: Request, res: Response) => {
      const cartId = getParam(req.params.cartId);
      const itemId = getParam(req.params.itemId);
      const cart = await recalculateCart(cartId, false);
      cart.items = cart.items.filter((i) => i.id !== itemId && i.sku !== itemId);
      await backend.saveCart(cart);
      const updatedCart = await recalculateCart(cartId, true);
      res.json({ cart: updatedCart });
    })
  );

  app.post(
    '/api/cart/:cartId/discount',
    asyncHandler(async (req: Request, res: Response) => {
      const cartId = getParam(req.params.cartId);
      const code = String(req.body.code || '').trim().toUpperCase();
      const disc = await backend.findDiscountByCode(code);
      if (!disc || !disc.isActive) {
        res.status(400).json({ error: 'INVALID_DISCOUNT_CODE', message: 'Invalid or expired coupon code.' });
        return;
      }

      const cart = await recalculateCart(cartId, false);
      cart.discountCode = disc.code;
      await backend.saveCart(cart);
      const updatedCart = await recalculateCart(cartId, true);
      res.json({ cart: updatedCart, discount: disc });
    })
  );

  // Wishlist Endpoints
  app.get(
    '/api/wishlist/:wishlistId',
    asyncHandler(async (req: Request, res: Response) => {
      const wishlistId = getParam(req.params.wishlistId);
      const [skus, products] = await Promise.all([
        backend.getWishlist(wishlistId),
        backend.listProducts(),
      ]);
      const items = products.filter((p) => skus.includes(p.sku) || skus.includes(p.handle));
      res.json({ wishlistId, skus, items });
    })
  );

  app.post(
    '/api/wishlist/:wishlistId/toggle',
    asyncHandler(async (req: Request, res: Response) => {
      const wishlistId = getParam(req.params.wishlistId);
      const skuOrHandle = String(req.body.sku || req.body.handle || '').trim();
      const before = await backend.getWishlist(wishlistId);
      const added = !before.includes(skuOrHandle);
      const skus = await backend.toggleWishlist(wishlistId, skuOrHandle);
      res.json({
        wishlistId,
        added,
        skus,
      });
    })
  );

  // Checkout, Order Creation & Razorpay Payment Verification
  app.post(
    '/api/checkout/create-order',
    optionalCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CheckoutCreateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const input = parsed.data;
      const rawIdempotencyHeader = req.headers['idempotency-key'];
      const idempotencyKey =
        input.idempotencyKey ||
        (typeof rawIdempotencyHeader === 'string' && rawIdempotencyHeader.trim().length >= 8
          ? rawIdempotencyHeader.trim().slice(0, 128)
          : undefined);

      if (idempotencyKey) {
        const existingOrder = await backend.findOrderByIdempotencyKey(idempotencyKey);
        if (existingOrder) {
          const normalizedRequestEmail = normalizeEmail(req.customerUser?.email || input.customerEmail);
          if (existingOrder.customerEmail.toLowerCase() !== normalizedRequestEmail) {
            res.status(409).json({
              error: 'IDEMPOTENCY_KEY_CONFLICT',
              message: 'This checkout idempotency key is already associated with another customer.',
            });
            return;
          }
          const orderAccessToken = signOrderAccessToken(existingOrder.id, existingOrder.customerEmail);
          let rzpPayload: { id: string; amountPaise: number; currency: string; keyId: string } | null = null;
          if (input.paymentMethod === 'RAZORPAY' && existingOrder.financialStatus === 'PENDING') {
            const creds = getRazorpayCredentials();
            const amountPaise = inrToPaise(existingOrder.totalPriceInr);
            if (existingOrder.razorpayOrderId) {
              rzpPayload = {
                id: existingOrder.razorpayOrderId,
                amountPaise,
                currency: 'INR',
                keyId: creds.keyId,
              };
            } else {
              const retryOrder = await createRazorpayOrder({
                amountPaise,
                receipt: buildRazorpayReceipt(existingOrder.orderNumber),
              });
              await backend.attachRazorpayOrderToOrder({
                orderId: existingOrder.id,
                razorpayOrderId: retryOrder.id,
                actorEmail: existingOrder.customerEmail,
                actorRole: req.customerUser ? 'CUSTOMER' : 'SYSTEM',
              });
              rzpPayload = {
                id: retryOrder.id,
                amountPaise: retryOrder.amount,
                currency: retryOrder.currency,
                keyId: creds.keyId,
              };
            }
          }
          res.status(200).json({
            order: existingOrder,
            orderAccessToken,
            paymentStatus: existingOrder.financialStatus,
            idempotent: true,
            razorpayOrder: rzpPayload,
          });
          return;
        }
      }

      const [products, metalRates, diamondRates, activeRule, discounts] = await Promise.all([
        backend.listProducts(),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
        backend.listDiscounts(),
      ]);

      // 0. No owner-approved pricing rule -> nothing can be sold at a calculated price.
      if (!activeRule) {
        res.status(422).json({
          error: 'PRICE_ON_REQUEST',
          reason: 'NO_APPROVED_PRICING_RULE',
          message: 'Online checkout is unavailable until an owner-approved pricing rule is active.',
        });
        return;
      }

      // 1. Aggregate duplicate SKUs and validate stock before any remote call.
      const itemProducts = input.items.map((reqItem) =>
        products.find(
          (p) =>
            p.sku.toLowerCase() === reqItem.sku.toLowerCase() ||
            p.handle.toLowerCase() === reqItem.sku.toLowerCase()
        )
      );
      const requestedBySku = new Map<string, number>();
      for (let index = 0; index < input.items.length; index += 1) {
        const reqItem = input.items[index]!;
        const prod = itemProducts[index];
        if (!prod) {
          res.status(404).json({
            error: 'PRODUCT_NOT_FOUND',
            message: `Product "${reqItem.sku}" was not found.`,
          });
          return;
        }
        requestedBySku.set(prod.sku, (requestedBySku.get(prod.sku) || 0) + reqItem.quantity);
      }
      for (const [sku, requestedQuantity] of requestedBySku) {
        const prod = products.find((candidate) => candidate.sku === sku)!;
        if (checkoutSkusInFlight.has(sku)) {
          res.status(409).json({
            error: 'CHECKOUT_IN_PROGRESS',
            message: 'Another checkout is currently reserving this item. Please retry shortly.',
          });
          return;
        }
        if (prod.inventoryQuantity < requestedQuantity) {
          res.status(409).json({
            error: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for "${prod.title}" (available: ${prod.inventoryQuantity}, requested: ${requestedQuantity}).`,
          });
          return;
        }
      }

      for (const sku of requestedBySku.keys()) checkoutSkusInFlight.add(sku);
      try {
        let orderSubtotal = 0;
        const orderLineItems: Array<{
          sku: string;
          title: string;
          quantity: number;
          purchaseTimePriceInr: string;
          metalPurity: string;
          diamondCarats: string;
          pricingSnapshotId: string;
          customizationSnapshot?: unknown[];
          customerDesignId?: string;
        }> = [];

        for (const reqItem of input.items) {
          const prod = products.find(
            (p) =>
              p.sku.toLowerCase() === reqItem.sku.toLowerCase() ||
              p.handle.toLowerCase() === reqItem.sku.toLowerCase()
          )!;

          let customResult: Awaited<ReturnType<typeof resolveCustomizedItemPricing>> = null;
          try {
            customResult = await resolveCustomizedItemPricing({
              product: prod,
              selections: reqItem.selections,
              customerDesignId: reqItem.customerDesignId,
              authenticatedCustomerId: req.customerUser?.id,
            });
          } catch (err) {
            if (err instanceof CustomizationQuoteError) {
              res.status(err.statusCode).json({ error: err.code, message: err.message });
              return;
            }
            throw err;
          }

          const enrichedProd = enrichProductWithAuthoritativePrice(
            prod,
            metalRates,
            diamondRates,
            activeRule
          );
          const baseBreakdown =
            enrichedProd.priceBreakup ||
            calculateJewelleryPrice({
              product: prod,
              metalRates,
              diamondRates,
              rule: activeRule,
            });

          if (!customResult && enrichedProd.priceOnRequest) {
            res.status(422).json({
              error: 'PRICE_ON_REQUEST',
              reason: enrichedProd.priceOnRequestReason,
              message: `"${prod.title}" is priced on request and cannot be purchased online. Please contact our studio for a personalised quote.`,
            });
            return;
          }

          const unitPrice = customResult
            ? Number(customResult.quote.unitPriceInr)
            : Number(enrichedProd.currentShopifyPriceInr);
          orderSubtotal += unitPrice * reqItem.quantity;
          const snapshotId = `snap-ord-${crypto.randomUUID()}`;
          orderLineItems.push({
            sku: prod.sku,
            title: prod.title,
            quantity: reqItem.quantity,
            purchaseTimePriceInr: unitPrice.toFixed(2),
            metalPurity:
              customResult?.quote.selectionSnapshot.find((s) => s.groupCode === 'metal_purity_color')?.label ||
              `${reqItem.metalPurity || prod.metalPurity} ${
                reqItem.metalColor || prod.metalColor.replace('_', ' ')
              }`,
            diamondCarats: `${baseBreakdown.totalDiamondCarats} ct tw`,
            pricingSnapshotId: snapshotId,
            customizationSnapshot: customResult
              ? customResult.quote.selectionSnapshot
              : undefined,
            customerDesignId: customResult?.customerDesignId,
          });
        }

        let discountAmt = 0;
        let appliedDiscountCode: string | null = null;
        if (input.discountCode) {
          const disc = discounts.find(
            (d) => d.code.toUpperCase() === input.discountCode!.toUpperCase() && d.isActive
          );
          if (disc && orderSubtotal >= Number(disc.minOrderAmountInr)) {
            appliedDiscountCode = disc.code;
            discountAmt =
              disc.discountType === 'PERCENTAGE'
                ? orderSubtotal * (Number(disc.value) / 100)
                : Number(disc.value);
          }
        }

        const finalTotal = Math.max(0, orderSubtotal - discountAmt);
        const netExTax = finalTotal / 1.03;
        const gstTax = finalTotal - netExTax;

        const orderNumber = `MRS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const orderReceiptId = buildRazorpayReceipt(orderNumber);
        const amountPaise = inrToPaise(finalTotal);
        let razorpayOrder: Awaited<ReturnType<typeof createRazorpayOrder>> | null = null;
        if (input.paymentMethod === 'RAZORPAY') {
          try {
            getRazorpayCredentials();
            razorpayOrder = await createRazorpayOrder({
              amountPaise,
              receipt: orderReceiptId,
            });
            if (
              !razorpayOrder.id ||
              razorpayOrder.amount !== amountPaise ||
              razorpayOrder.currency !== 'INR' ||
              razorpayOrder.status !== 'created'
            ) {
              res.status(503).json({
                error: 'PAYMENT_PROVIDER_INVALID_RESPONSE',
                message: 'Razorpay did not return a valid pending order.',
              });
              return;
            }
          } catch (err) {
            const safeMsg = redactRazorpayError(err);
            const isModeRejected = safeMsg.includes('TEST MODE') || safeMsg.includes('RAZORPAY_MODE');
            res.status(503).json({
              error: isModeRejected ? 'PAYMENT_MODE_REJECTED' : 'PAYMENT_UNAVAILABLE',
              message: isModeRejected
                ? safeMsg
                : 'Online payment is unavailable. No order was placed and inventory was not changed.',
            });
            return;
          }
        }

        let newOrder;
        try {
          newOrder = await backend.createOrderWithInventoryReservation({
            orderNumber,
            customerId: req.customerUser?.id || null,
            customerName: input.customerName,
            customerEmail: normalizeEmail(req.customerUser?.email || input.customerEmail),
            customerPhone: input.customerPhone,
            shippingCity: input.shippingAddress.city,
            shippingState: input.shippingAddress.state,
            shippingPincode: input.shippingAddress.pincode,
            shippingAddressJson: input.shippingAddress as unknown as Record<string, unknown>,
            subtotalPriceInr: netExTax.toFixed(2),
            totalTaxInr: gstTax.toFixed(2),
            totalPriceInr: finalTotal.toFixed(2),
            discountAmountInr: discountAmt.toFixed(2),
            discountCode: appliedDiscountCode,
            idempotencyKey,
            lineItems: orderLineItems,
            razorpayOrderId: razorpayOrder?.id,
            paymentGateway:
              input.paymentMethod === 'RAZORPAY'
                ? 'Razorpay Secure Checkout'
                : 'Studio Vault Pickup / Insured Payment',
            auditActorEmail: req.customerUser?.email || input.customerEmail,
            auditActorRole: req.customerUser ? 'CUSTOMER' : 'SYSTEM',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.startsWith('INSUFFICIENT_STOCK:')) {
            res.status(409).json({ error: 'INSUFFICIENT_STOCK', message: msg });
            return;
          }
          throw err;
        }

        const orderAccessToken = signOrderAccessToken(newOrder.id, newOrder.customerEmail);

        res.status(201).json({
          order: newOrder,
          orderAccessToken,
          paymentStatus: 'PENDING',
          razorpayOrder: razorpayOrder
            ? {
                id: razorpayOrder.id,
                amountPaise: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                keyId: getRazorpayCredentials().keyId,
              }
            : null,
        });
      } finally {
        for (const sku of requestedBySku.keys()) checkoutSkusInFlight.delete(sku);
      }
    })
  );

  // Create or retry a Razorpay order for an existing pending internal order
  app.post(
    '/api/checkout/orders/:orderId/razorpay-order',
    optionalCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = RazorpayRetryOrderSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const order = await backend.findOrderByIdOrNumber(String(req.params.orderId || ''));
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        return;
      }

      const tokenHeader = req.headers['x-order-access-token'];
      const orderAccessToken =
        parsed.data.orderAccessToken ||
        (typeof tokenHeader === 'string' ? tokenHeader : undefined);

      const isCustomerOwner =
        Boolean(req.customerUser) &&
        (order.customerId === req.customerUser!.id ||
          order.customerEmail.toLowerCase() === req.customerUser!.email.toLowerCase());
      const hasValidOrderToken =
        Boolean(orderAccessToken) &&
        verifyOrderAccessToken(orderAccessToken!, order.id, order.orderNumber, order.customerEmail);

      if (!isCustomerOwner && !hasValidOrderToken) {
        res.status(403).json({
          error: 'ORDER_ACCESS_DENIED',
          message: 'You are not authorized to initiate payment for this order.',
        });
        return;
      }

      if (order.financialStatus !== 'PENDING') {
        res.status(409).json({
          error: 'ORDER_NOT_PENDING',
          message: `Order ${order.orderNumber} is ${order.financialStatus} and cannot accept a new payment order.`,
        });
        return;
      }

      let creds: ReturnType<typeof getRazorpayCredentials>;
      try {
        creds = getRazorpayCredentials();
      } catch (err) {
        res.status(503).json({
          error: 'PAYMENT_CONFIGURATION_ERROR',
          message: redactRazorpayError(err),
        });
        return;
      }

      const amountPaise = inrToPaise(order.totalPriceInr);
      let rzpOrder: Awaited<ReturnType<typeof createRazorpayOrder>>;
      try {
        rzpOrder = await createRazorpayOrder({
          amountPaise,
          receipt: buildRazorpayReceipt(order.orderNumber),
        });
      } catch (err) {
        res.status(503).json({
          error: 'PAYMENT_UNAVAILABLE',
          message: 'Razorpay could not create a payment order. Your order remains pending.',
        });
        return;
      }

      const updatedOrder = await backend.attachRazorpayOrderToOrder({
        orderId: order.id,
        razorpayOrderId: rzpOrder.id,
        actorEmail: req.customerUser?.email || order.customerEmail,
        actorRole: req.customerUser ? 'CUSTOMER' : 'SYSTEM',
      });

      res.status(200).json({
        order: updatedOrder,
        razorpayOrder: {
          id: rzpOrder.id,
          amountPaise: rzpOrder.amount,
          currency: rzpOrder.currency,
          keyId: creds.keyId,
        },
      });
    })
  );

  // Verify Razorpay Payment
  app.post(
    '/api/payments/razorpay/verify',
    optionalCustomerAuth,
    paymentVerifyRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = RazorpayVerifyPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const {
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        orderAccessToken: bodyOrderToken,
      } = parsed.data;

      let secret: string;
      try {
        secret = getRazorpayKeySecret();
      } catch {
        res.status(503).json({
          error: 'PAYMENT_CONFIGURATION_ERROR',
          message: 'Razorpay payment verification is unavailable due to missing server secret configuration.',
        });
        return;
      }

      const order = await backend.findOrderByIdOrNumber(orderId);
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        return;
      }

      // Ownership validation: if order belongs to a registered customer, require matching session or valid orderAccessToken
      const tokenHeader = req.headers['x-order-access-token'];
      const orderAccessToken =
        bodyOrderToken || (typeof tokenHeader === 'string' ? tokenHeader : undefined);

      if (req.customerUser) {
        const ownsOrder =
          order.customerId === req.customerUser.id ||
          order.customerEmail.toLowerCase() === req.customerUser.email.toLowerCase();
        if (!ownsOrder) {
          res.status(403).json({
            error: 'ORDER_OWNERSHIP_MISMATCH',
            message: 'Authenticated customer does not own this order.',
          });
          return;
        }
      } else if (orderAccessToken) {
        if (!verifyOrderAccessToken(orderAccessToken, order.id, order.orderNumber, order.customerEmail)) {
          res.status(403).json({
            error: 'INVALID_ORDER_ACCESS_TOKEN',
            message: 'Provided order access token is invalid.',
          });
          return;
        }
      } else if (order.customerId && order.customerId !== 'cust-guest') {
        res.status(401).json({
          error: 'UNAUTHORIZED_PAYMENT_VERIFICATION',
          message: 'Customer authentication or valid order access token is required to verify this payment.',
        });
        return;
      }

      const isSignatureValid = verifyRazorpayCheckoutSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        secret,
      });

      if (!isSignatureValid) {
        res.status(401).json({
          error: 'INVALID_PAYMENT_SIGNATURE',
          message: 'Razorpay payment signature verification failed.',
        });
        return;
      }

      const expectedRzpOrderId = order.razorpayOrderId;
      if (!expectedRzpOrderId || razorpayOrderId !== expectedRzpOrderId) {
        res.status(400).json({
          error: 'ORDER_PAYMENT_MISMATCH',
          message: 'Provided razorpayOrderId does not match the checkout Razorpay order for this order.',
        });
        return;
      }

      const expectedAmountPaise = Math.round(Number(order.totalPriceInr) * 100);
      const payments = await backend.listPayments();
      const samePaymentRecord = payments.find((p) => p.providerPaymentId === razorpayPaymentId);

      if (samePaymentRecord && samePaymentRecord.orderId !== order.id) {
        res.status(409).json({
          error: 'PAYMENT_ALREADY_ASSOCIATED',
          message: 'This payment is already associated with another order.',
        });
        return;
      }

      if (order.financialStatus !== 'PENDING') {
        if (samePaymentRecord || order.razorpayPaymentId === razorpayPaymentId) {
          res.json({
            verified: true,
            idempotent: true,
            order,
            payment: samePaymentRecord || null,
          });
          return;
        }

        res.status(409).json({
          error: 'ORDER_ALREADY_PAID',
          message: 'Order has already been paid and captured under a different payment reference.',
        });
        return;
      }

      if (paymentOrdersInFlight.has(order.id)) {
        res.status(409).json({
          error: 'PAYMENT_VERIFICATION_IN_PROGRESS',
          message: 'Payment verification is already in progress for this order.',
        });
        return;
      }

      let providerPayment;
      let providerOrder;
      paymentOrdersInFlight.add(order.id);
      try {
        [providerPayment, providerOrder] = await Promise.all([
          fetchRazorpayPayment(razorpayPaymentId),
          fetchRazorpayOrder(razorpayOrderId),
        ]);
      } catch {
        res.status(503).json({
          error: 'PAYMENT_STATUS_UNAVAILABLE',
          message: 'Payment status could not be verified with Razorpay. The order remains pending.',
        });
        return;
      } finally {
        paymentOrdersInFlight.delete(order.id);
      }
      if (
        providerPayment.id !== razorpayPaymentId ||
        providerPayment.order_id !== expectedRzpOrderId ||
        providerPayment.amount !== expectedAmountPaise ||
        providerPayment.currency !== 'INR' ||
        providerOrder.id !== expectedRzpOrderId ||
        providerOrder.amount !== expectedAmountPaise ||
        providerOrder.currency !== 'INR'
      ) {
        res.status(400).json({
          error: 'PAYMENT_MISMATCH',
          message: 'Razorpay payment does not match this order amount, currency, or provider order.',
        });
        return;
      }
      if (providerPayment.status === 'authorized' && providerPayment.captured !== true) {
        await backend.recordPaymentAttemptStatus({
          orderId: order.id,
          providerPaymentId: razorpayPaymentId,
          providerOrderId: razorpayOrderId,
          amountInr: order.totalPriceInr,
          status: 'AUTHORIZED',
          method: providerPayment.method || 'unknown',
          actorEmail: req.customerUser?.email || order.customerEmail,
          actorRole: 'CUSTOMER',
        });
        res.status(409).json({
          error: 'PAYMENT_NOT_CAPTURED',
          message: 'Razorpay payment is authorized but not yet captured. The order remains pending.',
        });
        return;
      }
      if (providerPayment.status === 'failed') {
        await backend.recordPaymentAttemptStatus({
          orderId: order.id,
          providerPaymentId: razorpayPaymentId,
          providerOrderId: razorpayOrderId,
          amountInr: order.totalPriceInr,
          status: 'FAILED',
          method: providerPayment.method || 'unknown',
          failureReason: providerPayment.error_description || 'Payment failed at Razorpay',
          actorEmail: req.customerUser?.email || order.customerEmail,
          actorRole: 'CUSTOMER',
        });
        res.status(409).json({
          error: 'PAYMENT_FAILED',
          message: 'Razorpay reported this payment attempt as failed. The order remains pending.',
        });
        return;
      }
      if (
        providerPayment.status !== 'captured' ||
        providerPayment.captured !== true ||
        providerOrder.status !== 'paid'
      ) {
        res.status(409).json({
          error: 'PAYMENT_NOT_CAPTURED',
          message: 'Razorpay has not confirmed a captured payment and paid order. The order remains pending.',
        });
        return;
      }

      const captured = await backend.confirmPaymentCapture({
        orderId: order.id,
        providerPaymentId: razorpayPaymentId,
        providerOrderId: razorpayOrderId,
        providerSignature: razorpaySignature,
        amountInr: order.totalPriceInr,
        method: providerPayment.method || 'unknown',
        actorEmail: order.customerEmail,
        actorRole: 'CUSTOMER',
      });

      res.json({
        verified: true,
        idempotent: captured.idempotent,
        order: {
          id: captured.order.id,
          orderNumber: captured.order.orderNumber,
          financialStatus: captured.order.financialStatus,
        },
        payment: {
          providerPaymentId: captured.payment.providerPaymentId,
          amountInr: captured.payment.amountInr,
          currency: captured.payment.currency,
          status: captured.payment.status,
        },
      });
    })
  );

  // Initiate Refund
  const handleOrderRefund = asyncHandler(async (req: Request, res: Response) => {
    const parsed = RefundCreateSchema.safeParse({
      ...req.body,
      orderId: req.params.orderId || req.body.orderId,
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      return;
    }

    const { orderId, amountInr, reason, restockItems } = parsed.data;
    const order = await backend.findOrderByIdOrNumber(orderId);

    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      return;
    }

    const refundAmt = Number(amountInr);
    const orderTotal = Number(order.totalPriceInr);
    if (refundAmt > orderTotal) {
      res.status(400).json({
        error: 'REFUND_EXCEEDS_ORDER_TOTAL',
        message: `Refund amount (${refundAmt}) cannot exceed order total (${orderTotal}).`,
      });
      return;
    }

    let result;
    try {
      result = await backend.createRefund({
        orderId: order.id,
        amountInr: refundAmt,
        reason,
        initiatedByEmail: req.adminUser!.email,
        initiatedByRole: req.adminUser!.role,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('ORDER_NOT_REFUNDABLE:') || msg.startsWith('PAYMENT_NOT_FOUND:') || msg.startsWith('REFUND_EXCEEDS_BALANCE:')) {
        res.status(400).json({ error: msg.split(':')[0], message: msg });
        return;
      }
      throw err;
    }

    if (restockItems) {
      for (const li of order.lineItems) {
        await backend.adjustInventory({
          sku: li.sku,
          quantityDelta: li.quantity,
          reason: `Restocked from refund on order ${order.orderNumber}`,
          actorEmail: req.adminUser!.email,
          actorRole: req.adminUser!.role,
        });
      }
    }

    res.status(201).json({ refund: result.refund, order: result.order });
  });

  app.post(
    '/api/admin/orders/:orderId/refund',
    requireAuth,
    requirePermission('ORDERS_MANAGE'),
    handleOrderRefund
  );
  app.post(
    '/api/payments/refund',
    requireAuth,
    requirePermission('ORDERS_MANAGE'),
    handleOrderRefund
  );

  // Cancel Order & Restore Stock
  const handleAdminCancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = getParam(req.params.orderId);
    const order = await backend.findOrderByIdOrNumber(orderId);

    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      return;
    }

    try {
      const result = await backend.cancelOrderWithRestock(
        order.id,
        req.adminUser!.email,
        'Admin cancellation',
        req.adminUser!.role
      );
      res.json({ order: result.order, idempotent: result.idempotent });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('ORDER_NOT_CANCELLABLE:')) {
        res.status(409).json({
          error: 'ORDER_NOT_CANCELLABLE',
          message: 'Shipped, in-transit, and fulfilled orders cannot be cancelled through the ordinary cancellation path.',
        });
        return;
      }
      throw err;
    }
  });

  const handleCustomerCancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = getParam(req.params.orderId);
    const order = await backend.findOrderByIdOrNumber(orderId);

    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      return;
    }

    const customer = req.customerUser!;
    const ownsOrder = order.customerId === customer.id;

    if (!ownsOrder) {
      res.status(403).json({
        error: 'FORBIDDEN_NOT_ORDER_OWNER',
        message: 'You are not authorized to cancel an order belonging to another customer.',
      });
      return;
    }

    try {
      const result = await backend.cancelOrderWithRestock(
        order.id,
        customer.email,
        'Customer cancellation',
        'CUSTOMER'
      );
      res.json({ order: result.order, idempotent: result.idempotent });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('ORDER_NOT_CANCELLABLE:')) {
        res.status(409).json({
          error: 'ORDER_NOT_CANCELLABLE',
          message: 'Shipped, in-transit, and fulfilled orders cannot be cancelled through the ordinary cancellation path.',
        });
        return;
      }
      throw err;
    }
  });

  app.post(
    '/api/admin/orders/:orderId/cancel',
    requireAuth,
    requirePermission('ORDERS_MANAGE'),
    handleAdminCancelOrder
  );
  app.post(
    '/api/orders/:orderId/cancel',
    requireCustomerAuth,
    handleCustomerCancelOrder
  );

  // Printable GST Jewellery Tax Invoice (Protected: Admin with ORDERS_VIEW, Order-Owning Customer, or Signed Guest Order Token)
  app.get(
    '/api/orders/:orderId/invoice',
    asyncHandler(async (req: Request, res: Response) => {
      const orderId = getParam(req.params.orderId);
      const [order, settings] = await Promise.all([
        backend.findOrderByIdOrNumber(orderId),
        backend.getSettings(),
      ]);
      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        return;
      }

      const rawAuthHeader = req.headers.authorization;
      const sessionCookies = parseCookies(req.headers.cookie);
      let bearerToken =
        rawAuthHeader && typeof rawAuthHeader === 'string' && rawAuthHeader.startsWith('Bearer ')
          ? rawAuthHeader.slice('Bearer '.length).trim()
          : '';
      if (!bearerToken) {
        for (const candidate of [sessionCookies[ADMIN_SESSION_COOKIE], sessionCookies[CUSTOMER_SESSION_COOKIE]]) {
          if (
            candidate &&
            ((await verifyAdminTokenWithLookup(candidate, backend.authLookup)) ||
              (await verifyCustomerTokenWithLookup(candidate, backend.authLookup)))
          ) {
            bearerToken = candidate;
            break;
          }
        }
      }
      const orderTokenHeader =
        typeof req.headers['x-mrs-order-token'] === 'string'
          ? req.headers['x-mrs-order-token'].trim()
          : '';

      let authorized = false;

      if (bearerToken) {
        const adminUser = await verifyAdminTokenWithLookup(bearerToken, backend.authLookup);
        if (adminUser) {
          if (!adminUser.permissions.includes('ORDERS_VIEW')) {
            res.status(403).json({
              error: 'FORBIDDEN_INSUFFICIENT_ROLE',
              message: `Role '${adminUser.role}' does not have required permission 'ORDERS_VIEW'.`,
            });
            return;
          }
          authorized = true;
        } else {
          const customerUser = await verifyCustomerTokenWithLookup(bearerToken, backend.authLookup);
          if (customerUser) {
            const ownsOrder = order.customerId === customerUser.id;
            if (!ownsOrder) {
              res.status(403).json({
                error: 'FORBIDDEN_NOT_ORDER_OWNER',
                message: 'You are not authorized to access an invoice belonging to another customer.',
              });
              return;
            }
            authorized = true;
          }
        }
      }

      if (
        !authorized &&
        order.customerId === 'cust-guest' &&
        orderTokenHeader &&
        verifyOrderAccessToken(orderTokenHeader, order.id, order.orderNumber, order.customerEmail)
      ) {
        authorized = true;
      }

      if (!authorized) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid authentication or order access token is required to view this GST invoice.',
        });
        return;
      }

      res.json({
        invoiceNumber: `INV-MRS-${order.orderNumber.replace('MRS-', '')}`,
        issuedAt: order.placedAt,
        seller: {
          legalName: settings.legalEntityName,
          brandName: settings.storeName,
          gstin: '27AABCM1975R1Z6',
          hsnCode: '711319 (Articles of Fine Gold & Lab-Grown Diamond Jewellery)',
          registeredAddress: 'Mangal Royal Studio Vault, Zaveri Bazaar / Bandra West, Mumbai — 400050, Maharashtra',
        },
      buyer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        city: order.shippingCity,
        state: order.shippingState,
        pincode: order.shippingPincode,
      },
      order: {
        orderNumber: order.orderNumber,
        placedAt: order.placedAt,
        financialStatus: order.financialStatus,
        lineItems: order.lineItems.map(({ sku, title, quantity, purchaseTimePriceInr, metalPurity }) => ({
          sku,
          title,
          quantity,
          purchaseTimePriceInr,
          metalPurity,
        })),
      },
      taxSummary: {
        taxableValueInr: order.subtotalPriceInr,
        gstRatePercent: '3.00%',
        totalGstInr: order.totalTaxInr,
        grandTotalInr: order.totalPriceInr,
      },
    });
  }));

  // Shiprocket Pincode Serviceability Check
  app.get('/api/shipping/serviceability', (req: Request, res: Response) => {
    const pincode = String(req.query.pincode || '400050').trim();
    const isValidPin = /^\d{6}$/.test(pincode);
    if (!isValidPin) {
      res.status(400).json({
        error: 'INVALID_PINCODE',
        message: 'Please enter a valid 6-digit Indian PIN code.',
      });
      return;
    }

    res.json({
      pincode,
      serviceable: true,
      insuredDeliveryAvailable: true,
      estimatedDeliveryDays: pincode.startsWith('400') ? 2 : 4,
      couriers: [
        {
          courierName: 'BlueDart Insured Jewellery Air',
          rateInr: '0.00',
          isInsured: true,
          etdDays: pincode.startsWith('400') ? 2 : 4,
        },
        {
          courierName: 'Sequel Logistics Fine Jewellery Vault',
          rateInr: '0.00',
          isInsured: true,
          etdDays: 3,
        },
      ],
    });
  });

  // CSV Export for Admin Reports
  app.get(
    '/api/admin/reports/export.csv',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const type = String(req.query.type || 'orders').toLowerCase();
      if (type === 'products' || type === 'inventory') {
        if (!req.adminUser!.permissions.includes('PRODUCTS_VIEW')) {
          res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Products report exports require PRODUCTS_VIEW permission.',
          });
          return;
        }
      } else {
        if (!req.adminUser!.permissions.includes('ORDERS_VIEW')) {
          res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Order report exports require ORDERS_VIEW permission.',
          });
          return;
        }
        if (!req.adminUser!.permissions.includes('CUSTOMERS_PII_VIEW')) {
          res.status(403).json({
            error: 'CUSTOMERS_PII_PERMISSION_REQUIRED',
            message: 'Order report exports require permission to view sensitive customer information.',
          });
          return;
        }
      }
      let csv = '';

      if (type === 'products' || type === 'inventory') {
        const products = await backend.listProducts();
        csv = [
          'SKU,Title,Category,Metal Purity,Gross Weight (g),Net Weight (g),Price (INR),Stock Qty',
          ...products.map((p) =>
            [
              escapeCsvValue(p.sku),
              escapeCsvValue(p.title),
              escapeCsvValue(p.category),
              escapeCsvValue(p.metalPurity),
              escapeCsvValue(p.grossWeightGrams),
              escapeCsvValue(p.netMetalWeightGrams),
              escapeCsvValue(p.currentShopifyPriceInr),
              escapeCsvValue(p.inventoryQuantity),
            ].join(',')
          ),
        ].join('\n');
      } else {
        const orders = await backend.listOrders();
        csv = [
          'Order Number,Customer,Email,City,Subtotal (INR),GST (INR),Total (INR),Financial Status,Fulfillment Status,Placed At',
          ...orders.map((o) =>
            [
              escapeCsvValue(o.orderNumber),
              escapeCsvValue(o.customerName),
              escapeCsvValue(o.customerEmail),
              escapeCsvValue(o.shippingCity),
              escapeCsvValue(o.subtotalPriceInr),
              escapeCsvValue(o.totalTaxInr),
              escapeCsvValue(o.totalPriceInr),
              escapeCsvValue(o.financialStatus),
              escapeCsvValue(o.fulfillmentStatus),
              escapeCsvValue(o.placedAt),
            ].join(',')
          ),
        ].join('\n');
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="mrs-${type}-report.csv"`);
      res.send(csv);
    })
  );

  // OpenAPI 3.1 Specification Endpoint
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Mangal Royal Studio — Complete E-Commerce & Jewellery Pricing API',
        version: '1.0.0',
        description:
          'REST API for Mangal Royal Studio Storefront, Custom Admin Dashboard, Decimal.js Jewellery Pricing Engine, 11-Sheet Excel Importer, Razorpay Payments, and Shiprocket Logistics.',
      },
      servers: [{ url: '/api/v1', description: 'Version 1 API Gateway' }],
      paths: {
        '/health': { get: { summary: 'System & architecture health check' } },
        '/auth/login': { post: { summary: 'Admin RBAC login' } },
        '/auth/register': { post: { summary: 'Customer storefront registration' } },
        '/auth/customer/login': { post: { summary: 'Customer storefront login' } },
        '/products': {
          get: { summary: 'List & filter jewellery catalog with live price breakup' },
          post: { summary: 'Create new jewellery product' },
        },
        '/products/{handleOrSku}': {
          get: { summary: 'Get product detail, live Decimal.js price breakup & related items' },
          delete: { summary: 'Delete product with active-order safeguard' },
        },
        '/collections': { get: { summary: 'List collections & categories' } },
        '/collections/{handle}': { get: { summary: 'Get collection detail & products' } },
        '/inventory/adjust': { post: { summary: 'Adjust product stock & log movement' } },
        '/cart/{cartId}': { get: { summary: 'Get cart with GST & discount calculation' } },
        '/cart/{cartId}/items': { post: { summary: 'Add item to cart with stock check' } },
        '/checkout/create-order': {
          post: { summary: 'Create order, lock immutable pricing snapshot & deduct stock' },
        },
        '/payments/razorpay/verify': {
          post: { summary: 'Verify Razorpay HMAC-SHA256 signature & capture payment' },
        },
        '/payments/refund': { post: { summary: 'Initiate partial/full refund & optional restock' } },
        '/shipping/serviceability': { get: { summary: 'Check insured courier serviceability' } },
        '/admin/pricing/preview': { post: { summary: 'Preview repricing run across catalog' } },
        '/admin/pricing/runs/{runId}/validate': { post: { summary: 'Validate repricing run' } },
        '/admin/pricing/runs/{runId}/approve': { post: { summary: 'Owner-only approval of pricing run' } },
        '/admin/pricing/runs/{runId}/publish': { post: { summary: 'Publish approved run & store snapshots' } },
        '/admin/imports/excel': { post: { summary: 'Dry-run or commit 11-sheet 296-record Excel workbook' } },
        '/admin/imports/{jobId}/rollback': { post: { summary: 'Rollback committed import job' } },
      },
    });
  });
  //Roles & Permissions Endpoints
  app.get(
    '/api/roles',
    requireAuth,
    requirePermission('AUDIT_VIEW'),
    (_req: Request, res: Response) => {
    res.json({
      roles: Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => ({
        name,
        permissions,
      })),
    });
  });

  // ---------------------------------------------------------------------------
  // PHASE 2: JEWELLERY CUSTOMIZER, QUOTE ENGINE, 3D MODEL ASSETS & SAVED DESIGNS
  // ---------------------------------------------------------------------------

  // Public: Customization config + 3D model asset for a product
  app.get(
    '/api/public/products/:handleOrSku/customization',
    asyncHandler(async (req: Request, res: Response) => {
      const handleOrSku = getParam(req.params.handleOrSku);
      const product = await backend.findProductByHandleOrSku(handleOrSku);
      if (!isPublicProduct(product)) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }

      const [profiles, assignment, modelAsset] = await Promise.all([
        backend.listCustomizationProfiles(),
        backend.findCustomizationAssignmentByProductId(product.id),
        backend.findModelAssetByProductId(product.id),
      ]);

      const resolved = resolveEligibleCustomizationProfile({
        product,
        assignment,
        profiles,
      });

      const activeModelAsset =
        modelAsset && modelAsset.status === 'ACTIVE' ? modelAsset : null;

      res.json({
        productId: product.id,
        sku: product.sku,
        handle: product.handle,
        eligible: resolved.eligible,
        assignment: resolved.assignment,
        profile: resolved.profile,
        modelAsset: activeModelAsset,
      });
    })
  );

  // Public: Authoritative server-side customization price quote
  app.post(
    '/api/public/customization/quote',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CustomizationQuoteInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const product = await backend.findProductByHandleOrSku(parsed.data.productHandleOrSku);
      if (!isPublicProduct(product)) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }

      const [profiles, assignment, metalRates, diamondRates, activeRule] = await Promise.all([
        backend.listCustomizationProfiles(),
        backend.findCustomizationAssignmentByProductId(product.id),
        backend.getActiveMetalRates(),
        backend.getActiveDiamondRates(),
        backend.getActivePricingRule(),
      ]);

      const resolved = resolveEligibleCustomizationProfile({
        product,
        assignment,
        profiles,
      });
      if (!resolved.eligible || !resolved.profile) {
        res.status(400).json({
          error: 'PRODUCT_NOT_CUSTOMIZABLE',
          message: `Product "${product.sku}" is not configured for customization.`,
        });
        return;
      }

      try {
        const quote = calculateCustomizationQuote({
          product,
          profile: resolved.profile,
          assignment: resolved.assignment,
          selections: parsed.data.selections,
          quantity: parsed.data.quantity,
          metalRates,
          diamondRates,
          rule: activeRule,
        });
        res.json({ quote });
      } catch (err) {
        if (err instanceof CustomizationQuoteError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }
    })
  );

  // Public: Serve locally managed 3D model asset safely
  app.get(
    '/api/public/model-assets/:storageKey',
    asyncHandler(async (req: Request, res: Response) => {
      const storageKey = getParam(req.params.storageKey);
      if (!storageKey || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
        res.status(400).json({ error: 'INVALID_STORAGE_KEY' });
        return;
      }
      const buf = await defaultModelStorage.readModel(storageKey);
      if (!buf) {
        res.status(404).json({ error: 'MODEL_ASSET_NOT_FOUND' });
        return;
      }
      const isGltf = storageKey.toLowerCase().endsWith('.gltf');
      res.setHeader('Content-Type', isGltf ? 'model/gltf+json' : 'model/gltf-binary');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    })
  );

  // Customer: Saved Designs CRUD + Duplicate + Add-to-Cart (Strict IDOR Ownership)
  app.get(
    '/api/customer/designs',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designs = await backend.listCustomerDesigns(req.customerUser!.id);
      res.json({ designs });
    })
  );

  app.post(
    '/api/customer/designs',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreateCustomerDesignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const product = await backend.findProductByHandleOrSku(parsed.data.productHandleOrSku);
      if (!isPublicProduct(product)) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }

      let customResult: Awaited<ReturnType<typeof resolveCustomizedItemPricing>> = null;
      try {
        customResult = await resolveCustomizedItemPricing({
          product,
          selections: parsed.data.selections,
        });
      } catch (err) {
        if (err instanceof CustomizationQuoteError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      if (!customResult) {
        res.status(400).json({ error: 'SELECTIONS_REQUIRED', message: 'Customization selections are required.' });
        return;
      }

      const design = await backend.createCustomerDesign({
        customerId: req.customerUser!.id,
        productMetadataId: product.id,
        productSku: product.sku,
        productHandle: product.handle,
        productTitle: product.title,
        profileId: customResult.quote.profileId,
        name: parsed.data.name || `${product.title} Custom Design`,
        selections: customResult.selections,
        selectionSnapshot: customResult.quote.selectionSnapshot,
        lastQuotedPriceInr: customResult.quote.unitPriceInr,
        lastPriceBreakdown: customResult.quote.breakdownLines,
        pricingRuleVersion: customResult.quote.pricingRuleVersion,
      });

      res.status(201).json({ design });
    })
  );

  app.get(
    '/api/customer/designs/:designId',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designId = getParam(req.params.designId);
      const design = await backend.findCustomerDesignById(designId);
      if (!design) {
        res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
        return;
      }
      if (design.customerId !== req.customerUser!.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this saved design.' });
        return;
      }
      res.json({ design });
    })
  );

  app.patch(
    '/api/customer/designs/:designId',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designId = getParam(req.params.designId);
      const parsed = UpdateCustomerDesignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }

      const existing = await backend.findCustomerDesignById(designId);
      if (!existing) {
        res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
        return;
      }
      if (existing.customerId !== req.customerUser!.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this saved design.' });
        return;
      }

      const updates: Parameters<RuntimeBackend['updateCustomerDesign']>[2] = {
        name: parsed.data.name,
      };

      if (parsed.data.selections) {
        const product = await backend.findProductByHandleOrSku(existing.productSku);
        if (!product) {
          res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
          return;
        }
        try {
          const customResult = await resolveCustomizedItemPricing({
            product,
            selections: parsed.data.selections,
          });
          if (customResult) {
            updates.selections = customResult.selections;
            updates.selectionSnapshot = customResult.quote.selectionSnapshot;
            updates.lastPriceBreakdown = customResult.quote.breakdownLines;
            updates.lastQuotedPriceInr = customResult.quote.unitPriceInr;
            updates.pricingRuleVersion = customResult.quote.pricingRuleVersion;
          }
        } catch (err) {
          if (err instanceof CustomizationQuoteError) {
            res.status(err.statusCode).json({ error: err.code, message: err.message });
            return;
          }
          throw err;
        }
      }

      const updated = await backend.updateCustomerDesign(designId, req.customerUser!.id, updates);
      res.json({ design: updated });
    })
  );

  app.delete(
    '/api/customer/designs/:designId',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designId = getParam(req.params.designId);
      const existing = await backend.findCustomerDesignById(designId);
      if (!existing) {
        res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
        return;
      }
      if (existing.customerId !== req.customerUser!.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this saved design.' });
        return;
      }
      await backend.deleteCustomerDesign(designId, req.customerUser!.id);
      res.json({ deleted: true, designId });
    })
  );

  app.post(
    '/api/customer/designs/:designId/duplicate',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designId = getParam(req.params.designId);
      const existing = await backend.findCustomerDesignById(designId);
      if (!existing) {
        res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
        return;
      }
      if (existing.customerId !== req.customerUser!.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this saved design.' });
        return;
      }
      const product = await backend.findProductByHandleOrSku(existing.productSku);
      if (!product) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }

      let customResult: Awaited<ReturnType<typeof resolveCustomizedItemPricing>> = null;
      try {
        customResult = await resolveCustomizedItemPricing({
          product,
          selections: existing.selections,
        });
      } catch (err) {
        if (err instanceof CustomizationQuoteError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      const duplicated = await backend.createCustomerDesign({
        customerId: req.customerUser!.id,
        productMetadataId: product.id,
        productSku: product.sku,
        productHandle: product.handle,
        productTitle: product.title,
        profileId: customResult?.quote.profileId ?? existing.profileId,
        name: `${existing.name} (Copy)`.slice(0, 80),
        selections: customResult?.selections ?? existing.selections,
        selectionSnapshot: customResult?.quote.selectionSnapshot ?? existing.selectionSnapshot,
        lastQuotedPriceInr: customResult?.quote.unitPriceInr ?? existing.lastQuotedPriceInr,
        lastPriceBreakdown: customResult?.quote.breakdownLines ?? existing.lastPriceBreakdown,
        pricingRuleVersion: customResult?.quote.pricingRuleVersion ?? existing.pricingRuleVersion,
      });
      res.status(201).json({ design: duplicated });
    })
  );

  app.post(
    '/api/customer/designs/:designId/add-to-cart',
    requireCustomerAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const designId = getParam(req.params.designId);
      const cartId = String(req.body?.cartId || '').trim();
      const quantity = Number(req.body?.quantity ?? 1);
      if (!cartId) {
        res.status(400).json({ error: 'CART_ID_REQUIRED' });
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        res.status(400).json({ error: 'INVALID_QUANTITY' });
        return;
      }

      const design = await backend.findCustomerDesignById(designId);
      if (!design) {
        res.status(404).json({ error: 'DESIGN_NOT_FOUND' });
        return;
      }
      if (design.customerId !== req.customerUser!.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this saved design.' });
        return;
      }

      const product = await backend.findProductByHandleOrSku(design.productSku);
      if (!isPublicProduct(product)) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      if (product.inventoryQuantity < quantity) {
        res.status(400).json({
          error: 'INSUFFICIENT_STOCK',
          message: `Only ${product.inventoryQuantity} unit(s) of "${product.title}" available in vault.`,
        });
        return;
      }

      let customResult: Awaited<ReturnType<typeof resolveCustomizedItemPricing>> = null;
      try {
        customResult = await resolveCustomizedItemPricing({
          product,
          selections: design.selections,
          customerDesignId: design.id,
          authenticatedCustomerId: req.customerUser!.id,
        });
      } catch (err) {
        if (err instanceof CustomizationQuoteError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }

      if (!customResult) {
        res.status(400).json({ error: 'CUSTOMIZATION_UNAVAILABLE' });
        return;
      }

      const cart = await recalculateCart(cartId, false);
      const unitPrice = Number(customResult.quote.unitPriceInr);
      cart.items.push({
        id: crypto.randomUUID(),
        sku: product.sku,
        handle: product.handle,
        title: product.title,
        imageUrl: product.imageUrl || '',
        quantity,
        unitPriceInr: unitPrice.toFixed(2),
        lineTotalInr: (quantity * unitPrice).toFixed(2),
        metalPurity:
          customResult.quote.selectionSnapshot.find((s) => s.groupCode === 'metal_purity_color')?.label ||
          product.metalPurity,
        metalColor: customResult.quote.resolvedMetalColor || product.metalColor,
        ringSize:
          customResult.quote.selectionSnapshot.find((s) => s.groupCode === 'ring_size')?.value ||
          product.ringSize ||
          '12',
        customizationSelections: customResult.selections,
        customizationSnapshot: customResult.quote.selectionSnapshot,
        pricingBreakdown: customResult.quote.breakdownLines,
        customerDesignId: design.id,
      });

      await backend.saveCart(cart);
      const updatedCart = await recalculateCart(cartId, true);
      res.json({ cart: updatedCart, design });
    })
  );

  // Admin: Customization Profiles, Groups, Options & Product Assignments
  app.get(
    '/api/admin/customization/profiles',
    requireAuth,
    requirePermission('CUSTOMIZATION_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const [profiles, assignments] = await Promise.all([
        backend.listCustomizationProfiles(),
        backend.listCustomizationAssignments(),
      ]);
      res.json({ profiles, assignments });
    })
  );

  app.post(
    '/api/admin/customization/profiles',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = CreateCustomizationProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.createCustomizationProfile({
        ...parsed.data,
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });
      res.status(201).json({ profile });
    })
  );

  app.patch(
    '/api/admin/customization/profiles/:profileId',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const profileId = getParam(req.params.profileId);
      const parsed = CreateCustomizationProfileSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.updateCustomizationProfile(
        profileId,
        parsed.data,
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.json({ profile });
    })
  );

  app.post(
    '/api/admin/customization/profiles/:profileId/groups',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const profileId = getParam(req.params.profileId);
      const parsed = CreateCustomizationGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.addCustomizationGroup(
        profileId,
        parsed.data,
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.status(201).json({ profile });
    })
  );

  app.patch(
    '/api/admin/customization/groups/:groupId',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const groupId = getParam(req.params.groupId);
      const parsed = CreateCustomizationGroupSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.updateCustomizationGroup(
        groupId,
        parsed.data,
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.json({ profile });
    })
  );

  app.post(
    '/api/admin/customization/groups/:groupId/options',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const groupId = getParam(req.params.groupId);
      const parsed = CreateCustomizationOptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.addCustomizationOption(
        groupId,
        {
          ...parsed.data,
          priceRuleValue: String(parsed.data.priceRuleValue ?? '0'),
          diamondCaratWeight:
            parsed.data.diamondCaratWeight !== undefined
              ? String(parsed.data.diamondCaratWeight)
              : undefined,
        },
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.status(201).json({ profile });
    })
  );

  app.patch(
    '/api/admin/customization/options/:optionId',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const optionId = getParam(req.params.optionId);
      const parsed = CreateCustomizationOptionSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const profile = await backend.updateCustomizationOption(
        optionId,
        {
          ...parsed.data,
          priceRuleValue:
            parsed.data.priceRuleValue !== undefined
              ? String(parsed.data.priceRuleValue)
              : undefined,
        },
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.json({ profile });
    })
  );

  app.put(
    '/api/admin/customization/products/:sku/assignment',
    requireAuth,
    requirePermission('CUSTOMIZATION_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const sku = getParam(req.params.sku);
      const parsed = AssignProductCustomizationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const product = await backend.findProductByHandleOrSku(sku);
      if (!product) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      const assignment = await backend.upsertCustomizationAssignment({
        productMetadataId: product.id,
        productSku: product.sku,
        profileId: parsed.data.profileId,
        isCustomizable: parsed.data.isCustomizable,
        allowDiamondSelection: parsed.data.allowDiamondSelection,
        allowEngraving: parsed.data.allowEngraving,
        maxEngravingChars: parsed.data.maxEngravingChars,
        disabledOptionCodes: parsed.data.disabledOptionCodes,
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });
      res.json({ assignment });
    })
  );

  // Admin: 3D Model Asset Management (.glb/.gltf upload + external URL + delete)
  app.get(
    '/api/admin/model-assets',
    requireAuth,
    requirePermission('CUSTOMIZATION_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const modelAssets = await backend.listModelAssets();
      res.json({ modelAssets });
    })
  );

  app.post(
    '/api/admin/model-assets/:sku/upload',
    requireAuth,
    requirePermission('MODEL_ASSETS_MANAGE'),
    modelUpload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      const sku = getParam(req.params.sku);
      const product = await backend.findProductByHandleOrSku(sku);
      if (!product) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'FILE_REQUIRED', message: 'A .glb or .gltf file is required.' });
        return;
      }

      let validated: ReturnType<typeof validateModelBuffer>;
      try {
        validated = validateModelBuffer({
          fileName: req.file.originalname || 'model.glb',
          buffer: req.file.buffer,
        });
      } catch (err) {
        res.status(400).json({
          error: 'INVALID_MODEL_FILE',
          message: err instanceof Error ? err.message : 'Invalid 3D model file.',
        });
        return;
      }

      const stored = await defaultModelStorage.saveModel({
        originalFileName: req.file.originalname || `${product.sku}${validated.ext}`,
        buffer: req.file.buffer,
      });

      const result = await backend.upsertModelAsset({
        productMetadataId: product.id,
        productSku: product.sku,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        storageProvider: 'LOCAL_MANAGED',
        storageKey: stored.storageKey,
        assetUrl: `/api/public/model-assets/${stored.storageKey}`,
        previewImageUrl: req.body?.posterImageUrl ? String(req.body.posterImageUrl) : product.imageUrl,
        status: 'ACTIVE',
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });

      res.status(201).json({ modelAsset: result.asset });
    })
  );

  app.put(
    '/api/admin/model-assets/:sku/external',
    requireAuth,
    requirePermission('MODEL_ASSETS_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const sku = getParam(req.params.sku);
      const parsed = AssociateModelAssetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
        return;
      }
      const product = await backend.findProductByHandleOrSku(sku);
      if (!product) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      const result = await backend.upsertModelAsset({
        productMetadataId: product.id,
        productSku: product.sku,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        fileSizeBytes: 0,
        storageProvider: 'EXTERNAL_URL',
        storageKey: `external-${product.sku.toLowerCase()}`,
        assetUrl: parsed.data.assetUrl,
        previewImageUrl: parsed.data.previewImageUrl || product.imageUrl,
        status: parsed.data.status ?? 'ACTIVE',
        actorEmail: req.adminUser!.email,
        actorRole: req.adminUser!.role,
      });
      res.json({ modelAsset: result.asset });
    })
  );

  app.delete(
    '/api/admin/model-assets/:sku',
    requireAuth,
    requirePermission('MODEL_ASSETS_MANAGE'),
    asyncHandler(async (req: Request, res: Response) => {
      const sku = getParam(req.params.sku);
      const product = await backend.findProductByHandleOrSku(sku);
      if (!product) {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
        return;
      }
      const existing = await backend.findModelAssetByProductId(product.id);
      if (existing && existing.storageProvider === 'LOCAL_MANAGED') {
        await defaultModelStorage.deleteModel(existing.storageKey);
      }
      const deleted = await backend.deleteModelAsset(
        product.id,
        req.adminUser!.email,
        req.adminUser!.role
      );
      res.json({ deleted, sku: product.sku });
    })
  );

  // Admin: Customer Saved Designs Inspection
  app.get(
    '/api/admin/designs',
    requireAuth,
    requirePermission('DESIGNS_VIEW'),
    asyncHandler(async (_req: Request, res: Response) => {
      const designs = await backend.listAllDesignsForAdmin();
      res.json({ designs });
    })
  );

  // Centralized error handler (fail closed on database/persistence failures, never fall back)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err?.message || 'An unexpected server error occurred.';
    if (
      msg.includes('PERSISTENCE_UNAVAILABLE') ||
      msg.includes('STATE_PERSIST_FAILED') ||
      msg.includes('AUDIT_PERSIST_FAILED')
    ) {
      res.status(503).json({
        error: 'PERSISTENCE_UNAVAILABLE',
        message: 'Unable to save this change. Please retry.',
      });
      return;
    }
    if (
      msg.includes("Can't reach database") ||
      err.name === 'PrismaClientInitializationError'
    ) {
      res.status(503).json({
        error: 'DATABASE_UNAVAILABLE',
        message: 'Database backend is temporarily unavailable. Please retry.',
      });
      return;
    }
    // Client errors raised by Express/body-parser (malformed URL encoding, bad JSON, payload too large):
    // keep their 4xx status and only the framework's client-safe message.
    const httpErr = err as Error & { status?: number; statusCode?: number; expose?: boolean; type?: string };
    const clientStatus = httpErr.status ?? httpErr.statusCode;
    if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
      res.status(clientStatus).json({
        error: 'BAD_REQUEST',
        message: httpErr.expose ? msg : 'The request could not be processed.',
      });
      return;
    }
    // Never echo internal error text (DB/driver/stack details) to clients; log it server-side instead.
    console.error('[Mangal Royal Studio API] Unhandled error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    });
  });

  return app;
}
