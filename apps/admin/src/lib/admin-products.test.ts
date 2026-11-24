import { describe, expect, it } from 'vitest';
import { filterAdminProducts, type AdminProductFilterable } from './admin-products';

const SAMPLE_PRODUCTS: AdminProductFilterable[] = [
  {
    sku: 'MRS-RNG-1001',
    title: 'Royal Celeste 1.50 ct IGI Lab-Grown Solitaire Ring',
    category: 'Rings',
    status: 'ACTIVE',
    calculatedPriceInr: '149500.00',
    priceBreakup: { isPriceOnRequest: false },
  },
  {
    sku: 'MRS-EAR-2001',
    title: 'Lumiere 1.00 ct tw Classic Solitaire Diamond Studs',
    category: 'Earrings',
    status: 'ACTIVE',
    calculatedPriceInr: null,
    priceBreakup: { isPriceOnRequest: true },
  },
  {
    sku: 'SKUDRG00001',
    title: 'Supplier Draft Ring',
    category: 'Rings',
    status: 'DRAFT',
    calculatedPriceInr: null,
    priceBreakup: { isPriceOnRequest: true },
  },
];

describe('Admin product visibility & filtering', () => {
  it('shows all ACTIVE products by default when no status filter is selected', () => {
    const visible = filterAdminProducts(SAMPLE_PRODUCTS, {});
    expect(visible.map((p) => p.sku)).toEqual(['MRS-RNG-1001', 'MRS-EAR-2001', 'SKUDRG00001']);
  });

  it('filters by SKU and product title case-insensitively', () => {
    expect(filterAdminProducts(SAMPLE_PRODUCTS, { search: 'mrs-rng-1001' }).map((p) => p.sku)).toEqual([
      'MRS-RNG-1001',
    ]);
    expect(filterAdminProducts(SAMPLE_PRODUCTS, { search: 'celeste' }).map((p) => p.sku)).toEqual([
      'MRS-RNG-1001',
    ]);
  });

  it('filters by ACTIVE, DRAFT, and PRICE_ON_REQUEST', () => {
    expect(filterAdminProducts(SAMPLE_PRODUCTS, { status: 'ACTIVE' }).map((p) => p.sku)).toEqual([
      'MRS-RNG-1001',
      'MRS-EAR-2001',
    ]);
    expect(filterAdminProducts(SAMPLE_PRODUCTS, { status: 'DRAFT' }).map((p) => p.sku)).toEqual([
      'SKUDRG00001',
    ]);
    expect(
      filterAdminProducts(SAMPLE_PRODUCTS, { status: 'PRICE_ON_REQUEST' }).map((p) => p.sku)
    ).toEqual(['MRS-EAR-2001', 'SKUDRG00001']);
  });
});
