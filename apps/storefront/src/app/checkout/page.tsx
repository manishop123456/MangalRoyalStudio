'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, formatInr, storefrontFetch } from '../../lib/storefront-data';
import { validateCheckoutInput } from '../../lib/storefront-helpers';
import { useStorefront } from '../../components/StorefrontShell';
import { friendlyApiError } from '../../lib/customer-messages';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, handler: (response: { error?: { description?: string; reason?: string } }) => void) => void;
    };
  }
}

type CheckoutPaymentState =
  | 'PREPARING'
  | 'OPENING_CHECKOUT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'PENDING_VERIFICATION';

async function loadRazorpayCheckout(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const { cart, discountCode, discountPercent, clearCart, customer } = useStorefront();

  const [fullName, setFullName] = useState(customer ? `${customer.firstName} ${customer.lastName}` : '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState(customer?.city || '');
  const [stateName, setStateName] = useState(customer?.state || '');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD_STUDIO_PICKUP'>('RAZORPAY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    orderNumber: string;
    totalPriceInr: string;
    placedAt: string;
    paymentMethod: 'RAZORPAY' | 'COD_STUDIO_PICKUP';
    orderAccessToken?: string;
    razorpayOrder: { id: string; amountPaise: number; currency: string; keyId: string } | null;
  } | null>(null);
  const [paymentState, setPaymentState] = useState<CheckoutPaymentState>('PENDING_VERIFICATION');
  const [idempotencyKey] = useState<string | undefined>(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined
  );

  const subtotal = cart.reduce((sum, i) => sum + i.unitPriceInr * i.quantity, 0);
  const discountInr = Math.round((subtotal * discountPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountInr);

  const openRazorpay = async (order: NonNullable<typeof createdOrder>) => {
    if (!order.razorpayOrder) {
      setPaymentState('PENDING_VERIFICATION');
      setErrorMessage('Online payment is unavailable for this order. Its payment remains pending.');
      return;
    }
    setPaymentState('OPENING_CHECKOUT');
    setErrorMessage('');
    const loaded = await loadRazorpayCheckout();
    if (!loaded || !window.Razorpay) {
      setPaymentState('FAILED');
      setErrorMessage('Razorpay Checkout could not be loaded. Your order remains pending; retry payment when available.');
      return;
    }
    const checkout = new window.Razorpay({
      key: order.razorpayOrder.keyId,
      order_id: order.razorpayOrder.id,
      amount: order.razorpayOrder.amountPaise,
      currency: order.razorpayOrder.currency,
      name: 'Mangal Royal Studio',
      description: `Order ${order.orderNumber}`,
      notes: {
        internal_order_id: order.id,
        order_number: order.orderNumber,
      },
      prefill: { name: fullName, email, contact: phone },
      handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setPaymentState('PROCESSING');
        try {
          const verifyRes = await storefrontFetch(`${API_BASE_URL}/payments/razorpay/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(order.orderAccessToken ? { 'x-order-access-token': order.orderAccessToken } : {}),
            },
            body: JSON.stringify({
              orderId: order.id,
              razorpayOrderId: result.razorpay_order_id,
              razorpayPaymentId: result.razorpay_payment_id,
              razorpaySignature: result.razorpay_signature,
              orderAccessToken: order.orderAccessToken,
            }),
          });
          const verified = await verifyRes.json();
          if (!verifyRes.ok || verified.verified !== true) {
            setPaymentState(verifyRes.status === 409 && verified.error === 'PAYMENT_NOT_CAPTURED' ? 'PENDING_VERIFICATION' : 'FAILED');
            setErrorMessage(verified.message || 'Payment could not be verified. The order remains pending.');
            return;
          }
          setPaymentState('SUCCESS');
          clearCart();
          setErrorMessage('');
        } catch {
          setPaymentState('PENDING_VERIFICATION');
          setErrorMessage('Payment status could not be confirmed yet. The order remains pending verification.');
        }
      },
      modal: {
        ondismiss: () => {
          setPaymentState((prev) => (prev === 'SUCCESS' || prev === 'PROCESSING' ? prev : 'CANCELLED'));
        },
      },
    });
    if (typeof checkout.on === 'function') {
      checkout.on('payment.failed', (resp) => {
        setPaymentState('FAILED');
        setErrorMessage(
          resp?.error?.description || 'Payment failed in Razorpay Checkout. Your order remains pending and you can retry.'
        );
      });
    }
    checkout.open();
  };

  const handleRetryPayment = async () => {
    if (!createdOrder) return;
    setPaymentState('PREPARING');
    setErrorMessage('');
    try {
      const retryRes = await storefrontFetch(
        `${API_BASE_URL}/checkout/orders/${encodeURIComponent(createdOrder.id)}/razorpay-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(createdOrder.orderAccessToken
              ? { 'x-order-access-token': createdOrder.orderAccessToken }
              : {}),
          },
          body: JSON.stringify({ orderAccessToken: createdOrder.orderAccessToken }),
        }
      );
      const retryData = await retryRes.json();
      if (!retryRes.ok || !retryData.razorpayOrder) {
        setPaymentState('FAILED');
        setErrorMessage(retryData.message || 'Unable to start a new payment attempt. Please try again.');
        return;
      }
      const refreshedOrder = {
        ...createdOrder,
        razorpayOrder: retryData.razorpayOrder,
      };
      setCreatedOrder(refreshedOrder);
      await openRazorpay(refreshedOrder);
    } catch {
      setPaymentState('FAILED');
      setErrorMessage('Unable to reach payment service for retry. Your order remains pending.');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validation = validateCheckoutInput({
      fullName,
      email,
      phone,
      line1,
      city,
      stateName,
      pincode,
      itemCount: cart.length,
    });
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Revalidate live product availability against backend before order creation
      const catalogRes = await fetch(`${API_BASE_URL}/products`);
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json().catch(() => null);
        const liveProducts = Array.isArray(catalogData?.products) ? catalogData.products : [];
        for (const item of cart) {
          const match = liveProducts.find((p: any) => p.sku === item.sku);
          if (!match) {
            setErrorMessage(`${item.title} (${item.sku}) is no longer available.`);
            return;
          }
          if (typeof match.inventoryQuantity === 'number' && match.inventoryQuantity < item.quantity) {
            setErrorMessage(
              `Insufficient stock for ${item.title}: requested ${item.quantity}, available ${match.inventoryQuantity}.`
            );
            return;
          }
          if (item.selections && Object.keys(item.selections).length > 0) {
            const quoteRes = await fetch(`${API_BASE_URL}/public/customization/quote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku: item.sku,
                selections: item.selections,
                quantity: item.quantity,
              }),
            });
            if (!quoteRes.ok) {
              const qErr = await quoteRes.json().catch(() => ({}));
              setErrorMessage(
                friendlyApiError(quoteRes.status, qErr, `The custom options for ${item.title} could not be confirmed. Please contact our studio.`)
              );
              return;
            }
          }
        }
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const createRes = await storefrontFetch(`${API_BASE_URL}/checkout/create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerEmail: email,
          customerName: fullName,
          customerPhone: phone,
          shippingAddress: {
            line1,
            city,
            state: stateName,
            pincode,
          },
          items: cart.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            metalPurity: i.metalPurity,
            metalColor: i.metalColor,
            ringSize: i.ringSize,
            selections: i.selections,
            customerDesignId: i.customerDesignId,
          })),
          discountCode: discountCode || undefined,
          paymentMethod,
          idempotencyKey,
        }),
      });

      const data = await createRes.json();
      if (!createRes.ok || !data.order?.id || !['PENDING', 'PAID'].includes(data.paymentStatus)) {
        setErrorMessage(friendlyApiError(createRes.status, data, 'We could not create your order. Your cart has been kept unchanged.'));
        return;
      }
      if (data.orderAccessToken) {
        try {
          sessionStorage.setItem(`mrs_order_token_${data.order.id}`, data.orderAccessToken);
          sessionStorage.setItem(`mrs_order_token_${data.order.orderNumber}`, data.orderAccessToken);
        } catch {
          // Order remains available in this screen; only guest self-service lookup is unavailable.
        }
      }
      const order = {
        id: data.order.id as string,
        orderNumber: data.order.orderNumber as string,
        totalPriceInr: data.order.totalPriceInr as string,
        placedAt: data.order.placedAt as string,
        paymentMethod,
        orderAccessToken: data.orderAccessToken as string | undefined,
        razorpayOrder: data.razorpayOrder || null,
      };
      setCreatedOrder(order);
      if (data.paymentStatus === 'PAID') {
        setPaymentState('SUCCESS');
        clearCart();
      } else if (paymentMethod === 'RAZORPAY') {
        await openRazorpay(order);
      } else {
        setPaymentState('PENDING_VERIFICATION');
        clearCart();
      }
    } catch {
      setErrorMessage('The checkout service is unavailable. No confirmation was created and your cart is unchanged.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onlineCheckoutEnabled = process.env.NEXT_PUBLIC_ONLINE_CHECKOUT_ENABLED === 'true';

  if (!onlineCheckoutEnabled) {
    return (
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '72px 24px' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E6E0DE',
            padding: '44px 36px',
            textAlign: 'center',
          }}
        >
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '42px', marginBottom: '4px' }}>
            Studio Concierge
          </p>
          <h1 className="mrs-section-heading-serif" style={{ fontSize: '30px', marginBottom: '14px' }}>
            ONLINE CHECKOUT CURRENTLY UNAVAILABLE
          </h1>
          <p style={{ fontSize: '14px', color: '#6B5B5B', lineHeight: 1.7, maxWidth: '580px', margin: '0 auto 24px' }}>
            Mangal Royal Studio is currently operating in Catalogue &amp; Studio Enquiry mode. Online payment processing and automated shipping are disabled. Please contact our studio concierge to reserve selected pieces, confirm bespoke specifications, or arrange a private viewing.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/contact"
              style={{
                padding: '14px 32px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              Enquire With Our Studio
            </Link>
            <Link
              href="/collections/all"
              style={{
                padding: '14px 32px',
                border: '1px solid #7D132A',
                color: '#7D132A',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              Browse Catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (createdOrder) {
    const headingByState: Record<CheckoutPaymentState, string> = {
      PREPARING: 'PREPARING PAYMENT',
      OPENING_CHECKOUT: 'OPENING RAZORPAY CHECKOUT',
      PROCESSING: 'VERIFYING PAYMENT CAPTURE',
      SUCCESS: 'PAYMENT SUCCESSFUL',
      FAILED: 'PAYMENT FAILED — ORDER PENDING',
      CANCELLED: 'PAYMENT CANCELLED — ORDER PENDING',
      PENDING_VERIFICATION: 'ORDER CREATED — PAYMENT PENDING',
    };
    const subtitleByState: Record<CheckoutPaymentState, string> = {
      PREPARING: 'Preparing a fresh Razorpay Test Mode payment session for your pending order...',
      OPENING_CHECKOUT: 'Opening Razorpay Standard Checkout. Please complete payment in the modal.',
      PROCESSING: 'Verifying Razorpay signature and server-side capture status. Please wait...',
      SUCCESS: 'Razorpay has confirmed captured payment for this order.',
      FAILED: 'Your payment attempt failed, but your order is safely saved as pending. You can retry payment below.',
      CANCELLED: 'You closed the Razorpay Checkout modal before completing payment. Your order remains pending and you can retry below.',
      PENDING_VERIFICATION: 'Your order is recorded, but payment has not been confirmed. Dispatch will not begin until payment is verified.',
    };
    const statusLabelByState: Record<CheckoutPaymentState, string> = {
      PREPARING: 'Preparing payment session',
      OPENING_CHECKOUT: 'Awaiting checkout completion',
      PROCESSING: 'Verifying signature & capture',
      SUCCESS: 'Captured and verified',
      FAILED: 'Failed — pending retry',
      CANCELLED: 'Cancelled — pending retry',
      PENDING_VERIFICATION: 'Pending verification',
    };

    return (
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '64px 24px' }}>
        <div
          style={{
            background: '#FBE8DB',
            border: '1px solid #E7D1C4',
            padding: '44px 36px',
            textAlign: 'center',
          }}
        >
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '48px' }}>
            Thank you
          </p>
          <h1 className="mrs-section-heading-serif" style={{ fontSize: '34px', marginBottom: '12px' }}>
            {headingByState[paymentState]} — #{createdOrder.orderNumber}
          </h1>
          <p style={{ fontSize: '14px', color: '#3E3E3E', marginBottom: '24px' }}>
            {subtitleByState[paymentState]}
          </p>

          <div
            style={{
              background: '#FFFFFF',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '28px',
              border: '1px solid #E6E0DE',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
              GST Tax Invoice Summary (HSN 711319)
            </div>
            <div>Seller: Mangal Royal Jewels Pvt Ltd (GSTIN: 27AABCM1975R1Z6)</div>
            <div>Customer: {fullName} ({email})</div>
            <div>Delivery Address: {line1}, {city}, {stateName} — {pincode}</div>
            <div>Payment Status: {statusLabelByState[paymentState]}</div>
            <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 700, color: '#7D132A' }}>
              {paymentState === 'SUCCESS' ? 'Total Paid' : 'Order Total'}: {formatInr(createdOrder.totalPriceInr)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link
              href={`/pages/order-tracking?orderNumber=${createdOrder.orderNumber}`}
              style={{
                padding: '13px 28px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              View Order Status
            </Link>
            <Link
              href="/collections/all"
              style={{
                padding: '13px 28px',
                border: '1px solid #7D132A',
                color: '#7D132A',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              Continue Shopping
            </Link>
          </div>
          {errorMessage ? <div role="alert" style={{ color: '#991B1B', marginTop: 18 }}>{errorMessage}</div> : null}
          {createdOrder.paymentMethod === 'RAZORPAY' && paymentState !== 'SUCCESS' && paymentState !== 'PROCESSING' ? (
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={paymentState === 'PREPARING' || paymentState === 'OPENING_CHECKOUT'}
              style={{ marginTop: 18, padding: '12px 24px', background: '#7D132A', color: '#FFFFFF', border: 0, cursor: 'pointer' }}
            >
              {paymentState === 'PREPARING' ? 'Preparing Retry...' : 'Retry Payment'}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px) 80px' }}>
      <h1 className="mrs-section-heading-serif" style={{ marginBottom: '32px', textAlign: 'center' }}>
        SECURE INSURED CHECKOUT
      </h1>

      <form
        onSubmit={handlePlaceOrder}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '44px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', margin: 0 }}>
            1. Insured Delivery Recipient Details
          </h2>
          {errorMessage && (
            <div role="alert" style={{ padding: '12px', background: '#FEE2E2', color: '#991B1B', fontSize: '13px' }}>{errorMessage}</div>
          )}
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name (as on Government ID for Insured Delivery)"
            style={{ padding: '12px', border: '1px solid #D5CBC8' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              style={{ padding: '12px', border: '1px solid #D5CBC8' }}
            />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Number (for OTP Delivery)"
              style={{ padding: '12px', border: '1px solid #D5CBC8' }}
            />
          </div>
          <input
            type="text"
            required
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Street Address / Flat / Building"
            style={{ padding: '12px', border: '1px solid #D5CBC8' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              style={{ padding: '12px', border: '1px solid #D5CBC8' }}
            />
            <input
              type="text"
              required
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="State"
              style={{ padding: '12px', border: '1px solid #D5CBC8' }}
            />
            <input
              type="text"
              required
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="PIN Code"
              style={{ padding: '12px', border: '1px solid #D5CBC8' }}
            />
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', margin: '16px 0 0' }}>
            2. Payment Method
          </h2>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px',
              border: paymentMethod === 'RAZORPAY' ? '1.5px solid #7D132A' : '1px solid #D5CBC8',
              background: paymentMethod === 'RAZORPAY' ? '#FBE8DB' : '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              checked={paymentMethod === 'RAZORPAY'}
              onChange={() => setPaymentMethod('RAZORPAY')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                Razorpay Secure Payment (UPI, Credit/Debit Cards, NetBanking, No-Cost EMI)
              </div>
              <div style={{ fontSize: '11px', color: '#6B5B5B' }}>
                Payment is confirmed only after server-side capture verification
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px',
              border:
                paymentMethod === 'COD_STUDIO_PICKUP' ? '1.5px solid #7D132A' : '1px solid #D5CBC8',
              background: paymentMethod === 'COD_STUDIO_PICKUP' ? '#FBE8DB' : '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              checked={paymentMethod === 'COD_STUDIO_PICKUP'}
              onChange={() => setPaymentMethod('COD_STUDIO_PICKUP')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                Mumbai Studio Vault Appointment / Bank RTGS
              </div>
              <div style={{ fontSize: '11px', color: '#6B5B5B' }}>
                Reserve piece now and complete payment at our Mumbai Showroom
              </div>
            </div>
          </label>
        </div>

        <div style={{ background: '#FAF7F4', border: '1px solid #E6E0DE', padding: '28px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', margin: '0 0 16px 0' }}>
            Purchase-Time Price Summary
          </h2>
          {cart.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                padding: '8px 0',
                borderBottom: '1px solid #E6E0DE',
              }}
            >
              <span>
                {item.title} ({item.metalPurity}) × {item.quantity}
              </span>
              <strong>{formatInr(item.unitPriceInr * item.quantity)}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '14px' }}>
            <span>Subtotal</span>
            <span>{formatInr(subtotal)}</span>
          </div>
          {discountInr > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7D132A', fontSize: '14px', marginTop: '6px' }}>
              <span>Privilege Discount ({discountCode})</span>
              <span>−{formatInr(discountInr)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid #E6E0DE',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <span>Total Payable (INR)</span>
            <span style={{ color: '#7D132A' }}>{formatInr(finalTotal)}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || cart.length === 0}
            style={{
              width: '100%',
              marginTop: '22px',
              padding: '15px',
              background: '#7D132A',
              color: '#FFFFFF',
              border: 0,
              fontSize: '13px',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {isSubmitting ? 'Verifying & Locking Price Snapshot...' : `Pay & Place Order — ${formatInr(finalTotal)}`}
          </button>
        </div>
      </form>
    </div>
  );
}

