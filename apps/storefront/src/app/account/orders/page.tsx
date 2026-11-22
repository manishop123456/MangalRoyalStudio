'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, formatInr, storefrontFetch } from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';
import { CustomerFacingError, friendlyApiError, friendlyThrown } from '../../../lib/customer-messages';

interface CustomerOrderItem {
  sku: string;
  title: string;
  quantity: number;
  purchaseTimePriceInr: string;
  metalPurity: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  totalPriceInr: string;
  financialStatus: string;
  fulfillmentStatus: string;
  placedAt: string;
  lineItems: CustomerOrderItem[];
}

interface InvoiceView {
  invoiceNumber?: string;
  seller?: { legalName?: string; gstin?: string; registeredAddress?: string };
  buyer?: { name?: string; email?: string; city?: string; state?: string; pincode?: string };
  order?: {
    orderNumber: string;
    placedAt: string;
    financialStatus: string;
    lineItems: CustomerOrderItem[];
  };
  taxSummary?: {
    taxableValueInr: string;
    gstRatePercent: string;
    totalGstInr: string;
    grandTotalInr: string;
  };
}

export default function AccountOrdersPage() {
  const { customer } = useStorefront();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    storefrontFetch(`${API_BASE_URL}/customer/orders`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to load order history.'));
        if (!cancelled) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(friendlyThrown(err, 'Unable to load order history.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer]);

  const handleLoadInvoice = async (orderId: string) => {
    setBusyOrderId(orderId);
    setError('');
    try {
      const res = await storefrontFetch(
        `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/invoice`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to load GST invoice.'));
      setInvoice(data as InvoiceView);
    } catch (err) {
      setError(friendlyThrown(err, 'Unable to load GST invoice.'));
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="mrs-section-pad" style={{ minHeight: '60vh' }}>
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B5B5B' }}>
        <Link href="/">Home</Link> / <Link href="/account">Account</Link> /{' '}
        <span style={{ color: '#190303' }}>Order History</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '18px',
          borderBottom: '1px solid #E6E0DE',
        }}
      >
        <div>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '38px' }}>
            Your Acquisitions
          </p>
          <h1 className="mrs-section-heading-serif">ORDER HISTORY &amp; INVOICES</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href="/account"
            style={{
              padding: '10px 18px',
              border: '1px solid #7D132A',
              color: '#7D132A',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Account Overview
          </Link>
          <Link
            href="/account/designs"
            style={{
              padding: '10px 18px',
              background: '#7D132A',
              color: '#FFFFFF',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Saved Designs
          </Link>
        </div>
      </div>

      {!customer ? (
        <div style={{ padding: '48px 24px', background: '#FAF6F2', border: '1px solid #E6E0DE', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '10px' }}>
            Sign in to view your orders
          </h2>
          <p style={{ color: '#6B5B5B', fontSize: '14px', marginBottom: '20px' }}>
            Access your purchase history, insured delivery status, and official GST tax invoices.
          </p>
          <Link
            href="/account/login"
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
            Sign In
          </Link>
        </div>
      ) : loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6B5B5B' }}>
          Loading your order history...
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                background: '#FDECEC',
                border: '1px solid #F5C2C7',
                color: '#A61B2B',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          {orders.length === 0 ? (
            <div style={{ padding: '48px 24px', background: '#FAF6F2', border: '1px solid #E6E0DE', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '8px' }}>
                No orders yet
              </h2>
              <p style={{ color: '#6B5B5B', fontSize: '14px', marginBottom: '20px' }}>
                Explore our IGI-certified lab-grown diamond solitaires and fine jewellery collections.
              </p>
              <Link
                href="/collections/all"
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
                Explore Collections
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              {orders.map((order) => (
                <article
                  key={order.id}
                  style={{
                    border: '1px solid #E6E0DE',
                    background: '#FFFFFF',
                    padding: '22px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingBottom: '14px',
                      borderBottom: '1px solid #F0EAE8',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>
                        Order {order.orderNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B5B5B', marginTop: '2px' }}>
                        Placed {new Date(order.placedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          background: '#F8E1CF',
                          color: '#7D132A',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {order.financialStatus}
                      </span>
                      <span
                        style={{
                          padding: '4px 10px',
                          background: '#F6F3F1',
                          color: '#2D2021',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {order.fulfillmentStatus}
                      </span>
                      <strong style={{ fontSize: '16px', color: '#7D132A' }}>
                        {formatInr(order.totalPriceInr)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
                    {(order.lineItems || []).map((item, idx) => (
                      <div
                        key={`${order.id}-${item.sku}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '13.5px',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          <strong>{item.title}</strong> ({item.sku}) × {item.quantity}{' '}
                          {item.metalPurity ? `• ${item.metalPurity}` : ''}
                        </span>
                        <span>{formatInr(item.purchaseTimePriceInr)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleLoadInvoice(order.id)}
                      disabled={busyOrderId === order.id}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #7D132A',
                        background: '#FFFFFF',
                        color: '#7D132A',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {busyOrderId === order.id ? 'Loading Invoice...' : 'View GST Invoice'}
                    </button>
                    <Link
                      href={`/order-tracking?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                      style={{
                        padding: '8px 16px',
                        background: '#F6F3F1',
                        color: '#190303',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      Track Shipment
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {invoice && (
            <section
              style={{
                marginTop: '28px',
                padding: '24px',
                border: '1px solid #C9A227',
                background: '#FAF6F2',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px' }}>
                  Tax Invoice {invoice.invoiceNumber || ''}
                </h2>
                <button
                  type="button"
                  onClick={() => setInvoice(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  ✕ Close
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#3E3E3E', marginBottom: '8px' }}>
                <strong>Seller:</strong> {invoice.seller?.legalName || 'Mangal Royal Jewels Pvt Ltd'}{' '}
                {invoice.seller?.gstin ? `(GSTIN: ${invoice.seller.gstin})` : ''}
              </p>
              {invoice.taxSummary && (
                <p style={{ fontSize: '13px', color: '#3E3E3E' }}>
                  <strong>Taxable:</strong> {formatInr(invoice.taxSummary.taxableValueInr)} •{' '}
                  <strong>GST ({invoice.taxSummary.gstRatePercent}%):</strong>{' '}
                  {formatInr(invoice.taxSummary.totalGstInr)} •{' '}
                  <strong>Grand Total:</strong> {formatInr(invoice.taxSummary.grandTotalInr)}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
