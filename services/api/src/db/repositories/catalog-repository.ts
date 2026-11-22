import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  DiamondComponentSpec,
  JewelleryProductSpec,
  MakingChargeMode,
  MetalPurity,
  MetalType,
  NetWeightDerivationMode,
  WastageMode,
} from '@mrs/shared';
import type {
  CategoryRecord,
  CollectionRecord,
  InventoryMovementRecord,
} from '../../store/data-store.js';
import { getPrismaClient } from '../prisma.js';

const productInclude = {
  category: true,
  collections: { include: { collection: true } },
  jewellerySpecification: { include: { diamondComponents: true } },
  inventoryRecord: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  variants: true,
} satisfies Prisma.ProductMetadataInclude;

type ProductWithRelations = Prisma.ProductMetadataGetPayload<{
  include: typeof productInclude;
}>;

function mapProductToSpec(p: ProductWithRelations): JewelleryProductSpec {
  const spec = p.jewellerySpecification;
  const inv = p.inventoryRecord;
  const gallery = p.images.map((img) => img.url);
  return {
    id: p.id,
    serialNumber: p.serialNumber ? Number(p.serialNumber) : undefined,
    productTag: p.productTag || undefined,
    sku: p.sku,
    handle: p.handle,
    title: p.title,
    description: p.description || undefined,
    category: p.category?.name || 'Uncategorized',
    collections: p.collections.map((c) => c.collection.handle),
    shopifyProductGid: p.shopifyProductGid || `gid://shopify/Product/${p.id}`,
    shopifyVariantGid: p.shopifyVariantGid || `gid://shopify/ProductVariant/${p.id}`,
    currentShopifyPriceInr: p.currentShopifyPrice.toFixed(2),
    compareAtPriceInr: p.compareAtPrice ? p.compareAtPrice.toFixed(2) : undefined,
    metalType: (spec?.metalType || 'GOLD') as MetalType,
    metalPurity: (spec?.metalPurity || '18K') as MetalPurity,
    metalColor: (spec?.metalColor || 'YELLOW_GOLD') as JewelleryProductSpec['metalColor'],
    ringSize: spec?.ringSize || undefined,
    grossWeightGrams: spec ? spec.grossWeightGrams.toFixed(3) : '0.000',
    netMetalWeightGrams: spec ? spec.netMetalWeightGrams.toFixed(3) : '0.000',
    netWeightMode: (spec?.netWeightMode || 'EXPLICIT_NET_WEIGHT') as NetWeightDerivationMode,
    diamondComponents: (spec?.diamondComponents || []).map(
      (dc): DiamondComponentSpec => ({
        id: dc.id,
        componentName: dc.componentName,
        shape: dc.shape as DiamondComponentSpec['shape'],
        stoneCount: dc.stoneCount,
        totalCaratWeight: dc.totalCaratWeight.toFixed(3),
        colorGrade: dc.colorGrade as DiamondComponentSpec['colorGrade'],
        clarityGrade: dc.clarityGrade as DiamondComponentSpec['clarityGrade'],
        cutGrade: (dc.cutGrade || 'EXCELLENT') as DiamondComponentSpec['cutGrade'],
        sieveSize: dc.sieveSize || undefined,
        certification: (dc.certification || 'IGI') as DiamondComponentSpec['certification'],
        rateOverridePerCaratInr: dc.rateOverridePerCaratInr
          ? dc.rateOverridePerCaratInr.toFixed(2)
          : undefined,
      })
    ),
    makingChargeMode: (spec?.makingChargeMode || 'PER_GRAM_NET') as MakingChargeMode,
    makingChargeValue: spec ? spec.makingChargeValue.toFixed(2) : '0.00',
    wastageMode: (spec?.wastageMode || 'NONE') as WastageMode,
    wastageValue: spec ? spec.wastageValue.toFixed(3) : '0.000',
    certificationFeeInr: spec ? spec.certificationFeeInr.toFixed(2) : '0.00',
    hallmarkFeeInr: spec ? spec.hallmarkFeeInr.toFixed(2) : '0.00',
    fixedAdjustmentInr: spec ? spec.fixedAdjustmentInr.toFixed(2) : '0.00',
    manualPriceOverrideInr: spec?.manualPriceOverrideInr
      ? spec.manualPriceOverrideInr.toFixed(2)
      : null,
    pricingEnabled: spec?.pricingEnabled ?? true,
    inventoryQuantity: inv?.availableQuantity ?? 0,
    imageUrl: p.imageUrl || gallery[0] || undefined,
    altImageUrl: p.hoverImageUrl || gallery[1] || undefined,
    galleryImages: gallery.length > 0 ? gallery : undefined,
    status: (p.status as JewelleryProductSpec['status']) || 'ACTIVE',
    variants:
      p.variants.length > 0
        ? p.variants.map((v) => ({
            id: v.id,
            title: v.title,
            sku: v.sku,
            ringSize: v.ringSize || undefined,
            metalPurity: v.metalPurity as MetalPurity,
            metalColor: v.metalColor as NonNullable<JewelleryProductSpec['variants']>[number]['metalColor'],
            priceInr: v.priceInr.toFixed(2),
            inventoryQuantity: inv?.availableQuantity ?? 0,
            inStock: v.isAvailable && (inv?.availableQuantity ?? 0) > 0,
          }))
        : undefined,
    isFeaturedBestseller: p.isBestseller,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export class PostgresCatalogRepository {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async listProducts(options?: { includeDrafts?: boolean }): Promise<JewelleryProductSpec[]> {
    const rows = await this.prisma.productMetadata.findMany({
      where: options?.includeDrafts ? undefined : { status: 'ACTIVE' },
      include: productInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapProductToSpec);
  }

  async findProductByHandleOrSku(handleOrSku: string): Promise<JewelleryProductSpec | null> {
    const key = handleOrSku.trim();
    const row = await this.prisma.productMetadata.findFirst({
      where: {
        OR: [
          { sku: { equals: key, mode: 'insensitive' } },
          { handle: { equals: key, mode: 'insensitive' } },
          { id: key },
        ],
      },
      include: productInclude,
    });
    return row ? mapProductToSpec(row) : null;
  }

  async listCategories(): Promise<CategoryRecord[]> {
    const rows = await this.prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      shopifyCollectionId: c.shopifyCollectionId || '',
      excelSheetName: c.excelSheetName || c.name,
      description: c.description || '',
      productCount: c._count.products,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
    }));
  }

  async listCollections(): Promise<CollectionRecord[]> {
    const rows = await this.prisma.collection.findMany({
      include: {
        products: {
          include: { productMetadata: { select: { sku: true } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((col) => ({
      id: col.id,
      handle: col.handle,
      title: col.title,
      description: col.description || '',
      imageUrl: col.imageUrl || '',
      isFeatured: true,
      isActive: col.isActive,
      productSkus: col.products.map((p) => p.productMetadata.sku),
    }));
  }

  async findCollectionByHandle(handle: string): Promise<CollectionRecord | null> {
    const col = await this.prisma.collection.findUnique({
      where: { handle: handle.trim().toLowerCase() },
      include: {
        products: {
          include: { productMetadata: { select: { sku: true } } },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!col) return null;
    return {
      id: col.id,
      handle: col.handle,
      title: col.title,
      description: col.description || '',
      imageUrl: col.imageUrl || '',
      isFeatured: true,
      isActive: col.isActive,
      productSkus: col.products.map((p) => p.productMetadata.sku),
    };
  }

  async createProduct(params: {
    sku: string;
    handle: string;
    title: string;
    description?: string;
    categoryName: string;
    priceInr: number;
    metalType: string;
    metalPurity: string;
    metalColor: string;
    grossWeightGrams: number;
    netMetalWeightGrams: number;
    netWeightMode?: string;
    makingChargeMode: string;
    makingChargeValue: number;
    wastageMode?: string;
    wastageValue?: number;
    certificationFeeInr?: number;
    hallmarkFeeInr?: number;
    fixedAdjustmentInr?: number;
    inventoryQuantity: number;
    imageUrl?: string;
    diamondComponents?: Array<{
      componentName?: string;
      shape?: string;
      stoneCount?: number;
      totalCaratWeight: number | string;
      colorGrade?: string;
      clarityGrade?: string;
      cutGrade?: string;
      certification?: string;
    }>;
    actorEmail: string;
    actorRole: string;
  }): Promise<JewelleryProductSpec> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMetadata.findFirst({
        where: { OR: [{ sku: params.sku }, { handle: params.handle }] },
      });
      if (existing) {
        throw new Error(`DUPLICATE_PRODUCT: SKU "${params.sku}" or handle "${params.handle}" already exists.`);
      }

      const categorySlug = params.categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const category = await tx.category.upsert({
        where: { slug: categorySlug },
        update: {},
        create: {
          name: params.categoryName.trim(),
          slug: categorySlug,
          excelSheetName: params.categoryName.trim(),
        },
      });

      const created = await tx.productMetadata.create({
        data: {
          sku: params.sku.trim(),
          handle: params.handle.trim().toLowerCase(),
          title: params.title.trim(),
          description: params.description,
          categoryId: category.id,
          currentShopifyPrice: params.priceInr,
          currency: 'INR',
          imageUrl: params.imageUrl,
          status: 'ACTIVE',
          jewellerySpecification: {
            create: {
              metalType: params.metalType,
              metalPurity: params.metalPurity,
              metalColor: params.metalColor,
              grossWeightGrams: params.grossWeightGrams,
              netMetalWeightGrams: params.netMetalWeightGrams,
              netWeightMode: params.netWeightMode || 'EXPLICIT_NET_WEIGHT',
              makingChargeMode: params.makingChargeMode,
              makingChargeValue: params.makingChargeValue,
              wastageMode: params.wastageMode || 'NONE',
              wastageValue: params.wastageValue ?? 0,
              certificationFeeInr: params.certificationFeeInr ?? 0,
              hallmarkFeeInr: params.hallmarkFeeInr ?? 0,
              fixedAdjustmentInr: params.fixedAdjustmentInr ?? 0,
              pricingEnabled: true,
              diamondComponents: params.diamondComponents?.length
                ? {
                    create: params.diamondComponents.map((dc) => ({
                      componentName: dc.componentName || 'Center / Accent Diamond',
                      shape: dc.shape || 'ROUND',
                      stoneCount: dc.stoneCount ?? 1,
                      totalCaratWeight: Number(dc.totalCaratWeight),
                      colorGrade: dc.colorGrade || 'EF',
                      clarityGrade: dc.clarityGrade || 'VVS',
                      cutGrade: dc.cutGrade || 'EXCELLENT',
                      certification: dc.certification || 'IGI',
                    })),
                  }
                : undefined,
            },
          },
          inventoryRecord: {
            create: {
              availableQuantity: params.inventoryQuantity,
              reservedQuantity: 0,
              lowStockThreshold: 2,
              locationName: 'Mumbai Studio Vault',
            },
          },
        },
        include: productInclude,
      });

      if (created.inventoryRecord) {
        await tx.inventoryMovement.create({
          data: {
            inventoryRecordId: created.inventoryRecord.id,
            sku: created.sku,
            movementType: 'INITIAL_IMPORT',
            quantityDelta: params.inventoryQuantity,
            previousQuantity: 0,
            newQuantity: params.inventoryQuantity,
            reason: 'Initial product creation',
            actorEmail: params.actorEmail,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'PRODUCT_CREATED',
          entityType: 'ProductMetadata',
          entityId: created.sku,
          summary: `Created product ${created.title} (${created.sku})`,
          afterData: { sku: created.sku, priceInr: params.priceInr, inventoryQuantity: params.inventoryQuantity },
        },
      });

      return mapProductToSpec(created);
    });
  }

  async updateProductAttributes(
    sku: string,
    updates: {
      metalType?: string;
      metalPurity?: string;
      grossWeightGrams?: string | number;
      netMetalWeightGrams?: string | number;
      netWeightMode?: string;
      makingChargeMode?: string;
      makingChargeValue?: string | number;
      wastageMode?: string;
      wastageValue?: string | number;
      certificationFeeInr?: string | number;
      hallmarkFeeInr?: string | number;
      fixedAdjustmentInr?: string | number;
      manualPriceOverrideInr?: string | number | null;
      pricingEnabled?: boolean;
      diamondComponents?: Array<{
        id?: string;
        componentName?: string;
        shape?: string;
        stoneCount?: number;
        totalCaratWeight: number | string;
        colorGrade?: string;
        clarityGrade?: string;
        cutGrade?: string;
        certification?: string;
        rateOverridePerCaratInr?: number | string | null;
      }>;
    },
    actorEmail: string,
    actorRole: string
  ): Promise<JewelleryProductSpec | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMetadata.findUnique({
        where: { sku },
        include: productInclude,
      });
      if (!existing || !existing.jewellerySpecification) return null;

      const spec = existing.jewellerySpecification;
      await tx.jewellerySpecification.update({
        where: { id: spec.id },
        data: {
          metalType: updates.metalType ?? spec.metalType,
          metalPurity: updates.metalPurity ?? spec.metalPurity,
          grossWeightGrams:
            updates.grossWeightGrams !== undefined ? Number(updates.grossWeightGrams) : spec.grossWeightGrams,
          netMetalWeightGrams:
            updates.netMetalWeightGrams !== undefined
              ? Number(updates.netMetalWeightGrams)
              : spec.netMetalWeightGrams,
          netWeightMode: updates.netWeightMode ?? spec.netWeightMode,
          makingChargeMode: updates.makingChargeMode ?? spec.makingChargeMode,
          makingChargeValue:
            updates.makingChargeValue !== undefined
              ? Number(updates.makingChargeValue)
              : spec.makingChargeValue,
          wastageMode: updates.wastageMode ?? spec.wastageMode,
          wastageValue: updates.wastageValue !== undefined ? Number(updates.wastageValue) : spec.wastageValue,
          certificationFeeInr:
            updates.certificationFeeInr !== undefined
              ? Number(updates.certificationFeeInr)
              : spec.certificationFeeInr,
          hallmarkFeeInr:
            updates.hallmarkFeeInr !== undefined ? Number(updates.hallmarkFeeInr) : spec.hallmarkFeeInr,
          fixedAdjustmentInr:
            updates.fixedAdjustmentInr !== undefined
              ? Number(updates.fixedAdjustmentInr)
              : spec.fixedAdjustmentInr,
          manualPriceOverrideInr:
            updates.manualPriceOverrideInr !== undefined
              ? updates.manualPriceOverrideInr === null
                ? null
                : Number(updates.manualPriceOverrideInr)
              : spec.manualPriceOverrideInr,
          pricingEnabled: updates.pricingEnabled ?? spec.pricingEnabled,
        },
      });

      if (updates.diamondComponents) {
        await tx.diamondComponent.deleteMany({ where: { jewellerySpecificationId: spec.id } });
        if (updates.diamondComponents.length > 0) {
          await tx.diamondComponent.createMany({
            data: updates.diamondComponents.map((dc) => ({
              jewellerySpecificationId: spec.id,
              componentName: dc.componentName || 'Center / Accent Diamond',
              shape: dc.shape || 'ROUND',
              stoneCount: dc.stoneCount ?? 1,
              totalCaratWeight: Number(dc.totalCaratWeight),
              colorGrade: dc.colorGrade || 'EF',
              clarityGrade: dc.clarityGrade || 'VVS',
              cutGrade: dc.cutGrade || 'EXCELLENT',
              certification: dc.certification || 'IGI',
              rateOverridePerCaratInr:
                dc.rateOverridePerCaratInr !== undefined && dc.rateOverridePerCaratInr !== null
                  ? Number(dc.rateOverridePerCaratInr)
                  : null,
            })),
          });
        }
      }

      const updated = await tx.productMetadata.findUniqueOrThrow({
        where: { id: existing.id },
        include: productInclude,
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRODUCT_PRICING_ATTRIBUTES_UPDATED',
          entityType: 'ProductMetadata',
          entityId: sku,
          summary: `Updated pricing attributes for ${sku}`,
          afterData: updates as Prisma.InputJsonValue,
        },
      });

      return mapProductToSpec(updated);
    });
  }

  async deleteProduct(sku: string, actorEmail: string, actorRole: string): Promise<JewelleryProductSpec | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMetadata.findUnique({
        where: { sku },
        include: productInclude,
      });
      if (!existing) return null;

      await tx.productMetadata.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRODUCT_DELETED',
          entityType: 'ProductMetadata',
          entityId: sku,
          summary: `Deleted product ${existing.title} (${sku})`,
        },
      });

      return mapProductToSpec(existing);
    });
  }

  async listInventory() {
    const rows = await this.prisma.inventoryRecord.findMany({
      include: {
        productMetadata: {
          include: { category: true },
        },
        movements: {
          where: { movementType: 'PROVISIONAL_IMPORT_OVERRIDE' },
          take: 1,
        },
      },
      orderBy: { productMetadata: { sku: 'asc' } },
    });

    return rows.map((inv) => ({
      id: inv.id,
      sku: inv.productMetadata.sku,
      title: inv.productMetadata.title,
      category: inv.productMetadata.category?.name || 'Uncategorized',
      locationName: inv.locationName,
      availableQuantity: inv.availableQuantity,
      reservedQuantity: inv.reservedQuantity,
      lowStockThreshold: inv.lowStockThreshold,
      isLowStock: inv.availableQuantity <= inv.lowStockThreshold,
      isProvisional: inv.movements.length > 0,
      provisionalNote:
        inv.movements.length > 0 ? inv.movements[0]!.reason : undefined,
      updatedAt: inv.updatedAt.toISOString(),
    }));
  }

  async adjustInventory(params: {
    sku: string;
    quantityDelta: number;
    reason: string;
    actorEmail: string;
    actorRole: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.productMetadata.findUnique({
        where: { sku: params.sku },
        include: { inventoryRecord: true },
      });
      if (!product || !product.inventoryRecord) {
        throw new Error(`PRODUCT_NOT_FOUND: SKU "${params.sku}" not found.`);
      }

      const inv = product.inventoryRecord;
      const previousQuantity = inv.availableQuantity;
      const newQuantity = previousQuantity + params.quantityDelta;
      if (newQuantity < 0) {
        throw new Error(
          `INSUFFICIENT_STOCK: Cannot adjust ${params.sku} by ${params.quantityDelta}; available is ${previousQuantity}.`
        );
      }

      const updatedInv = await tx.inventoryRecord.update({
        where: { id: inv.id },
        data: { availableQuantity: newQuantity, lastSyncedAt: new Date() },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryRecordId: inv.id,
          sku: product.sku,
          movementType: 'MANUAL_ADJUSTMENT',
          quantityDelta: params.quantityDelta,
          previousQuantity,
          newQuantity,
          reason: params.reason,
          actorEmail: params.actorEmail,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'INVENTORY_ADJUSTED',
          entityType: 'InventoryRecord',
          entityId: product.sku,
          summary: `Adjusted inventory for ${product.sku} from ${previousQuantity} to ${newQuantity} (${params.quantityDelta >= 0 ? '+' : ''}${params.quantityDelta})`,
          beforeData: { availableQuantity: previousQuantity },
          afterData: { availableQuantity: newQuantity, reason: params.reason },
        },
      });

      return {
        sku: product.sku,
        previousQuantity,
        newQuantity: updatedInv.availableQuantity,
        movement: {
          id: movement.id,
          sku: movement.sku,
          title: product.title,
          movementType: 'ADJUSTMENT' as const,
          deltaQuantity: movement.quantityDelta,
          previousAvailable: movement.previousQuantity,
          newAvailable: movement.newQuantity,
          reason: movement.reason,
          actorEmail: movement.actorEmail,
          createdAt: movement.createdAt.toISOString(),
        },
      };
    });
  }

  async listInventoryMovements(): Promise<InventoryMovementRecord[]> {
    const rows = await this.prisma.inventoryMovement.findMany({
      include: { inventoryRecord: { include: { productMetadata: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      sku: m.sku,
      title: m.inventoryRecord.productMetadata.title,
      movementType: m.movementType as InventoryMovementRecord['movementType'],
      deltaQuantity: m.quantityDelta,
      previousAvailable: m.previousQuantity,
      newAvailable: m.newQuantity,
      reason: m.reason,
      referenceId: m.referenceId || undefined,
      actorEmail: m.actorEmail,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
