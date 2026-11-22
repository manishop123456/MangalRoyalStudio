import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  CustomerDesignRecord,
  CustomizationDependencyRule,
  CustomizationGroupRecord,
  CustomizationOptionCategory,
  CustomizationOptionRecord,
  CustomizationPriceRuleType,
  CustomizationProfileRecord,
  CustomizationQuoteBreakdownLine,
  CustomizationSelectionMap,
  CustomizationSelectionMode,
  CustomizationSelectionSnapshotItem,
  DiamondShape,
  MetalPurity,
  MetalType,
  ProductCustomizationAssignmentRecord,
  ProductModelAssetRecord,
} from '@mrs/shared';

function mapOption(o: {
  id: string;
  groupId: string;
  code: string;
  label: string;
  description: string | null;
  value: string;
  swatchHex: string | null;
  imageUrl: string | null;
  priceRuleType: string;
  priceRuleValue: Prisma.Decimal;
  metalType: string | null;
  metalPurity: string | null;
  metalColor: string | null;
  diamondShape: string | null;
  diamondCaratWeight: Prisma.Decimal | null;
  diamondColorGrade: string | null;
  diamondClarityGrade: string | null;
  gemstoneType: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  eligibilityRule: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomizationOptionRecord {
  return {
    id: o.id,
    groupId: o.groupId,
    code: o.code,
    label: o.label,
    description: o.description ?? undefined,
    value: o.value,
    swatchHex: o.swatchHex ?? undefined,
    imageUrl: o.imageUrl ?? undefined,
    priceRuleType: o.priceRuleType as CustomizationPriceRuleType,
    priceRuleValue: o.priceRuleValue.toFixed(4),
    metalType: (o.metalType as MetalType) ?? undefined,
    metalPurity: (o.metalPurity as MetalPurity) ?? undefined,
    metalColor: o.metalColor ?? undefined,
    diamondShape: (o.diamondShape as DiamondShape) ?? undefined,
    diamondCaratWeight: o.diamondCaratWeight ? o.diamondCaratWeight.toFixed(4) : undefined,
    diamondColorGrade: o.diamondColorGrade ?? undefined,
    diamondClarityGrade: o.diamondClarityGrade ?? undefined,
    gemstoneType: o.gemstoneType ?? undefined,
    isDefault: o.isDefault,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
    eligibilityRule: (o.eligibilityRule as CustomizationDependencyRule | null) ?? undefined,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function mapGroup(
  g: {
    id: string;
    profileId: string;
    code: string;
    name: string;
    description: string | null;
    stepOrder: number;
    selectionMode: string;
    optionCategory: string;
    isRequired: boolean;
    isActive: boolean;
    dependencyRule: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    options: Parameters<typeof mapOption>[0][];
  }
): CustomizationGroupRecord {
  return {
    id: g.id,
    profileId: g.profileId,
    code: g.code,
    name: g.name,
    description: g.description ?? undefined,
    stepOrder: g.stepOrder,
    selectionMode: g.selectionMode as CustomizationSelectionMode,
    optionCategory: g.optionCategory as CustomizationOptionCategory,
    isRequired: g.isRequired,
    isActive: g.isActive,
    dependencyRule: (g.dependencyRule as CustomizationDependencyRule | null) ?? undefined,
    options: [...g.options].sort((a, b) => a.sortOrder - b.sortOrder).map(mapOption),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

function mapProfile(
  p: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    eligibleCategories: Prisma.JsonValue;
    isActive: boolean;
    isDefault: boolean;
    createdBy: string;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    groups: Parameters<typeof mapGroup>[0][];
  }
): CustomizationProfileRecord {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description ?? undefined,
    eligibleCategories: Array.isArray(p.eligibleCategories)
      ? (p.eligibleCategories as string[])
      : [],
    isActive: p.isActive,
    isDefault: p.isDefault,
    createdBy: p.createdBy,
    updatedBy: p.updatedBy ?? undefined,
    groups: [...p.groups].sort((a, b) => a.stepOrder - b.stepOrder).map(mapGroup),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function mapAssignment(a: {
  id: string;
  productMetadataId: string;
  profileId: string;
  isCustomizable: boolean;
  allowDiamondSelection: boolean;
  allowEngraving: boolean;
  maxEngravingChars: number;
  disabledOptionCodes: Prisma.JsonValue;
  configOverrides: Prisma.JsonValue | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  productMetadata?: { sku: string } | null;
}): ProductCustomizationAssignmentRecord {
  return {
    id: a.id,
    productMetadataId: a.productMetadataId,
    productSku: a.productMetadata?.sku,
    profileId: a.profileId,
    isCustomizable: a.isCustomizable,
    allowDiamondSelection: a.allowDiamondSelection,
    allowEngraving: a.allowEngraving,
    maxEngravingChars: a.maxEngravingChars,
    disabledOptionCodes: Array.isArray(a.disabledOptionCodes)
      ? (a.disabledOptionCodes as string[])
      : [],
    configOverrides: (a.configOverrides as Record<string, unknown> | null) ?? undefined,
    updatedBy: a.updatedBy ?? undefined,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function mapModelAsset(m: {
  id: string;
  productMetadataId: string;
  productSku: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageProvider: string;
  storageKey: string;
  assetUrl: string;
  previewImageUrl: string | null;
  status: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}): ProductModelAssetRecord {
  return {
    id: m.id,
    productMetadataId: m.productMetadataId,
    productSku: m.productSku,
    fileName: m.fileName,
    mimeType: m.mimeType,
    fileSizeBytes: m.fileSizeBytes,
    storageProvider: m.storageProvider as 'LOCAL_MANAGED' | 'EXTERNAL_URL',
    storageKey: m.storageKey,
    assetUrl: m.assetUrl,
    previewImageUrl: m.previewImageUrl ?? undefined,
    status: m.status as 'ACTIVE' | 'INACTIVE',
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function mapDesign(d: {
  id: string;
  customerId: string;
  productMetadataId: string;
  productSku: string;
  productHandle: string;
  productTitle: string;
  profileId: string | null;
  name: string;
  selections: Prisma.JsonValue;
  selectionSnapshot: Prisma.JsonValue;
  lastQuotedPriceInr: Prisma.Decimal;
  lastPriceBreakdown: Prisma.JsonValue;
  pricingRuleVersion: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): CustomerDesignRecord {
  return {
    id: d.id,
    customerId: d.customerId,
    productMetadataId: d.productMetadataId,
    productSku: d.productSku,
    productHandle: d.productHandle,
    productTitle: d.productTitle,
    profileId: d.profileId ?? undefined,
    name: d.name,
    selections: (d.selections as CustomizationSelectionMap) || {},
    selectionSnapshot: Array.isArray(d.selectionSnapshot)
      ? (d.selectionSnapshot as unknown as CustomizationSelectionSnapshotItem[])
      : [],
    lastQuotedPriceInr: d.lastQuotedPriceInr.toFixed(2),
    lastPriceBreakdown: Array.isArray(d.lastPriceBreakdown)
      ? (d.lastPriceBreakdown as unknown as CustomizationQuoteBreakdownLine[])
      : [],
    pricingRuleVersion: d.pricingRuleVersion,
    status: d.status as 'SAVED' | 'ARCHIVED',
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export class PostgresCustomizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listProfiles(): Promise<CustomizationProfileRecord[]> {
    const rows = await this.prisma.customizationProfile.findMany({
      include: { groups: { include: { options: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapProfile);
  }

  async findProfileById(profileId: string): Promise<CustomizationProfileRecord | null> {
    const row = await this.prisma.customizationProfile.findUnique({
      where: { id: profileId },
      include: { groups: { include: { options: true } } },
    });
    return row ? mapProfile(row) : null;
  }

  async createProfile(params: {
    code: string;
    name: string;
    description?: string;
    eligibleCategories: string[];
    isActive: boolean;
    isDefault: boolean;
    actorEmail: string;
    actorRole: string;
  }): Promise<CustomizationProfileRecord> {
    return this.prisma.$transaction(async (tx) => {
      if (params.isDefault) {
        await tx.customizationProfile.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      const created = await tx.customizationProfile.create({
        data: {
          code: params.code.trim().toUpperCase(),
          name: params.name.trim(),
          description: params.description?.trim() || null,
          eligibleCategories: params.eligibleCategories,
          isActive: params.isActive,
          isDefault: params.isDefault,
          createdBy: params.actorEmail,
          updatedBy: params.actorEmail,
        },
        include: { groups: { include: { options: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'CUSTOMIZATION_PROFILE_CREATED',
          entityType: 'CustomizationProfile',
          entityId: created.id,
          summary: `Created customization profile "${created.name}" (${created.code}).`,
          afterData: { code: created.code, name: created.name, isActive: created.isActive },
        },
      });
      return mapProfile(created);
    });
  }

  async updateProfile(
    profileId: string,
    updates: {
      name?: string;
      description?: string;
      eligibleCategories?: string[];
      isActive?: boolean;
      isDefault?: boolean;
    },
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationProfileRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customizationProfile.findUnique({ where: { id: profileId } });
      if (!existing) return null;
      if (updates.isDefault) {
        await tx.customizationProfile.updateMany({
          where: { isDefault: true, id: { not: profileId } },
          data: { isDefault: false },
        });
      }
      const updated = await tx.customizationProfile.update({
        where: { id: profileId },
        data: {
          name: updates.name?.trim() ?? existing.name,
          description: updates.description !== undefined ? updates.description.trim() || null : existing.description,
          eligibleCategories:
            updates.eligibleCategories !== undefined
              ? updates.eligibleCategories
              : (existing.eligibleCategories as Prisma.InputJsonValue),
          isActive: updates.isActive ?? existing.isActive,
          isDefault: updates.isDefault ?? existing.isDefault,
          updatedBy: actorEmail,
        },
        include: { groups: { include: { options: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'CUSTOMIZATION_PROFILE_UPDATED',
          entityType: 'CustomizationProfile',
          entityId: updated.id,
          summary: `Updated customization profile "${updated.name}".`,
          beforeData: { name: existing.name, isActive: existing.isActive, isDefault: existing.isDefault },
          afterData: { name: updated.name, isActive: updated.isActive, isDefault: updated.isDefault },
        },
      });
      return mapProfile(updated);
    });
  }

  async addGroup(
    profileId: string,
    params: {
      code: string;
      name: string;
      description?: string;
      stepOrder: number;
      selectionMode: 'SINGLE' | 'TEXT';
      optionCategory: string;
      isRequired: boolean;
      isActive: boolean;
      dependencyRule?: CustomizationDependencyRule;
    },
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationGroupRecord> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.customizationGroup.create({
        data: {
          profileId,
          code: params.code.trim().toUpperCase(),
          name: params.name.trim(),
          description: params.description?.trim() || null,
          stepOrder: params.stepOrder,
          selectionMode: params.selectionMode,
          optionCategory: params.optionCategory,
          isRequired: params.isRequired,
          isActive: params.isActive,
          dependencyRule: (params.dependencyRule as Prisma.InputJsonValue) ?? undefined,
        },
        include: { options: true },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'CUSTOMIZATION_GROUP_CREATED',
          entityType: 'CustomizationGroup',
          entityId: created.id,
          summary: `Added group "${created.name}" (${created.code}) to profile ${profileId}.`,
        },
      });
      return mapGroup(created);
    });
  }

  async updateGroup(
    groupId: string,
    updates: {
      name?: string;
      description?: string;
      stepOrder?: number;
      isRequired?: boolean;
      isActive?: boolean;
      dependencyRule?: CustomizationDependencyRule;
    },
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationGroupRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customizationGroup.findUnique({ where: { id: groupId } });
      if (!existing) return null;
      const updated = await tx.customizationGroup.update({
        where: { id: groupId },
        data: {
          name: updates.name?.trim() ?? existing.name,
          description: updates.description !== undefined ? updates.description.trim() || null : existing.description,
          stepOrder: updates.stepOrder ?? existing.stepOrder,
          isRequired: updates.isRequired ?? existing.isRequired,
          isActive: updates.isActive ?? existing.isActive,
          dependencyRule:
            updates.dependencyRule !== undefined
              ? (updates.dependencyRule as Prisma.InputJsonValue)
              : (existing.dependencyRule as Prisma.InputJsonValue) ?? undefined,
        },
        include: { options: true },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'CUSTOMIZATION_GROUP_UPDATED',
          entityType: 'CustomizationGroup',
          entityId: updated.id,
          summary: `Updated customization group "${updated.name}".`,
        },
      });
      return mapGroup(updated);
    });
  }

  async addOption(
    groupId: string,
    params: {
      code: string;
      label: string;
      description?: string;
      value: string;
      swatchHex?: string;
      imageUrl?: string;
      priceRuleType: CustomizationPriceRuleType;
      priceRuleValue: string | number;
      metalType?: MetalType;
      metalPurity?: MetalPurity;
      metalColor?: string;
      diamondShape?: string;
      diamondCaratWeight?: string | number;
      diamondColorGrade?: string;
      diamondClarityGrade?: string;
      gemstoneType?: string;
      isDefault: boolean;
      isActive: boolean;
      sortOrder: number;
      eligibilityRule?: CustomizationDependencyRule;
    },
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationOptionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.customizationOption.create({
        data: {
          groupId,
          code: params.code.trim().toUpperCase(),
          label: params.label.trim(),
          description: params.description?.trim() || null,
          value: params.value.trim(),
          swatchHex: params.swatchHex?.trim() || null,
          imageUrl: params.imageUrl?.trim() || null,
          priceRuleType: params.priceRuleType,
          priceRuleValue: Number(params.priceRuleValue || 0),
          metalType: params.metalType || null,
          metalPurity: params.metalPurity || null,
          metalColor: params.metalColor || null,
          diamondShape: params.diamondShape || null,
          diamondCaratWeight:
            params.diamondCaratWeight !== undefined && params.diamondCaratWeight !== ''
              ? Number(params.diamondCaratWeight)
              : null,
          diamondColorGrade: params.diamondColorGrade || null,
          diamondClarityGrade: params.diamondClarityGrade || null,
          gemstoneType: params.gemstoneType || null,
          isDefault: params.isDefault,
          isActive: params.isActive,
          sortOrder: params.sortOrder,
          eligibilityRule: (params.eligibilityRule as Prisma.InputJsonValue) ?? undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'CUSTOMIZATION_OPTION_CREATED',
          entityType: 'CustomizationOption',
          entityId: created.id,
          summary: `Added customization option "${created.label}" (${created.code}, ${created.priceRuleType}: ${created.priceRuleValue.toFixed(2)}).`,
        },
      });
      return mapOption(created);
    });
  }

  async updateOption(
    optionId: string,
    updates: Partial<{
      label: string;
      description: string;
      value: string;
      swatchHex: string;
      priceRuleType: CustomizationPriceRuleType;
      priceRuleValue: string | number;
      isDefault: boolean;
      isActive: boolean;
      sortOrder: number;
    }>,
    actorEmail: string,
    actorRole: string
  ): Promise<CustomizationOptionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customizationOption.findUnique({ where: { id: optionId } });
      if (!existing) return null;
      const updated = await tx.customizationOption.update({
        where: { id: optionId },
        data: {
          label: updates.label?.trim() ?? existing.label,
          description: updates.description !== undefined ? updates.description.trim() || null : existing.description,
          value: updates.value?.trim() ?? existing.value,
          swatchHex: updates.swatchHex !== undefined ? updates.swatchHex.trim() || null : existing.swatchHex,
          priceRuleType: updates.priceRuleType ?? existing.priceRuleType,
          priceRuleValue:
            updates.priceRuleValue !== undefined ? Number(updates.priceRuleValue) : existing.priceRuleValue,
          isDefault: updates.isDefault ?? existing.isDefault,
          isActive: updates.isActive ?? existing.isActive,
          sortOrder: updates.sortOrder ?? existing.sortOrder,
        },
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'CUSTOMIZATION_OPTION_UPDATED',
          entityType: 'CustomizationOption',
          entityId: updated.id,
          summary: `Updated customization option "${updated.label}".`,
          beforeData: {
            priceRuleType: existing.priceRuleType,
            priceRuleValue: existing.priceRuleValue.toFixed(2),
            isActive: existing.isActive,
          },
          afterData: {
            priceRuleType: updated.priceRuleType,
            priceRuleValue: updated.priceRuleValue.toFixed(2),
            isActive: updated.isActive,
          },
        },
      });
      return mapOption(updated);
    });
  }

  async listAssignments(): Promise<ProductCustomizationAssignmentRecord[]> {
    const rows = await this.prisma.productCustomizationAssignment.findMany({
      include: { productMetadata: { select: { sku: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapAssignment);
  }

  async findAssignmentByProductId(
    productMetadataId: string
  ): Promise<ProductCustomizationAssignmentRecord | null> {
    const row = await this.prisma.productCustomizationAssignment.findUnique({
      where: { productMetadataId },
      include: { productMetadata: { select: { sku: true } } },
    });
    return row ? mapAssignment(row) : null;
  }

  async upsertProductAssignment(params: {
    productMetadataId: string;
    productSku: string;
    profileId: string;
    isCustomizable: boolean;
    allowDiamondSelection: boolean;
    allowEngraving: boolean;
    maxEngravingChars: number;
    disabledOptionCodes: string[];
    actorEmail: string;
    actorRole: string;
  }): Promise<ProductCustomizationAssignmentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.productCustomizationAssignment.upsert({
        where: { productMetadataId: params.productMetadataId },
        update: {
          profileId: params.profileId,
          isCustomizable: params.isCustomizable,
          allowDiamondSelection: params.allowDiamondSelection,
          allowEngraving: params.allowEngraving,
          maxEngravingChars: params.maxEngravingChars,
          disabledOptionCodes: params.disabledOptionCodes,
          updatedBy: params.actorEmail,
        },
        create: {
          productMetadataId: params.productMetadataId,
          profileId: params.profileId,
          isCustomizable: params.isCustomizable,
          allowDiamondSelection: params.allowDiamondSelection,
          allowEngraving: params.allowEngraving,
          maxEngravingChars: params.maxEngravingChars,
          disabledOptionCodes: params.disabledOptionCodes,
          updatedBy: params.actorEmail,
        },
        include: { productMetadata: { select: { sku: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'PRODUCT_CUSTOMIZATION_ASSIGNED',
          entityType: 'ProductCustomizationAssignment',
          entityId: params.productSku,
          summary: `Assigned customization profile ${params.profileId} to ${params.productSku} (customizable=${params.isCustomizable}).`,
        },
      });
      return mapAssignment(saved);
    });
  }

  async listModelAssets(): Promise<ProductModelAssetRecord[]> {
    const rows = await this.prisma.productModelAsset.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapModelAsset);
  }

  async findModelAssetByProductId(productMetadataId: string): Promise<ProductModelAssetRecord | null> {
    const row = await this.prisma.productModelAsset.findUnique({
      where: { productMetadataId },
    });
    return row ? mapModelAsset(row) : null;
  }

  async upsertModelAsset(params: {
    productMetadataId: string;
    productSku: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageProvider: 'LOCAL_MANAGED' | 'EXTERNAL_URL';
    storageKey: string;
    assetUrl: string;
    previewImageUrl?: string;
    status: 'ACTIVE' | 'INACTIVE';
    actorEmail: string;
    actorRole: string;
  }): Promise<{ asset: ProductModelAssetRecord; previousStorageKey?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productModelAsset.findUnique({
        where: { productMetadataId: params.productMetadataId },
      });
      const saved = await tx.productModelAsset.upsert({
        where: { productMetadataId: params.productMetadataId },
        update: {
          productSku: params.productSku,
          fileName: params.fileName,
          mimeType: params.mimeType,
          fileSizeBytes: params.fileSizeBytes,
          storageProvider: params.storageProvider,
          storageKey: params.storageKey,
          assetUrl: params.assetUrl,
          previewImageUrl: params.previewImageUrl ?? null,
          status: params.status,
          uploadedBy: params.actorEmail,
        },
        create: {
          productMetadataId: params.productMetadataId,
          productSku: params.productSku,
          fileName: params.fileName,
          mimeType: params.mimeType,
          fileSizeBytes: params.fileSizeBytes,
          storageProvider: params.storageProvider,
          storageKey: params.storageKey,
          assetUrl: params.assetUrl,
          previewImageUrl: params.previewImageUrl ?? null,
          status: params.status,
          uploadedBy: params.actorEmail,
        },
      });
      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: existing ? 'PRODUCT_MODEL_ASSET_REPLACED' : 'PRODUCT_MODEL_ASSET_ATTACHED',
          entityType: 'ProductModelAsset',
          entityId: params.productSku,
          summary: `${existing ? 'Replaced' : 'Attached'} 3D model asset "${params.fileName}" for ${params.productSku}.`,
        },
      });
      return {
        asset: mapModelAsset(saved),
        previousStorageKey:
          existing && existing.storageProvider === 'LOCAL_MANAGED'
            ? existing.storageKey
            : undefined,
      };
    });
  }

  async deleteModelAsset(
    productMetadataId: string,
    actorEmail: string,
    actorRole: string
  ): Promise<{ deleted: ProductModelAssetRecord | null }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productModelAsset.findUnique({ where: { productMetadataId } });
      if (!existing) return { deleted: null };
      await tx.productModelAsset.delete({ where: { productMetadataId } });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRODUCT_MODEL_ASSET_REMOVED',
          entityType: 'ProductModelAsset',
          entityId: existing.productSku,
          summary: `Removed 3D model asset "${existing.fileName}" from ${existing.productSku}.`,
        },
      });
      return { deleted: mapModelAsset(existing) };
    });
  }

  async listCustomerDesigns(customerId: string): Promise<CustomerDesignRecord[]> {
    const rows = await this.prisma.customerDesign.findMany({
      where: { customerId, status: 'SAVED' },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapDesign);
  }

  async listAllDesignsForAdmin(): Promise<CustomerDesignRecord[]> {
    const rows = await this.prisma.customerDesign.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return rows.map(mapDesign);
  }

  async findCustomerDesignById(designId: string): Promise<CustomerDesignRecord | null> {
    const row = await this.prisma.customerDesign.findUnique({
      where: { id: designId },
    });
    return row ? mapDesign(row) : null;
  }

  async createCustomerDesign(params: {
    customerId: string;
    productMetadataId: string;
    productSku: string;
    productHandle: string;
    productTitle: string;
    profileId?: string;
    name: string;
    selections: CustomizationSelectionMap;
    selectionSnapshot: CustomizationSelectionSnapshotItem[];
    lastQuotedPriceInr: string;
    lastPriceBreakdown: CustomizationQuoteBreakdownLine[];
    pricingRuleVersion: number;
  }): Promise<CustomerDesignRecord> {
    const created = await this.prisma.customerDesign.create({
      data: {
        customerId: params.customerId,
        productMetadataId: params.productMetadataId,
        productSku: params.productSku,
        productHandle: params.productHandle,
        productTitle: params.productTitle,
        profileId: params.profileId ?? null,
        name: params.name.trim(),
        selections: params.selections as Prisma.InputJsonValue,
        selectionSnapshot: params.selectionSnapshot as unknown as Prisma.InputJsonValue,
        lastQuotedPriceInr: Number(params.lastQuotedPriceInr),
        lastPriceBreakdown: params.lastPriceBreakdown as unknown as Prisma.InputJsonValue,
        pricingRuleVersion: params.pricingRuleVersion,
        status: 'SAVED',
      },
    });
    return mapDesign(created);
  }

  async updateCustomerDesign(
    designId: string,
    customerId: string,
    updates: {
      name?: string;
      selections?: CustomizationSelectionMap;
      selectionSnapshot?: CustomizationSelectionSnapshotItem[];
      lastQuotedPriceInr?: string;
      lastPriceBreakdown?: CustomizationQuoteBreakdownLine[];
      pricingRuleVersion?: number;
    }
  ): Promise<CustomerDesignRecord | null> {
    const existing = await this.prisma.customerDesign.findUnique({ where: { id: designId } });
    if (!existing || existing.customerId !== customerId) return null;
    const updated = await this.prisma.customerDesign.update({
      where: { id: designId },
      data: {
        name: updates.name?.trim() ?? existing.name,
        selections:
          updates.selections !== undefined
            ? (updates.selections as Prisma.InputJsonValue)
            : (existing.selections as Prisma.InputJsonValue),
        selectionSnapshot:
          updates.selectionSnapshot !== undefined
            ? (updates.selectionSnapshot as unknown as Prisma.InputJsonValue)
            : (existing.selectionSnapshot as Prisma.InputJsonValue),
        lastQuotedPriceInr:
          updates.lastQuotedPriceInr !== undefined
            ? Number(updates.lastQuotedPriceInr)
            : existing.lastQuotedPriceInr,
        lastPriceBreakdown:
          updates.lastPriceBreakdown !== undefined
            ? (updates.lastPriceBreakdown as unknown as Prisma.InputJsonValue)
            : (existing.lastPriceBreakdown as Prisma.InputJsonValue),
        pricingRuleVersion: updates.pricingRuleVersion ?? existing.pricingRuleVersion,
      },
    });
    return mapDesign(updated);
  }

  async deleteCustomerDesign(designId: string, customerId: string): Promise<boolean> {
    const existing = await this.prisma.customerDesign.findUnique({ where: { id: designId } });
    if (!existing || existing.customerId !== customerId) return false;
    await this.prisma.customerDesign.delete({ where: { id: designId } });
    return true;
  }
}
