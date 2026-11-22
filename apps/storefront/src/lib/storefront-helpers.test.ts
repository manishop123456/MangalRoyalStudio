import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPortFree, startIsolatedApi, type IsolatedApi } from '../test-support/isolated-api';
import { STOREFRONT_PRODUCTS } from './storefront-data';
import {
  addItemToCart,
  buildCartItemId,
  filterAndSortProducts,
  paginateItems,
  parseStoredCart,
  toggleWishlistHandle,
  updateCartItemQuantity,
  validateCheckoutInput,
  type StorefrontCartItem,
} from './storefront-helpers';

describe('Storefront Cart, Catalogue, Wishlist & Checkout Helpers', () => {
  const sampleRing = STOREFRONT_PRODUCTS[0]!;
  const sampleStuds = STOREFRONT_PRODUCTS[1]!;

  it('adds standard products and merges identical configurations', () => {
    let cart: StorefrontCartItem[] = [];
    cart = addItemToCart(cart, sampleRing, { quantity: 1 });
    cart = addItemToCart(cart, sampleRing, { quantity: 2 });
    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(3);
  });

  it('keeps customized items with different configurations as distinct cart lines', () => {
    let cart: StorefrontCartItem[] = [];
    cart = addItemToCart(cart, sampleRing, {
      quantity: 1,
      unitPriceInr: 72000,
      selections: { metal: '18K_YELLOW', engraving: 'A&R' },
    });
    cart = addItemToCart(cart, sampleRing, {
      quantity: 1,
      unitPriceInr: 74500,
      selections: { metal: '18K_ROSE', engraving: 'M&K' },
    });
    expect(cart).toHaveLength(2);
    expect(cart[0]?.id).not.toBe(cart[1]?.id);
  });

  it('updates item quantities, removes on zero, and parses stored cart safely', () => {
    let cart = addItemToCart([], sampleRing, { quantity: 2 });
    const id = buildCartItemId({
      sku: sampleRing.sku,
      metalPurity: sampleRing.metalPurity,
      metalColor: sampleRing.metalColor.replace('_', ' '),
      ringSize: sampleRing.ringSize || '12',
    });

    cart = updateCartItemQuantity(cart, id, 4);
    expect(cart[0]?.quantity).toBe(4);

    const serialized = JSON.stringify(cart);
    expect(parseStoredCart(serialized)).toHaveLength(1);
    expect(parseStoredCart('{invalid-json')).toEqual([]);
    expect(parseStoredCart(JSON.stringify([{ bad: true }]))).toEqual([]);

    cart = updateCartItemQuantity(cart, id, 0);
    expect(cart).toHaveLength(0);
  });

  it('filters collections, searches by SKU/title, sorts, and paginates', () => {
    const rings = filterAndSortProducts(STOREFRONT_PRODUCTS, {
      collectionHandle: 'rings',
    });
    expect(rings.length).toBeGreaterThan(0);
    expect(rings.every((p) => p.category.toLowerCase() === 'rings')).toBe(true);

    const search = filterAndSortProducts(STOREFRONT_PRODUCTS, {
      searchQuery: sampleStuds.sku,
    });
    expect(search).toHaveLength(1);
    expect(search[0]?.sku).toBe(sampleStuds.sku);

    const unknown = filterAndSortProducts(STOREFRONT_PRODUCTS, {
      searchQuery: 'NON-EXISTENT-JEWELLERY-XYZ',
    });
    expect(unknown).toHaveLength(0);

    const sorted = filterAndSortProducts(STOREFRONT_PRODUCTS, {
      sortBy: 'price-asc',
    });
    for (let i = 1; i < sorted.length; i++) {
      expect(Number(sorted[i]!.currentShopifyPriceInr)).toBeGreaterThanOrEqual(
        Number(sorted[i - 1]!.currentShopifyPriceInr)
      );
    }

    const page1 = paginateItems(STOREFRONT_PRODUCTS, 1, 4);
    const page2 = paginateItems(STOREFRONT_PRODUCTS, 2, 4);
    expect(page1.items).toHaveLength(4);
    expect(page2.items).toHaveLength(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.items[0]?.sku).not.toBe(page2.items[0]?.sku);
  });

  it('toggles wishlist handles without duplicates', () => {
    let list = toggleWishlistHandle([], sampleRing.handle);
    expect(list).toEqual([sampleRing.handle]);
    list = toggleWishlistHandle(list, sampleStuds.handle);
    expect(list).toEqual([sampleRing.handle, sampleStuds.handle]);
    list = toggleWishlistHandle(list, sampleRing.handle);
    expect(list).toEqual([sampleStuds.handle]);
  });

  it('validates checkout contact and Indian PIN code fields', () => {
    expect(
      validateCheckoutInput({
        fullName: 'Aarav Mehta',
        email: 'bad-email',
        phone: '9876543210',
        line1: '12 Pedder Road',
        city: 'Mumbai',
        stateName: 'Maharashtra',
        pincode: '400026',
        itemCount: 1,
      }).ok
    ).toBe(false);

    expect(
      validateCheckoutInput({
        fullName: 'Aarav Mehta',
        email: 'aarav@example.com',
        phone: '9876543210',
        line1: '12 Pedder Road',
        city: 'Mumbai',
        stateName: 'Maharashtra',
        pincode: '4000',
        itemCount: 1,
      }).ok
    ).toBe(false);

    expect(
      validateCheckoutInput({
        fullName: 'Aarav Mehta',
        email: 'aarav@example.com',
        phone: '+91 9876543210',
        line1: '12 Pedder Road',
        city: 'Mumbai',
        stateName: 'Maharashtra',
        pincode: '400026',
        itemCount: 1,
      }).ok
    ).toBe(true);
  });
});

describe('Storefront Live API Integration (dedicated isolated test API)', () => {
  // A dedicated API process on a fresh free port with throwaway JSON data. Never port 4000's process,
  // never an env-provided URL, never a silent skip: if the server cannot start, the test fails.
  let api: IsolatedApi;
  beforeAll(async () => {
    api = await startIsolatedApi();
  }, 90_000);
  afterAll(async () => {
    await api?.stop();
  });

  it('fetches 8 baseline products, validates customization quotes, and enforces 401 on protected routes', async () => {
    const apiBase = api.apiBase;
    const prodRes = await fetch(`${apiBase}/products`);
    expect(prodRes.status).toBe(200);
    const prodData = await prodRes.json();
    expect(prodData.products).toHaveLength(8);
    const ear2001 = prodData.products.find((p: any) => p.sku === 'MRS-EAR-2001');
    expect(ear2001?.inventoryQuantity).toBe(9);

    const custRes = await fetch(`${apiBase}/public/products/MRS-RNG-1001/customization`);
    expect(custRes.status).toBe(200);

    const badQuoteRes = await fetch(`${apiBase}/public/customization/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'MRS-RNG-1001',
        selections: { INVALID_GROUP: 'INVALID_OPTION' },
        quantity: 1,
      }),
    });
    expect(badQuoteRes.status).toBe(400);

    const unauthOrders = await fetch(`${apiBase}/customer/orders`);
    expect(unauthOrders.status).toBe(401);

    const unauthDesigns = await fetch(`${apiBase}/customer/designs`);
    expect(unauthDesigns.status).toBe(401);
  });

  it('runs on its own port, not on port 4000', () => {
    expect(api.port).not.toBe(4000);
    expect(api.baseUrl.startsWith('http://127.0.0.1:')).toBe(true);
  });
});

describe('Isolated test API harness (regression: never reuse a pre-existing process)', () => {
  it('refuses an occupied port instead of using whatever is listening there', async () => {
    const squatter = net.createServer((sock) => sock.end('not-mrs'));
    await new Promise<void>((r) => squatter.listen(0, '127.0.0.1', () => r()));
    const port = (squatter.address() as net.AddressInfo).port;
    try {
      await expect(startIsolatedApi({ port })).rejects.toThrow(/PORT_IN_USE/);
      // The pre-existing process is left untouched and still listening.
      expect(squatter.listening).toBe(true);
    } finally {
      await new Promise<void>((r) => squatter.close(() => r()));
    }
  });

  it('stops only the process it started and frees its port', async () => {
    const own = await startIsolatedApi();
    const pid = own.pid;
    await own.stop();
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    expect(alive).toBe(false);
    expect(await isPortFree(own.port)).toBe(true);
  }, 90_000);
});
