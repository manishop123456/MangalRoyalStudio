import type { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  buildOwnerMarketRateCard,
  doDiamondSlabsOverlap,
  doesDiamondSlabCoverExactOneCarat,
  OWNER_MARKET_RATE_CARD_LABEL,
  type DiamondRateMatrixEntry,
  type MetalRateRecord,
  type OwnerMarketRateCard,
  type PriceCalculationBreakdown,
  type PricingFormulaRule,
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
  minInclusive?: boolean;
  maxInclusive?: boolean;
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
    minInclusive: r.minInclusive ?? true,
    maxInclusive: r.maxInclusive ?? true,
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

  private async recordGoldRateInTx(
    tx: Prisma.TransactionClient,
    params: {
      metalType: string;
      purity: string;
      ratePerGramInr: number | string;
      source?: string;
      isPlaceholder?: boolean;
      createdBy: string;
      actorRole?: string;
    }
  ): Promise<MetalRateRecord> {
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
    return this.prisma.$transaction((tx) => this.recordGoldRateInTx(tx, params));
  }

  private async recordDiamondRateInTx(
    tx: Prisma.TransactionClient,
    params: {
      shape: string;
      sieveRange?: string;
      caratMin: number | string;
      caratMax: number | string;
      minInclusive?: boolean;
      maxInclusive?: boolean;
      colorGrade: string;
      clarityGrade: string;
      cutGrade?: string;
      ratePerCaratInr: number | string;
      isPlaceholder?: boolean;
      isActive?: boolean;
      createdBy: string;
      actorRole?: string;
    }
  ): Promise<DiamondRateMatrixEntry> {
    const minDec = new Decimal(params.caratMin);
    const maxDec = new Decimal(params.caratMax);
    const rateDec = new Decimal(params.ratePerCaratInr);
    const minInclusive = params.minInclusive ?? true;
    const maxInclusive = params.maxInclusive ?? true;
    const isActive = params.isActive ?? true;

    if (!minDec.isFinite() || !maxDec.isFinite() || minDec.isNegative() || !minDec.lessThan(maxDec)) {
      throw new Error('INVALID_CARAT_RANGE: Minimum carat must be >= 0 and strictly lower than maximum carat.');
    }
    if (!rateDec.isFinite() || !rateDec.greaterThan(0)) {
      throw new Error('INVALID_DIAMOND_RATE: Rate per carat must be greater than 0.');
    }
    if (
      isActive &&
      doesDiamondSlabCoverExactOneCarat({
        sizeMinCarat: minDec.toFixed(4),
        sizeMaxCarat: maxDec.toFixed(4),
        minInclusive,
        maxInclusive,
      })
    ) {
      throw new Error('EXACT_1CT_PRICE_ON_REQUEST_REQUIRED: Exactly 1.0000 ct must remain Price on Request and cannot be covered by an active slab.');
    }

    if (isActive) {
      await tx.diamondRate.updateMany({
        where: {
          isActive: true,
          shape: params.shape,
          colorGrade: params.colorGrade.toUpperCase(),
          clarityGrade: params.clarityGrade.toUpperCase(),
          sizeMinCarat: minDec.toFixed(4),
          sizeMaxCarat: maxDec.toFixed(4),
        },
        data: { isActive: false },
      });
      if (params.isPlaceholder === false) {
        await tx.diamondRate.updateMany({
          where: { isActive: true, isPlaceholder: true },
          data: { isActive: false },
        });
      }
      const existingSameGroup = await tx.diamondRate.findMany({
        where: {
          isActive: true,
          shape: params.shape,
          colorGrade: params.colorGrade.toUpperCase(),
          clarityGrade: params.clarityGrade.toUpperCase(),
        },
      });
      for (const existing of existingSameGroup) {
        if (
          doDiamondSlabsOverlap(
            {
              sizeMinCarat: minDec.toFixed(4),
              sizeMaxCarat: maxDec.toFixed(4),
              minInclusive,
              maxInclusive,
            },
            {
              sizeMinCarat: existing.sizeMinCarat.toFixed(4),
              sizeMaxCarat: existing.sizeMaxCarat.toFixed(4),
              minInclusive: existing.minInclusive,
              maxInclusive: existing.maxInclusive,
            }
          )
        ) {
          throw new Error(
            `OVERLAPPING_DIAMOND_SLAB: Active slab overlaps existing ${existing.shape} ${existing.colorGrade}-${existing.clarityGrade} slab (${existing.sizeMinCarat.toFixed(4)}–${existing.sizeMaxCarat.toFixed(4)} ct).`
          );
        }
      }
    }

    const previous = await tx.diamondRate.findFirst({
      where: {
        shape: params.shape,
        colorGrade: params.colorGrade.toUpperCase(),
        clarityGrade: params.clarityGrade.toUpperCase(),
        sizeMinCarat: minDec.toFixed(4),
        sizeMaxCarat: maxDec.toFixed(4),
      },
      orderBy: { effectiveAt: 'desc' },
    });
    const nextVersion = (previous?.version ?? 0) + 1;

    const created = await tx.diamondRate.create({
      data: {
        shape: params.shape,
        sieveRange: params.sieveRange || null,
        sizeMinCarat: minDec.toFixed(4),
        sizeMaxCarat: maxDec.toFixed(4),
        minInclusive,
        maxInclusive,
        colorGrade: params.colorGrade.toUpperCase(),
        clarityGrade: params.clarityGrade.toUpperCase(),
        cutGrade: params.cutGrade || 'EXCELLENT',
        rateInr: rateDec.toFixed(4),
        version: nextVersion,
        isPlaceholder: params.isPlaceholder ?? false,
        isActive,
        createdBy: params.createdBy,
      },
    });

    await tx.auditLog.create({
      data: {
        actorEmail: params.createdBy,
        actorRole: params.actorRole || 'OWNER',
        action: 'DIAMOND_RATE_CREATED',
        entityType: 'DiamondRate',
        entityId: created.id,
        summary: `Created ${created.shape} ${created.colorGrade}-${created.clarityGrade} (${minInclusive ? '[' : '('}${minDec.toFixed(4)}, ${maxDec.toFixed(4)}${maxInclusive ? ']' : ')'} ct) @ ₹${rateDec.toFixed(2)}/ct (active=${isActive})`,
        afterData: created as unknown as Prisma.InputJsonValue,
      },
    });

    return mapDiamondRate(created);
  }

  async recordDiamondRate(params: {
    shape: string;
    sieveRange?: string;
    caratMin: number | string;
    caratMax: number | string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
    colorGrade: string;
    clarityGrade: string;
    cutGrade?: string;
    ratePerCaratInr: number | string;
    isPlaceholder?: boolean;
    isActive?: boolean;
    createdBy: string;
    actorRole?: string;
  }): Promise<DiamondRateMatrixEntry> {
    return this.prisma.$transaction((tx) => this.recordDiamondRateInTx(tx, params));
  }

  async updateDiamondRate(params: {
    id: string;
    shape?: string;
    sieveRange?: string;
    caratMin?: number | string;
    caratMax?: number | string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
    colorGrade?: string;
    clarityGrade?: string;
    cutGrade?: string;
    ratePerCaratInr?: number | string;
    isPlaceholder?: boolean;
    isActive?: boolean;
    updatedBy: string;
    actorRole?: string;
  }): Promise<DiamondRateMatrixEntry> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.diamondRate.findUnique({ where: { id: params.id } });
      if (!existing) {
        throw new Error('DIAMOND_RATE_NOT_FOUND');
      }

      const nextShape = params.shape ?? existing.shape;
      const nextColor = (params.colorGrade ?? existing.colorGrade).toUpperCase();
      const nextClarity = (params.clarityGrade ?? existing.clarityGrade).toUpperCase();
      const nextMin = new Decimal(params.caratMin ?? existing.sizeMinCarat.toFixed(4));
      const nextMax = new Decimal(params.caratMax ?? existing.sizeMaxCarat.toFixed(4));
      const nextMinInc = params.minInclusive ?? existing.minInclusive;
      const nextMaxInc = params.maxInclusive ?? existing.maxInclusive;
      const nextRate = new Decimal(params.ratePerCaratInr ?? existing.rateInr.toFixed(4));
      const nextActive = params.isActive ?? existing.isActive;
      const nextPlaceholder = params.isPlaceholder ?? existing.isPlaceholder;

      if (!nextMin.isFinite() || !nextMax.isFinite() || nextMin.isNegative() || !nextMin.lessThan(nextMax)) {
        throw new Error('INVALID_CARAT_RANGE: Minimum carat must be >= 0 and strictly lower than maximum carat.');
      }
      if (!nextRate.isFinite() || !nextRate.greaterThan(0)) {
        throw new Error('INVALID_DIAMOND_RATE: Rate per carat must be greater than 0.');
      }
      if (
        nextActive &&
        doesDiamondSlabCoverExactOneCarat({
          sizeMinCarat: nextMin.toFixed(4),
          sizeMaxCarat: nextMax.toFixed(4),
          minInclusive: nextMinInc,
          maxInclusive: nextMaxInc,
        })
      ) {
        throw new Error('EXACT_1CT_PRICE_ON_REQUEST_REQUIRED: Exactly 1.0000 ct must remain Price on Request and cannot be covered by an active slab.');
      }

      if (nextActive) {
        const others = await tx.diamondRate.findMany({
          where: {
            id: { not: existing.id },
            isActive: true,
            shape: nextShape,
            colorGrade: nextColor,
            clarityGrade: nextClarity,
          },
        });
        for (const other of others) {
          if (
            doDiamondSlabsOverlap(
              {
                sizeMinCarat: nextMin.toFixed(4),
                sizeMaxCarat: nextMax.toFixed(4),
                minInclusive: nextMinInc,
                maxInclusive: nextMaxInc,
              },
              {
                sizeMinCarat: other.sizeMinCarat.toFixed(4),
                sizeMaxCarat: other.sizeMaxCarat.toFixed(4),
                minInclusive: other.minInclusive,
                maxInclusive: other.maxInclusive,
              }
            )
          ) {
            throw new Error(
              `OVERLAPPING_DIAMOND_SLAB: Active slab overlaps existing ${other.shape} ${other.colorGrade}-${other.clarityGrade} slab (${other.sizeMinCarat.toFixed(4)}–${other.sizeMaxCarat.toFixed(4)} ct).`
            );
          }
        }
      }

      const updated = await tx.diamondRate.update({
        where: { id: existing.id },
        data: {
          shape: nextShape,
          sieveRange: params.sieveRange !== undefined ? params.sieveRange || null : existing.sieveRange,
          sizeMinCarat: nextMin.toFixed(4),
          sizeMaxCarat: nextMax.toFixed(4),
          minInclusive: nextMinInc,
          maxInclusive: nextMaxInc,
          colorGrade: nextColor,
          clarityGrade: nextClarity,
          cutGrade: params.cutGrade ?? existing.cutGrade,
          rateInr: nextRate.toFixed(4),
          isPlaceholder: nextPlaceholder,
          isActive: nextActive,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.updatedBy,
          actorRole: params.actorRole || 'OWNER',
          action: 'DIAMOND_RATE_UPDATED',
          entityType: 'DiamondRate',
          entityId: updated.id,
          summary: `Updated ${updated.shape} ${updated.colorGrade}-${updated.clarityGrade} (${nextMinInc ? '[' : '('}${nextMin.toFixed(4)}, ${nextMax.toFixed(4)}${nextMaxInc ? ']' : ')'} ct) @ ₹${nextRate.toFixed(2)}/ct (active=${nextActive})`,
          beforeData: existing as unknown as Prisma.InputJsonValue,
          afterData: updated as unknown as Prisma.InputJsonValue,
        },
      });

      return mapDiamondRate(updated);
    });
  }

  private async createPricingRuleInTx(
    tx: Prisma.TransactionClient,
    params: {
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
    }
  ): Promise<PricingFormulaRule> {
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
    return this.prisma.$transaction((tx) => this.createPricingRuleInTx(tx, params));
  }

  async publishOwnerMarketRateCard(params: {
    gold14kPerGramInr: string;
    gold18kPerGramInr: string;
    gold22kPerGramInr: string;
    platinum950PerGramInr: string;
    makingChargePerGramInr: string;
    diamondUnder1CaratPerCaratInr: string;
    diamondOver1CaratPerCaratInr: string;
    notes?: string;
    beforeRateCard: OwnerMarketRateCard;
    actorEmail: string;
    actorRole: string;
  }): Promise<{ rateCard: OwnerMarketRateCard; pricingRule: PricingFormulaRule }> {
    return this.prisma.$transaction(async (tx) => {
      for (const [metalType, purity, rate] of [
        ['GOLD', '14K', params.gold14kPerGramInr],
        ['GOLD', '18K', params.gold18kPerGramInr],
        ['GOLD', '22K', params.gold22kPerGramInr],
        ['PLATINUM', '950_PLATINUM', params.platinum950PerGramInr],
      ] as const) {
        await this.recordGoldRateInTx(tx, {
          metalType,
          purity,
          ratePerGramInr: rate,
          source: OWNER_MARKET_RATE_CARD_LABEL,
          isPlaceholder: false,
          createdBy: params.actorEmail,
          actorRole: params.actorRole,
        });
      }

      await this.recordDiamondRateInTx(tx, {
        shape: 'ANY',
        sieveRange: '> 0.0000 ct to < 1.0000 ct',
        caratMin: '0.0001',
        caratMax: '0.9999',
        minInclusive: true,
        maxInclusive: true,
        colorGrade: 'ANY',
        clarityGrade: 'ANY',
        cutGrade: 'EXCELLENT',
        ratePerCaratInr: params.diamondUnder1CaratPerCaratInr,
        isPlaceholder: false,
        createdBy: params.actorEmail,
        actorRole: params.actorRole,
      });

      await this.recordDiamondRateInTx(tx, {
        shape: 'ANY',
        sieveRange: '> 1.0000 ct to <= 99.0000 ct',
        caratMin: '1.0001',
        caratMax: '99.0000',
        minInclusive: true,
        maxInclusive: true,
        colorGrade: 'ANY',
        clarityGrade: 'ANY',
        cutGrade: 'EXCELLENT',
        ratePerCaratInr: params.diamondOver1CaratPerCaratInr,
        isPlaceholder: false,
        createdBy: params.actorEmail,
        actorRole: params.actorRole,
      });

      const prevRule = await tx.pricingRule.findFirst({
        where: { status: 'APPROVED' },
        orderBy: { version: 'desc' },
      });

      const newRule = await this.createPricingRuleInTx(tx, {
        name: OWNER_MARKET_RATE_CARD_LABEL,
        description: `${
          params.notes || 'Owner-updated market rates published via Admin'
        } [MAKING_CHARGE_PER_GRAM_INR:${Number(params.makingChargePerGramInr).toFixed(2)}]`,
        stoneWeightToGramsFactor: prevRule?.stoneWeightToGramsFactor.toString() || '0.2000',
        gstRatePercent: '3.00',
        gstMode: prevRule?.gstMode || 'INCLUSIVE',
        roundingMode: prevRule?.roundingMode || 'NEAREST_1',
        maxPriceDeltaPercentThreshold: prevRule?.maxPriceDeltaPercentThreshold.toString() || '15.00',
        defaultCertificationFeeInr: '0.00',
        defaultHallmarkFeeInr: '0.00',
        isPlaceholderFormula: false,
        createdBy: params.actorEmail,
        actorRole: params.actorRole,
      });

      const [metalRows, diamondRows] = await Promise.all([
        tx.goldRate.findMany({ orderBy: { effectiveAt: 'desc' } }),
        tx.diamondRate.findMany({ where: { isActive: true }, orderBy: { effectiveAt: 'desc' } }),
      ]);
      const latestMetals = new Map<string, MetalRateRecord>();
      for (const row of metalRows) {
        const mapped = mapMetalRate(row);
        const key = `${mapped.metalType}:${mapped.purity}`;
        if (!latestMetals.has(key)) latestMetals.set(key, mapped);
      }

      const afterRateCard = buildOwnerMarketRateCard({
        metalRates: [...latestMetals.values()],
        diamondRates: diamondRows.map(mapDiamondRate),
        rule: newRule,
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'OWNER_MARKET_RATE_CARD_UPDATED',
          entityType: 'OwnerMarketRateCard',
          entityId: `v${afterRateCard.version}`,
          summary: `Updated "${OWNER_MARKET_RATE_CARD_LABEL}" to v${afterRateCard.version} (14K ₹${params.gold14kPerGramInr}/g, 18K ₹${params.gold18kPerGramInr}/g, 22K ₹${params.gold22kPerGramInr}/g, Pt950 ₹${params.platinum950PerGramInr}/g, Making ₹${params.makingChargePerGramInr}/g, Diamond <1ct ₹${params.diamondUnder1CaratPerCaratInr}/ct, >1ct ₹${params.diamondOver1CaratPerCaratInr}/ct)`,
          beforeData: params.beforeRateCard as unknown as Prisma.InputJsonValue,
          afterData: afterRateCard as unknown as Prisma.InputJsonValue,
        },
      });

      return { rateCard: afterRateCard, pricingRule: newRule };
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
