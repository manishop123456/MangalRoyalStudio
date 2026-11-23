import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataStore, type PlatformState } from '../store/data-store.js';

/**
 * Builds a self-contained, sanitized synthetic PlatformState JSON file inside a private
 * temporary directory so importer and PostgreSQL integration tests never read or depend on
 * `services/api/.data/platform-state.json`.
 */
export function createSyntheticPlatformStateFixture(): {
  dir: string;
  filePath: string;
  state: PlatformState;
  cleanup: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-synthetic-state-'));
  const tmpStoreFile = path.join(dir, 'seed-init.json');
  const store = new DataStore({ filePath: tmpStoreFile, testMode: true });
  const state = structuredClone(store.getState());

  const rng1001 = state.products.find((p) => p.sku === 'MRS-RNG-1001');
  if (rng1001) {
    rng1001.currentShopifyPriceInr = '70336.00';
  }

  const baseOrder = state.orders[0]!;
  const baseSnap = state.pricingSnapshots[0]!;
  for (let i = 1; i <= 6; i += 1) {
    const ordId = `ord-test-synthetic-${i}`;
    state.orders.push({
      ...baseOrder,
      id: ordId,
      orderNumber: `TEST-ORD-${1794000000000 + i}`,
      customerId: i === 1 ? 'cust-guest' : baseOrder.customerId,
      customerEmail: 'buyer@example.com',
      customerName: `Synthetic Test Buyer ${i}`,
      lineItems: [
        {
          ...baseOrder.lineItems[0]!,
          pricingSnapshotId: i === 1 ? 'checkout-immutable-lock' : `snap-test-${i}`,
        },
      ],
    });
    state.refunds.push({
      id: `rfnd-179000000${i}`,
      orderId: ordId,
      orderNumber: `TEST-ORD-${1794000000000 + i}`,
      paymentId: 'pay_test_verified_001',
      providerRefundId: `rfnd_prov_${i}`,
      amountInr: '1000.00',
      reason: 'Synthetic test artifact refund',
      status: 'PROCESSED',
      initiatedByEmail: 'owner@mangalroyalstudio.com',
      processedAt: '2026-11-12T10:00:00.000Z',
    });
    state.pricingSnapshots.push({
      ...baseSnap,
      id: `snap-test-${i}`,
      pricingRunId: 'checkout-immutable-lock',
      sku: 'MRS-RNG-1001',
      publishedAt: '2026-11-12T10:00:00.000Z',
    });
  }

  state.payments.push(
    {
      id: 'pay-test-synthetic-1',
      orderId: 'ord-test-synthetic-1',
      orderNumber: 'TEST-ORD-1794000000001',
      provider: 'RAZORPAY',
      providerPaymentId: 'pay_test_verified_001',
      amountInr: '68500.00',
      currency: 'INR',
      method: 'card',
      status: 'CAPTURED',
      signatureVerified: true,
      capturedAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'pay-test-synthetic-2',
      orderId: 'ord-test-synthetic-2',
      orderNumber: 'TEST-ORD-1794000000002',
      provider: 'RAZORPAY',
      providerPaymentId: 'pay_test_verified_001',
      amountInr: '68500.00',
      currency: 'INR',
      method: 'card',
      status: 'CAPTURED',
      signatureVerified: true,
      capturedAt: '2026-11-12T10:00:00.000Z',
    }
  );

  const filePath = path.join(dir, 'platform-state.synthetic.json');
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');

  return {
    dir,
    filePath,
    state,
    cleanup: () => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
