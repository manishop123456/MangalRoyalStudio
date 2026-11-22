'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CustomerDesignRecord } from '@mrs/shared';
import { API_BASE_URL, formatInr, storefrontFetch } from '../../lib/storefront-data';
import { useStorefront } from '../../components/StorefrontShell';
import { CustomerFacingError, friendlyApiError, friendlyThrown } from '../../lib/customer-messages';

interface AccountOrder {
  id: string;
  orderNumber: string;
  totalPriceInr: string;
  financialStatus: string;
  fulfillmentStatus: string;
  placedAt: string;
  lineItems: Array<{ sku: string; title: string; quantity: number; purchaseTimePriceInr: string; metalPurity: string }>;
}

interface InvoiceView {
  invoiceNumber?: string;
  seller?: { legalName?: string; gstin?: string; registeredAddress?: string };
  buyer?: { name?: string; email?: string; city?: string; state?: string; pincode?: string };
  order?: { orderNumber: string; placedAt: string; financialStatus: string; lineItems: Array<{ sku: string; title: string; quantity: number; purchaseTimePriceInr: string; metalPurity: string }> };
  taxSummary?: { taxableValueInr: string; gstRatePercent: string; totalGstInr: string; grandTotalInr: string };
}

export default function CustomerAccountPage() {
  const { customer, customerToken, setCustomer, products, addToCart } = useStorefront();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [designs, setDesigns] = useState<CustomerDesignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busyDesignId, setBusyDesignId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    storefrontFetch(`${API_BASE_URL}/customer/designs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.designs)) {
          setDesigns(data.designs);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const handleDuplicateDesign = async (designId: string) => {
    setBusyDesignId(designId);
    setError('');
    try {
      const res = await storefrontFetch(`${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to duplicate design.'));
      setDesigns((prev) => [data.design, ...prev]);
      setNotice(`Duplicated "${data.design.name}".`);
    } catch (e) {
      setError(friendlyThrown(e, 'Unable to duplicate design.'));
    } finally {
      setBusyDesignId(null);
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!window.confirm('Delete this saved bespoke design?')) return;
    setBusyDesignId(designId);
    setError('');
    try {
      const res = await storefrontFetch(`${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to delete design.'));
      }
      setDesigns((prev) => prev.filter((d) => d.id !== designId));
      setNotice('Saved design deleted.');
    } catch (e) {
      setError(friendlyThrown(e, 'Unable to delete design.'));
    } finally {
      setBusyDesignId(null);
    }
  };

  const handleAddDesignToCart = (d: CustomerDesignRecord) => {
    const product = products.find((p) => p.sku === d.productSku || p.handle === d.productHandle);
    if (!product) {
      setError(`Product ${d.productSku} is currently unavailable.`);
      return;
    }
    addToCart(product, {
      unitPriceInr: Number(d.lastQuotedPriceInr),
      selections: d.selections,
      selectionSnapshot: d.selectionSnapshot,
      breakdownLines: d.lastPriceBreakdown,
      customerDesignId: d.id,
    });
    setNotice(`Added "${d.name}" to your shopping bag.`);
  };

  const loadInvoice = async (orderId: string) => {
    setBusyOrderId(orderId);
    setError('');
    setNotice('');
    try {
      const response = await storefrontFetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/invoice`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new CustomerFacingError(friendlyApiError(response.status, data, 'Unable to load the invoice.'));
      setInvoice(data as InvoiceView);
    } catch (reason) {
      setError(friendlyThrown(reason, 'Unable to load the invoice.'));
    } finally {
      setBusyOrderId(null);
    }
  };

  const cancelOrder = async (order: AccountOrder) => {
    if (!window.confirm(`Cancel order #${order.orderNumber}? This cannot be undone.`)) return;
    setBusyOrderId(order.id);
    setError('');
    setNotice('');
    try {
      const response = await storefrontFetch(`${API_BASE_URL}/orders/${encodeURIComponent(order.id)}/cancel`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new CustomerFacingError(friendlyApiError(response.status, data, 'This order could not be cancelled.'));
      setOrders((current) => current.map((entry) => (entry.id === order.id ? { ...entry, fulfillmentStatus: 'CANCELLED' } : entry)));
      setNotice(`Order #${order.orderNumber} has been cancelled.`);
    } catch (reason) {
      setError(friendlyThrown(reason, 'This order could not be cancelled.'));
    } finally {
      setBusyOrderId(null);
    }
  };

  useEffect(() => {
    let active = true;
    if (!customerToken) {
      setLoading(false);
      return;
    }
    storefrontFetch(`${API_BASE_URL}/auth/customer/me`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          setCustomer(null);
          if (active) setError('Your session has expired. Please sign in again.');
          return;
        }
        if (!response.ok) throw new CustomerFacingError(friendlyApiError(response.status, data, 'Unable to load your account.'));
        if (active) setOrders(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch((reason: unknown) => {
        if (active) setError(friendlyThrown(reason, 'Unable to load your account.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerToken]);

  if (!customerToken || !customer) {
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '42px' }}>Royal circle</p>
        <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>ACCOUNT ACCESS</h1>
        <p style={{ color: '#6B5B5B', fontSize: '14px' }}>Sign in or create an account to view your profile and order history.</p>
        {error ? <p role="alert" style={{ color: '#991B1B' }}>{error}</p> : null}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24 }}>
          <Link href="/account/login" style={{ padding: '12px 22px', background: '#7D132A', color: '#FFFFFF' }}>Sign In</Link>
          <Link href="/account/register" style={{ padding: '12px 22px', border: '1px solid #7D132A', color: '#7D132A' }}>Create Account</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '56px 32px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '36px', paddingBottom: '20px', borderBottom: '1px solid #E6E0DE' }}>
        <div>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '42px' }}>Royal circle member</p>
          <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>WELCOME, {customer.firstName} {customer.lastName}</h1>
        </div>
        <button type="button" onClick={() => setCustomer(null)} style={{ padding: '10px 22px', border: '1px solid #7D132A', background: '#FFFFFF', color: '#7D132A', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>Sign Out</button>
      </div>
      {error ? <p role="alert" style={{ color: '#991B1B' }}>{error}</p> : null}
      {notice ? <p role="status" style={{ color: '#166534' }}>{notice}</p> : null}
      {invoice ? (
        <div style={{ border: '1px solid #7D132A', padding: '24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', margin: 0 }}>Tax Invoice — Order #{invoice.order?.orderNumber}</h2>
            <span>
              <button type="button" onClick={() => window.print()} style={{ marginRight: 8, padding: '6px 14px', cursor: 'pointer' }}>Print</button>
              <button type="button" onClick={() => setInvoice(null)} style={{ padding: '6px 14px', cursor: 'pointer' }}>Close</button>
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#6B5B5B' }}>{invoice.seller?.legalName} • GSTIN {invoice.seller?.gstin}<br />{invoice.seller?.registeredAddress}</p>
          <p style={{ fontSize: '13px' }}>Billed to: {invoice.buyer?.name} ({invoice.buyer?.email})</p>
          {invoice.order?.lineItems.map((item, index) => (
            <div key={`${item.sku}-${index}`} style={{ fontSize: '14px' }}>{item.title} ({item.metalPurity}) × {item.quantity} — {formatInr(item.purchaseTimePriceInr)}</div>
          ))}
          {invoice.taxSummary ? (
            <p style={{ fontSize: '13px', marginTop: 12 }}>
              Taxable value {formatInr(invoice.taxSummary.taxableValueInr)} • GST {invoice.taxSummary.gstRatePercent} {formatInr(invoice.taxSummary.totalGstInr)} • <strong>Total {formatInr(invoice.taxSummary.grandTotalInr)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '36px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', margin: '0 0 16px 0' }}>Order History & Purchase-Time Price Snapshots</h2>
          {loading ? <p>Loading your orders…</p> : orders.length === 0 ? <p style={{ color: '#6B5B5B' }}>No orders are associated with this account.</p> : orders.map((order) => (
            <div key={order.id} style={{ border: '1px solid #E6E0DE', padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><strong style={{ color: '#7D132A' }}>Order #{order.orderNumber}</strong><span style={{ fontSize: '12px', background: '#FBE8DB', padding: '2px 8px' }}>{order.fulfillmentStatus}</span></div>
              {order.lineItems.map((item, index) => <div key={`${item.sku}-${index}`} style={{ fontSize: '14px', fontWeight: 500 }}>{item.title} ({item.metalPurity}) × {item.quantity}</div>)}
              <div style={{ fontSize: '12px', color: '#6B5B5B', margin: '8px 0 12px' }}>{new Date(order.placedAt).toLocaleDateString()} • {order.financialStatus} • {formatInr(order.totalPriceInr)}</div>
              <Link href={`/pages/order-tracking?orderNumber=${encodeURIComponent(order.orderNumber)}`} style={{ fontSize: '12px', color: '#7D132A', textDecoration: 'underline' }}>Track Shipment</Link>
              <button type="button" disabled={busyOrderId === order.id} onClick={() => loadInvoice(order.id)} style={{ marginLeft: 16, fontSize: '12px', color: '#7D132A', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>{busyOrderId === order.id ? 'Working…' : 'View Invoice'}</button>
              {order.fulfillmentStatus === 'UNFULFILLED' ? (
                <button type="button" disabled={busyOrderId === order.id} onClick={() => cancelOrder(order)} style={{ marginLeft: 16, fontSize: '12px', color: '#991B1B', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Cancel Order</button>
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ background: '#FAF7F4', border: '1px solid #E6E0DE', padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', margin: '0 0 14px 0' }}>Profile</h2>
          <p style={{ fontSize: '14px', lineHeight: 1.7, margin: 0 }}><strong>{customer.firstName} {customer.lastName}</strong><br />Email: {customer.email}{customer.phone ? <><br />Phone: {customer.phone}</> : null}{customer.city || customer.state ? <><br />Location: {[customer.city, customer.state].filter(Boolean).join(', ')}</> : null}</p>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', margin: '0 0 16px 0' }}>
          Saved Bespoke Designs ({designs.length})
        </h2>
        {designs.length === 0 ? (
          <p style={{ color: '#6B5B5B', fontSize: '14px' }}>
            You haven&apos;t saved any bespoke jewellery designs yet. Customize any ring or fine jewellery piece on its product page and click Save Design.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: '16px' }}>
            {designs.map((d) => (
              <div key={d.id} style={{ border: '1px solid #E6E0DE', padding: '18px', background: '#FFFFFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <strong style={{ color: '#7D132A', fontSize: '15px' }}>{d.name}</strong>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatInr(d.lastQuotedPriceInr)}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6B5B5B', marginBottom: '10px' }}>
                  {d.productTitle} ({d.productSku})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {d.selectionSnapshot.map((s) => (
                    <span
                      key={s.groupCode}
                      style={{ fontSize: '11px', background: '#FAF7F4', border: '1px solid #E6E0DE', padding: '2px 7px' }}
                    >
                      {s.groupName}: {s.label}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' }}>
                  <Link
                    href={`/products/${encodeURIComponent(d.productHandle)}?designId=${encodeURIComponent(d.id)}`}
                    style={{ color: '#7D132A', textDecoration: 'underline' }}
                  >
                    Reopen &amp; Edit
                  </Link>
                  <button
                    type="button"
                    disabled={busyDesignId === d.id}
                    onClick={() => handleAddDesignToCart(d)}
                    style={{ background: 'none', border: 0, color: '#7D132A', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Add to Bag
                  </button>
                  <button
                    type="button"
                    disabled={busyDesignId === d.id}
                    onClick={() => handleDuplicateDesign(d.id)}
                    style={{ background: 'none', border: 0, color: '#4A433E', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    disabled={busyDesignId === d.id}
                    onClick={() => handleDeleteDesign(d.id)}
                    style={{ background: 'none', border: 0, color: '#991B1B', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
