'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStorefront } from '../../components/StorefrontShell';
import { ProductCard } from '../../components/ProductCard';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const { products } = useStorefront();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.metalPurity.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '48px 40px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Discover brilliance
        </p>
        <h1 className="mrs-section-heading-serif">SEARCH OUR CATALOGUE</h1>
        <div style={{ maxWidth: '560px', margin: '20px auto 0', display: 'flex', gap: '10px' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by solitaire, ring, earring, bracelet, or SKU..."
            style={{ flex: 1, padding: '12px 16px', border: '1px solid #D5CBC8', fontSize: '14px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px', fontSize: '13px', color: '#6B5B5B' }}>
        Showing {results.length} matching {results.length === 1 ? 'creation' : 'creations'}
      </div>

      {results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: '#FAF6F2', border: '1px solid #E6E0DE' }}>
          <p style={{ fontSize: '16px', color: '#6B5B5B', marginBottom: '16px' }}>
            No jewellery pieces matched &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setPage(1);
            }}
            style={{
              padding: '10px 24px',
              background: '#7D132A',
              color: '#FFFFFF',
              border: 0,
              fontSize: '12px',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))',
              gap: '36px',
            }}
          >
            {results.slice((page - 1) * pageSize, page * pageSize).map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>

          {results.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '36px' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '8px 16px', border: '1px solid #D5CBC8', background: '#FFFFFF', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '13px', color: '#6B5B5B' }}>
                Page {page} of {Math.ceil(results.length / pageSize)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(results.length / pageSize)}
                onClick={() => setPage((p) => Math.min(Math.ceil(results.length / pageSize), p + 1))}
                style={{ padding: '8px 16px', border: '1px solid #D5CBC8', background: '#FFFFFF', cursor: page >= Math.ceil(results.length / pageSize) ? 'not-allowed' : 'pointer', opacity: page >= Math.ceil(results.length / pageSize) ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
