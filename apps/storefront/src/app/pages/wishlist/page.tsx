'use client';

import React from 'react';
import Link from 'next/link';
import { useStorefront } from '../../../components/StorefrontShell';
import { ProductCard } from '../../../components/ProductCard';

export default function WishlistPage() {
  const { products, wishlistHandles } = useStorefront();
  const wishedProducts = products.filter((p) => wishlistHandles.includes(p.handle));

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '56px 40px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '48px' }}>
          Saved favourites
        </p>
        <h1 className="mrs-section-heading-serif">MY WISHLIST ({wishedProducts.length})</h1>
      </div>

      {wishedProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#FAF7F4' }}>
          <p style={{ fontSize: '15px', color: '#6B5B5B', marginBottom: '24px' }}>
            You haven’t saved any jewellery pieces to your wishlist yet.
          </p>
          <Link
            href="/collections/all"
            style={{
              display: 'inline-block',
              padding: '13px 32px',
              background: '#7D132A',
              color: '#FFFFFF',
              fontSize: '12px',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
            }}
          >
            Explore Fine Jewellery
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))',
            gap: '36px',
          }}
        >
          {wishedProducts.map((product) => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

