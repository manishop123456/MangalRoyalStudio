'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { resolveProductImageUrl } from '@mrs/shared';
import { API_ORIGIN, formatInr } from '../../lib/storefront-data';
import { useStorefront } from '../../components/StorefrontShell';

export default function CartPage() {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    discountCode,
    discountPercent,
    applyDiscountCode,
  } = useStorefront();

  const [couponInput, setCouponInput] = useState(discountCode || '');
  const [couponStatus, setCouponStatus] = useState<string>('');

  const subtotal = cart.reduce((sum, i) => sum + i.unitPriceInr * i.quantity, 0);
  const discountInr = Math.round((subtotal * discountPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountInr);
  const gstIncluded = Math.round(finalTotal - finalTotal / 1.03);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 36px) 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Your selection
        </p>
        <h1 className="mrs-section-heading-serif">SHOPPING BAG</h1>
      </div>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#FAF7F4' }}>
          <p style={{ fontSize: '16px', color: '#6B5B5B', marginBottom: '24px' }}>
            Your shopping bag is currently empty.
          </p>
          <Link
            href="/collections/all"
            style={{
              display: 'inline-block',
              padding: '14px 36px',
              background: '#7D132A',
              color: '#FFFFFF',
              fontSize: '12px',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
            }}
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '44px',
            alignItems: 'start',
          }}
        >
          <div style={{ gridColumn: 'span 1' }}>
            {cart.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr auto',
                  gap: '20px',
                  padding: '20px 0',
                  borderBottom: '1px solid #E6E0DE',
                  alignItems: 'center',
                }}
              >
                <img
                  src={resolveProductImageUrl(item.imageUrl, API_ORIGIN)}
                  alt={item.title}
                  style={{ width: '100px', height: '125px', objectFit: 'cover', background: '#F6F3F1' }}
                />
                <div>
                  <Link
                    href={`/products/${item.handle}`}
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '20px',
                      textTransform: 'uppercase',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    {item.title}
                  </Link>
                  <div style={{ fontSize: '12px', color: '#6B5B5B', marginBottom: '10px' }}>
                    SKU: {item.sku} • {item.metalPurity} • {item.metalColor} • Ring Size {item.ringSize}
                  </div>
                  {item.selectionSnapshot && item.selectionSnapshot.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {item.selectionSnapshot.map((s) => (
                        <span
                          key={s.groupCode}
                          style={{
                            fontSize: '11px',
                            background: '#FAF7F4',
                            border: '1px solid #E6E0DE',
                            padding: '2px 8px',
                            color: '#4A433E',
                          }}
                        >
                          {s.groupName}: <strong>{s.label}</strong>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, item.quantity - 1)}
                      style={{ width: '28px', height: '28px', border: '1px solid #D5CBC8', background: '#fff', cursor: 'pointer' }}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, item.quantity + 1)}
                      style={{ width: '28px', height: '28px', border: '1px solid #D5CBC8', background: '#fff', cursor: 'pointer' }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      style={{
                        marginLeft: '14px',
                        background: 'none',
                        border: 0,
                        color: '#7D132A',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>
                  {formatInr(item.unitPriceInr * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#FAF7F4',
              border: '1px solid #E6E0DE',
              padding: '28px',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                textTransform: 'uppercase',
                margin: '0 0 18px 0',
              }}
            >
              Order Summary
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>
                Promo / Privilege Code
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter privilege code"
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #D5CBC8', fontSize: '13px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const res = applyDiscountCode(couponInput);
                    setCouponStatus(res.message);
                  }}
                  style={{
                    padding: '10px 18px',
                    background: '#2D2021',
                    color: '#FFFFFF',
                    border: 0,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Apply
                </button>
              </div>
              {couponStatus && (
                <div style={{ fontSize: '12px', color: '#7D132A', marginTop: '6px' }}>
                  {couponStatus}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '10px', fontSize: '14px', borderTop: '1px solid #E6E0DE', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bag Subtotal</span>
                <span>{formatInr(subtotal)}</span>
              </div>
              {discountInr > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7D132A' }}>
                  <span>Discount ({discountCode})</span>
                  <span>−{formatInr(discountInr)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B5B5B', fontSize: '13px' }}>
                <span>Included 3% GST (HSN 7113)</span>
                <span>{formatInr(gstIncluded)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B5B5B', fontSize: '13px' }}>
                <span>Insured Vault Delivery</span>
                <span>FREE</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #E6E0DE',
                  paddingTop: '12px',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                <span>Total Payable</span>
                <span style={{ color: '#7D132A' }}>{formatInr(finalTotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              style={{
                display: 'block',
                width: '100%',
                marginTop: '22px',
                padding: '15px',
                background: '#7D132A',
                color: '#FFFFFF',
                textAlign: 'center',
                fontSize: '13px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              Proceed To Secure Checkout
            </Link>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', gap: '12px' }}>
              <Link
                href="/collections/all"
                style={{ fontSize: '12.5px', color: '#2D2021', textDecoration: 'underline' }}
              >
                ← Continue Shopping
              </Link>
              <button
                type="button"
                onClick={() => clearCart()}
                style={{
                  background: 'none',
                  border: 0,
                  color: '#7D132A',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear Bag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

