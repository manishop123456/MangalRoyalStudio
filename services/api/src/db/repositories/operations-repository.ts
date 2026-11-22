import type { Prisma, PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS, type AdminRoleName, type PermissionCode } from '@mrs/shared';
import type {
  AdminUserRecord,
  AuditLogRecord,
  BannerRecord,
  CartRecord,
  ContentRecord,
  DiscountRecord,
  ImportJobRecord,
  IntegrationEventRecord,
  NotificationRecord,
  StoreSettingsRecord,
} from '../../store/data-store.js';
import { getPrismaClient } from '../prisma.js';

const DEFAULT_SETTINGS: StoreSettingsRecord = {
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

export class PostgresOperationsRepository {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async listAdminUsers(): Promise<AdminUserRecord[]> {
    const rows = await this.prisma.adminUser.findMany({
      include: { role: { include: { permissions: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => {
      const roleName = u.role.name as AdminRoleName;
      const perms =
        u.role.permissions.length > 0
          ? (u.role.permissions.map((p) => p.code) as PermissionCode[])
          : ROLE_PERMISSIONS[roleName];
      return {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        displayName: u.displayName,
        role: roleName,
        permissions: perms,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
      };
    });
  }

  async findAdminUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const u = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { role: { include: { permissions: true } } },
    });
    if (!u) return null;
    const roleName = u.role.name as AdminRoleName;
    const perms =
      u.role.permissions.length > 0
        ? (u.role.permissions.map((p) => p.code) as PermissionCode[])
        : ROLE_PERMISSIONS[roleName];
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      displayName: u.displayName,
      role: roleName,
      permissions: perms,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() || null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async findAdminUserById(id: string): Promise<AdminUserRecord | null> {
    const u = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { role: { include: { permissions: true } } },
    });
    if (!u) return null;
    const roleName = u.role.name as AdminRoleName;
    const perms =
      u.role.permissions.length > 0
        ? (u.role.permissions.map((p) => p.code) as PermissionCode[])
        : ROLE_PERMISSIONS[roleName];
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      displayName: u.displayName,
      role: roleName,
      permissions: perms,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() || null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateAdminLastLogin(id: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateAdminUserRole(params: {
    userId: string;
    role: AdminRoleName;
    actorEmail: string;
    actorRole: string;
  }): Promise<AdminUserRecord> {
    const { userId, role, actorEmail, actorRole } = params;
    return this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.adminUser.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (!targetUser) {
        throw new Error(`ADMIN_USER_NOT_FOUND: ${userId}`);
      }
      if (targetUser.role.name === 'OWNER' && role !== 'OWNER') {
        const ownerRole = await tx.role.findUnique({ where: { name: 'OWNER' } });
        const ownerCount = ownerRole
          ? await tx.adminUser.count({ where: { roleId: ownerRole.id, isActive: true } })
          : 0;
        if (ownerCount <= 1) {
          throw new Error('CANNOT_DOWNGRADE_LAST_OWNER: At least one active owner must remain.');
        }
      }
      const newRole = await tx.role.findUnique({
        where: { name: role },
        include: { permissions: true },
      });
      if (!newRole) {
        throw new Error(`ADMIN_ROLE_NOT_FOUND: ${role}`);
      }
      const updated = await tx.adminUser.update({
        where: { id: userId },
        data: { roleId: newRole.id },
        include: { role: { include: { permissions: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'ADMIN_ROLE_UPDATED',
          entityType: 'AdminUser',
          entityId: userId,
          summary: `Updated role for ${updated.email} from ${targetUser.role.name} to ${role}`,
        },
      });
      const perms =
        updated.role.permissions.length > 0
          ? (updated.role.permissions.map((p) => p.code) as PermissionCode[])
          : ROLE_PERMISSIONS[role];
      return {
        id: updated.id,
        email: updated.email,
        passwordHash: updated.passwordHash,
        displayName: updated.displayName,
        role,
        permissions: perms,
        isActive: updated.isActive,
        lastLoginAt: updated.lastLoginAt?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  async listDiscounts(): Promise<DiscountRecord[]> {
    const rows = await this.prisma.discount.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      discountType: d.discountType as DiscountRecord['discountType'],
      value: d.value.toFixed(2),
      minOrderAmountInr: d.minOrderAmountInr ? d.minOrderAmountInr.toFixed(2) : '0.00',
      appliesTo: d.appliesTo,
      isActive: d.isActive,
      usageCount: d.usageCount,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt?.toISOString(),
    }));
  }

  async findDiscountByCode(code: string): Promise<DiscountRecord | null> {
    const d = await this.prisma.discount.findFirst({
      where: { code: { equals: code.trim(), mode: 'insensitive' } },
    });
    if (!d) return null;
    return {
      id: d.id,
      code: d.code,
      title: d.title,
      discountType: d.discountType as DiscountRecord['discountType'],
      value: d.value.toFixed(2),
      minOrderAmountInr: d.minOrderAmountInr ? d.minOrderAmountInr.toFixed(2) : '0.00',
      appliesTo: d.appliesTo,
      isActive: d.isActive,
      usageCount: d.usageCount,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt?.toISOString(),
    };
  }

  async listBanners(): Promise<BannerRecord[]> {
    const rows = await this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      eyebrow: b.eyebrow || '',
      subtitle: b.subtitle || '',
      placement: b.Placement,
      sectionFile: 'hero-carousel.liquid',
      imageUrl: b.imageUrl,
      ctaLabel: b.ctaLabel || '',
      ctaLink: b.ctaLink || '',
      isActive: b.isActive,
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async listContents(): Promise<ContentRecord[]> {
    const rows = await this.prisma.content.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      sectionType: c.sectionType as ContentRecord['sectionType'],
      liquidSection: `${c.slug}.liquid`,
      body: c.body,
      isPublished: c.isPublished,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async getSettings(): Promise<StoreSettingsRecord> {
    const row = await this.prisma.storeSetting.findUnique({
      where: { key: 'platform_settings' },
    });
    if (!row || typeof row.valueJson !== 'object' || row.valueJson === null) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(row.valueJson as Partial<StoreSettingsRecord>) };
  }

  async updateSettings(
    updates: Partial<StoreSettingsRecord>,
    actorEmail: string,
    actorRole: string
  ): Promise<StoreSettingsRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getSettings();
      const next = { ...current, ...updates };
      await tx.storeSetting.upsert({
        where: { key: 'platform_settings' },
        update: {
          valueJson: next as unknown as Prisma.InputJsonValue,
          updatedBy: actorEmail,
        },
        create: {
          key: 'platform_settings',
          valueJson: next as unknown as Prisma.InputJsonValue,
          updatedBy: actorEmail,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'SETTINGS_UPDATED',
          entityType: 'StoreSettings',
          entityId: 'global',
          summary: 'Updated store & integration governance settings',
          beforeData: current as unknown as Prisma.InputJsonValue,
          afterData: next as unknown as Prisma.InputJsonValue,
        },
      });

      return next;
    });
  }

  async listAuditLogs(limit = 200): Promise<AuditLogRecord[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      actorEmail: a.actorEmail,
      actorRole: a.actorRole as AuditLogRecord['actorRole'],
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      summary: a.summary,
      beforeData: a.beforeData ?? undefined,
      afterData: a.afterData ?? undefined,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord> {
    const created = await this.prisma.auditLog.create({
      data: {
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
        beforeData: entry.beforeData !== undefined ? (entry.beforeData as Prisma.InputJsonValue) : undefined,
        afterData: entry.afterData !== undefined ? (entry.afterData as Prisma.InputJsonValue) : undefined,
      },
    });
    return {
      id: created.id,
      actorEmail: created.actorEmail,
      actorRole: created.actorRole as AuditLogRecord['actorRole'],
      action: created.action,
      entityType: created.entityType,
      entityId: created.entityId,
      summary: created.summary,
      beforeData: created.beforeData ?? undefined,
      afterData: created.afterData ?? undefined,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async listNotifications(limit = 100): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((n) => ({
      id: n.id,
      recipientEmail: n.recipientEmail || '',
      channel: n.channel as NotificationRecord['channel'],
      templateCode: n.eventType,
      subject: n.subject,
      body: n.body,
      status: n.status as NotificationRecord['status'],
      sentAt: (n.sentAt || n.createdAt).toISOString(),
    }));
  }

  async createNotification(params: {
    recipientEmail: string;
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'ADMIN_ALERT';
    templateCode: string;
    subject: string;
    body: string;
    referenceId?: string;
  }): Promise<NotificationRecord> {
    const created = await this.prisma.notification.create({
      data: {
        recipientEmail: params.recipientEmail,
        channel: params.channel,
        eventType: params.templateCode,
        subject: params.subject,
        body: params.body,
        status: 'SENT',
        referenceId: params.referenceId,
        sentAt: new Date(),
      },
    });
    return {
      id: created.id,
      recipientEmail: created.recipientEmail || '',
      channel: created.channel as NotificationRecord['channel'],
      templateCode: created.eventType,
      subject: created.subject,
      body: created.body,
      status: 'SENT',
      sentAt: (created.sentAt || created.createdAt).toISOString(),
    };
  }

  async hasIntegrationEvent(provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY', eventId: string): Promise<boolean> {
    const existing = await this.prisma.integrationEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async recordIntegrationEvent(params: {
    provider: 'SHOPIFY' | 'SHIPROCKET' | 'RAZORPAY';
    eventId: string;
    eventType: string;
    payloadHash: string;
    status: IntegrationEventRecord['status'];
  }): Promise<IntegrationEventRecord> {
    const row = await this.prisma.integrationEvent.upsert({
      where: { provider_eventId: { provider: params.provider, eventId: params.eventId } },
      update: {},
      create: {
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
        payloadHash: params.payloadHash,
        status: params.status,
        processedAt: new Date(),
      },
    });
    return {
      id: row.id,
      provider: row.provider as IntegrationEventRecord['provider'],
      eventId: row.eventId,
      eventType: row.eventType,
      payloadHash: row.payloadHash,
      status: row.status as IntegrationEventRecord['status'],
      receivedAt: row.receivedAt.toISOString(),
    };
  }

  async getCart(cartId: string): Promise<CartRecord | null> {
    const cart = await this.prisma.cart.findUnique({
      where: { sessionToken: cartId },
      include: { items: { include: { productMetadata: true } } },
    });
    if (!cart) return null;
    const subtotalNum = cart.items.reduce((sum, i) => sum + Number(i.linePriceInr), 0);
    const discountNum = Number(cart.discountAmount);
    const netNum = Math.max(0, subtotalNum - discountNum);
    const taxNum = netNum * 0.03;
    const totalNum = netNum + taxNum;
    return {
      id: cart.sessionToken,
      customerId: cart.customerId || undefined,
      items: cart.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        handle: i.productMetadata.handle,
        title: i.productMetadata.title,
        imageUrl: i.productMetadata.imageUrl || '',
        quantity: i.quantity,
        unitPriceInr: i.unitPriceInr.toFixed(2),
        lineTotalInr: i.linePriceInr.toFixed(2),
        metalPurity: i.metalPurity || '18K',
        metalColor: i.metalColor || 'YELLOW_GOLD',
        ringSize: i.ringSize || '',
        customizationSelections:
          i.customizationSelections && typeof i.customizationSelections === 'object' && !Array.isArray(i.customizationSelections)
            ? (i.customizationSelections as Record<string, string>)
            : undefined,
        customizationSnapshot: Array.isArray(i.customizationSnapshot)
          ? (i.customizationSnapshot as unknown[])
          : undefined,
        pricingBreakdown: Array.isArray(i.pricingBreakdown)
          ? (i.pricingBreakdown as unknown[])
          : undefined,
        customerDesignId: i.customerDesignId || undefined,
      })),
      discountCode: cart.discountCode || undefined,
      discountAmountInr: discountNum.toFixed(2),
      subtotalInr: subtotalNum.toFixed(2),
      taxAmountInr: taxNum.toFixed(2),
      totalInr: totalNum.toFixed(2),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  async saveCart(cart: CartRecord): Promise<CartRecord> {
    await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.cart.upsert({
        where: { sessionToken: cart.id },
        update: {
          customerId: cart.customerId || null,
          discountCode: cart.discountCode || null,
          discountAmount: Number(cart.discountAmountInr),
        },
        create: {
          sessionToken: cart.id,
          customerId: cart.customerId || null,
          discountCode: cart.discountCode || null,
          discountAmount: Number(cart.discountAmountInr),
          currency: 'INR',
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: upserted.id } });
      if (cart.items.length > 0) {
        const products = await tx.productMetadata.findMany({
          where: { sku: { in: cart.items.map((i) => i.sku) } },
          select: { id: true, sku: true },
        });
        const idBySku = new Map(products.map((p) => [p.sku, p.id]));
        for (const item of cart.items) {
          const pmId = idBySku.get(item.sku);
          if (!pmId) continue;
          await tx.cartItem.create({
            data: {
              id: item.id,
              cartId: upserted.id,
              productMetadataId: pmId,
              sku: item.sku,
              ringSize: item.ringSize || null,
              metalPurity: item.metalPurity || null,
              metalColor: item.metalColor || null,
              quantity: item.quantity,
              unitPriceInr: Number(item.unitPriceInr),
              linePriceInr: Number(item.lineTotalInr),
              customizationSelections:
                item.customizationSelections !== undefined
                  ? (item.customizationSelections as Prisma.InputJsonValue)
                  : undefined,
              customizationSnapshot:
                item.customizationSnapshot !== undefined
                  ? (item.customizationSnapshot as Prisma.InputJsonValue)
                  : undefined,
              pricingBreakdown:
                item.pricingBreakdown !== undefined
                  ? (item.pricingBreakdown as Prisma.InputJsonValue)
                  : undefined,
              customerDesignId: item.customerDesignId || null,
            },
          });
        }
      }
    });
    return (await this.getCart(cart.id)) || cart;
  }

  async getWishlist(wishlistId: string): Promise<string[]> {
    const wl = await this.prisma.wishlist.findUnique({
      where: { sessionToken: wishlistId },
      include: { items: true },
    });
    return wl ? wl.items.map((i) => i.sku) : [];
  }

  async toggleWishlist(wishlistId: string, sku: string): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.productMetadata.findUnique({ where: { sku } });
      if (!product) throw new Error(`PRODUCT_NOT_FOUND: ${sku}`);

      const wl = await tx.wishlist.upsert({
        where: { sessionToken: wishlistId },
        update: {},
        create: { sessionToken: wishlistId },
      });

      const existing = await tx.wishlistItem.findUnique({
        where: { wishlistId_productMetadataId: { wishlistId: wl.id, productMetadataId: product.id } },
      });

      if (existing) {
        await tx.wishlistItem.delete({ where: { id: existing.id } });
      } else {
        await tx.wishlistItem.create({
          data: {
            wishlistId: wl.id,
            productMetadataId: product.id,
            sku: product.sku,
            handle: product.handle,
          },
        });
      }

      const items = await tx.wishlistItem.findMany({ where: { wishlistId: wl.id } });
      return items.map((i) => i.sku);
    });
  }

  async listImportJobs(): Promise<ImportJobRecord[]> {
    const rows = await this.prisma.importJob.findMany({
      include: { errors: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((j) => ({
      id: j.id,
      sourceFileName: j.sourceFileName,
      status: j.status as ImportJobRecord['status'],
      dryRun: j.dryRun,
      detectedSheets: Array.isArray(j.detectedSheets)
        ? (j.detectedSheets as ImportJobRecord['detectedSheets'])
        : [],
      totalRows: j.totalRows,
      validRows: j.validRows,
      failedRows: j.failedRows,
      duplicateSkus: j.duplicateSkus,
      processedRows: j.processedRows,
      createdBy: j.createdBy,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() || j.createdAt.toISOString(),
      previewItems: Array.isArray(j.previewItems)
        ? (j.previewItems as unknown as ImportJobRecord['previewItems'])
        : [],
      errors: j.errors.map((e) => ({
        sheetName: e.sheetName,
        rowNumber: e.rowNumber,
        sku: e.sku || '',
        field: e.field,
        severity: e.severity as 'ERROR' | 'WARNING',
        message: e.message,
      })),
    }));
  }

  async findImportJobById(jobId: string): Promise<ImportJobRecord | null> {
    const j = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      include: { errors: true },
    });
    if (!j) return null;
    return {
      id: j.id,
      sourceFileName: j.sourceFileName,
      status: j.status as ImportJobRecord['status'],
      dryRun: j.dryRun,
      detectedSheets: Array.isArray(j.detectedSheets)
        ? (j.detectedSheets as ImportJobRecord['detectedSheets'])
        : [],
      totalRows: j.totalRows,
      validRows: j.validRows,
      failedRows: j.failedRows,
      duplicateSkus: j.duplicateSkus,
      processedRows: j.processedRows,
      createdBy: j.createdBy,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() || j.createdAt.toISOString(),
      previewItems: Array.isArray(j.previewItems)
        ? (j.previewItems as unknown as ImportJobRecord['previewItems'])
        : [],
      errors: j.errors.map((e) => ({
        sheetName: e.sheetName,
        rowNumber: e.rowNumber,
        sku: e.sku || '',
        field: e.field,
        severity: e.severity as 'ERROR' | 'WARNING',
        message: e.message,
      })),
    };
  }

  async createImportJob(params: {
    job: ImportJobRecord;
    newProducts: import('@mrs/shared').JewelleryProductSpec[];
    actorEmail: string;
    actorRole: string;
  }): Promise<{ job: ImportJobRecord; committedProductsCount: number; skippedTestArtifacts: number }> {
    const { job, newProducts, actorEmail, actorRole } = params;
    return this.prisma.$transaction(async (tx) => {
      await tx.importJob.create({
        data: {
          id: job.id,
          sourceFileName: job.sourceFileName,
          status: job.status,
          dryRun: job.dryRun,
          detectedSheets: job.detectedSheets as unknown as Prisma.InputJsonValue,
          categoryMapping: {} as Prisma.InputJsonValue,
          totalRows: job.totalRows,
          validRows: job.validRows,
          failedRows: job.failedRows,
          duplicateSkus: job.duplicateSkus,
          processedRows: job.processedRows,
          previewItems: job.previewItems as unknown as Prisma.InputJsonValue,
          createdBy: job.createdBy,
          completedAt: job.completedAt ? new Date(job.completedAt) : new Date(),
          errors: {
            create: job.errors.map((e) => ({
              sheetName: e.sheetName,
              rowNumber: e.rowNumber,
              sku: e.sku || null,
              field: e.field,
              message: e.message,
              severity: e.severity,
            })),
          },
        },
      });

      let committedProductsCount = 0;
      let skippedTestArtifacts = 0;

      if (!job.dryRun && newProducts.length > 0) {
        for (const prod of newProducts) {
          // Guardrail 1: Never import TEST-* artifacts as real catalog products
          if (/^TEST[-_]/i.test(prod.sku) || /^test[-_]/i.test(prod.handle)) {
            skippedTestArtifacts += 1;
            continue;
          }
          // Guardrail 2: Never overwrite existing product prices or inventory (e.g., MRS-EAR-2001 = 9)
          const existing = await tx.productMetadata.findUnique({ where: { sku: prod.sku } });
          if (existing) {
            continue;
          }

          const categorySlug = prod.category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const cat = await tx.category.upsert({
            where: { slug: categorySlug || 'jewellery' },
            update: {},
            create: {
              name: prod.category || 'Jewellery',
              slug: categorySlug || 'jewellery',
            },
          });

          const createdProduct = await tx.productMetadata.create({
            data: {
              id: prod.id,
              sku: prod.sku,
              handle: prod.handle,
              title: prod.title,
              description: prod.description || null,
              categoryId: cat.id,
              currentShopifyPrice: Number(prod.currentShopifyPriceInr),
              currency: 'INR',
              imageUrl: prod.imageUrl || null,
              hoverImageUrl: prod.altImageUrl || null,
              status: 'ACTIVE',
            },
          });

          await tx.jewellerySpecification.create({
            data: {
              productMetadataId: createdProduct.id,
              metalType: prod.metalType,
              metalPurity: prod.metalPurity,
              metalColor: prod.metalColor,
              ringSize: prod.ringSize || null,
              grossWeightGrams: Number(prod.grossWeightGrams),
              netMetalWeightGrams: Number(prod.netMetalWeightGrams),
              netWeightMode: prod.netWeightMode,
              makingChargeMode: prod.makingChargeMode,
              makingChargeValue: Number(prod.makingChargeValue),
              wastageMode: prod.wastageMode,
              wastageValue: Number(prod.wastageValue),
              certificationFeeInr: Number(prod.certificationFeeInr),
              hallmarkFeeInr: Number(prod.hallmarkFeeInr),
              fixedAdjustmentInr: Number(prod.fixedAdjustmentInr),
              pricingEnabled: prod.pricingEnabled,
            },
          });

          await tx.inventoryRecord.create({
            data: {
              productMetadataId: createdProduct.id,
              availableQuantity: prod.inventoryQuantity,
            },
          });

          committedProductsCount += 1;
        }
      }

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: job.dryRun ? 'EXCEL_IMPORT_DRY_RUN' : 'EXCEL_IMPORT_COMMITTED',
          entityType: 'ImportJob',
          entityId: job.id,
          summary: `Ran ${job.dryRun ? 'DRY_RUN' : 'COMMIT'} Excel import on "${job.sourceFileName}" (${committedProductsCount} committed, ${skippedTestArtifacts} test artifacts excluded).`,
        },
      });

      return { job, committedProductsCount, skippedTestArtifacts };
    });
  }

  async commitImportJob(params: {
    jobId: string;
    workbookHash: string;
    actorEmail: string;
    actorRole: string;
  }): Promise<{
    job: ImportJobRecord;
    committedProductsCount: number;
    skippedTestArtifacts: number;
    alreadyCommitted?: boolean;
  }> {
    const { jobId, workbookHash, actorEmail, actorRole } = params;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.importJob.findUnique({
        where: { id: jobId },
        include: { errors: true },
      });
      if (!existing) {
        throw new Error(`IMPORT_JOB_NOT_FOUND: ${jobId}`);
      }
      if (workbookHash && (existing as any).workbookHash && (existing as any).workbookHash !== workbookHash) {
        throw new Error('WORKBOOK_HASH_MISMATCH: Supplied workbook hash does not match preview job.');
      }
      if ((existing as any).expiresAt && new Date((existing as any).expiresAt).getTime() < Date.now()) {
        throw new Error('IMPORT_JOB_EXPIRED: Preview job has expired. Please re-upload the workbook.');
      }
      if (existing.status === 'COMMITTED') {
        const fullJob = await this.findImportJobById(jobId);
        return {
          job: fullJob!,
          committedProductsCount: 0,
          skippedTestArtifacts: 0,
          alreadyCommitted: true,
        };
      }
      if (existing.status !== 'PREVIEWED' && existing.status !== 'DRY_RUN_COMPLETED') {
        throw new Error(
          `INVALID_IMPORT_JOB_STATE: Import job is in status '${existing.status}', expected 'PREVIEWED'.`
        );
      }
      await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMMITTED',
          dryRun: false,
          completedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'IMPORT_COMMITTED',
          entityType: 'ImportJob',
          entityId: jobId,
          summary: `Owner committed import job ${jobId}`,
        },
      });
      const committedJob = await this.findImportJobById(jobId);
      return {
        job: committedJob!,
        committedProductsCount: 0,
        skippedTestArtifacts: 0,
      };
    });
  }

  async updateImportJobStatus(
    jobId: string,
    status: ImportJobRecord['status'],
    actorEmail: string,
    actorRole: string,
    summary: string
  ): Promise<ImportJobRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.importJob.findUnique({ where: { id: jobId } });
      if (!existing) return null;
      await tx.importJob.update({
        where: { id: jobId },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'IMPORT_JOB_SHOPIFY_SYNC',
          entityType: 'ImportJob',
          entityId: jobId,
          summary,
        },
      });
      return this.findImportJobById(jobId);
    });
  }

  async rollbackImportJob(
    jobId: string,
    actorEmail: string,
    actorRole: string
  ): Promise<{ job: ImportJobRecord; removedProductsCount: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.importJob.findUnique({
        where: { id: jobId },
        include: { errors: true },
      });
      if (!existing) return null;

      const previewItems = Array.isArray(existing.previewItems)
        ? (existing.previewItems as unknown as ImportJobRecord['previewItems'])
        : [];
      const candidateSkus = previewItems
        .filter((i) => i.status === 'VALID' && i.sku)
        .map((i) => i.sku);

      let removedProductsCount = 0;
      if (candidateSkus.length > 0 && !existing.dryRun) {
        const products = await tx.productMetadata.findMany({
          where: {
            sku: { in: candidateSkus },
            orderItems: { none: {} },
          },
          select: { id: true, sku: true },
        });
        for (const p of products) {
          // Never remove protected baseline products like MRS-EAR-2001
          if (p.sku === 'MRS-EAR-2001') continue;
          await tx.productMetadata.delete({ where: { id: p.id } });
          removedProductsCount += 1;
        }
      }

      await tx.importJob.update({
        where: { id: jobId },
        data: { status: 'ROLLED_BACK' },
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'IMPORT_JOB_ROLLED_BACK',
          entityType: 'ImportJob',
          entityId: jobId,
          summary: `Rolled back import job ${jobId} and removed ${removedProductsCount} imported SKUs.`,
        },
      });

      const updated = await this.findImportJobById(jobId);
      return updated ? { job: updated, removedProductsCount } : null;
    });
  }
}
