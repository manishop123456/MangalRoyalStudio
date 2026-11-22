import type { Prisma, PrismaClient } from '@prisma/client';
import type { CustomerRecord } from '../../store/data-store.js';
import { getPrismaClient } from '../prisma.js';

const customerInclude = {
  addresses: true,
} satisfies Prisma.CustomerInclude;

type CustomerWithAddresses = Prisma.CustomerGetPayload<{
  include: typeof customerInclude;
}>;

export function mapCustomerToRecord(c: CustomerWithAddresses): CustomerRecord {
  return {
    id: c.id,
    shopifyCustomerGid: c.shopifyCustomerGid || undefined,
    email: c.email,
    passwordHash: c.passwordHash || undefined,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone || undefined,
    city: c.city || undefined,
    state: c.state || undefined,
    isActive: c.isActive && c.status !== 'SUSPENDED',
    emailVerified: c.emailVerified,
    emailVerificationTokenHash: c.emailVerificationTokenHash || undefined,
    emailVerificationExpiresAt: c.emailVerificationExpiresAt?.toISOString(),
    emailVerificationLastSentAt: c.emailVerificationLastSentAt?.toISOString(),
    totalOrdersCount: c.totalOrdersCount,
    totalSpentInr: c.totalSpentInr.toFixed(2),
    tags: c.tags,
    addresses: c.addresses.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      label: a.isDefault ? 'Default' : 'Address',
      recipientName: a.fullName,
      phone: a.phone,
      line1: a.addressLine1,
      line2: a.addressLine2 || undefined,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country,
      isDefault: a.isDefault,
    })),
    createdAt: c.createdAt.toISOString(),
  };
}

export class PostgresCustomerRepository {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async findByEmail(email: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.customer.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: customerInclude,
    });
    return row ? mapCustomerToRecord(row) : null;
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.customer.findUnique({
      where: { id },
      include: customerInclude,
    });
    return row ? mapCustomerToRecord(row) : null;
  }

  async listCustomers(): Promise<CustomerRecord[]> {
    const rows = await this.prisma.customer.findMany({
      include: customerInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapCustomerToRecord);
  }

  async createCustomer(data: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash?: string;
    phone?: string;
    city?: string;
    state?: string;
    emailVerified?: boolean;
    emailVerificationTokenHash?: string;
    emailVerificationExpiresAt?: Date;
    emailVerificationLastSentAt?: Date;
    tags?: string[];
  }): Promise<CustomerRecord> {
    const row = await this.prisma.customer.create({
      data: {
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        passwordHash: data.passwordHash,
        phone: data.phone,
        city: data.city,
        state: data.state,
        status: 'ACTIVE',
        isActive: true,
        emailVerified: data.emailVerified ?? false,
        emailVerificationTokenHash: data.emailVerificationTokenHash,
        emailVerificationExpiresAt: data.emailVerificationExpiresAt,
        emailVerificationLastSentAt: data.emailVerificationLastSentAt,
        tags: data.tags ?? ['REGISTERED'],
      },
      include: customerInclude,
    });
    return mapCustomerToRecord(row);
  }

  async updateVerificationToken(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    sentAt: Date
  ): Promise<CustomerRecord> {
    const row = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationLastSentAt: sentAt,
      },
      include: customerInclude,
    });
    return mapCustomerToRecord(row);
  }

  async markEmailVerified(customerId: string): Promise<CustomerRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          status: 'ACTIVE',
          isActive: true,
        },
        include: customerInclude,
      });

      await tx.auditLog.create({
        data: {
          actorEmail: updated.email,
          actorRole: 'CUSTOMER',
          action: 'CUSTOMER_EMAIL_VERIFIED',
          entityType: 'Customer',
          entityId: updated.id,
          summary: `Verified email for customer ${updated.email}`,
        },
      });

      return updated;
    });
    return mapCustomerToRecord(row);
  }

  async updatePassword(customerId: string, passwordHash: string): Promise<CustomerRecord> {
    const row = await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash },
      include: customerInclude,
    });
    return mapCustomerToRecord(row);
  }
}
