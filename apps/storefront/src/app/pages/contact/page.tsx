'use client';

import React from 'react';

export default function ContactPage() {
  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 32px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Private concierge
        </p>
        <h1 className="mrs-section-heading-serif">VISIT OR CONTACT OUR STUDIO</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '44px',
        }}
      >
        <div style={{ background: '#FBE8DB', padding: '32px', border: '1px solid #E7D1C4' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', margin: '0 0 14px 0' }}>
            Mangal Royal Studio — Mumbai Flagship
          </h2>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#3E3E3E' }}>
            <strong>A Unit of Mangal Royal Jewels Pvt Ltd (Since 1975)</strong>
            <br />
            Linking Road / Zaveri Bazaar Heritage Vault,
            <br />
            Mumbai — 400050, Maharashtra, India
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#3E3E3E' }}>
            <strong>Concierge Phone:</strong> +91 22 2640 1975 / +91 98201 19750
            <br />
            <strong>Email:</strong> concierge@mangalroyalstudio.com
            <br />
            <strong>Studio Hours:</strong> Mon – Sun, 11:00 AM – 8:30 PM IST
          </p>
        </div>

        <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', margin: 0 }}>
            Book a Private Viewing or Enquiry
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.7, color: '#4A433E' }}>
            Online appointment scheduling is not yet enabled on the web storefront. Please reach our Mumbai
            concierge directly by email or phone for private viewings, bespoke sizing, or order assistance.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
            <a
              href="mailto:concierge@mangalroyalstudio.com?subject=Private%20Viewing%20Enquiry%20-%20Mangal%20Royal%20Studio"
              style={{
                padding: '14px 24px',
                background: '#7D132A',
                color: '#FFFFFF',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Email Studio Concierge
            </a>
            <a
              href="tel:+912240197500"
              style={{
                padding: '14px 24px',
                border: '1px solid #7D132A',
                color: '#7D132A',
                fontSize: '12px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Call +91 22 4019 7500
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

