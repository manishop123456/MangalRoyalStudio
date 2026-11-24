'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  resolveProductImageUrl,
  type CustomizationQuoteBreakdownLine,
  type CustomizationSelectionSnapshotItem,
  type JewelleryProductSpec,
} from '@mrs/shared';
import {
  API_BASE_URL,
  API_ORIGIN,
  formatInr,
  PRODUCT_IMAGE_PLACEHOLDER,
  THEME_IMAGES,
  setStorefrontCsrfToken,
  storefrontFetch,
} from '../lib/storefront-data';
import { hasCustomerSessionHint, setCustomerSessionHint } from '../lib/customer-messages';
import {
  addItemToCart,
  parseStoredCart,
  toggleWishlistHandle,
  updateCartItemQuantity,
} from '../lib/storefront-helpers';

export interface CartItem {
  id: string;
  sku: string;
  handle: string;
  title: string;
  imageUrl: string;
  quantity: number;
  unitPriceInr: number;
  metalPurity: string;
  metalColor: string;
  ringSize: string;
  selections?: Record<string, string>;
  selectionSnapshot?: CustomizationSelectionSnapshotItem[];
  breakdownLines?: CustomizationQuoteBreakdownLine[];
  customerDesignId?: string;
}

export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
}

interface StorefrontContextValue {
  products: JewelleryProductSpec[];
  productsLoading: boolean;
  productsError: string | null;
  reloadProducts: () => void;
  cart: CartItem[];
  wishlistHandles: string[];
  discountCode: string;
  discountPercent: number;
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (
    product: JewelleryProductSpec,
    options?: {
      quantity?: number;
      metalPurity?: string;
      metalColor?: string;
      ringSize?: string;
      unitPriceInr?: number;
      openDrawer?: boolean;
      selections?: Record<string, string>;
      selectionSnapshot?: CustomizationSelectionSnapshotItem[];
      breakdownLines?: CustomizationQuoteBreakdownLine[];
      customerDesignId?: string;
    }
  ) => void;
  updateCartQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  applyDiscountCode: (code: string) => { ok: boolean; message: string };
  toggleWishlist: (handle: string) => void;
  customer: CustomerProfile | null;
  customerToken: string | null;
  setCustomer: (customer: CustomerProfile | null, token?: string | null) => void;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error('useStorefront must be used inside StorefrontShell');
  }
  return ctx;
}

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [products, setProducts] = useState<JewelleryProductSpec[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlistHandles, setWishlistHandles] = useState<string[]>([]);
  const [discountCode, setDiscountCode] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isCartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomerState] = useState<CustomerProfile | null>(null);
  const [customerToken, setCustomerTokenState] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    setProductsLoading(true);
    setProductsError(null);
    fetch(`${API_BASE_URL}/products`)
      .then((r) => {
        if (!r.ok) throw new Error(`Catalog API returned HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.products)) {
          const loadedProducts: JewelleryProductSpec[] = data.products;
          setProducts(loadedProducts);
          setCart((prevCart) => {
            if (prevCart.length === 0) return prevCart;
            const nextCart = prevCart
              .map((item) => {
                if (item.selections && Object.keys(item.selections).length > 0) {
                  return item;
                }
                const matched = loadedProducts.find((p) => p.sku === item.sku);
                if (!matched) return item;
                if (matched.priceOnRequest || matched.priceBreakup?.priceOnRequest) {
                  return null;
                }
                const serverUnitPrice = Number(
                  matched.priceBreakup?.finalProposedPriceInr ||
                    matched.effectivePriceInr ||
                    matched.currentShopifyPriceInr
                );
                return {
                  ...item,
                  unitPriceInr: serverUnitPrice,
                };
              })
              .filter((x): x is CartItem => x !== null);
            try {
              localStorage.setItem('mrs_cart_v1', JSON.stringify(nextCart));
            } catch {
              // Ignore
            }
            return nextCart;
          });
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        void err;
        setProductsError('Our catalogue is temporarily unavailable. Please try again in a moment.');
      })
      .finally(() => {
        setProductsLoading(false);
      });
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('mrs_cart_v1');
      if (savedCart) setCart(parseStoredCart(savedCart));
      const savedWish = localStorage.getItem('mangal-wishlist');
      if (savedWish) {
        const parsedWish = JSON.parse(savedWish);
        if (Array.isArray(parsedWish)) {
          setWishlistHandles(parsedWish.filter((x): x is string => typeof x === 'string'));
        }
      }
      // Purge any JWT/profile left by the previous sessionStorage implementation.
      sessionStorage.removeItem('mrs_customer_token_v1');
      sessionStorage.removeItem('mrs_customer_v1');
      localStorage.removeItem('mrs_customer_v1');
    } catch {
      // Ignore storage errors
    }

    // Resume an existing HttpOnly-cookie customer session, but only for browsers that signed in here.
    // Anonymous visitors (including every read-only showcase visitor) make no session request, so a
    // blocked or absent session endpoint never produces a failed request / console error.
    if (hasCustomerSessionHint()) {
      storefrontFetch(`${API_BASE_URL}/auth/customer/me`)
        .then(async (response) => {
          if (!response.ok) throw new Error('No customer session.');
          const data = await response.json();
          if (typeof data.csrfToken !== 'string') throw new Error('No CSRF token.');
          setStorefrontCsrfToken(data.csrfToken);
          setCustomerState(data.customer);
          setCustomerTokenState(data.csrfToken);
        })
        .catch(() => {
          setCustomerSessionHint(false);
          setStorefrontCsrfToken(null);
          setCustomerState(null);
          setCustomerTokenState(null);
        });
    }

    loadProducts();
  }, [loadProducts]);

  const persistCart = (next: CartItem[]) => {
    setCart(next);
    try {
      localStorage.setItem('mrs_cart_v1', JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const setCustomer = useCallback((next: CustomerProfile | null, token?: string | null) => {
    if (next && !token && !customerToken) return;
    // `token` is the in-memory session-bound CSRF token (the real session is an HttpOnly cookie).
    if (!next) {
      setCustomerSessionHint(false);
      void storefrontFetch(`${API_BASE_URL}/auth/customer/logout`, { method: 'POST' }).catch(() => undefined);
      setStorefrontCsrfToken(null);
    } else if (token) {
      setCustomerSessionHint(true);
      setStorefrontCsrfToken(token);
    }
    setCustomerState(next);
    setCustomerTokenState(next ? token ?? customerToken : null);
  }, [customerToken]);

  const addToCart: StorefrontContextValue['addToCart'] = (product, options) => {
    const next = addItemToCart(cart, product, {
      ...options,
      fallbackImageUrl: PRODUCT_IMAGE_PLACEHOLDER,
    });
    persistCart(next);
    if (options?.openDrawer !== false) {
      setCartDrawerOpen(true);
    }
  };

  const updateCartQty = (id: string, qty: number) => {
    persistCart(updateCartItemQuantity(cart, id, qty));
  };

  const removeFromCart = (id: string) => {
    persistCart(cart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    persistCart([]);
    setDiscountCode('');
    setDiscountPercent(0);
  };

  const applyDiscountCode = (rawCode: string): { ok: boolean; message: string } => {
    const code = rawCode.trim().toUpperCase();
    if (code === 'ENGAGEMENT10') {
      setDiscountCode('ENGAGEMENT10');
      setDiscountPercent(10);
      return { ok: true, message: '10% Engagement Ring Promo applied!' };
    }
    if (code === 'ROYALMAKING0') {
      setDiscountCode('ROYALMAKING0');
      setDiscountPercent(5);
      return { ok: true, message: 'Festive Making Charge Waiver applied!' };
    }
    return {
      ok: false,
      message: 'Invalid coupon code. Try ENGAGEMENT10 or ROYALMAKING0.',
    };
  };

  const toggleWishlist = (handle: string) => {
    const exists = wishlistHandles.includes(handle);
    const next = exists
      ? wishlistHandles.filter((h) => h !== handle)
      : [...wishlistHandles, handle];
    setWishlistHandles(next);
    try {
      localStorage.setItem('mangal-wishlist', JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const totalCartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalInr = cart.reduce((sum, i) => sum + i.unitPriceInr * i.quantity, 0);
  const discountInr = Math.round((subtotalInr * discountPercent) / 100);
  const finalTotalInr = Math.max(0, subtotalInr - discountInr);

  const navLinks = [
    { label: 'ALL JEWELLERY', href: '/collections/all' },
    { label: 'CATEGORIES', href: '/collections' },
    { label: 'SHAPES', href: '/collections/all?shape=ROUND' },
    { label: 'CUSTOMIZE', href: '/customize/MRS-RNG-1001' },
    { label: 'BOOK A VIEWING', href: '/pages/contact#appointment' },
    { label: 'ABOUT US', href: '/pages/about-us' },
  ];

  const confirmedEngagementOfferPercent =
    process.env.NEXT_PUBLIC_ENGAGEMENT_OFFER_PERCENT?.trim() || '';

  return (
    <StorefrontContext.Provider
      value={{
        products,
        productsLoading,
        productsError,
        reloadProducts: loadProducts,
        cart,
        wishlistHandles,
        discountCode,
        discountPercent,
        isCartDrawerOpen,
        setCartDrawerOpen,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        applyDiscountCode,
        toggleWishlist,
        customer,
        customerToken,
        setCustomer,
      }}
    >
      {/* 1. ANNOUNCEMENT BAR / OFFER STRIP (configurable; hides unconfirmed discount %) */}
      {confirmedEngagementOfferPercent ? (
        <div className="mrs-announcement-bar" role="region" aria-label="Announcement">
          <span>Get {confirmedEngagementOfferPercent}% OFF on Engagement Rings</span>
        </div>
      ) : null}

      {/* 2. STICKY HEADER (sections/header.liquid) */}
      <header className="mrs-header-wrapper">
        <div className="mrs-header">
          <div className="mrs-header__left">
            <button
              type="button"
              className="mrs-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/" className="mrs-header__logo" aria-label="Mangal Royal Studio Home">
              <img src={THEME_IMAGES.headerLogo} alt="Mangal Royal Studio" />
            </Link>
          </div>

          <nav aria-label="Main Navigation">
            <ul className="mrs-nav-list">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`mrs-nav-link ${pathname === item.href ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mrs-header__icons">
            <button
              type="button"
              className="mrs-icon-trigger"
              onClick={() => setSearchModalOpen(true)}
              aria-label="Search jewellery"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>

            <Link href="/pages/wishlist" className="mrs-icon-trigger" aria-label="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 20.6 4.3 13a4.7 4.7 0 0 1 0-6.7 4.7 4.7 0 0 1 6.7 0l1 1 1-1a4.7 4.7 0 0 1 6.7 0 4.7 4.7 0 0 1 0 6.7Z" />
              </svg>
              {wishlistHandles.length > 0 && (
                <span className="mrs-icon-badge">{wishlistHandles.length}</span>
              )}
            </Link>

            <Link
              href={customer ? '/account' : '/account/login'}
              className="mrs-icon-trigger"
              aria-label="Account"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1.8-3.8 5-6 8-6s6.2 2.2 8 6" />
              </svg>
            </Link>

            <button
              type="button"
              className="mrs-icon-trigger"
              onClick={() => setCartDrawerOpen(true)}
              aria-label="Shopping bag"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 7h12l1 13H5L6 7Z" />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              {totalCartCount > 0 && (
                <span className="mrs-icon-badge">{totalCartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* SEARCH MODAL */}
      {isSearchModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            backgroundColor: 'rgba(25, 3, 3, 0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '80px',
          }}
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              width: '100%',
              maxWidth: '680px',
              padding: '28px 32px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchModalOpen(false);
                router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
              }}
              style={{ display: 'flex', gap: '12px' }}
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Solitaire Rings, Earrings, Tennis Bracelets, SKU..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid #D5CBC8',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#7D132A',
                  color: '#FFFFFF',
                  border: 0,
                  padding: '0 24px',
                  fontSize: '12px',
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Search
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE NAVIGATION DRAWER */}
      {isMobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 85,
            backgroundColor: 'rgba(25, 3, 3, 0.5)',
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              width: '88vw',
              maxWidth: '360px',
              height: '100%',
              background: '#FFFFFF',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '18px',
                  borderBottom: '1px solid #EEEEEE',
                }}
              >
                <img src={THEME_IMAGES.headerLogo} alt="Mangal Royal Studio" style={{ width: '110px' }} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: 'none', border: 0, fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0' }}>
                {navLinks.map((item) => (
                  <li key={item.href} style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: '14px 0',
                        fontSize: '14px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li style={{ borderBottom: '1px solid #F2ECE9' }}>
                  <Link
                    href="/pages/order-tracking"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'block',
                      padding: '14px 0',
                      fontSize: '14px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Track Order
                  </Link>
                </li>
              </ul>
            </div>

            <div style={{ borderTop: '1px solid #EEEEEE', paddingTop: '16px' }}>
              <Link
                href={customer ? '/account' : '/account/login'}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  textAlign: 'center',
                  background: '#7D132A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                }}
              >
                {customer ? `My Account (${customer.firstName})` : 'Sign In / Create Account'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OUT CART DRAWER (snippets/cart-drawer.liquid) */}
      {isCartDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            backgroundColor: 'rgba(25, 3, 3, 0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setCartDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              height: '100%',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #E6E0DE',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '24px',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  Your Bag ({totalCartCount})
                </h2>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  style={{ background: 'none', border: 0, fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 16px' }}>
                  <p style={{ color: '#6B5B5B', marginBottom: '24px' }}>
                    Your Mangal Royal Studio jewellery bag is currently empty.
                  </p>
                  <Link
                    href="/collections/all"
                    onClick={() => setCartDrawerOpen(false)}
                    style={{
                      display: 'inline-block',
                      padding: '12px 28px',
                      background: '#7D132A',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Explore Jewellery
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '18px' }}>
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '76px 1fr',
                        gap: '14px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid #F2ECE9',
                      }}
                    >
                      <img
                        src={resolveProductImageUrl(item.imageUrl, API_ORIGIN)}
                        alt={item.title}
                        style={{
                          width: '76px',
                          height: '96px',
                          objectFit: 'cover',
                          background: '#F6F3F1',
                        }}
                      />
                      <div>
                        <Link
                          href={`/products/${item.handle}`}
                          onClick={() => setCartDrawerOpen(false)}
                          style={{
                            fontSize: '12px',
                            letterSpacing: '0.8px',
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          {item.title}
                        </Link>
                        <div style={{ fontSize: '11px', color: '#6B5B5B', marginBottom: '6px' }}>
                          {item.metalPurity} • {item.metalColor} • Size {item.ringSize}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                          {formatInr(item.unitPriceInr * item.quantity)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.quantity - 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              border: '1px solid #D5CBC8',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <span style={{ fontSize: '12px' }}>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, item.quantity + 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              border: '1px solid #D5CBC8',
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            style={{
                              marginLeft: 'auto',
                              background: 'none',
                              border: 0,
                              fontSize: '11px',
                              color: '#7D132A',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid #E6E0DE', paddingTop: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    fontSize: '13px',
                  }}
                >
                  <span>Subtotal (Incl. 3% GST)</span>
                  <strong>{formatInr(finalTotalInr)}</strong>
                </div>
                <p style={{ fontSize: '11px', color: '#6B5B5B', margin: '0 0 14px 0' }}>
                  Complimentary Insured Pan-India Delivery & IGI Authenticity Certificate included.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Link
                    href="/cart"
                    onClick={() => setCartDrawerOpen(false)}
                    style={{
                      padding: '12px',
                      border: '1px solid #7D132A',
                      color: '#7D132A',
                      textAlign: 'center',
                      fontSize: '12px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    }}
                  >
                    View Bag
                  </Link>
                  <Link
                    href="/checkout"
                    onClick={() => setCartDrawerOpen(false)}
                    style={{
                      padding: '12px',
                      background: '#7D132A',
                      color: '#FFFFFF',
                      textAlign: 'center',
                      fontSize: '12px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Checkout
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN PAGE CONTENT */}
      <main id="MainContent">{children}</main>

      {/* 13. CUSTOM FOOTER (#MRSFooter — matching ABOUT US.pdf source of truth) */}
      <footer id="MRSFooter" className="mrs-footer">
        <div className="mrs-footer__inner">
          <div
            style={{
              textAlign: 'center',
              paddingBottom: '44px',
              marginBottom: '44px',
              borderBottom: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 400,
                margin: '0 0 20px 0',
                color: '#FFFFFF',
              }}
            >
              Join the mailing list
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              style={{
                display: 'flex',
                maxWidth: '520px',
                margin: '0 auto',
                border: '1px solid rgba(255,255,255,0.45)',
              }}
            >
              <input
                type="email"
                placeholder="E-mail"
                aria-label="E-mail"
                style={{
                  flex: 1,
                  padding: '13px 16px',
                  background: 'transparent',
                  border: 0,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '13px 28px',
                  background: '#F8E1CF',
                  color: '#7D132A',
                  border: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                SUBSCRIBE
              </button>
            </form>
          </div>

          <div className="mrs-footer__grid">
            <div>
              <img
                src={THEME_IMAGES.footerLogo}
                alt="Mangal Royal Studio"
                style={{ width: '150px', marginBottom: '16px', display: 'block' }}
              />
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.88)', margin: '0 0 12px 0' }}>
                Designed for every day. Treasured for a lifetime. A unit of Mangal Royal Jewels Pvt Ltd — since 1975.
              </p>
            </div>

            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/collections/all">Shop</Link></li>
                <li><Link href="/pages/about-us">About Us</Link></li>
                <li><Link href="/pages/contact">Contact</Link></li>
              </ul>
            </div>

            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                <li><Link href="/collections/rings">Rings</Link></li>
                <li><Link href="/collections/earrings">Earrings</Link></li>
                <li><Link href="/collections/bracelets">Bracelets</Link></li>
                <li><Link href="/collections/necklaces">Necklaces</Link></li>
                <li><Link href="/collections/pendants">Pendants</Link></li>
                <li><Link href="/collections/antique">Bridal Sets</Link></li>
                <li><Link href="/collections/bangles">Bangles</Link></li>
              </ul>
            </div>

            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                <li><Link href="/pages/privacy-policy">Privacy Policy</Link></li>
                <li><Link href="/pages/terms-of-service">Terms of Service</Link></li>
                <li><Link href="/pages/return-policy">Return Policy</Link></li>
              </ul>
            </div>

            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                <li>
                  <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div
            style={{
              paddingTop: '22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            <span>© 2026, All rights reserved by Mangal Royal Studio | Developed by Fireflyz Tech</span>
            <span>IGI Certified Lab-Grown Diamonds • BIS Hallmarked Gold</span>
          </div>
        </div>
      </footer>
    </StorefrontContext.Provider>
  );
}

