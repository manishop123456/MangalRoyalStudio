/**
 * Development-only helper: sets a password and marks email verified for ONE existing or new customer
 * in an explicitly named, non-protected state file.
 *
 * Usage (never against production, never against the protected repo state files):
 *   NODE_ENV=development MRS_DATA_FILE_PATH=/tmp/mrs-dev-state.json \
 *   DEV_CUSTOMER_EMAIL=dev@example.com DEV_CUSTOMER_PASSWORD='ChangeMe#2026' \
 *   npx tsx src/scripts/create-dev-customer.ts
 *
 * Alternative that needs no script: register through POST /api/auth/register and verify the emailed token.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DataStore, hashPassword, resolveDefaultDataFilePath } from '../store/data-store.js';

function main(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REFUSED: create-dev-customer must never run with NODE_ENV=production.');
  }
  if (!process.env.MRS_DATA_FILE_PATH) {
    throw new Error('REFUSED: set MRS_DATA_FILE_PATH to an explicit development state file.');
  }
  const filePath = resolveDefaultDataFilePath(process.env);
  const protectedFiles = [
    path.resolve(process.cwd(), '.data/platform-state.json'),
    path.resolve(process.cwd(), '../../.data/platform-state.json'),
    resolveDefaultDataFilePath({}),
  ];
  if (protectedFiles.includes(path.resolve(filePath))) {
    throw new Error('REFUSED: target is a protected platform state file.');
  }
  const email = (process.env.DEV_CUSTOMER_EMAIL || '').trim().toLowerCase();
  const password = process.env.DEV_CUSTOMER_PASSWORD || '';
  if (!email || password.length < 12) {
    throw new Error('DEV_CUSTOMER_EMAIL and a DEV_CUSTOMER_PASSWORD of at least 12 characters are required.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('REFUSED: the development state file must already exist (copy a backup first).');
  }

  const store = new DataStore({ filePath, testMode: false, enforceLock: true });
  try {
    const customer = store.getState().customers.find((c) => c.email.toLowerCase() === email);
    if (!customer) throw new Error('No customer with that email exists in the development state file.');
    customer.passwordHash = hashPassword(password);
    customer.emailVerified = true;
    customer.isActive = true;
    delete customer.emailVerificationTokenHash;
    delete customer.emailVerificationExpiresAt;
    if (!store.persist()) throw new Error('Unable to persist the development customer.');
    console.log(`Development customer ${email} updated in ${filePath}`);
  } finally {
    store.releaseLock();
  }
}

main();
