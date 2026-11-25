'use client';

import React from 'react';
import Link from 'next/link';
import { THEME_IMAGES } from '../../lib/storefront-data';
import { SafeImage } from '../../components/SafeImage';

const COLLECTION_LIST = [
  { handle: 'best-sellers', title: 'Our Bestsellers', desc: 'Most coveted IGI-certified solitaire & fine jewellery creations.', image: THEME_IMAGES.catRings },
  { handle: 'rings', title: 'Rings', desc: 'Solitaire, halo, and eternity rings in 14K & 18K gold.', image: THEME_IMAGES.catRings },
  { handle: 'earrings', title: 'Earrings', desc: 'Solitaire studs, drops, hoops & bridal chandbalis.', image: THEME_IMAGES.catEarrings },
  { handle: 'pendants', title: 'Pendants', desc: 'Everyday diamond pendants and delicate solitaire drops.', image: THEME_IMAGES.catPendants },
  { handle: 'necklaces', title: 'Necklaces', desc: 'Bridal diamond haars and graduated tennis necklaces.', image: THEME_IMAGES.catNecklaces },
  { handle: 'bracelets', title: 'Bracelets', desc: 'Illusion and four-prong diamond tennis bracelets.', image: THEME_IMAGES.catBracelets },
  { handle: 'bangles', title: 'Bangles', desc: 'Handcrafted gold and lab-grown diamond kadas & bangles.', image: THEME_IMAGES.catBangles },
  { handle: 'antique', title: 'Antique Heritage', desc: '1975 Founder Edition heirloom creations.', image: THEME_IMAGES.catAntique },
];

export default function CollectionsIndexPage() {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '56px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <p className="mrs-section-eyebrow-script">Explore our vault</p>
        <h1 className="mrs-section-heading-serif">FINE JEWELLERY COLLECTIONS</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '32px',
        }}
      >
        {COLLECTION_LIST.map((col) => (
          <Link key={col.handle} href={`/collections/${col.handle}`} className="mrs-category-card">
            <div className="mrs-category-card__media">
              <SafeImage src={col.image} alt={col.title} />
            </div>
            <div className="mrs-category-card__footer">
              <h2 className="mrs-category-card__title">{col.title}</h2>
              <span>→</span>
            </div>
            <p style={{ fontSize: '13px', color: '#6B5B5B', margin: '8px 0 0 0' }}>{col.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

