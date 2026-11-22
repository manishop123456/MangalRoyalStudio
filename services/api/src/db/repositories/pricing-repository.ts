import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  DiamondRateMatrixEntry,
  MetalRateRecord,
  PriceCalculationBreakdown,
  PricingFormulaRule,
} from '@mrs/shared';
import type { PricingRunRecord, PricingSnapshotRecord } from '../../store/data-store.js';
import { getPrismaClient } from '../prisma.js';

function mapMetalRate(r: {
  id: string;
  metalType: string;
  purity: string;
  ratePerGramInr: Prisma.Decimal;
  currency: string;
  source: string;
  isPlaceholder: boolean;
  effectiveAt: Date;
  createdBy: string;
  createdAt?: Date;
}): MetalRateRecord {
  return {
    id: r.id,
    metalType: r.metalType as MetalRateRecord['metalType'],
    purity: r.purity as MetalRateRecord['purity'],
    ratePerGramInr: r.ratePerGramInr.toFixed(2),
    currency: 'INR',
    source: r.source,
    isPlaceholder: r.isPlaceholder,
    effectiveAt: r.effectiveAt.toISOString(),
    createdBy: r.createdBy,
    createdAt: (r.createdAt ?? r.effectiveAt).toISOString(),
  };
}

function mapDiamondRate(r: {
  id: string;
  shape: string;
  sieveRange?: string | null;
  sizeMinCarat: Prisma.Decimal;
  sizeMaxCarat: Prisma.Decimal;
  colorGrade: string;
  clarityGrade: string;
  cutGrade: string | null;
  pricingType: string;
  rateInr: Prisma.Decimal;
  currency: string;
  version: number;
  isPlaceholder: boolean;
  isActive: boolean;
  effectiveAt: Date;
  createdBy: string;
  createdAt?: Date;
}): DiamondRateMatrixEntry {
  return {
    id: r.id,
    shape: r.shape as DiamondRateMatrixEntry['shape'],
    sieveRange: r.sieveRange ?? undefined,
    sizeMinCarat: r.sizeMinCarat.toFixed(4),
    sizeMaxCarat: r.sizeMaxCarat.toFixed(4),
    colorGrade: r.colorGrade,
    clarityGrade: r.clarityGrade,
    cutGrade: r.cutGrade || 'EXCELLENT',
    pricingType: (r.pricingType === 'FLAT_PER_STONE' ? 'FLAT_PER_STONE' : 'PER_CARAT'),
    rateInr: r.rateInr.toFixed(2),
    currency: 'INR',
    version: r.version,
    isPlaceholder: r.isPlaceholder,
    isActive: r.isActive,
    effectiveAt: r.effectiveAt.toISOString(),
    createdBy: r.createdBy,
    createdAt: (r.createdAt ?? r.effectiveAt).toISOString(),
  };
}

function mapPricingRule(r: {
  id: string;
  version: number;
  name: string;
  description: string;
  status: string;
  isPlaceholderFormula: boolean;
  stoneWeightToGramsFactor: Prisma.Decimal;
  gstRatePercent: Prisma.Decimal;
  gstMode: string;
  roundingMode: string;
  maxPriceDeltaPercentThreshold: Prisma.Decimal;
  defaultCertificationFeeInr: Prisma.Decimal;
  defaultHallmarkFeeInr: Prisma.Decimal;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}): PricingFormulaRule {
  return {
    id: r.id,
    version: r.version,
    name: r.name,
    description: r.description,
    status: r.status as PricingFormulaRule['status'],
    isPlaceholderFormula: r.isPlaceholderFormula,
    stoneWeightToGramsFactor: r.stoneWeightToGramsFactor.toFixed(4),
    gstRatePercent: r.gstRatePercent.toFixed(2),
    gstMode: r.gstMode as PricingFormulaRule['gstMode'],
    roundingMode: r.roundingMode as PricingFormulaRule['roundingMode'],
    maxPriceDeltaPercentThreshold: r.maxPriceDeltaPercentThreshold.toFixed(2),
    defaultCertificationFeeInr: r.defaultCertificationFeeInr.toFixed(2),
    defaultHallmarkFeeInr: r.defaultHallmarkFeeInr.toFixed(2),
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  };
}

export class PostgresPricingRepository {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async listMetalRates(): Promise<MetalRateRecord[]> {
    const rows = await this.prisma.goldRate.findMany({
      orderBy: { effectiveAt: 'desc' },
    });
    return rows.map(mapMetalRate);
  }

  async getActiveMetalRates(): Promise<MetalRateRecord[]> {
    const rows = await this.prisma.goldRate.findMany({
      orderBy: { effectiveAt: 'desc' },
      distinct: ['metalType', 'purity'],
    });
    return rows.map(mapMetalRate);
  }

  async listDiamondRates(): Promise<DiamondRateMatrixEntry[]> {
    const rows = await this.prisma.diamondRate.findMany({
      orderBy: { effectiveAt: 'desc' },
    });
    return rows.map(mapDiamondRate);
  }

  async getActiveDiamondRates(): Promise<DiamondRateMatrixEntry[]> {
    const rows = await this.prisma.diamondRate.findMany({
      where: { isActive: true },
      orderBy: { effectiveAt: 'desc' },
    });
    return rows.map(mapDiamondRate);
  }

  async listPricingRules(): Promise<PricingFormulaRule[]> {
    const rows = await this.prisma.pricingRule.findMany({
      orderBy: { version: 'desc' },
    });
    return rows.map((r) => this.enrichPricingRule(mapPricingRule(r)));
  }

  async getActivePricingRule(): Promise<PricingFormulaRule | null> {
    const row = await this.prisma.pricingRule.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { version: 'desc' },
    });
    return row ? this.enrichPricingRule(mapPricingRule(row)) : null;
  }

  private enrichPricingRule(rule: PricingFormulaRule): PricingFormulaRule {
    const match = rule.description.match(/\[MAKING_CHARGE_PER_GRAM_INR:([0-9.]+)\]/);
    const makingChargePerGramInr =
      match?.[1] || (!rule.isPlaceholderFormula ? '2500.00' : rule.makingChargePerGramInr);
    return {
      ...rule,
      makingChargePerGramInr,
      useRateCardMakingCharge: Boolean(match || !rule.isPlaceholderFormula),
      confirmedGstPurities: rule.confirmedGstPurities ?? ['14K', '18K'],
      diamondTierBasis:
        rule.diamondTierBasis ?? (match || !rule.isPlaceholderFormula ? 'TOTAL_PRODUCT_CARAT' : 'COMPONENT_AVERAGE_STONE'),
      applyProductLevelFees: rule.applyProductLevelFees ?? !(match || !rule.isPlaceholderFormula),
      rateCardLabel: 'Owner-updated market rates',
    };
  }

  async recordGoldRate(params: {
    metalType: string;
    purity: string;
    ratePerGramInr: number | string;
    source?: string;
    isPlaceholder?: boolean;
    createdBy: string;
    actorRole?: string;
  }): Promise<MetalRateRecord> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.goldRate.findFirst({
        where: { metalType: params.metalType, purity: params.purity },
        orderBy: { effectiveAt: 'desc' },
      });
      const existingCount = await tx.goldRate.count({
        where: { metalType: params.metalType, purity: params.purity },
      });
      const rateVersion = existingCount + 1;

      const created = await tx.goldRate.create({
        data: {
          metalType: params.metalType,
          purity: params.purity,
          ratePerGramInr: Number(params.ratePerGramInr),
          currency: 'INR',
          source: params.source || 'Owner-updated market rates',
          isPlaceholder: params.isPlaceholder ?? false,
          createdBy: params.createdBy,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.createdBy,
          actorRole: params.actorRole || 'PRICING_OPERATOR',
          action: 'METAL_RATE_UPDATED',
          entityType: 'GoldRate',
          entityId: created.id,
          summary: `Recorded ${params.metalType} ${params.purity} rate ₹${Number(params.ratePerGramInr).toFixed(2)}/g (v${rateVersion})`,
          beforeData: previous
            ? {
                id: previous.id,
                metalType: previous.metalType,
                purity: previous.purity,
                ratePerGramInr: Number(previous.ratePerGramInr),
                source: previous.source,
                effectiveAt: previous.effectiveAt.toISOString(),
              }
            : undefined,
          afterData: {
            id: created.id,
            metalType: params.metalType,
            purity: params.purity,
            ratePerGramInr: Number(params.ratePerGramInr),
            source: created.source,
            rateVersion,
            changedBy: params.createdBy,
            effectiveAt: created.effectiveAt.toISOString(),
          },
        },
      });

      return mapMetalRate(created);
    });
  }

  async recordDiamondRate(params: {
    shape: string;
    caratMin: number | string;
    caratMax: number | string;
    colorGrade: string;
    clarityGrade: string;
    cutGrade?: string;
    ratePerCaratInr: number | string;
    isPlaceholder?: boolean;
    createdBy: string;
    actorRole?: string;
  }): Promise<DiamondRateMatrixEntry> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.diamondRate.findFirst({
        where: {
          shape: params.shape,
          sizeMinCarat: Number(params.caratMin),
          sizeMaxCarat: Number(params.caratMax),
        },
        orderBy: { effectiveAt: 'desc' },
      });
      const nextVersion = (previous?.version ?? 0) + 1;

      if (params.isPlaceholder === false) {
        await tx.diamondRate.updateMany({
          where: {
            OR: [
              { isPlaceholder: true },
              {
                shape: params.shape,
                sizeMinCarat: Number(params.caratMin),
                sizeMaxCarat: Number(params.caratMax),
              },
            ],
          },
          data: { isActive: false },
        });
      }

      const created = await tx.diamondRate.create({
        data: {
          shape: params.shape,
          sizeMinCarat: Number(params.caratMin),
          sizeMaxCarat: Number(params.caratMax),
          colorGrade: params.colorGrade,
          clarityGrade: params.clarityGrade,
          cutGrade: params.cutGrade || 'EXCELLENT',
          rateInr: Number(params.ratePerCaratInr),
          version: nextVersion,
          isPlaceholder: params.isPlaceholder ?? false,
          isActive: true,
          createdBy: params.createdBy,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.createdBy,
          actorRole: params.actorRole || 'PRICING_OPERATOR',
          action: 'DIAMOND_RATE_UPDATED',
          entityType: 'DiamondRate',
          entityId: created.id,
          summary: `Recorded diamond rate ${params.shape} ${params.caratMin}-${params.caratMax}ct ${params.colorGrade}/${params.clarityGrade} at ₹${Number(params.ratePerCaratInr).toFixed(2)}/ct (v${nextVersion})`,
          beforeData: previous
            ? {
                id: previous.id,
                shape: previous.shape,
                sizeMinCarat: Number(previous.sizeMinCarat),
                sizeMaxCarat: Number(previous.sizeMaxCarat),
                ratePerCaratInr: Number(previous.rateInr),
                version: previous.version,
                effectiveAt: previous.effectiveAt.toISOString(),
              }
            : undefined,
          afterData: {
            id: created.id,
            shape: params.shape,
            sizeMinCarat: Number(params.caratMin),
            sizeMaxCarat: Number(params.caratMax),
            ratePerCaratInr: Number(params.ratePerCaratInr),
            rateVersion: nextVersion,
            changedBy: params.createdBy,
            effectiveAt: created.effectiveAt.toISOString(),
          },
        },
      });

      return mapDiamondRate(created);
    });
  }

  async createPricingRule(params: {
    name: string;
    description: string;
    stoneWeightToGramsFactor: number | string;
    gstRatePercent: number | string;
    gstMode: string;
    roundingMode: string;
    maxPriceDeltaPercentThreshold: number | string;
    defaultCertificationFeeInr?: number | string;
    defaultHallmarkFeeInr?: number | string;
    isPlaceholderFormula?: boolean;
    createdBy: string;
    actorRole: string;
  }): Promise<PricingFormulaRule> {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.pricingRule.findFirst({ orderBy: { version: 'desc' } });
      const nextVersion = (latest?.version ?? 0) + 1;

      const created = await tx.pricingRule.create({
        data: {
          version: nextVersion,
          name: params.name,
          description: params.description,
          status: 'APPROVED',
          isPlaceholderFormula: params.isPlaceholderFormula ?? false,
          stoneWeightToGramsFactor: Number(params.stoneWeightToGramsFactor),
          gstRatePercent: Number(params.gstRatePercent),
          gstMode: params.gstMode,
          roundingMode: params.roundingMode,
          maxPriceDeltaPercentThreshold: Number(params.maxPriceDeltaPercentThreshold),
          defaultCertificationFeeInr: Number(params.defaultCertificationFeeInr ?? 0),
          defaultHallmarkFeeInr: Number(params.defaultHallmarkFeeInr ?? 0),
          approvedBy: params.createdBy,
          approvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.createdBy,
          actorRole: params.actorRole,
          action: 'PRICING_RULE_CREATED',
          entityType: 'PricingRule',
          entityId: created.id,
          summary: `Created pricing rule v${created.version}: ${created.name}`,
          beforeData: latest
            ? { version: latest.version, name: latest.name, description: latest.description }
            : undefined,
          afterData: { version: created.version, name: created.name, description: created.description },
        },
      });

      return this.enrichPricingRule(mapPricingRule(created));
    });
  }

  async listPricingRuns(): Promise<PricingRunRecord[]> {
    const rows = await this.prisma.pricingRun.findMany({
      include: { pricingRule: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status as PricingRunRecord['status'],
      ruleVersion: r.pricingRule.version,
      ruleId: r.pricingRuleId,
      notes: r.notes || '',
      createdBy: r.createdBy,
      validatedBy: r.validatedBy,
      validatedAt: r.validatedAt?.toISOString() || null,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() || null,
      publishedBy: r.publishedBy,
      publishedAt: r.publishedAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
      summary: (r.summary || {}) as PricingRunRecord['summary'],
      items: r.items.map((item) => ({
        sku: item.sku,
        title: item.sku,
        shopifyVariantGid: item.shopifyVariantGid || '',
        oldPriceInr: item.oldPriceInr.toFixed(2),
        proposedPriceInr: item.proposedPriceInr.toFixed(2),
        priceDeltaInr: item.priceDeltaInr.toFixed(2),
        priceDeltaPercent: item.priceDeltaPercent.toFixed(2),
        exceedsThreshold: item.exceedsThreshold,
        breakdown: item.calculationBreakdown as unknown as PriceCalculationBreakdown,
      })),
    }));
  }

  async findPricingRunById(runId: string): Promise<PricingRunRecord | null> {
    const r = await this.prisma.pricingRun.findUnique({
      where: { id: runId },
      include: { pricingRule: true, items: true },
    });
    if (!r) return null;
    return {
      id: r.id,
      status: r.status as PricingRunRecord['status'],
      ruleVersion: r.pricingRule.version,
      ruleId: r.pricingRuleId,
      notes: r.notes || '',
      createdBy: r.createdBy,
      validatedBy: r.validatedBy,
      validatedAt: r.validatedAt?.toISOString() || null,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() || null,
      publishedBy: r.publishedBy,
      publishedAt: r.publishedAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
      summary: (r.summary || {}) as PricingRunRecord['summary'],
      items: r.items.map((item) => ({
        sku: item.sku,
        title: item.sku,
        shopifyVariantGid: item.shopifyVariantGid || '',
        oldPriceInr: item.oldPriceInr.toFixed(2),
        proposedPriceInr: item.proposedPriceInr.toFixed(2),
        priceDeltaInr: item.priceDeltaInr.toFixed(2),
        priceDeltaPercent: item.priceDeltaPercent.toFixed(2),
        exceedsThreshold: item.exceedsThreshold,
        breakdown: item.calculationBreakdown as unknown as PriceCalculationBreakdown,
      })),
    };
  }

  async createPricingRun(params: {
    pricingRuleId: string;
    rateSnapshot: Record<string, unknown> | Prisma.InputJsonValue;
    summary: Record<string, unknown> | Prisma.InputJsonValue;
    notes?: string;
    createdBy: string;
    actorRole?: string;
    items: Array<{
      sku: string;
      oldPriceInr: number | string;
      proposedPriceInr: number | string;
      priceDeltaInr: number | string;
      priceDeltaPercent?: number | string;
      exceedsThreshold?: boolean;
      calculationBreakdown?: Record<string, unknown> | Prisma.InputJsonValue;
      shopifyProductGid?: string;
      shopifyVariantGid?: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.pricingRun.create({
        data: {
          pricingRuleId: params.pricingRuleId,
          status: 'PREVIEWED',
          rateSnapshot: params.rateSnapshot as Prisma.InputJsonValue,
          summary: params.summary as Prisma.InputJsonValue,
          notes: params.notes || '',
          createdBy: params.createdBy,
          items: {
            create: params.items.map((item) => ({
              sku: item.sku,
              oldPriceInr: Number(item.oldPriceInr),
              proposedPriceInr: Number(item.proposedPriceInr),
              priceDeltaInr: Number(item.priceDeltaInr),
              priceDeltaPercent: Number(item.priceDeltaPercent ?? 0),
              exceedsThreshold: item.exceedsThreshold ?? false,
              calculationBreakdown: (item.calculationBreakdown || {}) as Prisma.InputJsonValue,
              shopifyProductGid: item.shopifyProductGid,
              shopifyVariantGid: item.shopifyVariantGid,
            })),
          },
        },
        include: { pricingRule: true, items: true },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.createdBy,
          actorRole: params.actorRole || 'PRICING_OPERATOR',
          action: 'PRICING_RUN_PREVIEWED',
          entityType: 'PricingRun',
          entityId: run.id,
          summary: `Previewed pricing run ${run.id} across ${params.items.length} products`,
        },
      });

      return run;
    });
  }

  async validatePricingRun(runId: string, actorEmail: string, actorRole: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.pricingRun.update({
        where: { id: runId },
        data: {
          status: 'VALIDATED',
          validatedBy: actorEmail,
          validatedAt: new Date(),
        },
        include: { pricingRule: true, items: true },
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRICING_RUN_VALIDATED',
          entityType: 'PricingRun',
          entityId: run.id,
          summary: `Validated pricing run ${run.id}`,
        },
      });

      return run;
    });
  }

  async approvePricingRun(runId: string, actorEmail: string, actorRole: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.pricingRun.update({
        where: { id: runId },
        data: {
          status: 'APPROVED',
          approvedBy: actorEmail,
          approvedAt: new Date(),
        },
        include: { pricingRule: true, items: true },
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRICING_RUN_APPROVED',
          entityType: 'PricingRun',
          entityId: run.id,
          summary: `Owner approved pricing run ${run.id}`,
        },
      });

      return run;
    });
  }

  async publishPricingRun(runId: string, actorEmail: string, actorRole: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.pricingRun.findUnique({
        where: { id: runId },
        include: { pricingRule: true, items: true },
      });
      if (!run) {
        throw new Error(`PRICING_RUN_NOT_FOUND: ${runId}`);
      }

      const publishedAt = new Date();
      const snapshotsCreated: PricingSnapshotRecord[] = [];

      for (const item of run.items) {
        const product = await tx.productMetadata.findUnique({
          where: { sku: item.sku },
          select: { id: true, shopifyVariantGid: true },
        });

        await tx.productMetadata.updateMany({
          where: { sku: item.sku },
          data: { currentShopifyPrice: item.proposedPriceInr },
        });

        const snap = await tx.pricingSnapshot.create({
          data: {
            productMetadataId: product?.id || null,
            pricingRunId: run.id,
            pricingRuleId: run.pricingRuleId,
            sku: item.sku,
            shopifyVariantGid: item.shopifyVariantGid || product?.shopifyVariantGid || null,
            publishedPriceInr: item.proposedPriceInr,
            currency: 'INR',
            rateSnapshot: run.rateSnapshot as Prisma.InputJsonValue,
            calculationBreakdown: item.calculationBreakdown as Prisma.InputJsonValue,
            publishedBy: actorEmail,
            publishedAt,
          },
        });

        snapshotsCreated.push({
          id: snap.id,
          sku: snap.sku,
          shopifyVariantGid: snap.shopifyVariantGid || '',
          pricingRunId: run.id,
          formulaVersion: run.pricingRule.version,
          publishedPriceInr: snap.publishedPriceInr.toFixed(2),
          currency: 'INR',
          breakdown: snap.calculationBreakdown as unknown as PriceCalculationBreakdown,
          publishedBy: snap.publishedBy,
          publishedAt: snap.publishedAt.toISOString(),
        });
      }

      const updatedRun = await tx.pricingRun.update({
        where: { id: run.id },
        data: {
          status: 'PUBLISHED',
          publishedBy: actorEmail,
          publishedAt,
        },
        include: { pricingRule: true, items: true },
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'PRICING_RUN_PUBLISHED',
          entityType: 'PricingRun',
          entityId: run.id,
          summary: `Published pricing run ${run.id} (${snapshotsCreated.length} immutable snapshots created)`,
        },
      });

      return { run: updatedRun, snapshots: snapshotsCreated };
    });
  }

  async listPricingSnapshots(): Promise<PricingSnapshotRecord[]> {
    const rows = await this.prisma.pricingSnapshot.findMany({
      include: { pricingRule: { select: { version: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
    return rows.map((s) => ({
      id: s.id,
      sku: s.sku,
      shopifyVariantGid: s.shopifyVariantGid || '',
      pricingRunId: s.pricingRunId || '',
      formulaVersion: s.pricingRule.version,
      publishedPriceInr: s.publishedPriceInr.toFixed(2),
      currency: 'INR',
      breakdown: s.calculationBreakdown as unknown as PriceCalculationBreakdown,
      publishedBy: s.publishedBy,
      publishedAt: s.publishedAt.toISOString(),
    }));
  }
}
