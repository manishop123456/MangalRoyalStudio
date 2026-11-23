'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  buildOwnerMarketRateCard,
  calculateJewelleryPrice,
  resolveProductImageUrl,
  ROLE_PERMISSIONS,
  type AdminRoleName,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MakingChargeMode,
  type MetalPurity,
  type MetalRateRecord,
  type OwnerMarketRateCard,
  type PricingFormulaRule,
} from '@mrs/shared';
import AdminPhase2Modules from '../components/AdminPhase2Modules';
import { getPermittedModules, resolveVisibleModule } from '../lib/admin-navigation';

const API_BASE = (
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

export type AdminModuleKey =
  | 'overview'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'pricing-engine'
  | 'gold-rates'
  | 'diamond-rates'
  | 'excel-import'
  | 'discounts'
  | 'banners'
  | 'content'
  | 'shipping'
  | 'payments'
  | 'analytics'
  | 'users-roles'
  | 'settings'
  | 'audit-logs'
  | 'customization'
  | 'model-assets'
  | 'customer-designs';

interface ModuleNavItem {
  id: AdminModuleKey;
  number: number;
  label: string;
  group: 'Overview & Catalog' | 'Jewellery Pricing & Import' | 'Commerce & Logistics' | 'Governance & System';
  permission: string;
  badge?: string;
}

const ADMIN_MODULES: ModuleNavItem[] = [
  { id: 'overview', number: 1, label: 'Overview Dashboard', group: 'Overview & Catalog', permission: 'PRODUCTS_VIEW' },
  { id: 'products', number: 2, label: 'Product & Jewellery Specs', group: 'Overview & Catalog', permission: 'PRODUCTS_VIEW', badge: 'SKU' },
  { id: 'categories', number: 3, label: 'Category Management', group: 'Overview & Catalog', permission: 'PRODUCTS_VIEW', badge: '11' },
  { id: 'inventory', number: 4, label: 'Inventory Management', group: 'Overview & Catalog', permission: 'PRODUCTS_VIEW' },
  { id: 'pricing-engine', number: 7, label: 'Jewellery Pricing Engine', group: 'Jewellery Pricing & Import', permission: 'PRICING_PREVIEW', badge: 'Core' },
  { id: 'gold-rates', number: 8, label: 'Gold & Metal Rates', group: 'Jewellery Pricing & Import', permission: 'RATES_VIEW', badge: 'INR/g' },
  { id: 'diamond-rates', number: 9, label: 'Diamond Rate Matrix', group: 'Jewellery Pricing & Import', permission: 'RATES_VIEW', badge: 'INR/ct' },
  { id: 'excel-import', number: 10, label: 'Bulk Excel/CSV Import', group: 'Jewellery Pricing & Import', permission: 'IMPORTS_RUN', badge: '11 Sheets' },
  { id: 'orders', number: 5, label: 'Order Management', group: 'Commerce & Logistics', permission: 'ORDERS_VIEW' },
  { id: 'customers', number: 6, label: 'Customer Management', group: 'Commerce & Logistics', permission: 'ORDERS_VIEW' },
  { id: 'shipping', number: 14, label: 'Shipping (Shiprocket)', group: 'Commerce & Logistics', permission: 'SHIPMENTS_MANAGE', badge: 'AWB' },
  { id: 'payments', number: 15, label: 'Payment (Razorpay)', group: 'Commerce & Logistics', permission: 'PAYMENTS_VIEW' },
  { id: 'discounts', number: 11, label: 'Discount Management', group: 'Commerce & Logistics', permission: 'DISCOUNTS_MANAGE' },
  { id: 'banners', number: 12, label: 'Banner Management', group: 'Commerce & Logistics', permission: 'CONTENT_MANAGE' },
  { id: 'content', number: 13, label: 'Content & Policies', group: 'Commerce & Logistics', permission: 'CONTENT_MANAGE' },
  { id: 'analytics', number: 16, label: 'Reports & Analytics', group: 'Governance & System', permission: 'PRODUCTS_VIEW' },
  { id: 'users-roles', number: 17, label: 'Admin Users & RBAC', group: 'Governance & System', permission: 'USERS_MANAGE', badge: 'RBAC' },
  { id: 'settings', number: 18, label: 'Store & API Settings', group: 'Governance & System', permission: 'SETTINGS_MANAGE' },
  { id: 'audit-logs', number: 19, label: 'Activity & Audit Logs', group: 'Governance & System', permission: 'AUDIT_VIEW' },
  { id: 'customization', number: 20, label: 'Customization Profiles', group: 'Jewellery Pricing & Import', permission: 'CUSTOMIZATION_VIEW', badge: 'Phase 2' },
  { id: 'model-assets', number: 21, label: '3D Model Assets (.glb)', group: 'Overview & Catalog', permission: 'CUSTOMIZATION_VIEW', badge: '3D' },
  { id: 'customer-designs', number: 22, label: 'Customer Saved Designs', group: 'Commerce & Logistics', permission: 'DESIGNS_VIEW', badge: 'Bespoke' },
];

interface AuthenticatedAdminUser {
  id: string;
  email: string;
  displayName?: string;
  role: AdminRoleName;
  permissions: string[];
}

// Legacy key from the previous sessionStorage JWT implementation. It is only ever removed now:
// the admin session lives in an HttpOnly cookie that page scripts cannot read.
const LEGACY_ADMIN_TOKEN_STORAGE_KEY = 'mrs_admin_token';

// Session-bound CSRF token returned by the API at login / session check. Kept in memory only.
let adminCsrfToken: string | null = null;

function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (adminCsrfToken) headers.set('x-csrf-token', adminCsrfToken);
  return fetch(input, { ...init, headers, credentials: 'include' });
}

const ROLE_DISPLAY_DESCRIPTIONS: Record<AdminRoleName, string> = {
  OWNER: 'Owner — Full Governance, Pricing Approval & Shopify Publish',
  MANAGER: 'Store Operations Manager — Catalog, Orders, Imports & Validation',
  PRICING_OPERATOR: 'Bullion & Diamond Pricing Operator — Rate Cards & Preview Runs',
};

function formatInr(val: string | number | null | undefined): string {
  const num = Number(val || 0);
  if (Number.isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 14,
        paddingTop: 10,
        borderTop: '1px solid var(--mrs-border)',
        fontSize: 12.5,
      }}
    >
      <div style={{ color: 'var(--mrs-muted)' }}>
        Showing {startItem}–{endItem} of {total} records
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="mrs-btn mrs-btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </button>
        <span style={{ fontWeight: 600 }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="mrs-btn mrs-btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </button>
        <select
          className="mrs-select"
          style={{ padding: '4px 8px', fontSize: 12, marginLeft: 8 }}
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </div>
  );
}

export default function MangalRoyalAdminPage() {
  const [activeModule, setActiveModule] = useState<AdminModuleKey>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<AdminRoleName>('OWNER');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthenticatedAdminUser | null>(null);
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);

  // Executive Dashboard range & financial metrics
  const [overviewRange, setOverviewRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [overviewData, setOverviewData] = useState<any>(null);

  // Pagination states
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);

  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);

  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);

  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogPageSize, setAuditLogPageSize] = useState(15);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  const [metalRates, setMetalRates] = useState<MetalRateRecord[]>([]);
  const [diamondRates, setDiamondRates] = useState<DiamondRateMatrixEntry[]>([]);
  const [pricingRule, setPricingRule] = useState<PricingFormulaRule | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [pricingRuns, setPricingRuns] = useState<any[]>([]);
  const [pricingSnapshots, setPricingSnapshots] = useState<any[]>([]);
  const [importJobs, setImportJobs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    storeName: 'Mangal Royal Studio',
    shopifyDomain: 'mangal-royal-studio.myshopify.com',
    shopifyApiVersion: '2025-01',
    shopifyLiveWritesEnabled: false,
    currency: 'INR',
    defaultGstPercent: '3.00',
  });

  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [galleryPreviewProduct, setGalleryPreviewProduct] = useState<any | null>(null);
  const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(0);
  const [galleryImageFailed, setGalleryImageFailed] = useState(false);
  const [selectedSkuForBreakup, setSelectedSkuForBreakup] = useState<string>('MRS-RNG-1001');

  // Metal Rate update form
  const [editPurity, setEditPurity] = useState<MetalPurity>('18K');
  const [editMetalRateInr, setEditMetalRateInr] = useState<string>('5820.00');
  const [editMetalSource, setEditMetalSource] = useState<string>('IBJA Morning Bullion Fix');
  const [editMetalIsPlaceholder, setEditMetalIsPlaceholder] = useState<boolean>(true);

  // Diamond Rate update form
  const [editDiamondShape, setEditDiamondShape] = useState<string>('ROUND');
  const [editDiamondColor, setEditDiamondColor] = useState<string>('EF');
  const [editDiamondClarity, setEditDiamondClarity] = useState<string>('VVS');
  const [editDiamondSieve, setEditDiamondSieve] = useState<string>('Solitaire (0.50 - 5.00 ct)');
  const [editDiamondRateInr, setEditDiamondRateInr] = useState<string>('25500.00');

  // Interactive Jewellery Price Simulator state
  const [simPurity, setSimPurity] = useState<MetalPurity>('18K');
  const [simGrossGrams, setSimGrossGrams] = useState<string>('');
  const [simNetGrams, setSimNetGrams] = useState<string>('');
  const [simMakingMode, setSimMakingMode] = useState<MakingChargeMode>('PER_GRAM_NET');
  const [simMakingValue, setSimMakingValue] = useState<string>('');
  const [simWastagePct, setSimWastagePct] = useState<string>('');
  const [simCertFee, setSimCertFee] = useState<string>('');
  const [simPrimaryCarat, setSimPrimaryCarat] = useState<string>('');
  const [simSecondaryCarat, setSimSecondaryCarat] = useState<string>('');

  // Unified Owner-updated market rates card form state
  const [market14k, setMarket14k] = useState<string>('10200.00');
  const [market18k, setMarket18k] = useState<string>('12300.00');
  const [market22k, setMarket22k] = useState<string>('11510.00');
  const [marketPlat950, setMarketPlat950] = useState<string>('3911.00');
  const [marketMaking, setMarketMaking] = useState<string>('2500.00');
  const [marketDiamondUnder1ct, setMarketDiamondUnder1ct] = useState<string>('30000.00');
  const [marketDiamondOver1ct, setMarketDiamondOver1ct] = useState<string>('45000.00');
  const [marketConfirmPublish, setMarketConfirmPublish] = useState<boolean>(false);

  const liveOwnerRateCard = useMemo<OwnerMarketRateCard>(
    () =>
      buildOwnerMarketRateCard({
        metalRates,
        diamondRates,
        rule: pricingRule,
      }),
    [metalRates, diamondRates, pricingRule]
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }

  function clearAdminSession() {
    adminCsrfToken = null;
    setAuthToken(null);
    setAuthUser(null);
    setApiConnected(false);
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const loginRes = await adminFetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await loginRes.json();
      if (!loginRes.ok || !data.csrfToken || !data.user) {
        setLoginError(data.message || 'Invalid email or password.');
        return;
      }

      const verifiedUser: AuthenticatedAdminUser = data.user;
      adminCsrfToken = data.csrfToken;
      setAuthToken(data.csrfToken);
      setAuthUser(verifiedUser);
      setActiveRole(verifiedUser.role);
      setLoginPassword('');
      await syncWithBackend(data.csrfToken, verifiedUser);
      showToast(`Signed in as ${verifiedUser.displayName || verifiedUser.email} (${verifiedUser.role}).`);
    } catch {
      setLoginError('Unable to reach the Mangal Royal Studio API (:4000). Ensure the API server is running.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleAdminLogout() {
    void adminFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' }).catch(() => undefined);
    clearAdminSession();
    showToast('Signed out of Mangal Royal Studio Admin.');
  }

  async function syncWithBackend(
    tokenOverride?: string | null,
    userOverride?: AuthenticatedAdminUser | null
  ) {
    // The argument is only a "session present" marker; credentials travel in the HttpOnly cookie.
    const sessionMarker = tokenOverride ?? authToken;
    if (!sessionMarker) {
      setApiConnected(false);
      return;
    }

    try {

      // Always verify authoritative identity & role from the backend first
      let resolvedUser = userOverride ?? authUser;
      const meRes = await adminFetch(`${API_BASE}/api/auth/me`);
      if (meRes.status === 401) {
        clearAdminSession();
        return;
      }
      if (!meRes.ok) {
        throw new Error('Failed to verify admin session');
      }
      const meData = await meRes.json();
      if (typeof meData.csrfToken === 'string') {
        adminCsrfToken = meData.csrfToken;
        setAuthToken(meData.csrfToken);
      }
      if (meData.user) {
        resolvedUser = meData.user as AuthenticatedAdminUser;
        setAuthUser(resolvedUser);
        setActiveRole(resolvedUser.role);
      }

      setApiConnected(true);
      const perms = resolvedUser?.permissions || [];
      const hasPerm = (p: string) => perms.includes(p);

      const safeGet = (path: string, allowed: boolean) =>
        allowed ? adminFetch(`${API_BASE}${path}`) : Promise.resolve(null);

      const [
        overviewRes,
        prodRes,
        catRes,
        ordRes,
        custRes,
        diamondRes,
        rulesRes,
        impRes,
        shpRes,
        payRes,
        dscRes,
        bnrRes,
        cntRes,
        audRes,
        usrRes,
      ] = await Promise.all([
        safeGet('/api/admin/overview', hasPerm('PRODUCTS_VIEW')),
        safeGet('/api/admin/products?pageSize=500', hasPerm('PRODUCTS_VIEW')),
        safeGet('/api/admin/categories', hasPerm('PRODUCTS_VIEW')),
        safeGet('/api/admin/orders', hasPerm('ORDERS_VIEW')),
        safeGet('/api/admin/customers', hasPerm('ORDERS_VIEW')),
        safeGet('/api/admin/rates/diamonds', hasPerm('RATES_VIEW')),
        safeGet('/api/admin/pricing/rules', hasPerm('PRICING_PREVIEW')),
        safeGet('/api/admin/imports', hasPerm('IMPORTS_RUN')),
        safeGet('/api/admin/shipping/shipments', hasPerm('SHIPMENTS_MANAGE')),
        safeGet('/api/admin/payments', hasPerm('PAYMENTS_VIEW')),
        safeGet('/api/admin/discounts', hasPerm('DISCOUNTS_MANAGE')),
        safeGet('/api/admin/banners', hasPerm('CONTENT_MANAGE')),
        safeGet('/api/admin/content', hasPerm('CONTENT_MANAGE')),
        safeGet('/api/admin/audit-logs', hasPerm('AUDIT_VIEW')),
        safeGet('/api/admin/users', hasPerm('USERS_MANAGE')),
      ]);

      if (overviewRes?.ok) {
        const ov = await overviewRes.json();
        setOverviewData(ov);
        if (ov.metalRates) setMetalRates(ov.metalRates);
        if (ov.settings) setSettings(ov.settings);
      }
      if (prodRes?.ok) {
        const pd = await prodRes.json();
        setProducts(pd.products || []);
      }
      if (catRes?.ok) {
        const cd = await catRes.json();
        setCategories(cd.categories || []);
      }
      if (ordRes?.ok) {
        const od = await ordRes.json();
        setOrders(od.orders || []);
      }
      if (custRes?.ok) {
        const cud = await custRes.json();
        setCustomers(cud.customers || []);
      }
      if (diamondRes?.ok) {
        const dd = await diamondRes.json();
        setDiamondRates(dd.diamondRates || []);
      }
      if (rulesRes?.ok) {
        const rd = await rulesRes.json();
        if (rd.pricingRules?.length) setPricingRule(rd.pricingRules[0]);
        setPricingRuns(rd.pricingRuns || []);
        setPricingSnapshots(rd.pricingSnapshots || []);
      }
      if (impRes?.ok) {
        const id = await impRes.json();
        setImportJobs(id.importJobs || []);
      }
      if (shpRes?.ok) {
        const sd = await shpRes.json();
        setShipments(sd.shipments || []);
      }
      if (payRes?.ok) {
        const pyd = await payRes.json();
        setPayments(pyd.payments || []);
      }
      if (dscRes?.ok) {
        const dsd = await dscRes.json();
        setDiscounts(dsd.discounts || []);
      }
      if (bnrRes?.ok) {
        const bnd = await bnrRes.json();
        setBanners(bnd.banners || []);
      }
      if (cntRes?.ok) {
        const cnd = await cntRes.json();
        setContents(cnd.contents || []);
      }
      if (audRes?.ok) {
        const aud = await audRes.json();
        setAuditLogs(aud.auditLogs || []);
      }
      if (usrRes?.ok) {
        const us = await usrRes.json();
        setAdminUsers(us.users || []);
      }
    } catch {
      setApiConnected(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Purge any JWT left behind by the previous sessionStorage implementation.
      window.sessionStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
    }
    // Resume an existing HttpOnly-cookie session (401 simply leaves the login form visible).
    syncWithBackend('cookie-session', null).finally(() => {
      setAuthInitializing(false);
    });
  }, []);

  // Interactive Simulator Calculation using @mrs/shared decimal.js engine
  const simulatedBreakdown = useMemo(() => {
    const requiredInputs = [simGrossGrams, simNetGrams, simMakingValue, simWastagePct, simCertFee];
    if (requiredInputs.some((value) => value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return null;
    if (Number(simGrossGrams) <= 0 || Number(simNetGrams) <= 0 || Number(simNetGrams) > Number(simGrossGrams)) return null;
    if (!pricingRule || metalRates.length === 0) return null;
    const metalType =
      simPurity === '925_SILVER'
        ? 'SILVER'
        : simPurity === '950_PLATINUM'
        ? 'PLATINUM'
        : 'GOLD';

    const gross = Number(simGrossGrams);
    const net = Number(simNetGrams);

    const productSpec: JewelleryProductSpec = {
      id: 'sim-001',
      sku: 'SIMULATOR-PREVIEW',
      handle: 'simulator-preview',
      title: 'Interactive Simulator Jewellery Spec',
      category: 'Rings',
      shopifyProductGid: 'gid://shopify/Product/sim',
      shopifyVariantGid: 'gid://shopify/ProductVariant/sim',
      currentShopifyPriceInr: '68500.00',
      metalType,
      metalPurity: simPurity,
      metalColor: 'ROSE_GOLD',
      grossWeightGrams: gross.toFixed(3),
      netMetalWeightGrams: net.toFixed(3),
      netWeightMode: 'EXPLICIT_NET_WEIGHT',
      makingChargeMode: simMakingMode,
      makingChargeValue: Number(simMakingValue).toFixed(2),
      wastageMode: 'PERCENT_METAL_VALUE',
      wastageValue: Number(simWastagePct).toFixed(2),
      certificationFeeInr: Number(simCertFee).toFixed(2),
      hallmarkFeeInr: '0.00',
      fixedAdjustmentInr: '0.00',
      manualPriceOverrideInr: null,
      pricingEnabled: true,
      inventoryQuantity: 1,
      updatedAt: new Date().toISOString(),
      diamondComponents: [
        ...(Number(simPrimaryCarat) > 0
          ? [
              {
                componentName: 'Primary Solitaire / Center Stone',
                shape: 'ROUND' as const,
                stoneCount: 1,
                totalCaratWeight: Number(simPrimaryCarat).toFixed(3),
                colorGrade: 'EF',
                clarityGrade: 'VVS',
                cutGrade: 'EXCELLENT',
              },
            ]
          : []),
        ...(Number(simSecondaryCarat) > 0
          ? [
              {
                componentName: 'Accent / Halo Melee Stones',
                shape: 'ROUND' as const,
                stoneCount: 16,
                totalCaratWeight: Number(simSecondaryCarat).toFixed(3),
                colorGrade: 'EF',
                clarityGrade: 'VVS',
              },
            ]
          : []),
      ],
    };

    try {
      return calculateJewelleryPrice({
        product: productSpec,
        metalRates,
        diamondRates,
        rule: pricingRule,
      });
    } catch {
      return null;
    }
  }, [
    simPurity,
    simGrossGrams,
    simNetGrams,
    simMakingMode,
    simMakingValue,
    simWastagePct,
    simCertFee,
    simPrimaryCarat,
    simSecondaryCarat,
    metalRates,
    diamondRates,
    pricingRule,
  ]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (
        productSearch &&
        !p.sku.toLowerCase().includes(productSearch.toLowerCase()) &&
        !p.title.toLowerCase().includes(productSearch.toLowerCase())
      ) {
        return false;
      }
      if (
        productCategoryFilter &&
        p.category?.toLowerCase() !== productCategoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        productStatusFilter &&
        (p.status || 'ACTIVE').toUpperCase() !== productStatusFilter.toUpperCase()
      ) {
        return false;
      }
      return true;
    });
  }, [products, productSearch, productCategoryFilter, productStatusFilter]);

  const selectedProductForBreakup = useMemo(() => {
    return (
      products.find((p) => p.sku === selectedSkuForBreakup) ||
      products[0] ||
      null
    );
  }, [products, selectedSkuForBreakup]);

  async function handleUpdateMetalRate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingAction(true);
    const metalType =
      editPurity === '925_SILVER'
        ? 'SILVER'
        : editPurity === '950_PLATINUM'
        ? 'PLATINUM'
        : 'GOLD';

    try {
      if (apiConnected && authToken) {
        const res = await adminFetch(`${API_BASE}/api/admin/rates/metals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metalType,
            purity: editPurity,
            ratePerGramInr: Number(editMetalRateInr).toFixed(2),
            source: editMetalSource,
            isPlaceholder: editMetalIsPlaceholder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update metal rate');
        await syncWithBackend();
      } else {
        throw new Error('Rate changes require an authenticated API connection.');
      }
      showToast(`Updated ${metalType} ${editPurity} rate to ₹${Number(editMetalRateInr).toFixed(2)}/g.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handlePublishOwnerMarketRateCard(e: React.FormEvent) {
    e.preventDefault();
    if (!marketConfirmPublish) {
      showToast('Please check the confirmation box before publishing rate changes.');
      return;
    }
    setLoadingAction(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/rates/market-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gold14kPerGramInr: Number(market14k).toFixed(2),
          gold18kPerGramInr: Number(market18k).toFixed(2),
          gold22kPerGramInr: Number(market22k).toFixed(2),
          platinum950PerGramInr: Number(marketPlat950).toFixed(2),
          makingChargePerGramInr: Number(marketMaking).toFixed(2),
          diamondUnder1CaratPerCaratInr: Number(marketDiamondUnder1ct).toFixed(2),
          diamondOver1CaratPerCaratInr: Number(marketDiamondOver1ct).toFixed(2),
          confirmPublish: true,
          notes: 'Owner-updated market rates published from Admin Panel',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to publish market rate card');
      setMarketConfirmPublish(false);
      await syncWithBackend();
      showToast(`Published "Owner-updated market rates" (v${data.rateCard?.version || ''}) & logged audit history.`);
    } catch (err: any) {
      showToast(`Rate Publish Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleUpdateDiamondRate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingAction(true);
    try {
      if (apiConnected && authToken) {
        const res = await adminFetch(`${API_BASE}/api/admin/rates/diamonds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shape: editDiamondShape,
            sieveRange: editDiamondSieve,
            sizeMinCarat: '0.010',
            sizeMaxCarat: '5.000',
            colorGrade: editDiamondColor,
            clarityGrade: editDiamondClarity,
            rateInr: Number(editDiamondRateInr).toFixed(2),
            isPlaceholder: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update diamond rate');
        await syncWithBackend();
      } else {
        throw new Error('Rate changes require an authenticated API connection.');
      }
      showToast(`Updated Diamond Rate (${editDiamondShape} • ${editDiamondColor}-${editDiamondClarity}) to ₹${Number(editDiamondRateInr).toFixed(2)}/ct.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleGeneratePricingPreview() {
    setLoadingAction(true);
    const actorName = authUser?.displayName || authUser?.email || activeRole;
    try {
      if (apiConnected && authToken) {
        const res = await adminFetch(`${API_BASE}/api/admin/pricing/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: `Batch repricing preview triggered by ${actorName}`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Preview generation failed');
        await syncWithBackend();
        showToast(`Generated Pricing Run ${data.pricingRun.id} in PREVIEWED state.`);
      } else {
        throw new Error('Pricing preview requires an authenticated API connection.');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleTransitionPricingRun(
    runId: string,
    step: 'validate' | 'approve' | 'publish'
  ) {
    if ((step === 'approve' || step === 'publish') && activeRole !== 'OWNER') {
      showToast('RBAC Guard: Only the OWNER role can approve or publish a repricing run.');
      return;
    }

    setLoadingAction(true);
    try {
      if (apiConnected && authToken) {
        const res = await adminFetch(`${API_BASE}/api/admin/pricing/runs/${runId}/${step}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approvalNotes: `Approved by ${authUser?.displayName || authUser?.email || activeRole}`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Failed to ${step} pricing run`);
        await syncWithBackend();
      } else {
        throw new Error('Pricing workflow changes require an authenticated API connection.');
      }
      showToast(`Pricing run ${runId} transitioned via "${step.toUpperCase()}" successfully.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRunExcelImport(mode: 'DRY_RUN' | 'COMMIT') {
    if (mode === 'COMMIT') {
      const confirmed = window.confirm(
        'Commit valid rows from the configured workbook to the catalog? Review the latest dry-run first. This action may create catalog records.'
      );
      if (!confirmed) return;
      if (authUser?.role !== 'OWNER') {
        showToast('Only an owner can commit catalog imports.');
        return;
      }
    }
    setLoadingAction(true);
    try {
      if (apiConnected && authToken) {
        const res = await adminFetch(`${API_BASE}/api/admin/imports/excel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode, ...(mode === 'COMMIT' ? { confirmCommit: true } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Excel import failed');
        await syncWithBackend();
        showToast(
          `Completed ${mode} on MANGAL JEWELLERY.xlsx (${data.importJob.detectedSheets?.length || 11} sheets, ${data.importJob.validRows} valid rows, ${data.importJob.failedRows} flagged errors).`
        );
      } else {
        throw new Error('Import actions require an authenticated API connection. No local job was created.');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function fetchOverviewWithRange(range: string) {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/overview?range=${range}`);
      if (res.ok) {
        const ov = await res.json();
        setOverviewData(ov);
        if (ov.metalRates) setMetalRates(ov.metalRates);
        if (ov.settings) setSettings(ov.settings);
      }
    } catch {
      // offline fallback
    }
  }

  async function handleCommitPreviewJob(jobId: string, workbookHash: string) {
    if (authUser?.role !== 'OWNER') {
      showToast('Only an Owner can commit previewed imports.');
      return;
    }
    const confirmed = window.confirm(
      `Commit previewed job ${jobId}? This will persist validated non-test products into the catalog with hash binding.`
    );
    if (!confirmed) return;
    setLoadingAction(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/imports/${jobId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          workbookHash,
          confirmCommit: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to commit import job');
      showToast(`Import ${jobId} committed successfully! ${data.committedProductsCount} products persisted.`);
      await syncWithBackend();
    } catch (err: any) {
      showToast(`Commit Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleTransitionOrder(orderId: string, status: string) {
    const reason = window.prompt(`Transition order ${orderId} to ${status}? Enter reason:`, 'Status update via Admin Ops');
    if (reason === null) return;
    setLoadingAction(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to transition order');
      showToast(`Order status updated to ${status}.`);
      await syncWithBackend();
    } catch (err: any) {
      showToast(`Transition Error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  const navGroups = [
    'Overview & Catalog',
    'Jewellery Pricing & Import',
    'Commerce & Logistics',
    'Governance & System',
  ] as const;

  const permittedModules = getPermittedModules(ADMIN_MODULES, authUser?.permissions);
  const visibleModule = resolveVisibleModule(permittedModules, activeModule);
  const activeModuleMeta =
    ADMIN_MODULES.find((m) => m.id === visibleModule) || ADMIN_MODULES[0]!;

  return (
    <div className="mrs-admin-shell">
      {/* LEFT SIDEBAR NAVIGATION (ALL 19 MODULES) */}
      <aside className="mrs-sidebar">
        <div className="mrs-brand-header">
          <div className="mrs-brand-badge">
            <span>◆</span> MANGAL ROYAL STUDIO
          </div>
          <div className="mrs-brand-title">Royal Operations</div>
          <div className="mrs-brand-subtitle">
            Shopify Liquid Storefront + Custom Jewellery Pricing & ERP Admin
          </div>
          <button
            type="button"
            className="mrs-mobile-nav-toggle"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            {mobileNavOpen ? '✕ Close Navigation' : `☰ Modules (${permittedModules.length})`}
          </button>
        </div>

        <div className={`mrs-sidebar-nav-collapsible ${mobileNavOpen ? 'open' : ''}`}>
          <nav style={{ flex: 1, paddingBottom: 20 }}>
            {navGroups.map((groupName) => (
              <div key={groupName}>
                <div className="mrs-nav-section-label">{groupName}</div>
                <ul className="mrs-nav-list">
                  {ADMIN_MODULES.filter((m) => m.group === groupName && authUser?.permissions.includes(m.permission)).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`mrs-nav-btn ${visibleModule === item.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveModule(item.id);
                          setMobileNavOpen(false);
                        }}
                      >
                        <span>
                          <strong style={{ opacity: 0.6, marginRight: 6 }}>
                            {String(item.number).padStart(2, '0')}.
                          </strong>
                          {item.label}
                        </span>
                        {item.badge && <span className="mrs-nav-pill">{item.badge}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div
            style={{
              padding: '14px 18px',
              borderTop: '1px solid rgba(251, 232, 219, 0.14)',
              fontSize: 11.5,
              color: 'rgba(251, 232, 219, 0.75)',
            }}
          >
            <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: 3 }}>
              Storefront Source of Truth
            </div>
            <div>Shopify Dawn 15.5.0 (`apps/shopify-theme`)</div>
            <div style={{ marginTop: 4, color: '#E3B978' }}>
              Live Store Writes: {settings.shopifyLiveWritesEnabled ? 'ENABLED' : 'LOCKED (Safe Default)'}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="mrs-main">
        {/* CONFIGURABLE PLACEHOLDER SAFETY BANNER */}
        <div className="mrs-placeholder-banner">
          <div>
            <strong>JEWELLERY PRICING SAFETY GUARD:</strong> Metal and diamond rates are loaded only from the API; no local sample rates are used.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mrs-badge mrs-badge-burgundy">
              Shopify Admin API {settings.shopifyApiVersion || '2025-01'}
            </span>
            <span
              className={`mrs-badge ${
                apiConnected ? 'mrs-badge-success' : 'mrs-badge-warning'
              }`}
            >
              {apiConnected ? '● Backend API Connected (:4000)' : '● API unavailable'}
            </span>
          </div>
        </div>

        {/* TOP NAVIGATION BAR WITH SERVER-VERIFIED RBAC SESSION */}
        <header className="mrs-topbar">
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--mrs-muted)', fontWeight: 600 }}>
              MODULE {String(activeModuleMeta.number).padStart(2, '0')} OF 19 •{' '}
              {activeModuleMeta.group.toUpperCase()}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--mrs-espresso)' }}>
              {activeModuleMeta.label}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {authUser && authToken ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'rgba(122, 16, 35, 0.06)',
                    border: '1px solid rgba(122, 16, 35, 0.18)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--mrs-espresso)' }}>
                    {authUser.displayName || authUser.email}
                  </span>
                  <span className="mrs-badge mrs-badge-burgundy">{authUser.role}</span>
                </div>

                <button
                  type="button"
                  className="mrs-btn mrs-btn-secondary"
                  onClick={() => syncWithBackend()}
                >
                  ↻ Refresh State
                </button>

                <button
                  type="button"
                  className="mrs-btn mrs-btn-secondary"
                  onClick={handleAdminLogout}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <span className="mrs-badge mrs-badge-warning">
                Authentication Required
              </span>
            )}
          </div>
        </header>

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div
            style={{
              margin: '16px 28px 0',
              padding: '12px 18px',
              background: '#190303',
              color: '#FBE8DB',
              borderRadius: 10,
              borderLeft: '4px solid #C89B57',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FBE8DB',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* MODULE CONTENT */}
        <main className="mrs-content">
          {authInitializing ? (
            <div className="mrs-card" style={{ maxWidth: 480, margin: '48px auto', textAlign: 'center' }}>
              <h2 className="mrs-card-title">Verifying Admin Session…</h2>
              <p style={{ fontSize: 13, color: 'var(--mrs-muted)', marginTop: 8 }}>
                Validating the server-side session and RBAC permissions with the Mangal Royal Studio API.
              </p>
            </div>
          ) : !authToken || !authUser ? (
            <div className="mrs-card" style={{ maxWidth: 480, margin: '48px auto' }}>
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Mangal Royal Studio — Admin Sign In</h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--mrs-muted)', marginBottom: 16 }}>
                Sign in with your authorized Mangal Royal Studio administrator account. Roles and permissions are resolved strictly on the server.
              </p>
              {loginError && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(185, 28, 28, 0.08)',
                    border: '1px solid rgba(185, 28, 28, 0.3)',
                    color: '#991B1B',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {loginError}
                </div>
              )}
              <form onSubmit={handleAdminLogin}>
                <div className="mrs-form-row" style={{ marginBottom: 14 }}>
                  <label className="mrs-label" htmlFor="mrs-admin-login-email">
                    Admin Email
                  </label>
                  <input
                    id="mrs-admin-login-email"
                    type="email"
                    className="mrs-input"
                    placeholder="owner@mangalroyalstudio.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="mrs-form-row" style={{ marginBottom: 18 }}>
                  <label className="mrs-label" htmlFor="mrs-admin-login-password">
                    Password
                  </label>
                  <input
                    id="mrs-admin-login-password"
                    type="password"
                    className="mrs-input"
                    placeholder="Enter administrator password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  className="mrs-btn mrs-btn-primary"
                  disabled={isLoggingIn}
                  style={{ width: '100%' }}
                >
                  {isLoggingIn ? 'Signing In…' : 'Sign In to Royal Operations'}
                </button>
              </form>
            </div>
          ) : permittedModules.length === 0 ? (
            <div className="mrs-card" role="status" style={{ maxWidth: 520, margin: '48px auto' }}>
              <h2 className="mrs-card-title">No admin modules are assigned</h2>
              <p style={{ marginTop: 8, color: 'var(--mrs-muted)' }}>
                Ask an authorized owner to review this account’s role and permissions.
              </p>
            </div>
          ) : (
            <>
          {/* MODULE 1: OVERVIEW DASHBOARD */}
          {visibleModule === 'overview' && (
            <>
              {/* Date Range Selector Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 16,
                  padding: '10px 16px',
                  background: 'var(--mrs-card-bg)',
                  borderRadius: 10,
                  border: '1px solid var(--mrs-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mrs-gold)' }}>
                    Executive Dashboard Range:
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['7d', '30d', '90d', '1y', 'all'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`mrs-btn ${overviewRange === r ? 'mrs-btn-gold' : 'mrs-btn-secondary'}`}
                        style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}
                        onClick={() => {
                          setOverviewRange(r);
                          fetchOverviewWithRange(r);
                        }}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--mrs-muted)' }}>
                  Active Filter: <strong>{overviewRange.toUpperCase()}</strong>
                </div>
              </div>

              {/* Authoritative Financial Reconciliation Card */}
              <div
                className="mrs-card"
                style={{
                  marginBottom: 20,
                  borderLeft: '4px solid var(--mrs-gold)',
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(255,255,255,0) 100%)',
                }}
              >
                <div className="mrs-card-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h2 className="mrs-card-title">Executive Financial Summary ({overviewRange.toUpperCase()})</h2>
                    <p style={{ fontSize: 12, color: 'var(--mrs-muted)', marginTop: 2 }}>
                      {overviewData?.financialMetrics?.disclaimer ||
                        'Payment and refund totals are derived from authoritative transaction records.'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 14 }}>
                  <div style={{ padding: 12, background: 'var(--mrs-card-bg)', borderRadius: 8, border: '1px solid var(--mrs-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Net Revenue (INR)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--mrs-gold)', marginTop: 4 }}>
                      {formatInr(overviewData?.financialMetrics?.netRevenueInr ?? '0.00')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', marginTop: 2 }}>Gross minus refunds</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--mrs-card-bg)', borderRadius: 8, border: '1px solid var(--mrs-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Gross Captured (INR)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                      {formatInr(overviewData?.financialMetrics?.grossCapturedInr ?? '0.00')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', marginTop: 2 }}>Settled payments</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--mrs-card-bg)', borderRadius: 8, border: '1px solid var(--mrs-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Refunded (INR)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--mrs-danger)', marginTop: 4 }}>
                      {formatInr(overviewData?.financialMetrics?.totalRefundedInr ?? '0.00')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', marginTop: 2 }}>Processed refunds</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--mrs-card-bg)', borderRadius: 8, border: '1px solid var(--mrs-border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Paid Orders Total (INR)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                      {formatInr(overviewData?.financialMetrics?.paidOrdersTotalInr ?? '0.00')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mrs-muted)', marginTop: 2 }}>Order snapshot total</div>
                  </div>
                </div>
              </div>

              <div className="mrs-kpi-grid">
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Active Jewellery SKUs</div>
                  <div className="mrs-kpi-value">{products.length}</div>
                  <div className="mrs-kpi-sub">Synced with 11 Excel Category Sheets</div>
                </div>
                <div className="mrs-card">
                  <div className="mrs-kpi-label">24K / 22K / 18K Gold (INR/g)</div>
                  <div className="mrs-kpi-value">
                    ₹{metalRates.find((m) => m.purity === '18K')?.ratePerGramInr || '—'}
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--mrs-muted)' }}>
                      {' '}
                      (18K)
                    </span>
                  </div>
                  <div className="mrs-kpi-sub">
                    22K: ₹{metalRates.find((m) => m.purity === '22K')?.ratePerGramInr} • 24K: ₹
                    {metalRates.find((m) => m.purity === '24K')?.ratePerGramInr}
                  </div>
                </div>
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Paid Order Total (INR)</div>
                  <div className="mrs-kpi-value">
                    {formatInr(
                      orders.filter((o) => o.financialStatus === 'PAID').reduce((acc, o) => acc + Number(o.totalPriceInr || 0), 0)
                    )}
                  </div>
                  <div className="mrs-kpi-sub">
                    Sums orders currently marked PAID; refund adjustments are not reconciled
                  </div>
                </div>
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Repricing Runs & Snapshots</div>
                  <div className="mrs-kpi-value">{pricingRuns.length}</div>
                  <div className="mrs-kpi-sub">
                    Preview → Validate → Owner Approval → Publish
                  </div>
                </div>
              </div>

              <div className="mrs-grid-2" style={{ marginBottom: 22 }}>
                <div className="mrs-card">
                  <div className="mrs-card-header">
                    <h2 className="mrs-card-title">Live Metal Rate Card (Configurable Placeholders)</h2>
                    <button
                      type="button"
                      className="mrs-btn mrs-btn-secondary"
                      onClick={() => setActiveModule('gold-rates')}
                    >
                      Manage Metal Rates →
                    </button>
                  </div>
                  <div className="mrs-table-wrap">
                    <table className="mrs-table">
                      <thead>
                        <tr>
                          <th>Metal</th>
                          <th>Purity</th>
                          <th>Rate / Gram (INR)</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metalRates.map((m) => (
                          <tr key={m.id}>
                            <td><strong>{m.metalType}</strong></td>
                            <td><span className="mrs-badge mrs-badge-burgundy">{m.purity}</span></td>
                            <td><strong>₹{m.ratePerGramInr} / g</strong></td>
                            <td>
                              <span className={`mrs-badge ${m.isPlaceholder ? 'mrs-badge-warning' : 'mrs-badge-success'}`}>
                                {m.isPlaceholder ? 'CONFIGURABLE PLACEHOLDER' : 'OWNER APPROVED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mrs-card">
                  <div className="mrs-card-header">
                    <h2 className="mrs-card-title">Quick Operations Launcher</h2>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--mrs-muted)', marginBottom: 14 }}>
                    Execute core jewellery workflows directly or jump to any of the 19 specialized modules:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      className="mrs-btn mrs-btn-primary"
                      onClick={() => setActiveModule('pricing-engine')}
                    >
                      ◆ Jewellery Pricing Engine
                    </button>
                    <button
                      type="button"
                      className="mrs-btn mrs-btn-primary"
                      onClick={() => setActiveModule('excel-import')}
                    >
                      ▤ 11-Sheet Excel Importer
                    </button>
                    <button
                      type="button"
                      className="mrs-btn mrs-btn-secondary"
                      onClick={() => setActiveModule('products')}
                    >
                      ❖ Inspect SKU Price Breakups
                    </button>
                    <button
                      type="button"
                      className="mrs-btn mrs-btn-secondary"
                      onClick={() => setActiveModule('shipping')}
                    >
                      ✈ Shiprocket AWB Dispatch
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      padding: 14,
                      background: 'var(--mrs-blush)',
                      borderRadius: 10,
                      border: '1px solid var(--mrs-border)',
                      fontSize: 12.5,
                    }}
                  >
                    <strong>Architecture Alignment Verified:</strong>
                    <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.65 }}>
                      <li>
                        <strong>Customer Storefront:</strong> Shopify Liquid Theme (
                        <code>apps/shopify-theme/</code>, preserving Dawn 15.5.0 + 19 custom sections).
                      </li>
                      <li>
                        <strong>Original Backup:</strong> <code>jewellery-theme-backup/</code> untouched (377 files).
                      </li>
                      <li>
                        <strong>Commerce System of Record:</strong> Shopify Admin & Hosted Checkout.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* MODULE 2: PRODUCT & JEWELLERY SPECIFICATIONS */}
          {visibleModule === 'products' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <div>
                  <h2 className="mrs-card-title">Jewellery Catalog & Specification Inspector</h2>
                  <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)' }}>
                    Every SKU stores metal purity, gross/net weight, multi-component diamond specs, making mode, wastage, certification, and itemized INR breakup.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="search"
                    className="mrs-input"
                    placeholder="Search SKU or title..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setProductPage(1);
                    }}
                  />
                  <select
                    className="mrs-select"
                    aria-label="Filter by product status"
                    value={productStatusFilter}
                    onChange={(e) => {
                      setProductStatusFilter(e.target.value);
                      setProductPage(1);
                    }}
                  >
                    <option value="">All Products ({products.length})</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <select
                    className="mrs-select"
                    value={productCategoryFilter}
                    onChange={(e) => {
                      setProductCategoryFilter(e.target.value);
                      setProductPage(1);
                    }}
                  >
                    <option value="">All 11 Categories</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Jewellery Piece</th>
                      <th>Status</th>
                      <th>Category</th>
                      <th>Metal & Purity</th>
                      <th>Gross / Net Wt</th>
                      <th>Diamonds</th>
                      <th>Making Mode</th>
                      <th>Calculated Price (INR)</th>
                      <th>Stock</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts
                      .slice((productPage - 1) * productPageSize, productPage * productPageSize)
                      .map((p) => (
                      <tr key={p.sku}>
                        <td><strong>{p.sku}</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setGalleryPreviewProduct(p);
                                  setGalleryPreviewIndex(0);
                                  setGalleryImageFailed(false);
                                }}
                                title={`Preview gallery for ${p.sku}`}
                                style={{
                                  padding: 0,
                                  border: '1px solid var(--mrs-border)',
                                  borderRadius: 6,
                                  background: '#fff',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                }}
                              >
                                <img
                                  src={resolveProductImageUrl(p.imageUrl, API_BASE)}
                                  alt={p.title}
                                  style={{
                                    width: 40,
                                    height: 40,
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              </button>
                            ) : null}
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.title}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--mrs-muted)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span>Handle: <code>{p.handle}</code></span>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGalleryPreviewProduct(p);
                                    setGalleryPreviewIndex(0);
                                    setGalleryImageFailed(false);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--mrs-burgundy)',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  {p.galleryImages?.length || (p.imageUrl ? 1 : 0)} imgs
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`mrs-badge ${p.status === 'DRAFT' ? 'mrs-badge-warning' : 'mrs-badge-success'}`}>
                            {p.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td>{p.category}</td>
                        <td>
                          <span className="mrs-badge mrs-badge-burgundy">
                            {p.metalPurity} {p.metalColor}
                          </span>
                        </td>
                        <td>
                          {p.grossWeightGrams}g / <strong>{p.netMetalWeightGrams}g</strong>
                        </td>
                        <td>
                          {p.diamondComponents?.length || 0} comp (
                          {p.diamondComponents
                            ?.reduce((s: number, d: any) => s + Number(d.totalCaratWeight), 0)
                            .toFixed(3)}
                          ct)
                        </td>
                        <td>
                          {p.makingChargeMode} ({p.makingChargeValue})
                        </td>
                        <td>
                          {p.latestBreakdown?.priceOnRequest ? (
                            <div>
                              <span className="mrs-badge mrs-badge-warning">Price on request</span>
                              <div style={{ fontSize: 10.5, color: 'var(--mrs-muted)', marginTop: 3 }}>
                                {p.latestBreakdown.priceOnRequestReason}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <strong style={{ color: 'var(--mrs-burgundy)', fontSize: 14 }}>
                                {formatInr(p.latestBreakdown?.finalProposedPriceInr || p.currentShopifyPriceInr)}
                              </strong>
                              {p.latestBreakdown?.manualOverrideApplied && (
                                <div>
                                  <span className="mrs-badge mrs-badge-burgundy" style={{ fontSize: 10 }}>
                                    OWNER OVERRIDE
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`mrs-badge ${p.inventoryQuantity <= 2 ? 'mrs-badge-warning' : 'mrs-badge-success'}`}>
                            {p.inventoryQuantity} in stock
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="mrs-btn mrs-btn-secondary"
                            onClick={() => setSelectedSkuForBreakup(p.sku)}
                          >
                            Breakup
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={productPage}
                pageSize={productPageSize}
                total={filteredProducts.length}
                onPageChange={setProductPage}
                onPageSizeChange={setProductPageSize}
              />

              {galleryPreviewProduct && (() => {
                const rawUrls: string[] =
                  galleryPreviewProduct.galleryImages && galleryPreviewProduct.galleryImages.length > 0
                    ? galleryPreviewProduct.galleryImages
                    : galleryPreviewProduct.imageUrl
                    ? [galleryPreviewProduct.imageUrl]
                    : [];
                const resolvedUrls = rawUrls.map((u) => resolveProductImageUrl(u, API_BASE));
                const safeIdx = Math.min(galleryPreviewIndex, Math.max(0, resolvedUrls.length - 1));
                const activeUrl = resolvedUrls[safeIdx] || '';

                return (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Product gallery for ${galleryPreviewProduct.sku}`}
                    onClick={() => setGalleryPreviewProduct(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(20, 12, 14, 0.72)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                      zIndex: 1000,
                    }}
                  >
                    <div
                      className="mrs-card"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        maxWidth: 780,
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        background: '#fff',
                        padding: 20,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 17 }}>{galleryPreviewProduct.sku}</strong>
                            <span className={`mrs-badge ${galleryPreviewProduct.status === 'DRAFT' ? 'mrs-badge-warning' : 'mrs-badge-success'}`}>
                              {galleryPreviewProduct.status || 'ACTIVE'}
                            </span>
                            <span className="mrs-badge mrs-badge-burgundy">{galleryPreviewProduct.category}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--mrs-muted)', marginTop: 4 }}>
                            {galleryPreviewProduct.title} • {resolvedUrls.length} image{resolvedUrls.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mrs-btn mrs-btn-secondary"
                          onClick={() => setGalleryPreviewProduct(null)}
                        >
                          Close
                        </button>
                      </div>

                      {resolvedUrls.length === 0 ? (
                        <div style={{ padding: 36, textAlign: 'center', background: 'var(--mrs-blush)', borderRadius: 8 }}>
                          No gallery images attached to this SKU yet.
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              position: 'relative',
                              background: '#faf8f7',
                              border: '1px solid var(--mrs-border)',
                              borderRadius: 8,
                              minHeight: 300,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 12,
                            }}
                          >
                            {galleryImageFailed || !activeUrl ? (
                              <div style={{ textAlign: 'center', color: 'var(--mrs-muted)', padding: 24 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Image unavailable</div>
                                <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{activeUrl || 'Empty URL'}</div>
                              </div>
                            ) : (
                              <img
                                src={activeUrl}
                                alt={`${galleryPreviewProduct.sku} view ${safeIdx + 1}`}
                                onError={() => setGalleryImageFailed(true)}
                                style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
                              />
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>
                                Image {safeIdx + 1} of {resolvedUrls.length}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--mrs-muted)' }}>
                                (sortOrder: {safeIdx})
                              </span>
                              {safeIdx === 0 && (
                                <span className="mrs-badge mrs-badge-success">Primary Image</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="mrs-btn mrs-btn-secondary"
                                disabled={resolvedUrls.length <= 1}
                                onClick={() => {
                                  setGalleryImageFailed(false);
                                  setGalleryPreviewIndex((prev) => (prev - 1 + resolvedUrls.length) % resolvedUrls.length);
                                }}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="mrs-btn mrs-btn-secondary"
                                disabled={resolvedUrls.length <= 1}
                                onClick={() => {
                                  setGalleryImageFailed(false);
                                  setGalleryPreviewIndex((prev) => (prev + 1) % resolvedUrls.length);
                                }}
                              >
                                Next
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, paddingBottom: 4 }}>
                            {resolvedUrls.map((url, idx) => (
                              <button
                                key={`${url}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setGalleryImageFailed(false);
                                  setGalleryPreviewIndex(idx);
                                }}
                                style={{
                                  padding: 2,
                                  border: idx === safeIdx ? '2px solid var(--mrs-burgundy)' : '1px solid var(--mrs-border)',
                                  borderRadius: 6,
                                  background: '#fff',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  position: 'relative',
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Thumbnail ${idx + 1}`}
                                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                                />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {selectedProductForBreakup?.latestBreakdown && (
                <div
                  style={{
                    marginTop: 22,
                    padding: 20,
                    background: 'var(--mrs-blush)',
                    borderRadius: 12,
                    border: '1px solid var(--mrs-border)',
                  }}
                >
                  <div className="mrs-card-header">
                    <h3 className="mrs-card-title">
                      Itemized INR Price Breakup — {selectedProductForBreakup.sku} ({selectedProductForBreakup.title})
                    </h3>
                    <span className="mrs-badge mrs-badge-burgundy">
                      Formula Version v{selectedProductForBreakup.latestBreakdown.formulaVersion}
                    </span>
                  </div>
                  <div className="mrs-kpi-grid" style={{ marginBottom: 0 }}>
                    <div className="mrs-card">
                      <div className="mrs-kpi-label">Metal + Wastage Value</div>
                      <div className="mrs-kpi-value" style={{ fontSize: 22 }}>
                        {formatInr(selectedProductForBreakup.latestBreakdown.payableMetalValueInr)}
                      </div>
                      <div className="mrs-kpi-sub">
                        Base Metal: ₹{selectedProductForBreakup.latestBreakdown.baseMetalValueInr} + Wastage: ₹
                        {selectedProductForBreakup.latestBreakdown.wastageValueInr}
                      </div>
                    </div>
                    <div className="mrs-card">
                      <div className="mrs-kpi-label">Certified Diamonds Total</div>
                      <div className="mrs-kpi-value" style={{ fontSize: 22 }}>
                        {formatInr(selectedProductForBreakup.latestBreakdown.totalDiamondValueInr)}
                      </div>
                      <div className="mrs-kpi-sub">
                        {selectedProductForBreakup.latestBreakdown.totalDiamondCarats} ct tw
                      </div>
                    </div>
                    <div className="mrs-card">
                      <div className="mrs-kpi-label">Making + Certification</div>
                      <div className="mrs-kpi-value" style={{ fontSize: 22 }}>
                        {formatInr(
                          Number(selectedProductForBreakup.latestBreakdown.makingChargeValueInr) +
                            Number(selectedProductForBreakup.latestBreakdown.certificationFeeInr) +
                            Number(selectedProductForBreakup.latestBreakdown.hallmarkFeeInr)
                        )}
                      </div>
                      <div className="mrs-kpi-sub">
                        Making: ₹{selectedProductForBreakup.latestBreakdown.makingChargeValueInr} • Cert: ₹
                        {selectedProductForBreakup.latestBreakdown.certificationFeeInr}
                      </div>
                    </div>
                    <div className="mrs-card">
                      <div className="mrs-kpi-label">
                        {selectedProductForBreakup.latestBreakdown.priceOnRequest
                          ? 'Pricing Status (Guardrail Triggered)'
                          : selectedProductForBreakup.latestBreakdown.manualOverrideApplied
                            ? 'Owner-Approved Manual Override Price'
                            : `Final Retail Price (Incl. ${selectedProductForBreakup.latestBreakdown.gstRatePercent}% GST)`}
                      </div>
                      <div className="mrs-kpi-value" style={{ fontSize: 24 }}>
                        {selectedProductForBreakup.latestBreakdown.priceOnRequest
                          ? 'Price on request'
                          : formatInr(selectedProductForBreakup.latestBreakdown.finalProposedPriceInr)}
                      </div>
                      <div className="mrs-kpi-sub">
                        {selectedProductForBreakup.latestBreakdown.priceOnRequest
                          ? `Reason: ${selectedProductForBreakup.latestBreakdown.priceOnRequestReason}`
                          : selectedProductForBreakup.latestBreakdown.manualOverrideApplied
                            ? `Formula Calculated: ${formatInr(selectedProductForBreakup.latestBreakdown.calculatedPriceInr)} (Override Preserved)`
                            : `GST: ₹${selectedProductForBreakup.latestBreakdown.gstAmountInr} • Rounding: ${selectedProductForBreakup.latestBreakdown.roundingMode}`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 3: CATEGORY MANAGEMENT */}
          {visibleModule === 'categories' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <div>
                  <h2 className="mrs-card-title">11 Jewellery Categories & Excel Sheet Mapping</h2>
                  <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)' }}>
                    Direct 1:1 mapping between the 11 sheets in <code>MANGAL JEWELLERY.xlsx</code> and Shopify Storefront collections.
                  </p>
                </div>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category Name</th>
                      <th>Excel Sheet Name</th>
                      <th>Shopify Collection Handle</th>
                      <th>Catalog SKUs</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c, idx) => (
                      <tr key={c.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{c.name}</strong></td>
                        <td><code>{c.excelSheetName}</code></td>
                        <td><code>/collections/{c.slug}</code></td>
                        <td><strong>{c.productCount}</strong></td>
                        <td><span className="mrs-badge mrs-badge-success">ACTIVE</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 4: INVENTORY MANAGEMENT */}
          {visibleModule === 'inventory' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Vault Inventory & Shopify Variant Stock Sync</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product Title</th>
                      <th>Purity</th>
                      <th>Net Metal Weight</th>
                      <th>Current Price</th>
                      <th>Available Units</th>
                      <th>Stock Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .slice((inventoryPage - 1) * inventoryPageSize, inventoryPage * inventoryPageSize)
                      .map((p) => (
                      <tr key={p.sku}>
                        <td>
                          <strong>{p.sku}</strong>
                          {p.sku === 'MRS-EAR-2001' && (
                            <span
                              className="mrs-badge mrs-badge-burgundy"
                              style={{ marginLeft: 6, fontSize: 10 }}
                              title="Provisional baseline stock protected by Owner decision"
                            >
                              LOCKED BASELINE
                            </span>
                          )}
                        </td>
                        <td>{p.title}</td>
                        <td>{p.metalPurity}</td>
                        <td>{p.netMetalWeightGrams}g</td>
                        <td>{formatInr(p.currentShopifyPriceInr)}</td>
                        <td><strong>{p.inventoryQuantity} units</strong></td>
                        <td>
                          {p.sku === 'MRS-EAR-2001' ? (
                            <span className="mrs-badge mrs-badge-burgundy">PROTECTED (9 PROVISIONAL)</span>
                          ) : (
                            <span className={`mrs-badge ${p.inventoryQuantity <= 2 ? 'mrs-badge-danger' : 'mrs-badge-success'}`}>
                              {p.inventoryQuantity <= 2 ? 'LOW VAULT STOCK (≤2)' : 'HEALTHY'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={inventoryPage}
                pageSize={inventoryPageSize}
                total={products.length}
                onPageChange={setInventoryPage}
                onPageSizeChange={setInventoryPageSize}
              />
            </div>
          )}

          {/* MODULE 7: JEWELLERY PRICING ENGINE */}
          {visibleModule === 'pricing-engine' && (
            <div className="mrs-grid-2" style={{ marginBottom: 22 }}>
              <div className="mrs-card">
                <div className="mrs-card-header">
                  <div>
                    <h2 className="mrs-card-title">Interactive Jewellery Price Simulator</h2>
                    <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)' }}>
                      Powered by <code>@mrs/shared</code> <code>decimal.js</code> engine — zero floating-point drift.
                    </p>
                  </div>
                  <span className="mrs-badge mrs-badge-burgundy">Rule v{pricingRule?.version ?? '—'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Metal Purity</label>
                    <select
                      className="mrs-select"
                      value={simPurity}
                      onChange={(e) => setSimPurity(e.target.value as MetalPurity)}
                    >
                      <option value="24K">24K Gold (99.9%)</option>
                      <option value="22K">22K Gold (91.6% BIS)</option>
                      <option value="18K">18K Gold (75.0% BIS)</option>
                      <option value="14K">14K Gold (58.5%)</option>
                      <option value="925_SILVER">925 Sterling Silver</option>
                      <option value="950_PLATINUM">950 Platinum</option>
                    </select>
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Making Charge Mode</label>
                    <select
                      className="mrs-select"
                      value={simMakingMode}
                      onChange={(e) => setSimMakingMode(e.target.value as MakingChargeMode)}
                    >
                      <option value="PER_GRAM_NET">PER_GRAM_NET (INR/g)</option>
                      <option value="PER_GRAM_GROSS">PER_GRAM_GROSS (INR/g)</option>
                      <option value="PERCENTAGE_OF_METAL">PERCENTAGE_OF_METAL (%)</option>
                      <option value="FLAT_PER_PIECE">FLAT_PER_PIECE (INR)</option>
                    </select>
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Gross Weight (g)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="mrs-input"
                      value={simGrossGrams}
                      onChange={(e) => setSimGrossGrams(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Net Metal Weight (g)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="mrs-input"
                      value={simNetGrams}
                      onChange={(e) => setSimNetGrams(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Making Value (INR or %)</label>
                    <input
                      type="number"
                      step="10"
                      className="mrs-input"
                      value={simMakingValue}
                      onChange={(e) => setSimMakingValue(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Wastage (%)</label>
                    <input
                      type="number"
                      step="0.25"
                      className="mrs-input"
                      value={simWastagePct}
                      onChange={(e) => setSimWastagePct(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Primary Solitaire Carat (EF-VVS)</label>
                    <input
                      type="number"
                      step="0.05"
                      className="mrs-input"
                      value={simPrimaryCarat}
                      onChange={(e) => setSimPrimaryCarat(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Secondary Melee Carat (EF-VVS)</label>
                    <input
                      type="number"
                      step="0.02"
                      className="mrs-input"
                      value={simSecondaryCarat}
                      onChange={(e) => setSimSecondaryCarat(e.target.value)}
                    />
                  </div>
                </div>

                {!pricingRule || metalRates.length === 0 ? (
                  <p role="status" style={{ marginTop: 12, color: 'var(--mrs-warning)' }}>
                    Pricing simulation is unavailable until the API provides an active rule and metal rates. Entered values are a preview only; nothing is published from this form.
                  </p>
                ) : !simulatedBreakdown ? (
                  <p role="status" style={{ marginTop: 12, color: 'var(--mrs-muted)' }}>
                    Enter valid weights, making charge, wastage, and certification values to preview this scenario.
                  </p>
                ) : null}

                {simulatedBreakdown && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 16,
                      background: 'var(--mrs-blush)',
                      borderRadius: 10,
                      border: '1px solid var(--mrs-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>Metal Value ({simulatedBreakdown.computedNetMetalWeightGrams}g × ₹{simulatedBreakdown.metalRatePerGramInr}/g):</span>
                      <strong>₹{simulatedBreakdown.baseMetalValueInr}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>Wastage Value:</span>
                      <strong>₹{simulatedBreakdown.wastageValueInr}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>Diamond Matrix Value ({simulatedBreakdown.totalDiamondCarats} ct):</span>
                      <strong>₹{simulatedBreakdown.totalDiamondValueInr}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>Making Charges ({simulatedBreakdown.makingChargeMode}):</span>
                      <strong>₹{simulatedBreakdown.makingChargeValueInr}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>Certification & Hallmark Fee:</span>
                      <strong>₹{Number(simulatedBreakdown.certificationFeeInr) + Number(simulatedBreakdown.hallmarkFeeInr)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span>GST ({simulatedBreakdown.gstRatePercent}%):</span>
                      <strong>₹{simulatedBreakdown.gstAmountInr}</strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: 10,
                        borderTop: '1px solid var(--mrs-border)',
                        fontSize: 18,
                        color: 'var(--mrs-burgundy)',
                      }}
                    >
                      <strong>Final Rounded Retail Price:</strong>
                      <strong>{formatInr(simulatedBreakdown.finalProposedPriceInr)}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="mrs-card">
                <div className="mrs-card-header">
                  <div>
                    <h2 className="mrs-card-title">
                      Repricing Governance: Preview → Validate → Owner Approve → Publish
                    </h2>
                    <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)' }}>
                      No bulk rate or formula change ever touches Shopify without completing this 4-step workflow.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mrs-btn mrs-btn-primary"
                    disabled={loadingAction || !apiConnected}
                    onClick={handleGeneratePricingPreview}
                  >
                    + Generate Repricing Preview Run
                  </button>
                </div>

                <div className="mrs-table-wrap">
                  <table className="mrs-table">
                    <thead>
                      <tr>
                        <th>Run ID</th>
                        <th>Rule</th>
                        <th>SKUs</th>
                        <th>Workflow Status</th>
                        <th>Governance Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingRuns.map((run) => (
                        <tr key={run.id}>
                          <td><strong>{run.id}</strong></td>
                          <td>v{run.ruleVersion}</td>
                          <td>{run.summary?.totalProducts || products.length} SKUs</td>
                          <td>
                            <span
                              className={`mrs-badge ${
                                run.status === 'PUBLISHED'
                                  ? 'mrs-badge-success'
                                  : run.status === 'APPROVED'
                                  ? 'mrs-badge-burgundy'
                                  : 'mrs-badge-warning'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {(run.status === 'PREVIEWED' || run.status === 'DRAFT') && (
                                <button
                                  type="button"
                                  className="mrs-btn mrs-btn-secondary"
                                  onClick={() => handleTransitionPricingRun(run.id, 'validate')}
                                >
                                  2. Validate
                                </button>
                              )}
                              {(run.status === 'PREVIEWED' || run.status === 'VALIDATED') && (
                                <button
                                  type="button"
                                  className="mrs-btn mrs-btn-gold"
                                  onClick={() => handleTransitionPricingRun(run.id, 'approve')}
                                >
                                  3. Owner Approve
                                </button>
                              )}
                              {run.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  className="mrs-btn mrs-btn-primary"
                                  onClick={() => handleTransitionPricingRun(run.id, 'publish')}
                                >
                                  4. Publish & Snapshot
                                </button>
                              )}
                              {run.status === 'PUBLISHED' && (
                                <span style={{ fontSize: 12, color: 'var(--mrs-success)', fontWeight: 600 }}>
                                  ✓ Immutable Snapshot Saved
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 8: GOLD & METAL RATE MANAGEMENT */}
          {visibleModule === 'gold-rates' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div className="mrs-card" style={{ border: '1.5px solid var(--mrs-burgundy)' }}>
                <div className="mrs-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 className="mrs-card-title">{liveOwnerRateCard.label}</h2>
                      <span className="mrs-badge mrs-badge-burgundy">v{liveOwnerRateCard.version}</span>
                      <span className="mrs-badge mrs-badge-success">AUTHORITATIVE SERVER RATE CARD</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)', marginTop: 4 }}>
                      Last updated: <strong>{liveOwnerRateCard.lastUpdatedAt}</strong> by{' '}
                      <code>{liveOwnerRateCard.updatedBy}</code> • Shared server-side calculation across product cards, PDP, cart &amp; checkout.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePublishOwnerMarketRateCard}>
                  <div className="mrs-kpi-grid" style={{ marginBottom: 16 }}>
                    <div className="mrs-card">
                      <label className="mrs-label">14K Gold (INR / gram • 3% GST Confirmed)</label>
                      <input
                        type="number"
                        step="1"
                        className="mrs-input"
                        value={market14k}
                        onChange={(e) => setMarket14k(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">18K Gold (INR / gram • 3% GST Confirmed)</label>
                      <input
                        type="number"
                        step="1"
                        className="mrs-input"
                        value={market18k}
                        onChange={(e) => setMarket18k(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">22K Gold (INR / gram • GST Unconfirmed)</label>
                      <input
                        type="number"
                        step="1"
                        className="mrs-input"
                        value={market22k}
                        onChange={(e) => setMarket22k(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card" style={{ background: '#fff5f5', borderColor: '#feb2b2' }}>
                      <label className="mrs-label" style={{ color: '#9b2c2c' }}>24K Gold Status</label>
                      <div style={{ fontWeight: 700, color: '#9b2c2c', fontSize: 13 }}>
                        BLOCKED PENDING CONFIRMATION
                      </div>
                      <div style={{ fontSize: 11, color: '#742a2a', marginTop: 4 }}>
                        Conflicting values supplied (₹15,400/g incl. GST vs ₹154,000/g). Neither is active.
                      </div>
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">Platinum 950 (INR / gram • GST Unconfirmed)</label>
                      <input
                        type="number"
                        step="1"
                        className="mrs-input"
                        value={marketPlat950}
                        onChange={(e) => setMarketPlat950(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">Making Charge (INR / gram Net Metal Weight)</label>
                      <input
                        type="number"
                        step="1"
                        className="mrs-input"
                        value={marketMaking}
                        onChange={(e) => setMarketMaking(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">Diamond &lt; 1.00 ct (INR / carat)</label>
                      <input
                        type="number"
                        step="100"
                        className="mrs-input"
                        value={marketDiamondUnder1ct}
                        onChange={(e) => setMarketDiamondUnder1ct(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mrs-card">
                      <label className="mrs-label">Diamond &gt; 1.00 ct (INR / carat)</label>
                      <input
                        type="number"
                        step="100"
                        className="mrs-input"
                        value={marketDiamondOver1ct}
                        onChange={(e) => setMarketDiamondOver1ct(e.target.value)}
                        required
                      />
                      <div style={{ fontSize: 11, color: 'var(--mrs-muted)', marginTop: 4 }}>
                        Note: Exact = 1.00 ct has no supplied rate (returns Price on request until separate owner input).
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={marketConfirmPublish}
                        disabled={!authUser?.permissions?.includes('RATES_WRITE')}
                        onChange={(e) => setMarketConfirmPublish(e.target.checked)}
                      />
                      I confirm publishing these Owner-updated market rates (preserves manual product price overrides &amp; logs audit history)
                    </label>
                    <button
                      type="submit"
                      className="mrs-btn mrs-btn-primary"
                      disabled={loadingAction || !marketConfirmPublish || !authUser?.permissions?.includes('RATES_WRITE')}
                    >
                      Confirm &amp; Publish Owner-Updated Market Rates
                    </button>
                  </div>
                  {!authUser?.permissions?.includes('RATES_WRITE') && (
                    <p style={{ fontSize: 12, color: '#9b2c2c', marginTop: 8 }}>
                      Read-only view: Only the OWNER role holds <code>RATES_WRITE</code> permission to publish live rates.
                    </p>
                  )}
                </form>
              </div>

            <div className="mrs-grid-2">
              <div className="mrs-card">
                <div className="mrs-card-header">
                  <h2 className="mrs-card-title">Active Gold, Silver & Platinum Rate Card</h2>
                </div>
                <div className="mrs-table-wrap">
                  <table className="mrs-table">
                    <thead>
                      <tr>
                        <th>Metal</th>
                        <th>Purity</th>
                        <th>Rate / Gram (INR)</th>
                        <th>Source</th>
                        <th>Governance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metalRates.map((m) => (
                        <tr key={m.id}>
                          <td><strong>{m.metalType}</strong></td>
                          <td><span className="mrs-badge mrs-badge-burgundy">{m.purity}</span></td>
                          <td><strong>₹{m.ratePerGramInr}</strong></td>
                          <td>{m.source}</td>
                          <td>
                            <span className={`mrs-badge ${m.isPlaceholder ? 'mrs-badge-warning' : 'mrs-badge-success'}`}>
                              {m.isPlaceholder ? 'PLACEHOLDER' : 'APPROVED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mrs-card">
                <div className="mrs-card-header">
                  <h2 className="mrs-card-title">Update Daily Bullion Rate</h2>
                </div>
                <form onSubmit={handleUpdateMetalRate}>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Select Metal Purity</label>
                    <select
                      className="mrs-select"
                      value={editPurity}
                      onChange={(e) => setEditPurity(e.target.value as MetalPurity)}
                    >
                      <option value="24K">24K Gold</option>
                      <option value="22K">22K Gold</option>
                      <option value="18K">18K Gold</option>
                      <option value="14K">14K Gold</option>
                      <option value="925_SILVER">925 Silver</option>
                      <option value="950_PLATINUM">950 Platinum</option>
                    </select>
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Rate per Gram (INR)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="mrs-input"
                      value={editMetalRateInr}
                      onChange={(e) => setEditMetalRateInr(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Rate Source / Reference</label>
                    <input
                      type="text"
                      className="mrs-input"
                      value={editMetalSource}
                      onChange={(e) => setEditMetalSource(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mrs-form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input
                      id="placeholder-chk"
                      type="checkbox"
                      checked={editMetalIsPlaceholder}
                      onChange={(e) => setEditMetalIsPlaceholder(e.target.checked)}
                    />
                    <label htmlFor="placeholder-chk" style={{ fontSize: 12.5 }}>
                      Keep marked as Configurable Placeholder until Owner approves repricing run
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mrs-btn mrs-btn-primary"
                    disabled={loadingAction || !authUser?.permissions?.includes('RATES_WRITE')}
                  >
                    Save Metal Rate & Log Audit Entry
                  </button>
                  {!authUser?.permissions?.includes('RATES_WRITE') && (
                    <p style={{ fontSize: 12, color: '#9b2c2c', marginTop: 8 }}>
                      Read-only view: Only OWNER can publish metal rate updates.
                    </p>
                  )}
                </form>
              </div>
            </div>

              <div className="mrs-card">
                <div className="mrs-card-header">
                  <h2 className="mrs-card-title">Rate Card Audit History (Old / New Values, Timestamp, Actor &amp; Version)</h2>
                </div>
                <div className="mrs-table-wrap">
                  <table className="mrs-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Actor</th>
                        <th>Role</th>
                        <th>Action</th>
                        <th>Entity / Version</th>
                        <th>Summary &amp; Before/After Snapshot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs
                        .filter((l) =>
                          [
                            'OWNER_MARKET_RATE_CARD_UPDATED',
                            'METAL_RATE_UPDATED',
                            'DIAMOND_RATE_UPDATED',
                            'PRICING_RULE_CREATED',
                          ].includes(l.action)
                        )
                        .slice(0, 15)
                        .map((log) => (
                          <tr key={log.id}>
                            <td><code>{log.createdAt}</code></td>
                            <td><strong>{log.actorEmail}</strong></td>
                            <td><span className="mrs-badge mrs-badge-burgundy">{log.actorRole}</span></td>
                            <td><code>{log.action}</code></td>
                            <td><code>{log.entityId}</code></td>
                            <td style={{ fontSize: 12 }}>{log.summary}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 9: DIAMOND RATE MATRIX MANAGEMENT */}
          {visibleModule === 'diamond-rates' && (
            <div className="mrs-grid-2">
              <div className="mrs-card">
                <div className="mrs-card-header">
                  <h2 className="mrs-card-title">Diamond Quality × Sieve Size Matrix (INR/ct)</h2>
                </div>
                <div className="mrs-table-wrap">
                  <table className="mrs-table">
                    <thead>
                      <tr>
                        <th>Shape</th>
                        <th>Color / Clarity</th>
                        <th>Sieve / Bracket</th>
                        <th>Carat Range</th>
                        <th>Rate / Carat (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diamondRates.map((d) => (
                        <tr key={d.id}>
                          <td><strong>{d.shape}</strong></td>
                          <td><span className="mrs-badge mrs-badge-burgundy">{d.colorGrade}-{d.clarityGrade}</span></td>
                          <td><code>{d.sieveRange || 'Standard'}</code></td>
                          <td>{d.sizeMinCarat} – {d.sizeMaxCarat} ct</td>
                          <td><strong>₹{d.rateInr} / ct</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mrs-card">
                <div className="mrs-card-header">
                  <h2 className="mrs-card-title">Update Diamond Matrix Slab</h2>
                </div>
                <form onSubmit={handleUpdateDiamondRate}>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Diamond Shape</label>
                    <select
                      className="mrs-select"
                      value={editDiamondShape}
                      onChange={(e) => setEditDiamondShape(e.target.value)}
                    >
                      <option value="ROUND">ROUND</option>
                      <option value="ANY">ANY SHAPE</option>
                      <option value="EMERALD">EMERALD</option>
                      <option value="PEAR">PEAR</option>
                      <option value="CUSHION">CUSHION</option>
                    </select>
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Color Grade</label>
                    <input
                      className="mrs-input"
                      value={editDiamondColor}
                      onChange={(e) => setEditDiamondColor(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Clarity Grade</label>
                    <input
                      className="mrs-input"
                      value={editDiamondClarity}
                      onChange={(e) => setEditDiamondClarity(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Sieve / Size Description</label>
                    <input
                      className="mrs-input"
                      value={editDiamondSieve}
                      onChange={(e) => setEditDiamondSieve(e.target.value)}
                    />
                  </div>
                  <div className="mrs-form-row">
                    <label className="mrs-label">Rate per Carat (INR)</label>
                    <input
                      type="number"
                      step="500"
                      className="mrs-input"
                      value={editDiamondRateInr}
                      onChange={(e) => setEditDiamondRateInr(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="mrs-btn mrs-btn-primary"
                    disabled={loadingAction || !authUser?.permissions?.includes('RATES_WRITE')}
                  >
                    Save Diamond Matrix Rate
                  </button>
                  {!authUser?.permissions?.includes('RATES_WRITE') && (
                    <p style={{ fontSize: 12, color: '#9b2c2c', marginTop: 8 }}>
                      Read-only view: Only OWNER can publish diamond rate updates.
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* MODULE 10: BULK 11-SHEET EXCEL / CSV IMPORT SYSTEM */}
          {visibleModule === 'excel-import' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <div>
                  <h2 className="mrs-card-title">
                    11-Sheet Workbook Importer (<code>MANGAL JEWELLERY.xlsx</code>)
                  </h2>
                  <p style={{ fontSize: 12.5, color: 'var(--mrs-muted)' }}>
                    Detects all 11 category sheets, validates weights (net ≤ gross), blocks duplicate SKUs without overwriting, calculates dry-run prices, and exports CSV error reports.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="mrs-btn mrs-btn-primary"
                    disabled={loadingAction || !apiConnected}
                    onClick={() => handleRunExcelImport('DRY_RUN')}
                  >
                    ▶ Run Dry-Run Preview on MANGAL JEWELLERY.xlsx
                  </button>
                  <button
                    type="button"
                    className="mrs-btn mrs-btn-gold"
                    disabled={loadingAction || !apiConnected || authUser?.role !== 'OWNER'}
                    onClick={() => handleRunExcelImport('COMMIT')}
                  >
                    ✓ Commit Validated Rows to Catalog
                  </button>
                </div>
              </div>

              {importJobs.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--mrs-muted)' }}>
                  Click <strong>“Run Dry-Run Preview on MANGAL JEWELLERY.xlsx”</strong> above to inspect all 11 sheets, row-level price calculations, and validation error reports.
                </div>
              ) : (
                importJobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      marginTop: 16,
                      padding: 18,
                      background: 'var(--mrs-blush)',
                      borderRadius: 10,
                      border: '1px solid var(--mrs-border)',
                    }}
                  >
                    <div className="mrs-card-header">
                      <div>
                        <strong>Job {job.id}</strong> — <code>{job.sourceFileName}</code> ({job.status})
                        <div style={{ fontSize: 12, color: 'var(--mrs-muted)', marginTop: 2 }}>
                          Sheets Detected ({job.detectedSheets?.length || 11}):{' '}
                          {job.detectedSheets?.map((s: any) => s.sheetName).join(', ')}
                        </div>
                        {job.workbookHash && (
                          <div style={{ fontSize: 11.5, marginTop: 4 }}>
                            Hash:{' '}
                            <code style={{ fontSize: 11, background: 'var(--mrs-card-bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--mrs-border)' }}>
                              {job.workbookHash}
                            </code>
                            {job.expiresAt && (
                              <span style={{ marginLeft: 8, color: 'var(--mrs-muted)', fontSize: 11 }}>
                                Expires: {new Date(job.expiresAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="mrs-badge mrs-badge-success">{job.validRows} Valid Rows</span>
                        <span className="mrs-badge mrs-badge-danger">{job.failedRows} Flagged Errors</span>
                        <span className="mrs-badge mrs-badge-warning">{job.duplicateSkus} Duplicate SKUs Blocked</span>
                        {apiConnected && (
                          <a
                            href={`${API_BASE}/api/admin/imports/${job.id}/errors.csv`}
                            target="_blank"
                            rel="noreferrer"
                            className="mrs-btn mrs-btn-secondary"
                            style={{ textDecoration: 'none' }}
                          >
                            ⬇ Download Error CSV
                          </a>
                        )}
                        {(job.status === 'PREVIEWED' || job.status === 'DRY_RUN_COMPLETED') &&
                          job.workbookHash &&
                          authUser?.role === 'OWNER' && (
                            <button
                              type="button"
                              className="mrs-btn mrs-btn-gold"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              disabled={loadingAction}
                              onClick={() => handleCommitPreviewJob(job.id, job.workbookHash)}
                            >
                              ✓ Commit Job (Hash Bound)
                            </button>
                          )}
                      </div>
                    </div>

                    {job.errors?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, color: 'var(--mrs-danger)' }}>
                          Row-Level Validation & Duplicate Protection Report:
                        </div>
                        <div className="mrs-table-wrap">
                          <table className="mrs-table">
                            <thead>
                              <tr>
                                <th>Sheet</th>
                                <th>Row #</th>
                                <th>SKU</th>
                                <th>Field</th>
                                <th>Severity</th>
                                <th>Diagnostic Message</th>
                              </tr>
                            </thead>
                            <tbody>
                              {job.errors.map((err: any, i: number) => (
                                <tr key={`${job.id}-err-${i}`}>
                                  <td><strong>{err.sheetName}</strong></td>
                                  <td>Row {err.rowNumber}</td>
                                  <td><code>{err.sku || '(missing)'}</code></td>
                                  <td>{err.field}</td>
                                  <td><span className="mrs-badge mrs-badge-danger">{err.severity}</span></td>
                                  <td>{err.message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* MODULE 5: ORDER MANAGEMENT */}
          {visibleModule === 'orders' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Shopify Orders & Purchase-Time Pricing Snapshots</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Financial Status</th>
                      <th>Fulfillment</th>
                      <th>Total (INR)</th>
                      <th>Gateway</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize)
                      .map((o) => (
                      <tr key={o.id}>
                        <td><strong>{o.orderNumber}</strong></td>
                        <td>
                          <div>{o.customerName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--mrs-muted)' }}>{o.customerEmail}</div>
                        </td>
                        <td><span className="mrs-badge mrs-badge-success">{o.financialStatus}</span></td>
                        <td>
                          <span className={`mrs-badge ${o.fulfillmentStatus === 'FULFILLED' || o.fulfillmentStatus === 'DELIVERED' ? 'mrs-badge-success' : o.fulfillmentStatus === 'CANCELLED' ? 'mrs-badge-danger' : 'mrs-badge-warning'}`}>
                            {o.fulfillmentStatus}
                          </span>
                        </td>
                        <td><strong>{formatInr(o.totalPriceInr)}</strong></td>
                        <td>{o.paymentGateway}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <a
                              href={`${API_BASE}/api/admin/orders/${o.id}/invoice`}
                              target="_blank"
                              rel="noreferrer"
                              className="mrs-btn mrs-btn-secondary"
                              style={{ padding: '2px 8px', fontSize: 11, textDecoration: 'none' }}
                            >
                              GST Invoice
                            </a>
                            {o.fulfillmentStatus !== 'CANCELLED' && o.fulfillmentStatus !== 'DELIVERED' && (
                              <button
                                type="button"
                                className="mrs-btn mrs-btn-secondary"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => {
                                  const nextStatus =
                                    o.fulfillmentStatus === 'UNFULFILLED'
                                      ? 'CONFIRMED'
                                      : o.fulfillmentStatus === 'CONFIRMED'
                                      ? 'PROCESSING'
                                      : 'DELIVERED';
                                  handleTransitionOrder(o.id, nextStatus);
                                }}
                              >
                                Advance →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={orderPage}
                pageSize={orderPageSize}
                total={orders.length}
                onPageChange={setOrderPage}
                onPageSizeChange={setOrderPageSize}
              />
            </div>
          )}

          {/* MODULE 6: CUSTOMER MANAGEMENT */}
          {visibleModule === 'customers' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Customer Directory & High-Value Buyer Tags</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email / Phone</th>
                      <th>Location</th>
                      <th>Orders</th>
                      <th>Lifetime Spend</th>
                      <th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers
                      .slice((customerPage - 1) * customerPageSize, customerPage * customerPageSize)
                      .map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.firstName} {c.lastName}</strong></td>
                        <td>{c.email} • {c.phone}</td>
                        <td>{c.city}, {c.state}</td>
                        <td>{c.totalOrdersCount}</td>
                        <td><strong>{formatInr(c.totalSpentInr)}</strong></td>
                        <td>
                          {c.tags?.map((t: string) => (
                            <span key={t} className="mrs-badge mrs-badge-burgundy" style={{ marginRight: 4 }}>
                              {t}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={customerPage}
                pageSize={customerPageSize}
                total={customers.length}
                onPageChange={setCustomerPage}
                onPageSizeChange={setCustomerPageSize}
              />
            </div>
          )}

          {/* MODULE 14: SHIPPING MANAGEMENT (SHIPROCKET) */}
          {visibleModule === 'shipping' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <div>
                  <h2 className="mrs-card-title">Shipment Records</h2>
                  <p role="status" style={{ color: 'var(--mrs-warning)', marginTop: 6 }}>
                    New provider bookings are disabled until Shiprocket integration is approved and configured.
                  </p>
                </div>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Shiprocket Order ID</th>
                      <th>AWB Code</th>
                      <th>Courier Partner</th>
                      <th>Declared Value</th>
                      <th>Status</th>
                      <th>Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.orderNumber}</strong></td>
                        <td><code>{s.shiprocketOrderId}</code></td>
                        <td><span className="mrs-badge mrs-badge-burgundy">{s.awbCode}</span></td>
                        <td>{s.courierName}</td>
                        <td>{formatInr(s.declaredValueInr)} (Insured)</td>
                        <td><span className="mrs-badge mrs-badge-success">{s.status}</span></td>
                        <td>
                          <a href={s.labelUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--mrs-burgundy)', fontWeight: 600, marginRight: 10 }}>
                            Label PDF
                          </a>
                          <a href={s.manifestUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--mrs-burgundy)', fontWeight: 600 }}>
                            Manifest
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 15: PAYMENT MANAGEMENT */}
          {visibleModule === 'payments' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Razorpay Payment Verification & Shopify Hosted Checkout Ledger</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Razorpay Payment ID</th>
                      <th>Method</th>
                      <th>Amount (INR)</th>
                      <th>HMAC Signature</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.orderNumber}</strong></td>
                        <td><code>{p.providerPaymentId}</code></td>
                        <td>{p.method}</td>
                        <td><strong>{formatInr(p.amountInr)}</strong></td>
                        <td><span className="mrs-badge mrs-badge-success">HMAC VERIFIED</span></td>
                        <td><span className="mrs-badge mrs-badge-success">{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 11, 12, 13: DISCOUNTS, BANNERS & CONTENT */}
          {visibleModule === 'discounts' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Making-Charge Rebates & Promotional Discount Codes</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Campaign Title</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Applies To</th>
                      <th>Min Order</th>
                      <th>Redemptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((d) => (
                      <tr key={d.id}>
                        <td><span className="mrs-badge mrs-badge-burgundy">{d.code}</span></td>
                        <td><strong>{d.title}</strong></td>
                        <td>{d.discountType}</td>
                        <td><strong>{d.value}</strong></td>
                        <td>{d.appliesTo}</td>
                        <td>{formatInr(d.minOrderAmountInr)}</td>
                        <td>{d.usageCount} uses</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {visibleModule === 'banners' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Storefront Hero & Editorial Campaign Banners</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Placement</th>
                      <th>Headline</th>
                      <th>Subtitle</th>
                      <th>CTA Link</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((b) => (
                      <tr key={b.id}>
                        <td><span className="mrs-badge mrs-badge-burgundy">{b.placement}</span></td>
                        <td><strong>{b.title}</strong></td>
                        <td>{b.subtitle}</td>
                        <td><code>{b.ctaLink}</code></td>
                        <td><span className="mrs-badge mrs-badge-success">ACTIVE</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {visibleModule === 'content' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Jewellery Policies, Hallmarking Guides & Brand Story Content</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Slug</th>
                      <th>Document Title</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contents.map((c) => (
                      <tr key={c.id}>
                        <td><code>/pages/{c.slug}</code></td>
                        <td><strong>{c.title}</strong></td>
                        <td><span className="mrs-badge mrs-badge-burgundy">{c.sectionType}</span></td>
                        <td><span className="mrs-badge mrs-badge-success">PUBLISHED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 16: REPORTS & ANALYTICS */}
          {visibleModule === 'analytics' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Vault Valuation & Purity Distribution Analytics</h2>
              </div>
              <div className="mrs-kpi-grid">
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Total Catalog Valuation</div>
                  <div className="mrs-kpi-value">
                    {formatInr(
                      products.reduce(
                        (s, p) => s + Number(p.currentShopifyPriceInr || 0) * (p.inventoryQuantity || 1),
                        0
                      )
                    )}
                  </div>
                  <div className="mrs-kpi-sub">Across all active vault units</div>
                </div>
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Total Net Gold in Stock</div>
                  <div className="mrs-kpi-value">
                    {products
                      .reduce(
                        (s, p) => s + Number(p.netMetalWeightGrams || 0) * (p.inventoryQuantity || 1),
                        0
                      )
                      .toFixed(2)}
                    g
                  </div>
                  <div className="mrs-kpi-sub">BIS Hallmarked Net Weight</div>
                </div>
                <div className="mrs-card">
                  <div className="mrs-kpi-label">Immutable Pricing Snapshots</div>
                  <div className="mrs-kpi-value">{pricingSnapshots.length || products.length}</div>
                  <div className="mrs-kpi-sub">Historical audit records preserved</div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 17: ADMIN USERS & RBAC ROLES */}
          {visibleModule === 'users-roles' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Role-Based Access Control (OWNER, MANAGER, PRICING_OPERATOR)</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Role / Account</th>
                      <th>Description / Email</th>
                      <th>Role</th>
                      <th>Granted Server Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length > 0
                      ? adminUsers.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.displayName}</strong></td>
                            <td><code>{u.email}</code></td>
                            <td><span className="mrs-badge mrs-badge-burgundy">{u.role}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {(u.permissions || ROLE_PERMISSIONS[u.role as AdminRoleName] || []).map((perm: string) => (
                                  <span key={perm} className="mrs-badge mrs-badge-success">
                                    {perm}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      : (['OWNER', 'MANAGER', 'PRICING_OPERATOR'] as AdminRoleName[]).map((r) => (
                          <tr key={r}>
                            <td><strong>{r}</strong></td>
                            <td>{ROLE_DISPLAY_DESCRIPTIONS[r]}</td>
                            <td><span className="mrs-badge mrs-badge-burgundy">{r}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {ROLE_PERMISSIONS[r].map((perm) => (
                                  <span key={perm} className="mrs-badge mrs-badge-success">
                                    {perm}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 18: STORE & API SETTINGS */}
          {visibleModule === 'settings' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Storefront, Shopify GraphQL Admin API & Safety Guard Settings</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="mrs-form-row">
                  <label className="mrs-label">Shopify Store Domain</label>
                  <input className="mrs-input" value={settings.shopifyDomain || 'mangal-royal-studio.myshopify.com'} readOnly />
                </div>
                <div className="mrs-form-row">
                  <label className="mrs-label">Pinned Shopify Admin API Version</label>
                  <input className="mrs-input" value={settings.shopifyApiVersion || '2025-01'} readOnly />
                </div>
                <div className="mrs-form-row">
                  <label className="mrs-label">Default GST (%)</label>
                  <input className="mrs-input" value={settings.defaultGstPercent || '3.00'} readOnly />
                </div>
                <div className="mrs-form-row">
                  <label className="mrs-label">Live Store Writes Guard</label>
                  <input className="mrs-input" value={settings.shopifyLiveWritesEnabled ? 'ENABLED' : 'DISABLED (Safe Default)'} readOnly />
                </div>
              </div>
            </div>
          )}

          {/* MODULE 19: ACTIVITY & AUDIT LOGS */}
          {visibleModule === 'audit-logs' && (
            <div className="mrs-card">
              <div className="mrs-card-header">
                <h2 className="mrs-card-title">Immutable Security & Pricing Governance Audit Log</h2>
              </div>
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Actor</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs
                      .slice((auditLogPage - 1) * auditLogPageSize, auditLogPage * auditLogPageSize)
                      .map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                        <td><code>{log.actorEmail}</code></td>
                        <td><span className="mrs-badge mrs-badge-burgundy">{log.actorRole}</span></td>
                        <td><strong>{log.action}</strong></td>
                        <td>{log.entityType} ({log.entityId})</td>
                        <td>{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={auditLogPage}
                pageSize={auditLogPageSize}
                total={auditLogs.length}
                onPageChange={setAuditLogPage}
                onPageSizeChange={setAuditLogPageSize}
              />
            </div>
          )}

          {(visibleModule === 'customization' ||
            visibleModule === 'model-assets' ||
            visibleModule === 'customer-designs') && (
            <AdminPhase2Modules
              activeModule={visibleModule as 'customization' | 'model-assets' | 'customer-designs'}
              apiBase={API_BASE}
              adminFetch={adminFetch}
              currentUserRole={authUser.role}
              products={products}
            />
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
