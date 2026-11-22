'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStorefront } from '../../../components/StorefrontShell';
import { ProductCard } from '../../../components/ProductCard';

function CollectionDetailContent() {
  const params = useParams<{ handle: string }>();
  const searchParams = useSearchParams();
  const handle = String(params?.handle || 'all').toLowerCase();
  const { products } = useStorefront();

  const [selectedPurity, setSelectedPurity] = useState<string>('ALL');
  const [selectedShape, setSelectedShape] = useState<string>(
    searchParams?.get('shape')?.toUpperCase() || 'ALL'
  );
  const [sortBy, setSortBy] = useState<string>('featured');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const collectionTitle = useMemo(() => {
    if (handle === 'all') return 'All Fine Jewellery';
    if (handle === 'best-sellers') return 'Our Bestsellers';
    if (handle === 'under-15k') return 'Luxury Under ₹15,000';
    if (handle === '15k-to-25k') return 'Jewellery ₹15,000 – ₹25,000';
    if (handle === '25k-to-50k') return 'Jewellery ₹25,000 – ₹50,000';
    if (handle === '50k-and-above') return 'Signature Creations ₹50,000 & Above';
    return handle.replace(/-/g, ' ').toUpperCase();
  }, [handle]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      if (handle === 'best-sellers' && !p.isFeaturedBestseller) return false;
      const isPor = Boolean(p.priceOnRequest ?? p.priceBreakup?.priceOnRequest);
      if (isPor && ['under-15k', '15k-to-25k', '25k-to-50k', '50k-and-above'].includes(handle)) return false;
      if (handle === 'under-15k' && Number(p.currentShopifyPriceInr) >= 15000) return false;
      if (handle === '15k-to-25k') {
        const pr = Number(p.currentShopifyPriceInr);
        if (pr < 15000 || pr > 25000) return false;
      }
      if (handle === '25k-to-50k') {
        const pr = Number(p.currentShopifyPriceInr);
        if (pr < 25000 || pr > 50000) return false;
      }
      if (handle === '50k-and-above' && Number(p.currentShopifyPriceInr) < 50000) return false;
      if (
        !['all', 'best-sellers', 'under-15k', '15k-to-25k', '25k-to-50k', '50k-and-above'].includes(
          handle
        )
      ) {
        if (p.category.toLowerCase().replace(/\s+/g, '-') !== handle) return false;
      }

      if (selectedPurity !== 'ALL' && p.metalPurity !== selectedPurity) return false;
      if (
        selectedShape !== 'ALL' &&
        !p.diamondComponents.some((d) => d.shape.toUpperCase() === selectedShape)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      list.sort((a, b) => Number(a.currentShopifyPriceInr) - Number(b.currentShopifyPriceInr));
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => Number(b.currentShopifyPriceInr) - Number(a.currentShopifyPriceInr));
    } else if (sortBy === 'title-asc') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [products, handle, selectedPurity, selectedShape, sortBy]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '44px 40px 80px' }}>
      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#6B5B5B' }}>
        <Link href="/">Home</Link> / <Link href="/collections">Collections</Link> /{' '}
        <span style={{ color: '#190303' }}>{collectionTitle}</span>
      </div>

      <div
        style={{
          background: '#F8E1CF',
          padding: '40px 32px',
          marginBottom: '36px',
          textAlign: 'center',
        }}
      >
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Mangal Royal Studio
        </p>
        <h1 className="mrs-section-heading-serif">{collectionTitle}</h1>
        <p style={{ fontSize: '14px', color: '#3E3E3E', maxWidth: '640px', margin: '10px auto 0' }}>
          IGI-certified lab-grown diamond jewellery crafted in BIS-hallmarked gold with live transparent pricing.
        </p>
      </div>

      {/* FILTER & SORT TOOLBAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '20px',
          marginBottom: '32px',
          borderBottom: '1px solid #E6E0DE',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Purity:{' '}
            <select
              value={selectedPurity}
              onChange={(e) => setSelectedPurity(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #D5CBC8', marginLeft: '6px' }}
            >
              <option value="ALL">All Purities</option>
              <option value="18K">18K Gold</option>
              <option value="14K">14K Gold</option>
              <option value="22K">22K Gold</option>
            </select>
          </label>

          <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Diamond Cut:{' '}
            <select
              value={selectedShape}
              onChange={(e) => setSelectedShape(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #D5CBC8', marginLeft: '6px' }}
            >
              <option value="ALL">All Shapes</option>
              <option value="ROUND">Round</option>
              <option value="EMERALD">Emerald</option>
              <option value="PEAR">Pear</option>
              <option value="CUSHION">Cushion</option>
              <option value="OVAL">Oval</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#6B5B5B' }}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'creation' : 'creations'}
          </span>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Sort By:{' '}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #D5CBC8', marginLeft: '6px' }}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="title-asc">Alphabetically: A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px' }}>
          <p style={{ fontSize: '16px', color: '#6B5B5B', marginBottom: '20px' }}>
            No jewellery pieces matched your selected filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPurity('ALL');
              setSelectedShape('ALL');
            }}
            style={{
              padding: '12px 28px',
              background: '#7D132A',
              color: '#FFFFFF',
              border: 0,
              fontSize: '12px',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Reset Filters
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
            {filteredProducts
              .slice((page - 1) * pageSize, page * pageSize)
              .map((product) => (
                <ProductCard key={product.sku} product={product} />
              ))}
          </div>

          {filteredProducts.length > pageSize && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '14px',
                marginTop: '40px',
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #D5CBC8',
                  background: '#FFFFFF',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '13px', color: '#6B5B5B' }}>
                Page {page} of {Math.ceil(filteredProducts.length / pageSize)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(filteredProducts.length / pageSize)}
                onClick={() =>
                  setPage((p) => Math.min(Math.ceil(filteredProducts.length / pageSize), p + 1))
                }
                style={{
                  padding: '8px 16px',
                  border: '1px solid #D5CBC8',
                  background: '#FFFFFF',
                  cursor:
                    page >= Math.ceil(filteredProducts.length / pageSize)
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: page >= Math.ceil(filteredProducts.length / pageSize) ? 0.5 : 1,
                }}
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

export default function CollectionDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading collection...</div>}>
      <CollectionDetailContent />
    </Suspense>
  );
}
