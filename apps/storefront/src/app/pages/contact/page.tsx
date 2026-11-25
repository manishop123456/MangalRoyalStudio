'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '../../../lib/storefront-data';
import { BUSINESS_INFO } from '../../../lib/business-info';

const field: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  border: '1px solid #D8C3B6',
  background: '#FFFFFF',
  fontSize: '15px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  minHeight: '46px',
};
const label: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '12px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: '#4A433E',
};

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/public/appointment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? 'Too many requests. Please try again in a few minutes or email us.'
            : data.message || 'We could not send your request. Please email us instead.'
        );
        setStatus('error');
        return;
      }
      setReference(data.reference || '');
      setStatus('done');
    } catch {
      setError('We could not reach the studio. Please email us instead.');
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Private concierge
        </p>
        <h1 className="mrs-section-heading-serif">CONTACT MANGAL ROYAL STUDIO</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '44px',
        }}
      >
        <div style={{ background: '#FBE8DB', padding: '32px', border: '1px solid #E7D1C4', alignSelf: 'start', display: 'grid', gap: '12px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', margin: 0 }}>
            {BUSINESS_INFO.brandName}
          </h2>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#3E3E3E', margin: 0 }}>
            <strong>Legal Name:</strong> {BUSINESS_INFO.legalName}
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#3E3E3E', margin: 0 }}>
            <strong>Registered Address:</strong> {BUSINESS_INFO.address}
          </p>
          <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: '#3E3E3E', margin: 0 }}>
            <strong>GSTIN:</strong> {BUSINESS_INFO.gstin}
            <br />
            <strong>BIS Hallmarking Reg. No.:</strong> {BUSINESS_INFO.bisHallmarkRegNo}
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#3E3E3E', margin: 0 }}>
            <strong>Support Email:</strong>{' '}
            <a href={`mailto:${BUSINESS_INFO.supportEmail}`} style={{ color: '#7D132A', textDecoration: 'underline' }}>
              {BUSINESS_INFO.supportEmail}
            </a>
            <br />
            <strong>Support Phone:</strong>{' '}
            <a href={`tel:${BUSINESS_INFO.supportPhone}`} style={{ color: '#7D132A', textDecoration: 'underline' }}>
              {BUSINESS_INFO.supportPhone}
            </a>
            <br />
            <strong>Support Hours:</strong> {BUSINESS_INFO.supportHours} (IST)
          </p>
          <div style={{ borderTop: '1px solid #DFC4B4', paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#7D132A', marginBottom: '4px' }}>
              Grievance Officer
            </div>
            <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: '#3E3E3E', margin: 0 }}>
              {BUSINESS_INFO.grievanceOfficer.name} ({BUSINESS_INFO.grievanceOfficer.designation})
              <br />
              <a href={`mailto:${BUSINESS_INFO.grievanceOfficer.email}`} style={{ color: '#7D132A', textDecoration: 'underline' }}>
                {BUSINESS_INFO.grievanceOfficer.email}
              </a>{' '}
              ·{' '}
              <a href={`tel:${BUSINESS_INFO.grievanceOfficer.phone}`} style={{ color: '#7D132A', textDecoration: 'underline' }}>
                {BUSINESS_INFO.grievanceOfficer.phone}
              </a>
            </p>
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#4A433E', margin: 0 }}>
            Studio visits are by appointment. Send us a request and our concierge will confirm a time with you.
          </p>
        </div>

        <div id="appointment" style={{ scrollMarginTop: '120px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', margin: '0 0 8px 0' }}>
            Request a Private Viewing
          </h2>
          <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', lineHeight: 1.7, color: '#4A433E' }}>
            Tell us when you would like to visit. This is a request, not a confirmed booking — we will contact you to
            confirm the time.
          </p>

          {status === 'done' ? (
            <div role="status" style={{ background: '#FBE8DB', border: '1px solid #E7D1C4', padding: '24px' }}>
              <strong>Thank you — your request has been received.</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.7 }}>
                Reference <strong>{reference}</strong>. Our concierge will contact you to confirm your appointment.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: '14px' }}>
              <label style={label}>
                Full name
                <input name="name" required minLength={2} maxLength={120} autoComplete="name" style={field} />
              </label>
              <label style={label}>
                Phone
                <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" style={field} />
              </label>
              <label style={label}>
                Email (optional)
                <input name="email" type="email" autoComplete="email" style={field} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                <label style={label}>
                  Preferred date
                  <input name="preferredDate" type="date" required style={field} />
                </label>
                <label style={label}>
                  Preferred time
                  <select name="preferredTime" style={field} defaultValue="">
                    <option value="">Any time</option>
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                  </select>
                </label>
              </div>
              <label style={label}>
                Piece of interest (name or SKU)
                <input name="productOfInterest" maxLength={200} style={field} />
              </label>
              <label style={label}>
                Notes (optional)
                <textarea name="notes" maxLength={1000} rows={3} style={field} />
              </label>
              {/* Honeypot: hidden from people, bots tend to fill it */}
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
              {status === 'error' && (
                <p role="alert" style={{ margin: 0, color: '#7D132A', fontSize: '14px' }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  padding: '15px 24px',
                  background: '#7D132A',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12px',
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  minHeight: '48px',
                }}
              >
                {status === 'sending' ? 'Sending…' : 'Request Appointment'}
              </button>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#4A433E' }}>
                Prefer email?{' '}
                <a
                  href={`mailto:${BUSINESS_INFO.supportEmail}?subject=Private%20Viewing%20Enquiry%20-%20Mangal%20Royal%20Studio`}
                  style={{ color: '#7D132A' }}
                >
                  {BUSINESS_INFO.supportEmail}
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
