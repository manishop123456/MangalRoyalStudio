'use client';

import React from 'react';
import Link from 'next/link';
import { THEME_IMAGES } from '../../../lib/storefront-data';
import { SafeImage } from '../../../components/SafeImage';

const CORE_VALUES = [
  {
    title: 'Legacy & Trust',
    description:
      '50+ years of heritage built on relationships, craftsmanship and unwavering customer trust. Our name is our promise — passed from generation to generation.',
  },
  {
    title: 'Modern Luxury',
    description:
      "Contemporary jewellery designed for today's consumer. Minimal, elegant and wearable — luxury that moves with you, not just for the occasion.",
  },
  {
    title: 'Conscious Brilliance',
    description:
      'Lab-grown diamonds that reflect a smarter, more sustainable choice for modern lifestyles. Brilliance without compromise — for you and the world you live in.',
  },
  {
    title: 'Emotional Storytelling',
    description:
      'Jewellery designed to celebrate moments, memories and meaningful connections. Every piece carries an emotion before it carries a price.',
  },
];

const MANGAL_GROUP_ENTITIES = [
  {
    name: 'Mangal Royal Studio',
    description:
      'Lab-grown diamond jewellery. Heritage craftsmanship reimagined for the modern, conscious buyer.',
  },
  {
    name: 'Mangal Credit and Fincorp Ltd',
    description:
      'Trusted NBFC offering gold loans, personal loans, SME financing & property loans across Maharashtra & Gujarat.',
  },
  {
    name: 'Mangal Finserv Pvt Ltd',
    description:
      'Customer-centric unsecured lending with simplified digital experiences and transparent financial education.',
  },
  {
    name: 'Mangal BuildHome Pvt Ltd',
    description:
      'Premium residential and commercial real estate. Thoughtfully designed spaces balancing luxury and everyday comfort.',
  },
  {
    name: 'Mangal Entertainment Pvt Ltd',
    description:
      'End-to-end event management via Mangal Moments — weddings, corporate events, celebrations curated with precision.',
  },
  {
    name: 'Mangal Charitable Trust',
    description:
      'Empowering underprivileged communities through healthcare, education, skill development and welfare since 1975.',
  },
];

export default function AboutUsPage() {
  return (
    <div>
      {/* 1. HERO SECTION */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '56px clamp(16px, 4vw, 36px)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          <div>
            <p className="mrs-section-eyebrow-script" style={{ textAlign: 'left', fontSize: '46px', marginBottom: '4px' }}>
              We believe in blend
            </p>
            <h1
              className="mrs-section-heading-serif"
              style={{ textAlign: 'left', fontSize: 'clamp(28px, 4vw, 44px)', marginBottom: '20px' }}
            >
              WHERE HERITAGE MEETS THE MODERN DIAMOND.
            </h1>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#3E3E3E', marginBottom: '20px' }}>
              We are not just a jewellery brand. We are a 50-year promise — of trust, of craftsmanship, and of
              jewellery that means something. Built on legacy. Refined for today.
            </p>
            <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#2D2021', marginBottom: '28px' }}>
              We believe in:
              <br />
              <strong>&ldquo;Designed for every day. Treasured for a lifetime.&rdquo;</strong>
            </p>
            <Link
              href="/collections/all"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              EXPLORE OUR COLLECTION
            </Link>
          </div>
          <div>
            <SafeImage
              src={THEME_IMAGES.brandStoryTop}
              alt="Where Heritage Meets The Modern Diamond"
              style={{ width: '100%', aspectRatio: '4 / 4.2', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* 2. LEGACY STORY SECTION */}
      <section style={{ background: '#F6E3D4', padding: '72px clamp(16px, 4vw, 36px)' }}>
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <SafeImage
              src={THEME_IMAGES.brandStoryLeft}
              alt="Mangal Royal Studio Craftsmanship"
              style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block' }}
            />
            <SafeImage
              src={THEME_IMAGES.brandStoryRight}
              alt="Mangal Royal Studio Diamond Inspection"
              style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block', marginTop: '32px' }}
            />
          </div>
          <div>
            <p className="mrs-section-eyebrow-script" style={{ textAlign: 'left', fontSize: '44px', marginBottom: '4px' }}>
              The conscious choice
            </p>
            <h2
              className="mrs-section-heading-serif"
              style={{ textAlign: 'left', fontSize: 'clamp(26px, 3.6vw, 38px)', marginBottom: '20px' }}
            >
              A LEGACY JEWELLERY HOUSE REIMAGINED FOR TODAY.
            </h2>
            <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: '#3E3E3E', marginBottom: '16px' }}>
              In 1975, Mangal Royal Jewels was founded on two things that cannot be bought — trust and
              craftsmanship. For decades, families across generations have walked through our doors and left
              carrying more than jewellery. They carried a piece of an institution that truly understood what fine
              jewellery means: not just the weight of gold or the clarity of stone, but the weight of emotion and
              the clarity of occasion.
            </p>
            <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: '#3E3E3E', marginBottom: '16px' }}>
              Mangal Royal Studio is the next chapter of this story. Born from the same house, informed by the same
              values — but designed for a new generation of discerning, conscious and deeply personal luxury.
            </p>
            <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: '#3E3E3E', marginBottom: '22px' }}>
              Every piece at Mangal Royal Studio is designed to celebrate emotions, milestones and everyday luxury
              in a way that feels timeless yet deeply relevant to who you are today.
            </p>
            <blockquote
              style={{
                margin: 0,
                paddingLeft: '16px',
                borderLeft: '3px solid #7D132A',
                fontFamily: 'var(--font-serif)',
                fontSize: '20px',
                fontStyle: 'italic',
                color: '#2D2021',
                lineHeight: 1.5,
              }}
            >
              &ldquo;Luxury today is not just about what you wear. It&rsquo;s about the choices you make.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* 3. OUR CORE VALUES */}
      <section style={{ background: '#7D132A', color: '#FFFFFF', padding: '72px clamp(16px, 4vw, 36px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <p
              className="mrs-section-eyebrow-script"
              style={{ color: '#F8E1CF', fontSize: '44px', marginBottom: '4px' }}
            >
              What we stand for
            </p>
            <h2 className="mrs-section-heading-serif" style={{ color: '#FFFFFF', fontSize: '36px' }}>
              OUR CORE VALUES
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              gap: '20px',
            }}
          >
            {CORE_VALUES.map((val) => (
              <div
                key={val.title}
                style={{
                  border: '1px solid rgba(248, 225, 207, 0.35)',
                  padding: '28px 24px',
                  background: 'rgba(255, 255, 255, 0.04)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '22px',
                    color: '#F8E1CF',
                    margin: '0 0 12px 0',
                  }}
                >
                  {val.title}
                </h3>
                <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                  {val.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. THE VISIONARIES BEHIND MANGAL ROYAL STUDIO */}
      <section style={{ background: '#FBF3EC', padding: '76px clamp(16px, 4vw, 36px)' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px', marginBottom: '4px' }}>
              The backbone
            </p>
            <h2 className="mrs-section-heading-serif" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>
              THE VISIONARIES BEHIND MANGAL ROYAL STUDIO
            </h2>
          </div>

          <div style={{ display: 'grid', gap: '44px' }}>
            {/* Visionary 1: Ajit S. Jain */}
            <div
              style={{
                background: '#FFFFFF',
                padding: 'clamp(24px, 4vw, 40px)',
                border: '1px solid #EADCD1',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '28px',
                  color: '#2D2021',
                  margin: '0 0 14px 0',
                }}
              >
                Ajit S. Jain — Director
              </h3>
              <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: '#3E3E3E', margin: '0 0 20px 0' }}>
                Ajit S. Jain brings to Mangal Royal Studio a rare blend of strategic vision and deep-rooted passion
                for fine jewellery. With decades of leadership across the Mangal Group, he has shaped businesses
                defined by trust, integrity and long-term thinking. His commitment to excellence is not simply
                professional — it is personal. Under his direction, Mangal Royal Studio carries forward a fifty-year
                legacy while daring to reimagine what luxury jewellery can be.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {['STRATEGY', 'LEADERSHIP', 'INNOVATION'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '1.2px',
                      color: '#7D132A',
                      padding: '6px 14px',
                      background: '#F8E1CF',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Visionary 2: Panav Jain */}
            <div
              style={{
                background: '#FFFFFF',
                padding: 'clamp(24px, 4vw, 40px)',
                border: '1px solid #EADCD1',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '28px',
                  color: '#2D2021',
                  margin: '0 0 14px 0',
                }}
              >
                Panav Jain — Branding Partner
              </h3>
              <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: '#3E3E3E', margin: '0 0 20px 0' }}>
                Panav Jain is the creative and strategic force behind the Mangal Royal Studio brand identity.
                Operating across Ahmedabad and Mumbai, he brings a sharp understanding of modern consumer behaviour,
                cultural sensibility and the aspirational language of luxury. With focused experience in jewellery
                branding and market research, Panav has built a brand that feels simultaneously rooted in heritage
                and fluent in the aesthetic vocabulary of today&rsquo;s most discerning audiences.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {['BRAND', 'CONSUMER INSIGHT', 'MARKETING'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '1.2px',
                      color: '#7D132A',
                      padding: '6px 14px',
                      background: '#F8E1CF',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BRAND PROMISE */}
      <section style={{ background: '#7D132A', color: '#FFFFFF', padding: '72px clamp(16px, 4vw, 36px)' }}>
        <div
          style={{
            maxWidth: '1140px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '44px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <SafeImage
              src={THEME_IMAGES.catRings}
              alt="Mangal Royal Studio Rings"
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
            />
            <SafeImage
              src={THEME_IMAGES.catBracelets}
              alt="Mangal Royal Studio Bracelets"
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <h2
              className="mrs-section-heading-serif"
              style={{ color: '#FFFFFF', textAlign: 'left', fontSize: '36px', marginBottom: '6px' }}
            >
              BRAND PROMISE
            </h2>
            <p
              className="mrs-section-eyebrow-script"
              style={{ color: '#F8E1CF', textAlign: 'left', fontSize: '40px', marginBottom: '16px' }}
            >
              Every piece. Every detail. Every time.
            </p>
            <p style={{ fontSize: '14.5px', lineHeight: 1.75, color: 'rgba(255,255,255,0.9)', marginBottom: '28px' }}>
              We do not simply sell jewellery. We curate experiences, honour emotions and deliver pieces that carry
              the full weight of fifty years of earned trust. When you choose Mangal Royal Studio, you choose a
              legacy — and you begin one of your own.
            </p>
            <Link
              href="/collections/all"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                background: '#F8E1CF',
                color: '#7D132A',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              EXPLORE OUR COLLECTIONS
            </Link>
          </div>
        </div>
      </section>

      {/* 6. EXPERIENCE BRILLIANCE IN PERSON (SHOWROOM) */}
      <section style={{ background: '#D2A684', color: '#FFFFFF', padding: '72px clamp(16px, 4vw, 36px)' }}>
        <div
          style={{
            maxWidth: '1140px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '40px',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              className="mrs-section-heading-serif"
              style={{ color: '#FFFFFF', textAlign: 'left', fontSize: 'clamp(28px, 3.8vw, 40px)', marginBottom: '16px' }}
            >
              EXPERIENCE BRILLIANCE IN PERSON.
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#FFFFFF', marginBottom: '24px' }}>
              Our showroom in Vile Parle, Mumbai is a sanctuary of fine jewellery — where every piece may be held,
              worn and truly felt. We invite you to experience the Mangal Royal Studio difference.
            </p>
            <Link
              href="/pages/contact"
              style={{
                display: 'inline-block',
                paddingBottom: '6px',
                borderBottom: '1.5px solid #FFFFFF',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
              }}
            >
              VILE PARLE, MUMBAI ↗
            </Link>
          </div>
          <div>
            <SafeImage
              src={THEME_IMAGES.heroSlide1}
              alt="Mangal Royal Studio Showroom — Vile Parle, Mumbai"
              style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* 7. THE MANGAL GROUP */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '76px clamp(16px, 4vw, 36px)' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px', marginBottom: '4px' }}>
            The Mangal Group
          </p>
          <h2 className="mrs-section-heading-serif" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>
            A LEGACY THAT EXTENDS BEYOND JEWELLERY
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '24px',
          }}
        >
          {MANGAL_GROUP_ENTITIES.map((entity) => (
            <div
              key={entity.name}
              style={{
                border: '1px solid #DFC5B4',
                padding: '32px 24px',
                textAlign: 'center',
                background: '#FFFFFF',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '22px',
                  color: '#2D2021',
                  margin: '0 0 12px 0',
                }}
              >
                {entity.name}
              </h3>
              <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: '#5A4E4E', margin: 0 }}>
                {entity.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. BOTTOM CTA */}
      <section style={{ background: '#F6E3D4', padding: '64px clamp(16px, 4vw, 36px)', textAlign: 'center' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <h2
            className="mrs-section-heading-serif"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '12px', textTransform: 'none' }}
          >
            Ready to find your forever piece?
          </h2>
          <p style={{ fontSize: '15px', color: '#4A433E', marginBottom: '28px' }}>
            Explore our collections of certified lab-grown diamond jewellery crafted with five decades of expertise.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link
              href="/collections/all"
              style={{
                padding: '14px 32px',
                background: '#2D2021',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              SHOP COLLECTIONS
            </Link>
            <Link
              href="/pages/contact"
              style={{
                padding: '14px 32px',
                border: '1px solid #2D2021',
                color: '#2D2021',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              GET AT HOME SERVICE
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
