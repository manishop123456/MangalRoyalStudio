'use client';

import React, { useEffect, useState } from 'react';
import { API_BASE_URL, storefrontFetch } from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';

export default function OrderTrackingPage() {
  const { customerToken } = useStorefront();
  const [orderNumber, setOrderNumber] = useState('');
  const [awb, setAwb] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [trackingResult, setTrackingResult] = useState<{
    orderNumber: string;
    courierName: string;
    awbCode: string;
    status: string;
    latestMilestone: string;
    history: Array<{ timestamp: string; status: string }>;
  } | null>(null);

  useEffect(() => {
    const queryOrder = new URLSearchParams(window.location.search).get('orderNumber');
    if (queryOrder) setOrderNumber(queryOrder);
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setTrackingResult(null);
    try {
      const accessToken = sessionStorage.getItem(`mrs_order_token_${orderNumber.trim()}`);
      if (!accessToken && !customerToken) {
        setErrorMessage('Sign in to track an account order, or use the secure order link from your confirmation.');
        return;
      }
      const headers: Record<string, string> = {};
      if (!customerToken && accessToken) headers['X-MRS-Order-Token'] = accessToken;
      const res = await storefrontFetch(
        `${API_BASE_URL}/public/orders/track?orderNumber=${encodeURIComponent(orderNumber)}${awb ? `&awb=${encodeURIComponent(awb)}` : ''}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.tracking || data.shipment) {
          setTrackingResult({
            orderNumber: data.tracking?.orderNumber || data.shipment?.orderNumber || orderNumber,
            courierName: data.shipment?.courierName || data.tracking?.courierName || 'BlueDart Insured Jewellery Air',
            awbCode: data.shipment?.awbCode || data.tracking?.awbCode || awb,
            status: data.shipment?.status || data.tracking?.status || 'IN_TRANSIT',
            latestMilestone:
              data.shipment?.latestMilestone ||
              data.tracking?.latestMilestone ||
              'Shipment status updated',
            history:
              data.shipment?.trackingHistory ||
              data.tracking?.trackingHistory ||
              [],
          });
        }
      } else {
        setErrorMessage('Order tracking could not be authorized or no matching shipment was found.');
      }
    } catch {
      setErrorMessage('The tracking service is unavailable. Please try again later.');
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '56px 24px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
          Insured logistics
        </p>
        <h1 className="mrs-section-heading-serif">TRACK YOUR ORDER</h1>
        <p style={{ fontSize: '14px', color: '#6B5B5B' }}>
          Enter your order number. The secure order link in your confirmation provides access to tracking.
        </p>
      </div>

      <form
        onSubmit={handleTrack}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          background: '#F8E1CF',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        {errorMessage ? <div role="alert" style={{ gridColumn: '1 / -1', color: '#991B1B', fontSize: '13px' }}>{errorMessage}</div> : null}
        <input
          type="text"
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order Number"
          style={{ padding: '12px', border: '1px solid #D5CBC8', background: '#FFFFFF' }}
        />
        <input
          type="text"
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="AWB Code (optional)"
          style={{ padding: '12px', border: '1px solid #D5CBC8', background: '#FFFFFF' }}
        />
        <button
          type="submit"
          style={{
            padding: '12px 24px',
            background: '#7D132A',
            color: '#FFFFFF',
            border: 0,
            fontSize: '12px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Track Shipment
        </button>
      </form>

      {trackingResult ? <div style={{ border: '1px solid #E6E0DE', padding: '28px', background: '#FFFFFF' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '18px',
            borderBottom: '1px solid #E6E0DE',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#7D132A', fontWeight: 600 }}>
              ORDER #{trackingResult.orderNumber} • AWB: {trackingResult.awbCode}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', margin: '4px 0' }}>
              {trackingResult.latestMilestone}
            </h2>
            <div style={{ fontSize: '13px', color: '#6B5B5B' }}>
              Courier: {trackingResult.courierName}
            </div>
          </div>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              background: '#7D132A',
              color: '#FFFFFF',
              fontSize: '11px',
              letterSpacing: '1px',
            }}
          >
            {trackingResult.status}
          </span>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {trackingResult.history.map((step, idx) => (
            <div
              key={idx}
              style={{
                paddingLeft: '16px',
                borderLeft: '2px solid #7D132A',
              }}
            >
              <div style={{ fontSize: '12px', color: '#7D132A', fontWeight: 600 }}>
                {step.status} — {step.timestamp}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{step.status}</div>
            </div>
          ))}
        </div>
      </div> : <p style={{ textAlign: 'center', color: '#6B5B5B', fontSize: '14px' }}>Enter the order number associated with the secure order link to view tracking.</p>}
    </div>
  );
}

