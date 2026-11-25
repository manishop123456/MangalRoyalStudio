'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CustomerDesignRecord } from '@mrs/shared';
import { API_BASE_URL, formatInr, storefrontFetch } from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';
import { CustomerFacingError, friendlyApiError, friendlyThrown } from '../../../lib/customer-messages';

export default function AccountDesignsPage() {
  const { customer, products, addToCart } = useStorefront();
  const [designs, setDesigns] = useState<CustomerDesignRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    if (!customer) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    storefrontFetch(`${API_BASE_URL}/customer/designs`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to load saved designs.'));
        if (!cancelled) {
          setDesigns(Array.isArray(data.designs) ? data.designs : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(friendlyThrown(err, 'Unable to load saved designs.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer]);

  const handleDuplicate = async (designId: string) => {
    setBusyId(designId);
    setError('');
    setNotice('');
    try {
      const res = await storefrontFetch(
        `${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}/duplicate`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to duplicate design.'));
      setDesigns((prev) => [data.design, ...prev]);
      setNotice(`Duplicated "${data.design.name}".`);
    } catch (err) {
      setError(friendlyThrown(err, 'Unable to duplicate design.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (designId: string) => {
    if (!window.confirm('Delete this saved bespoke design?')) return;
    setBusyId(designId);
    setError('');
    setNotice('');
    try {
      const res = await storefrontFetch(
        `${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to delete design.'));
      }
      setDesigns((prev) => prev.filter((d) => d.id !== designId));
      setNotice('Saved design deleted.');
    } catch (err) {
      setError(friendlyThrown(err, 'Unable to delete design.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleAddToCart = (d: CustomerDesignRecord) => {
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
      openDrawer: true,
    });
    setNotice(`Added "${d.name}" to your shopping bag.`);
  };

  return (
    <div className="mrs-section-pad" style={{ minHeight: '60vh' }}>
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B5B5B' }}>
        <Link href="/">Home</Link> / <Link href="/account">Account</Link> /{' '}
        <span style={{ color: '#190303' }}>Saved Designs</span>
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
            Bespoke Atelier
          </p>
          <h1 className="mrs-section-heading-serif">SAVED JEWELLERY DESIGNS</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href="/account/orders"
            style={{
              padding: '10px 18px',
              border: '1px solid #7D132A',
              color: '#7D132A',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Order History
          </Link>
          <Link
            href="/customize/MRS-RNG-1001"
            style={{
              padding: '10px 18px',
              background: '#7D132A',
              color: '#FFFFFF',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            New Custom Design
          </Link>
        </div>
      </div>

      {!customer ? (
        <div style={{ padding: '48px 24px', background: '#FAF6F2', border: '1px solid #E6E0DE', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', marginBottom: '10px' }}>
            Sign in to access your bespoke designs
          </h2>
          <p style={{ color: '#6B5B5B', fontSize: '14px', marginBottom: '20px' }}>
            Save custom gold purity, diamond clarity, and engraving configurations to revisit anytime.
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
          Loading saved designs...
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
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              style={{
                padding: '12px 16px',
                background: '#E7F6EE',
                border: '1px solid #B7E1C7',
                color: '#1B6E44',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              {notice}
            </div>
          )}

          {designs.length === 0 ? (
            <div style={{ padding: '48px 24px', background: '#FAF6F2', border: '1px solid #E6E0DE', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '8px' }}>
                No saved bespoke designs yet
              </h2>
              <p style={{ color: '#6B5B5B', fontSize: '14px', marginBottom: '20px' }}>
                Open our Bespoke Customizer to configure metal purity, diamond quality, and engraving.
              </p>
              <Link
                href="/customize/MRS-RNG-1001"
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
                Open Bespoke Studio
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                gap: '22px',
              }}
            >
              {designs.map((design) => (
                <article
                  key={design.id}
                  style={{
                    border: '1px solid #E6E0DE',
                    background: '#FFFFFF',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#7D132A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      {design.productSku}
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', margin: '4px 0' }}>
                      {design.name}
                    </h2>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#190303', marginBottom: '10px' }}>
                      {formatInr(design.lastQuotedPriceInr)}
                    </div>
                    {Array.isArray(design.selectionSnapshot) && design.selectionSnapshot.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#3E3E3E', lineHeight: 1.6 }}>
                        {design.selectionSnapshot.map((item, idx) => (
                          <li key={`${design.id}-sel-${idx}`}>
                            <strong>{item.groupName}:</strong> {item.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid #F0EAE8' }}>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(design)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        background: '#7D132A',
                        color: '#FFFFFF',
                        border: 0,
                        fontSize: '11.5px',
                        fontWeight: 600,
                        letterSpacing: '0.8px',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Add to Bag
                    </button>
                    <Link
                      href={`/customize/${encodeURIComponent(design.productHandle || design.productSku)}?designId=${encodeURIComponent(design.id)}`}
                      style={{
                        padding: '9px 12px',
                        border: '1px solid #7D132A',
                        color: '#7D132A',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === design.id}
                      onClick={() => handleDuplicate(design.id)}
                      style={{
                        padding: '9px 10px',
                        border: '1px solid #D5CBC8',
                        background: '#FFFFFF',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={busyId === design.id}
                      onClick={() => handleDelete(design.id)}
                      style={{
                        padding: '9px 10px',
                        border: '1px solid #F5C2C7',
                        background: '#FDECEC',
                        color: '#A61B2B',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
