'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const POLICIES: Record<string, { title: string; body: string[] }> = {
  'lifetime-exchange': {
    title: 'Lifetime Exchange & Buyback Policy',
    body: [
      'Every Mangal Royal Studio piece is backed by Mangal Royal Jewels Pvt Ltd (Since 1975).',
      'We offer 100% prevailing bullion value on net BIS-hallmarked gold weight and 90% prevailing valuation on IGI-certified EF-VVS lab-grown diamonds when upgrading or exchanging for a new creation.',
      'Please present your original GST Tax Invoice and IGI Authenticity Certificate at our Mumbai Studio or request an insured reverse pickup.',
    ],
  },
  'shipping-policy': {
    title: 'Insured Pan-India Shipping Policy',
    body: [
      'Every order is dispatched in a tamper-evident security box with 100% transit insurance via BlueDart Insured Jewellery Air or Sequel Fine Jewellery Logistics.',
      'Delivery requires recipient verification via mobile OTP upon arrival.',
    ],
  },
  'ring-resizing': {
    title: 'Complimentary 30-Day Ring Resizing',
    body: [
      'Enjoy complimentary resizing within 30 days of purchase across all solitaire and engagement rings.',
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    body: [
      'Mangal Royal Studio respects your privacy. Customer contact details, shipping addresses, and order records are encrypted and never shared with unauthorized third parties.',
    ],
  },
  'terms-of-service': {
    title: 'Terms of Service',
    body: [
      'All jewellery prices are calculated in Indian Rupees (INR) using our versioned Decimal.js pricing engine and include 3% GST (HSN 711319). Once an order is placed, the purchase-time price snapshot is immutably locked.',
    ],
  },
  'refund-policy': {
    title: 'Refund & Return Policy',
    body: [
      'Unworn jewellery with original tags, IGI certificate, and tamper-evident seal intact may be returned within 15 days for a full refund to the original payment method.',
    ],
  },
  'return-policy': {
    title: 'Return Policy',
    body: [
      'Unworn jewellery with original tags, IGI certificate, and tamper-evident seal intact may be returned within 15 days for a full refund to the original payment method.',
    ],
  },
};

export default function PolicyPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || 'lifetime-exchange').toLowerCase();
  const policy = POLICIES[slug] || {
    title: slug.replace(/-/g, ' ').toUpperCase(),
    body: [
      'Mangal Royal Studio (A unit of Mangal Royal Jewels Pvt Ltd — since 1975) guarantees full transparency, IGI certification, and BIS hallmarking on every creation.',
    ],
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '64px 28px 80px' }}>
      <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px' }}>
        Client assurance
      </p>
      <h1 className="mrs-section-heading-serif" style={{ fontSize: '34px', marginBottom: '24px' }}>
        {policy.title}
      </h1>
      <div style={{ display: 'grid', gap: '16px', fontSize: '14px', lineHeight: 1.75, color: '#3E3E3E' }}>
        {policy.body.map((p, idx) => (
          <p key={idx} style={{ margin: 0 }}>
            {p}
          </p>
        ))}
      </div>
      <div style={{ marginTop: '36px' }}>
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
          Back To Shop
        </Link>
      </div>
    </div>
  );
}

