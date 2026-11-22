/** Test-only accessors for the per-run random seed passwords set in seed-credentials.setup.ts. */
import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  SEED_ADMIN_PASSWORD_ENV,
  SEED_CUSTOMER_PASSWORD_ENV,
  type SeedAdminRole,
} from '../config/seed-credentials.js';
import { hashPassword } from '../store/data-store.js';

export function testSeedAdminPassword(role: SeedAdminRole = 'OWNER'): string {
  const v = process.env[SEED_ADMIN_PASSWORD_ENV[role]];
  if (!v) throw new Error(`Test setup missing ${SEED_ADMIN_PASSWORD_ENV[role]} (seed-credentials.setup.ts not loaded)`);
  return v;
}

export function testSeedCustomerPassword(): string {
  const v = process.env[SEED_CUSTOMER_PASSWORD_ENV];
  if (!v) throw new Error(`Test setup missing ${SEED_CUSTOMER_PASSWORD_ENV}`);
  return v;
}

/**
 * Creates a temporary admin with a random password in the (dev/test) PostgreSQL database, so tests never
 * depend on a real account's password. cleanup() detaches audit rows (kept for history) and deletes the user.
 */
export async function createTemporaryPostgresAdmin(
  prisma: PrismaClient,
  role: SeedAdminRole = 'OWNER'
): Promise<{ id: string; email: string; password: string; cleanup: () => Promise<void> }> {
  const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const email = `test-admin-${crypto.randomUUID()}@test.invalid`;
  const password = `T-${crypto.randomBytes(24).toString('base64url')}`;
  const user = await prisma.adminUser.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      displayName: `Temporary test ${role}`,
      roleId: roleRow.id,
      isActive: true,
    },
  });
  return {
    id: user.id,
    email,
    password,
    cleanup: async () => {
      await prisma.auditLog.updateMany({ where: { actorId: user.id }, data: { actorId: null } });
      await prisma.adminUser.deleteMany({ where: { id: user.id } });
    },
  };
}
