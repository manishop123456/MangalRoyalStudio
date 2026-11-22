import React from 'react';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '90px 24px', textAlign: 'center' }}>
      <p className="mrs-section-eyebrow-script" style={{ fontSize: '52px' }}>
        Page not found
      </p>
      <h1 className="mrs-section-heading-serif" style={{ fontSize: '38px', marginBottom: '16px' }}>
        404 — THIS VAULT PAGE HAS MOVED
      </h1>
      <p style={{ fontSize: '14px', color: '#6B5B5B', marginBottom: '28px' }}>
        The jewellery piece or page you are looking for could not be found. Explore our IGI-certified lab-grown diamond collections below.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '14px 36px',
          background: '#7D132A',
          color: '#FFFFFF',
          fontSize: '12px',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}
      >
        Return To Homepage
      </Link>
    </div>
  );
}

