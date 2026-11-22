import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CustomerFacingError,
  friendlyApiError,
  friendlyThrown,
  hasCustomerSessionHint,
  looksInternal,
  PREVIEW_UNAVAILABLE_NOTE,
  PRICE_ON_REQUEST_LABEL,
  PRICE_ON_REQUEST_NOTE,
  QUOTE_UNAVAILABLE_NOTE,
  setCustomerSessionHint,
} from './customer-messages';

describe('Customer-facing messages never expose internal codes or server text', () => {
  const internalBodies = [
    { error: 'PRICE_ON_REQUEST', reason: 'PRICING_RULE_NOT_APPROVED', message: 'Product "X" (MRS-RNG-1001) is marked (PRICING_RULE_NOT_APPROVED)' },
    { error: 'SHOWCASE_FORBIDDEN', message: 'Endpoint disabled in read-only owner showcase.' },
    { error: 'INTERNAL_SERVER_ERROR', message: 'PrismaClientKnownRequestError at /srv/app/node_modules/x.js:12' },
    { error: 'SOME_NEW_UNKNOWN_CODE', message: 'Raw backend detail DATABASE_URL=postgres://…' },
    null,
    '<html>403 Forbidden</html>',
  ];

  it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])('status %i: never echoes server text or codes', (status) => {
    for (const body of internalBodies) {
      const msg = friendlyApiError(status, body, 'Something went wrong. Please try again.');
      expect(msg).not.toContain('MRS-RNG-1001');
      expect(msg).not.toMatch(/Prisma|node_modules|DATABASE_URL|\/srv\//);
      expect(looksInternal(msg), msg).toBe(false);
    }
  });

  it('maps known codes to fixed friendly sentences', () => {
    expect(friendlyApiError(422, { error: 'PRICE_ON_REQUEST' }, 'x')).toMatch(/priced on request/i);
    expect(friendlyApiError(403, { error: 'SHOWCASE_FORBIDDEN' }, 'x')).toBe(PREVIEW_UNAVAILABLE_NOTE);
    expect(friendlyApiError(400, { error: 'INSUFFICIENT_STOCK' }, 'x')).toMatch(/not available/i);
    expect(friendlyApiError(400, { error: 'SOME_NEW_UNKNOWN_CODE' }, 'Fallback text.')).toBe('Fallback text.');
  });

  it('only storefront-created errors are shown; any other thrown text falls back', () => {
    expect(friendlyThrown(new CustomerFacingError('Please sign in to continue.'), 'fb')).toBe('Please sign in to continue.');
    expect(friendlyThrown(new Error('TypeError: x is undefined at app.js:3'), 'fb')).toBe('fb');
    expect(friendlyThrown('PRICING_RULE_NOT_APPROVED', 'fb')).toBe('fb');
  });

  it('fixed customer wording is itself free of internal tokens', () => {
    for (const t of [PRICE_ON_REQUEST_LABEL, PRICE_ON_REQUEST_NOTE, QUOTE_UNAVAILABLE_NOTE, PREVIEW_UNAVAILABLE_NOTE]) {
      expect(looksInternal(t), t).toBe(false);
    }
    expect(looksInternal('Price on request (PRICING_RULE_NOT_APPROVED)')).toBe(true);
    expect(looksInternal('(Owner-Approved Fixed Override Price)')).toBe(true);
  });
});

describe('Customer session hint (no session request for anonymous visitors)', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
      clear: () => void (store = {}),
      key: () => null,
      length: 0,
    } as Storage;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('is absent for a fresh visitor, set on sign-in, cleared on sign-out', () => {
    expect(hasCustomerSessionHint()).toBe(false);
    setCustomerSessionHint(true);
    expect(hasCustomerSessionHint()).toBe(true);
    setCustomerSessionHint(false);
    expect(hasCustomerSessionHint()).toBe(false);
  });

  it('treats unavailable storage as signed out (never throws)', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(hasCustomerSessionHint()).toBe(false);
    expect(() => setCustomerSessionHint(true)).not.toThrow();
  });
});
