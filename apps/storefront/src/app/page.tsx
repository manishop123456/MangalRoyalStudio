'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { THEME_IMAGES } from '../lib/storefront-data';
import { useStorefront } from '../components/StorefrontShell';
import { ProductCard } from '../components/ProductCard';

const DIAMOND_SHAPES = [
  { name: 'Round', code: 'ROUND', image: THEME_IMAGES.shapeRound },
  { name: 'Heart', code: 'HEART', svgPath: 'M12 21s-7-4.8-9.2-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.2 12C19 16.2 12 21 12 21Z' },
  { name: 'Radiant', code: 'RADIANT', svgPath: 'M7 3h10l4 4v10l-4 4H7l-4-4V7l4-4Z' },
  { name: 'Princess', code: 'PRINCESS', svgPath: 'M4 4h16v16H4V4Zm3 3v10h10V7H7Z' },
  { name: 'Pear', code: 'PEAR', svgPath: 'M12 3c3.5 5 6.5 8.5 6.5 12.2a6.5 6.5 0 1 1-13 0C5.5 11.5 8.5 8 12 3Z' },
  { name: 'Oval', code: 'OVAL', svgPath: 'M12 3c4.2 0 7.5 4 7.5 9s-3.3 9-7.5 9-7.5-4-7.5-9 3.3-9 7.5-9Z' },
  { name: 'Marquise', code: 'MARQUISE', svgPath: 'M12 2c4.5 4.2 7 7.5 7 10s-2.5 5.8-7 10c-4.5-4.2-7-7.5-7-10s2.5-5.8 7-10Z' },
  { name: 'Emerald', code: 'EMERALD', svgPath: 'M7 2h10l3 3v14l-3 3H7l-3-3V5l3-3Zm1.5 3.5v13h7v-13h-7Z' },
];

const CATEGORIES = [
  { title: 'Rings', handle: 'rings', image: THEME_IMAGES.catRings, stagger: false },
  { title: 'Earrings', handle: 'earrings', image: THEME_IMAGES.catEarrings, stagger: true },
  { title: 'Pendants', handle: 'pendants', image: THEME_IMAGES.catPendants, stagger: false },
  { title: 'Necklaces', handle: 'necklaces', image: THEME_IMAGES.catNecklaces, stagger: true },
  { title: 'Bracelets', handle: 'bracelets', image: THEME_IMAGES.catBracelets, stagger: false },
  { title: 'Bangles', handle: 'bangles', image: THEME_IMAGES.catBangles, stagger: true },
  { title: 'Antique', handle: 'antique', image: THEME_IMAGES.catAntique, stagger: false },
];

const PRICE_TIERS = [
  { script: 'Under', amount: '15K', strip: 'SHOP UNDER ₹15,000', handle: 'under-15k', image: THEME_IMAGES.priceUnder15k },
  { script: 'Between', amount: '15K - 25K', strip: '₹15,000 TO ₹25,000', handle: '15k-to-25k', image: THEME_IMAGES.price15kTo25k },
  { script: 'Between', amount: '25K - 50K', strip: '₹25,000 TO ₹50,000', handle: '25k-to-50k', image: THEME_IMAGES.price25kTo50k },
  { script: 'Above', amount: '50K', strip: '₹50,000 & ABOVE', handle: '50k-and-above', image: THEME_IMAGES.priceAbove50k },
];

export default function HomePage() {
  const { products, productsLoading, productsError, reloadProducts } = useStorefront();
  const [seoExpanded, setSeoExpanded] = useState(false);

  const featuredBestsellers = products.filter((p) => p.isFeaturedBestseller);
  const bestsellers = (featuredBestsellers.length > 0 ? featuredBestsellers : products).slice(0, 4);

  return (
    <div>
      {productsError && (
        <div
          role="status"
          style={{
            background: '#FEF3E2',
            borderBottom: '1px solid #F3D9B1',
            color: '#9A5B13',
            padding: '10px 20px',
            fontSize: '12.5px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span>{productsError}</span>
          <button
            type="button"
            onClick={reloadProducts}
            style={{
              padding: '4px 10px',
              border: '1px solid #9A5B13',
              background: 'transparent',
              color: '#9A5B13',
              fontSize: '11.5px',
              cursor: 'pointer',
            }}
          >
            Retry Live Sync
          </button>
        </div>
      )}
      {/* 3. HERO SLIDESHOW (sections/slideshow.liquid) */}
      <section className="mrs-hero" aria-label="Hero Banner">
        <img
          src={THEME_IMAGES.heroSlide1}
          alt="Tradition in Trust — Brilliance For Today"
          className="mrs-hero__img"
        />
        <div className="mrs-hero__overlay">
          <div className="mrs-hero__content">
            <p className="mrs-hero__eyebrow">TRADITION IN TRUST</p>
            <h1 className="mrs-hero__script">Brilliance For Today</h1>
            <p className="mrs-hero__desc">
              Every creation is designed to reflect modern elegance while carrying forward a legacy of trust.
            </p>
            <Link href="/collections/all" className="mrs-hero__cta">
              <span>Shop Now</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. BESTSELLERS (sections/featured-collection.liquid + snippets/card-product.liquid) */}
      <section className="mrs-section-pad">
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <p className="mrs-section-eyebrow-script">Handpicked for you</p>
          <h2 className="mrs-section-heading-serif">OUR BESTSELLERS</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '36px',
          }}
        >
          {bestsellers.map((prod) => (
            <ProductCard key={prod.sku} product={prod} customBadge="BEST SELLER" />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '42px' }}>
          <Link
            href="/collections/best-sellers"
            style={{
              display: 'inline-block',
              padding: '12px 36px',
              border: '1px solid #7D132A',
              color: '#7D132A',
              fontSize: '12px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            Explore All Bestsellers
          </Link>
        </div>
      </section>

      {/* 5. SHOP BY SHAPE (sections/shop-by-shape.liquid) */}
      <section
        style={{
          backgroundColor: '#86142C',
          color: '#FFFFFF',
          padding: '56px 40px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '38px' }}>
            <p className="mrs-section-eyebrow-script" style={{ color: '#F8E1CF' }}>
              Pick your perfect cut
            </p>
            <h2 className="mrs-section-heading-serif" style={{ color: '#FFFFFF' }}>
              SHOP BY SHAPE
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '16px',
            }}
          >
            {DIAMOND_SHAPES.map((shape) => (
              <Link
                key={shape.code}
                href={`/collections/all?shape=${shape.code}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '22px 12px',
                  border: '1px solid rgba(248, 225, 207, 0.28)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  transition: 'background 0.25s ease, transform 0.25s ease',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  {shape.image ? (
                    <img
                      src={shape.image}
                      alt={shape.name}
                      style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                    />
                  ) : (
                    <svg
                      width="42"
                      height="42"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F8E1CF"
                      strokeWidth="1.2"
                    >
                      <path d={shape.svgPath} />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '15px',
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                  }}
                >
                  {shape.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. SHOP BY CATEGORY (sections/shop-by-catogory.liquid) */}
      <section className="mrs-category-section">
        <div style={{ textAlign: 'center', maxWidth: '1280px', margin: '0 auto' }}>
          <p className="mrs-section-eyebrow-script">Find what speaks to you</p>
          <h2 className="mrs-section-heading-serif">SHOP BY CATEGORY</h2>
        </div>

        <div className="mrs-category-grid">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.handle}
              href={`/collections/${cat.handle}`}
              className={`mrs-category-card ${cat.stagger ? 'mrs-category-card--stagger' : ''}`}
            >
              <div className="mrs-category-card__media">
                <img src={cat.image} alt={cat.title} loading="lazy" />
              </div>
              <div className="mrs-category-card__footer">
                <h3 className="mrs-category-card__title">{cat.title}</h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#190303" strokeWidth="1.5">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 7. BRAND STORY (sections/brand-story.liquid) */}
      <section
        style={{
          backgroundColor: '#FBE8DB',
          padding: '100px 40px',
        }}
      >
        <div
          style={{
            maxWidth: '1320px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '56px',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '54px',
                lineHeight: 1.02,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#190303',
                margin: 0,
              }}
            >
              ROOTED IN LEGACY
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-script)',
                fontSize: '88px',
                lineHeight: 0.9,
                color: '#7D132A',
                margin: '-14px 0 22px 0',
              }}
            >
              Build for today.
            </p>
            <p
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: '#3E3E3E',
                marginBottom: '16px',
              }}
            >
              <strong>A unit of Mangal Royal Jewels Pvt Ltd — since 1975.</strong> For over five decades, our family has been synonymous with hallmarked purity and master Indian artistry.
            </p>
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: '#3E3E3E',
                marginBottom: '28px',
              }}
            >
              Today, Mangal Royal Studio pairs that heirloom heritage with 100% IGI-certified EF-VVS lab-grown diamonds — giving you extraordinary brilliance with conscious modern provenance.
            </p>
            <Link
              href="/pages/about-us"
              style={{
                display: 'inline-block',
                padding: '13px 32px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
              }}
            >
              Discover Our Story
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <img
              src={THEME_IMAGES.brandStoryTop}
              alt="Mangal Royal Studio Craftsmanship"
              style={{
                gridColumn: '1 / -1',
                width: '100%',
                height: '280px',
                objectFit: 'cover',
              }}
            />
            <img
              src={THEME_IMAGES.brandStoryLeft}
              alt="Royal Heritage Detail"
              style={{ width: '100%', height: '240px', objectFit: 'cover' }}
            />
            <img
              src={THEME_IMAGES.brandStoryRight}
              alt="Lab-Grown Diamond Brilliance"
              style={{ width: '100%', height: '240px', objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* 8. FOUR-PILLAR TRUST BAR (sections/trust-bar.liquid) */}
      <section
        style={{
          backgroundColor: '#8B0D2B',
          color: '#FFFFFF',
          padding: '22px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1300px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#F8E1CF' }}>
              IGI Certified
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Every diamond certified for authenticity
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#F8E1CF' }}>
              Lifetime Exchange
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Full value on every piece, forever
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#F8E1CF' }}>
              Free Insured Shipping
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Tamper-evident insured delivery across India
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#F8E1CF' }}>
              Free Resizing
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Complimentary for 30 days after purchase
            </div>
          </div>
        </div>
      </section>

      {/* 9. SHOP BY PRICE (sections/shop-by-price.liquid) */}
      <section
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '64px 70px 90px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <p className="mrs-section-eyebrow-script">Luxury within reach</p>
          <h2 className="mrs-section-heading-serif">SHOP BY PRICES</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '32px',
          }}
        >
          {PRICE_TIERS.map((tier) => (
            <Link
              key={tier.handle}
              href={`/collections/${tier.handle}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '285 / 380', overflow: 'hidden' }}>
                <img
                  src={tier.image}
                  alt={tier.strip}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(25,3,3,0.68) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '24px',
                    color: '#FFFFFF',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-script)', fontSize: '38px', lineHeight: 1 }}>
                    {tier.script}
                  </span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600 }}>
                    ₹{tier.amount}
                  </span>
                </div>
              </div>
              <div
                style={{
                  background: '#7D132A',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: '8px 12px',
                  fontSize: '13px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {tier.strip}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 10. EDITORIAL QUOTE IMAGE BANNER (sections/image-banner.liquid) */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: '440px',
          overflow: 'hidden',
        }}
      >
        <img
          src={THEME_IMAGES.quoteBanner}
          alt="Luxury today is not just about what you wear"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(18, 4, 7, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <blockquote
            style={{
              maxWidth: '820px',
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              lineHeight: 1.3,
              color: '#FFFFFF',
              fontStyle: 'italic',
            }}
          >
            “Luxury today is not just about what you wear. It’s about the choices you make.”
          </blockquote>
        </div>
      </section>

      {/* 11. WHY LAB GROWN (sections/why-lab-grown.liquid) */}
      <section
        style={{
          backgroundColor: '#F9E2D2',
          padding: '90px 70px',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '64px',
            alignItems: 'center',
          }}
        >
          <div>
            <img
              src={THEME_IMAGES.whyLabGrown}
              alt="Why Lab-Grown Diamonds"
              style={{ width: '100%', maxHeight: '640px', objectFit: 'cover', display: 'block' }}
            />
          </div>

          <div>
            <p className="mrs-section-eyebrow-script">The conscious choice</p>
            <h2 className="mrs-section-heading-serif" style={{ marginBottom: '28px' }}>
              WHY LAB GROWN?
            </h2>

            <div style={{ display: 'grid', gap: '24px', marginBottom: '36px' }}>
              <div style={{ borderBottom: '1px solid rgba(25,3,3,0.15)', paddingBottom: '18px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#7D132A', marginBottom: '4px' }}>
                  01. Physically, Optically & Chemically Identical
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#3E3E3E', lineHeight: 1.6 }}>
                  100% real pure carbon crystal diamonds with identical fire, scintillation, Mohs 10 hardness, and IGI grading as mined diamonds.
                </p>
              </div>

              <div style={{ borderBottom: '1px solid rgba(25,3,3,0.15)', paddingBottom: '18px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#7D132A', marginBottom: '4px' }}>
                  02. Consciously Crafted
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#3E3E3E', lineHeight: 1.6 }}>
                  Zero earth-excavation footprint with full origin traceability from seed crystal to BIS-hallmarked gold setting.
                </p>
              </div>

              <div style={{ borderBottom: '1px solid rgba(25,3,3,0.15)', paddingBottom: '18px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#7D132A', marginBottom: '4px' }}>
                  03. Extraordinary Solitaire Value
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#3E3E3E', lineHeight: 1.6 }}>
                  Experience higher EF colour and VVS clarity grades in larger carat weights with complete price breakup transparency.
                </p>
              </div>
            </div>

            <Link
              href="/collections/all"
              style={{
                display: 'inline-block',
                padding: '14px 36px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
              }}
            >
              Explore Lab Grown
            </Link>
          </div>
        </div>
      </section>

      {/* 12B. SEO EDITORIAL CONTENT (sections/content.liquid) */}
      <section
        style={{
          backgroundColor: '#F7E0D0',
          padding: '48px 40px',
          borderTop: '1px solid #E7D1C4',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              textTransform: 'uppercase',
              margin: '0 0 12px 0',
            }}
          >
            Best Online Jewellery Store in India for Modern & Traditional Lab-Grown Diamond Designs
          </h2>
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#3E3E3E', margin: 0 }}>
            Mangal Royal Studio, a proud unit of Mangal Royal Jewels Pvt Ltd (established 1975), brings together fifty years of Indian jewellery heritage and IGI-certified EF-VVS lab-grown diamonds. Every ring, earring, necklace, bracelet, bangle, and mangalsutra is crafted in BIS-hallmarked 14K, 18K, and 22K gold with transparent component-level pricing.
          </p>
          {seoExpanded && (
            <div style={{ marginTop: '14px', fontSize: '13px', lineHeight: 1.7, color: '#3E3E3E' }}>
              <p>
                Whether you are selecting an emerald-cut solitaire engagement ring, classic four-prong diamond studs, or a bridal graduated diamond haar, every purchase includes an itemized GST invoice showing net gold weight, purity rate per gram, diamond carat matrix valuation, making charges, and an immutable purchase-time price guarantee.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSeoExpanded(!seoExpanded)}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 0,
              padding: 0,
              color: '#7D132A',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {seoExpanded ? 'Read Less' : 'Read More'}
          </button>
        </div>
      </section>
    </div>
  );
}

