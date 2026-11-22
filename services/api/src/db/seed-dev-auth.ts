import { ROLE_PERMISSIONS, type AdminRoleName } from '@mrs/shared';
import { getPrismaClient, disconnectPrisma } from './prisma.js';
import { requireSeedAdminPassword } from '../config/seed-credentials.js';
import { hashPassword } from '../store/data-store.js';

export async function seedDevAuthAndSettings(databaseUrl?: string): Promise<void> {
  // Admin passwords come only from MRS_SEED_*_PASSWORD; resolved BEFORE any database write so a missing or
  // weak value stops the seed with no partial changes. Values are never logged.
  const seedPasswords: Record<'OWNER' | 'MANAGER' | 'PRICING_OPERATOR', string> = {
    OWNER: requireSeedAdminPassword('OWNER'),
    MANAGER: requireSeedAdminPassword('MANAGER'),
    PRICING_OPERATOR: requireSeedAdminPassword('PRICING_OPERATOR'),
  };

  const prisma = getPrismaClient(databaseUrl);

  const roleEntries: Array<{ name: AdminRoleName; description: string }> = [
    { name: 'OWNER', description: 'Full platform ownership and pricing/refund approval authority' },
    { name: 'MANAGER', description: 'Operations, orders, shipments, and catalog management' },
    { name: 'PRICING_OPERATOR', description: 'Metal/diamond rate updates and pricing run previews' },
  ];

  for (const r of roleEntries) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }

  const allPermissions = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));
  for (const code of allPermissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }

  for (const r of roleEntries) {
    const perms = ROLE_PERMISSIONS[r.name];
    await prisma.role.update({
      where: { name: r.name },
      data: {
        permissions: {
          set: perms.map((code) => ({ code })),
        },
      },
    });
  }

  const roles = await prisma.role.findMany();
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  const devAdmins: Array<{
    id: string;
    email: string;
    password: string;
    displayName: string;
    role: AdminRoleName;
  }> = [
    {
      id: 'usr-owner-1',
      email: 'owner@mangalroyalstudio.com',
      password: seedPasswords.OWNER,
      displayName: 'Mangal Royal Studio — Owner',
      role: 'OWNER',
    },
    {
      id: 'usr-manager-1',
      email: 'manager@mangalroyalstudio.com',
      password: seedPasswords.MANAGER,
      displayName: 'Store Operations Manager',
      role: 'MANAGER',
    },
    {
      id: 'usr-operator-1',
      email: 'pricing@mangalroyalstudio.com',
      password: seedPasswords.PRICING_OPERATOR,
      displayName: 'Bullion & Diamond Pricing Operator',
      role: 'PRICING_OPERATOR',
    },
  ];

  for (const admin of devAdmins) {
    const existing = await prisma.adminUser.findUnique({ where: { email: admin.email } });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          id: admin.id,
          email: admin.email,
          passwordHash: hashPassword(admin.password),
          displayName: admin.displayName,
          roleId: roleByName.get(admin.role)!,
          isActive: true,
        },
      });
    }
  }

  const defaultSettings = {
    storeName: 'Mangal Royal Studio',
    legalEntityName: 'Mangal Royal Jewels Pvt Ltd (Since 1975)',
    foundedYear: 1975,
    shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN || 'mangal-royal-studio.myshopify.com',
    shopifyPlan: 'Shopify Basic',
    shopifyApiVersion: process.env.SHOPIFY_ADMIN_API_VERSION || '2025-01',
    shopifyLiveWritesEnabled: process.env.SHOPIFY_LIVE_WRITES_ENABLED === 'true',
    currency: 'INR',
    defaultGstPercent: '3.00',
    requireOwnerApprovalForPricing: true,
    maxAutoPriceSwingPercent: '15.00',
    shiprocketEnabled: true,
    shiprocketPickupLocation: 'Primary_Mumbai_Studio_Vault',
    shiprocketHighValueInsuranceEnabled: true,
    razorpayViaShopifyCheckout: true,
    announcementBarText: 'Get 10% OFF On Engagement Rings',
    announcementBarBgColor: '#7A1023',
    primaryBrandColor: '#7D132A',
    secondaryPeachColor: '#F8E1CF',
  };

  await prisma.storeSetting.upsert({
    where: { key: 'platform_settings' },
    update: {},
    create: {
      key: 'platform_settings',
      valueJson: defaultSettings,
      updatedBy: 'system-seed',
    },
  });
}

if (process.argv[1]?.endsWith('seed-dev-auth.ts')) {
  seedDevAuthAndSettings()
    .then(async () => {
      console.log('Seeded Role, Permission, AdminUser, and StoreSetting in PostgreSQL.');
      await disconnectPrisma();
    })
    .catch(async (err) => {
      console.error('Failed to seed dev auth/settings:', err);
      await disconnectPrisma();
      process.exit(1);
    });
}
