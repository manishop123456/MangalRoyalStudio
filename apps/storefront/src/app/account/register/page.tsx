'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../../lib/storefront-data';
import { friendlyApiError } from '../../../lib/customer-messages';

export default function CustomerRegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [showResend, setShowResend] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202 && data.verificationRequired === true) {
        setVerificationSent(true);
        return;
      }
      setShowResend(data.error === 'EMAIL_ALREADY_REGISTERED' || data.error === 'VERIFICATION_EMAIL_UNAVAILABLE');
      setErrorMessage(friendlyApiError(res.status, data, 'We could not create your account. Please try again.'));
    } catch {
      setErrorMessage('Unable to reach the account service. No account session was created. Please try again.');
    }
  };

  const handleResendVerification = async () => {
    setResendMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verification/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      setResendMessage(response.ok ? 'If this email is registered and not yet verified, a new verification link has been sent.' : friendlyApiError(response.status, data, 'Unable to resend verification email.'));
    } catch {
      setResendMessage('Unable to reach the verification service. Please try again later.');
    }
  };

  if (verificationSent) {
    return <div style={{ maxWidth: '480px', margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center' }}>
      <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px' }}>One last step</p>
      <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>VERIFY YOUR EMAIL</h1>
      <p style={{ color: '#6B5B5B', fontSize: '14px' }}>We sent a verification link to {email.trim().toLowerCase()}. Your account will remain signed out until you verify the address.</p>
      <button type="button" onClick={handleResendVerification} style={{ margin: '16px 0', padding: '10px 18px', border: '1px solid #7D132A', background: '#FFFFFF', color: '#7D132A' }}>Resend verification email</button>
      {resendMessage ? <p role="status" style={{ fontSize: '13px', color: '#6B5B5B' }}>{resendMessage}</p> : null}
      <Link href="/account/login" style={{ color: '#7D132A', textDecoration: 'underline' }}>Return to sign in</Link>
    </div>;
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '64px 24px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px' }}>
          Join the royal circle
        </p>
        <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>
          CREATE ACCOUNT
        </h1>
      </div>

      <form onSubmit={handleRegister} style={{ display: 'grid', gap: '14px' }}>
        {errorMessage ? <div role="alert" style={{ padding: '10px 12px', background: '#FDF2F2', border: '1px solid #E5B4B4', color: '#7D132A', fontSize: '13px' }}>{errorMessage}</div> : null}
        {showResend ? <button type="button" onClick={handleResendVerification} style={{ padding: '10px', border: '1px solid #7D132A', color: '#7D132A', background: '#FFFFFF' }}>Resend verification email</button> : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First Name"
            style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
          />
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last Name"
            style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
          />
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
        />
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile Number (+91)"
          style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create Password (min 6 characters)"
          style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
        />
        <button
          type="submit"
          style={{
            padding: '14px',
            background: '#7D132A',
            color: '#FFFFFF',
            border: 0,
            fontSize: '12px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Register Account
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
        Already have an account?{' '}
        <Link href="/account/login" style={{ color: '#7D132A', textDecoration: 'underline' }}>
          Sign In
        </Link>
      </div>
    </div>
  );
}

