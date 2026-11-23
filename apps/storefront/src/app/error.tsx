'use client';

import React from 'react';
import Link from 'next/link';

export default function StorefrontErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
      <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
        Temporary interruption
      </p>
      <h1 className="mrs-section-heading-serif" style={{ fontSize: '34px', marginBottom: '16px' }}>
        SOMETHING WENT WRONG
      </h1>
      <p style={{ fontSize: '14px', color: '#6B5B5B', marginBottom: '28px', lineHeight: 1.6 }}>
        We could not load this page right now. Please try again or contact our studio concierge for assistance.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '13px 28px',
            background: '#7D132A',
            color: '#FFFFFF',
            fontSize: '12px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            border: 0,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
        <Link
          href="/contact"
          style={{
            padding: '13px 28px',
            border: '1px solid #7D132A',
            color: '#7D132A',
            fontSize: '12px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          Contact Studio
        </Link>
      </div>
    </div>
  );
}
