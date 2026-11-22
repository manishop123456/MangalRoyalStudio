'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_BASE_URL, storefrontFetch } from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';
import { friendlyApiError } from '../../../lib/customer-messages';

export default function CustomerLoginPage() {
  const router = useRouter();
  const { setCustomer } = useStorefront();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const res = await storefrontFetch(`${API_BASE_URL}/auth/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.csrfToken === 'string' && data.csrfToken && data.customer) {
        setCustomer(data.customer, data.csrfToken);
        router.push('/account');
        return;
      }
      setErrorMessage(friendlyApiError(res.status, data, 'Invalid email or password.'));
      return;
    } catch {
      setErrorMessage('Unable to connect to authentication server. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '64px 24px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px' }}>
          Welcome back
        </p>
        <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>
          SIGN IN
        </h1>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'grid', gap: '16px' }}>
        {errorMessage ? (
          <div style={{ padding: '10px 12px', background: '#FDF2F2', border: '1px solid #E5B4B4', color: '#7D132A', fontSize: '13px' }}>
            {errorMessage}
          </div>
        ) : null}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          style={{ padding: '12px 14px', border: '1px solid #D5CBC8' }}
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
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
          Sign In
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
        New to Mangal Royal Studio?{' '}
        <Link href="/account/register" style={{ color: '#7D132A', textDecoration: 'underline' }}>
          Create an Account
        </Link>
      </div>
    </div>
  );
}

