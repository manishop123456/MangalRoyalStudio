'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { POLICIES_MAP, POLICY_ALIASES, type PolicyBlock } from '../../../lib/policies-data';

const POLICY_NAV_LINKS = [
  { slug: 'terms-of-service', label: 'Terms of Sale' },
  { slug: 'privacy-policy', label: 'Privacy' },
  { slug: 'return-policy', label: 'Returns & Exchange' },
  { slug: 'refund-policy', label: 'Refunds' },
  { slug: 'shipping-policy', label: 'Shipping' },
  { slug: 'cancellation-policy', label: 'Cancellation' },
  { slug: 'lifetime-exchange', label: 'Warranty & Buyback' },
  { slug: 'care-guide', label: 'Care Guide' },
  { slug: 'grievance-redressal', label: 'Grievance' },
];

function renderBlock(block: PolicyBlock, idx: number) {
  switch (block.type) {
    case 'heading':
      return (
        <h2
          key={idx}
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '21px',
            color: '#190303',
            margin: '16px 0 4px 0',
          }}
        >
          {block.text}
        </h2>
      );
    case 'paragraph':
      return (
        <p key={idx} style={{ margin: 0, fontSize: '14px', lineHeight: 1.75, color: '#3E3E3E' }}>
          {block.text}
        </p>
      );
    case 'list':
      return (
        <ul
          key={idx}
          style={{
            margin: 0,
            paddingLeft: '20px',
            display: 'grid',
            gap: '8px',
            fontSize: '14px',
            lineHeight: 1.7,
            color: '#3E3E3E',
          }}
        >
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div key={idx} style={{ overflowX: 'auto', border: '1px solid #E6E0DE' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8E1CF', color: '#190303' }}>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #E6E0DE',
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#FFFFFF' : '#FAF7F4' }}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #F0EAE6',
                        color: '#3E3E3E',
                        verticalAlign: 'top',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return (
        <div
          key={idx}
          style={{
            background: '#FAF7F4',
            borderLeft: '3px solid #7D132A',
            padding: '14px 18px',
            fontSize: '13.5px',
            lineHeight: 1.7,
            color: '#3E3E3E',
          }}
        >
          <strong style={{ display: 'block', color: '#7D132A', marginBottom: '4px' }}>{block.title}</strong>
          {block.text}
        </div>
      );
    case 'ownerConfirm':
      return (
        <div
          key={idx}
          style={{
            background: '#FEF7E6',
            border: '1px solid #F0D28C',
            padding: '12px 16px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#6E4B0A',
          }}
        >
          {block.text}
        </div>
      );
  }
}

export default function PolicyPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = String(params?.slug || 'terms-of-service').toLowerCase();
  const resolvedSlug = POLICY_ALIASES[rawSlug] || rawSlug;
  const policy = POLICIES_MAP[resolvedSlug];

  return (
    <div style={{ maxWidth: '940px', margin: '0 auto', padding: '48px 20px 80px' }}>
      <nav
        aria-label="Policy sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '28px',
          paddingBottom: '16px',
          borderBottom: '1px solid #E6E0DE',
        }}
      >
        {POLICY_NAV_LINKS.map((item) => {
          const active = item.slug === resolvedSlug;
          return (
            <Link
              key={item.slug}
              href={`/pages/${item.slug}`}
              style={{
                padding: '6px 12px',
                fontSize: '11.5px',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                border: active ? '1px solid #7D132A' : '1px solid #E6E0DE',
                background: active ? '#7D132A' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#3E3E3E',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {policy ? (
        <>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '40px' }}>
            {policy.partLabel}
          </p>
          <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px', marginBottom: '8px' }}>
            {policy.title}
          </h1>
          <p style={{ fontSize: '12.5px', color: '#6B5B5B', margin: '0 0 28px 0' }}>{policy.subtitle}</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {policy.blocks.map((block, idx) => renderBlock(block, idx))}
          </div>
        </>
      ) : (
        <>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '40px' }}>
            Client assurance
          </p>
          <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px', marginBottom: '16px' }}>
            {rawSlug.replace(/-/g, ' ').toUpperCase()}
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#3E3E3E' }}>
            Mangal Royal Studio (MANGAL ROYAL JEWELS PVT. LTD.) guarantees full transparency, IGI certification, and BIS hallmarking on every creation.
          </p>
        </>
      )}

      <div style={{ marginTop: '36px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/collections/all" className="mrs-btn-primary">
          Back To Shop
        </Link>
        <Link href="/pages/contact" className="mrs-btn-outline">
          Contact Support
        </Link>
      </div>
    </div>
  );
}
