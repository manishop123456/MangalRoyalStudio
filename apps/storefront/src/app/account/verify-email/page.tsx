'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_BASE_URL, storefrontFetch } from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';
import { CustomerFacingError, friendlyApiError, friendlyThrown } from '../../../lib/customer-messages';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { setCustomer } = useStorefront();
  const [message, setMessage] = useState('Verifying your email address…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) {
      setFailed(true);
      setMessage('This verification link is invalid or has expired. Request a new email to continue.');
      return;
    }
    storefrontFetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.csrfToken || !data.customer) throw new CustomerFacingError(friendlyApiError(response.status, data, 'Email verification failed.'));
      if (!active) return;
      setCustomer(data.customer, data.csrfToken);
      setMessage('Your email is verified. Opening your account…');
      router.replace('/account');
    }).catch((reason: unknown) => {
      if (!active) return;
      setFailed(true);
      setMessage(friendlyThrown(reason, 'Email verification failed.'));
    });
    return () => { active = false; };
  }, [router, setCustomer]);

  return <div style={{ maxWidth: '560px', margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center' }}>
    <p className="mrs-section-eyebrow-script" style={{ fontSize: '44px' }}>Royal circle</p>
    <h1 className="mrs-section-heading-serif" style={{ fontSize: '32px' }}>EMAIL VERIFICATION</h1>
    <p role={failed ? 'alert' : 'status'} style={{ color: failed ? '#991B1B' : '#6B5B5B', fontSize: '14px' }}>{message}</p>
    {failed ? <Link href="/account/register" style={{ color: '#7D132A', textDecoration: 'underline' }}>Return to registration</Link> : null}
  </div>;
}
