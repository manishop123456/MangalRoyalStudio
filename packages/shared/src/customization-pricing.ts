import { Decimal } from 'decimal.js';
import { applyInrRounding, calculateJewelleryPrice, matchDiamondRate } from './pricing-engine.js';
import type {
  CustomizationDependencyRule,
  CustomizationGroupRecord,
  CustomizationOptionRecord,
  CustomizationProfileRecord,
  CustomizationQuoteBreakdownLine,
  CustomizationQuoteResponse,
  CustomizationSelectionMap,
  CustomizationSelectionSnapshotItem,
  DiamondRateMatrixEntry,
  JewelleryProductSpec,
  MetalPurity,
  MetalRateRecord,
  MetalType,
  PricingFormulaRule,
  ProductCustomizationAssignmentRecord,
} from './types.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class CustomizationQuoteError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function matchesCategory(allowedCategories: string[] | undefined, category: string): boolean {
  if (!allowedCategories || allowedCategories.length === 0) return true;
  const target = category.trim().toLowerCase();
  return allowedCategories.some((c) => c.trim().toLowerCase() === target);
}

function checkDependencyRule(
  rule: CustomizationDependencyRule | undefined,
  ctx: {
    category: string;
    allowDiamondSelection: boolean;
    allowEngraving: boolean;
    metalType: MetalType;
  }
): { eligible: boolean; reason?: string } {
  if (!rule) return { eligible: true };
  if (rule.requiresDiamondSupport && !ctx.allowDiamondSelection) {
    return { eligible: false, reason: 'Diamond customization is not enabled for this product.' };
  }
  if (rule.requiresEngravingSupport && !ctx.allowEngraving) {
    return { eligible: false, reason: 'Engraving is not enabled for this product.' };
  }
  if (rule.allowedCategories && !matchesCategory(rule.allowedCategories, ctx.category)) {
    return { eligible: false, reason: `Not eligible for category "${ctx.category}".` };
  }
  if (
    rule.allowedMetalTypes &&
    rule.allowedMetalTypes.length > 0 &&
    !rule.allowedMetalTypes.includes(ctx.metalType)
  ) {
    return {
      eligible: false,
      reason: `Option is only available for ${rule.allowedMetalTypes.join(', ')} metal.`,
    };
  }
  return { eligible: true };
}

export function resolveEligibleCustomizationProfile(params: {
  product: JewelleryProductSpec;
  assignment: ProductCustomizationAssignmentRecord | null;
  profiles: CustomizationProfileRecord[];
}): {
  eligible: boolean;
  profile: CustomizationProfileRecord | null;
  assignment: ProductCustomizationAssignmentRecord | null;
} {
  const { product, assignment, profiles } = params;
  if (assignment) {
    if (!assignment.isCustomizable) {
      return { eligible: false, profile: null, assignment };
    }
    const assigned = profiles.find((p) => p.id === assignment.profileId && p.isActive) ?? null;
    return { eligible: Boolean(assigned), profile: assigned, assignment };
  }

  const categoryMatch =
    profiles.find(
      (p) =>
        p.isActive &&
        p.eligibleCategories.some((c) => c.trim().toLowerCase() === product.category.trim().toLowerCase())
    ) ??
    profiles.find((p) => p.isActive && p.isDefault) ??
    null;

  return { eligible: Boolean(categoryMatch), profile: categoryMatch, assignment: null };
}

export function calculateCustomizationQuote(params: {
  product: JewelleryProductSpec;
  profile: CustomizationProfileRecord;
  assignment: ProductCustomizationAssignmentRecord | null;
  selections: CustomizationSelectionMap;
  quantity: number;
  metalRates: MetalRateRecord[];
  diamondRates: DiamondRateMatrixEntry[];
  rule: PricingFormulaRule | null;
}): CustomizationQuoteResponse {
  const { product, profile, assignment, selections, quantity, metalRates, diamondRates, rule } = params;

  if (!profile.isActive) {
    throw new CustomizationQuoteError(
      'CUSTOMIZATION_UNAVAILABLE',
      'Customization profile is currently inactive.',
      400
    );
  }
  if (assignment && !assignment.isCustomizable) {
    throw new CustomizationQuoteError(
      'PRODUCT_NOT_CUSTOMIZABLE',
      `Product "${product.sku}" is not enabled for customization.`,
      400
    );
  }
  if (!rule) {
    throw new CustomizationQuoteError(
      'PRICING_CONFIGURATION_INCOMPLETE',
      'No active pricing formula rule is configured.',
      422
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new CustomizationQuoteError('INVALID_QUANTITY', 'Quantity must be between 1 and 20.', 400);
  }

  const allowDiamondSelection = assignment?.allowDiamondSelection ?? product.diamondComponents.length > 0;
  const allowEngraving = assignment?.allowEngraving ?? false;
  const maxEngravingChars = assignment?.maxEngravingChars ?? 20;
  const disabledCodes = new Set(
    (assignment?.disabledOptionCodes ?? []).map((c) => c.trim().toUpperCase())
  );

  const activeGroups = [...profile.groups]
    .filter((g) => g.isActive)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  // First pass: determine selected metalType so dependent options (e.g., purity) validate accurately
  let resolvedMetalType: MetalType = product.metalType;
  let resolvedMetalPurity: MetalPurity = product.metalPurity;
  let resolvedMetalColor: string = product.metalColor;
  let resolvedRingSize: string | undefined = product.ringSize;

  const metalGroup = activeGroups.find((g) => g.optionCategory === 'METAL');
  if (metalGroup && selections[metalGroup.code]) {
    const opt = metalGroup.options.find(
      (o) => o.isActive && o.code === selections[metalGroup.code]
    );
    if (opt?.metalType) resolvedMetalType = opt.metalType;
  }

  // Validate unknown group keys in selections
  const groupCodeSet = new Set(activeGroups.map((g) => g.code));
  for (const key of Object.keys(selections)) {
    if (!groupCodeSet.has(key)) {
      throw new CustomizationQuoteError(
        'UNSUPPORTED_CUSTOMIZATION_GROUP',
        `Customization group "${key}" is not supported for this product.`,
        400
      );
    }
  }

  const selectedEntries: Array<{
    group: CustomizationGroupRecord;
    option: CustomizationOptionRecord | null;
    textValue?: string;
  }> = [];

  for (const group of activeGroups) {
    const groupDep = checkDependencyRule(group.dependencyRule, {
      category: product.category,
      allowDiamondSelection,
      allowEngraving,
      metalType: resolvedMetalType,
    });

    const rawSelection = selections[group.code];

    if (!groupDep.eligible) {
      if (rawSelection !== undefined && rawSelection.trim() !== '') {
        throw new CustomizationQuoteError(
          'INELIGIBLE_OPTION_GROUP',
          groupDep.reason || `Group "${group.name}" is not eligible for this product.`,
          400
        );
      }
      continue;
    }

    if (group.selectionMode === 'TEXT') {
      const text = (rawSelection ?? '').trim();
      if (text.length > maxEngravingChars) {
        throw new CustomizationQuoteError(
          'ENGRAVING_TOO_LONG',
          `Engraving text cannot exceed ${maxEngravingChars} characters.`,
          400
        );
      }
      if (group.isRequired && text.length === 0) {
        throw new CustomizationQuoteError(
          'MISSING_REQUIRED_OPTION',
          `"${group.name}" is required.`,
          400
        );
      }
      if (text.length > 0) {
        selectedEntries.push({ group, option: null, textValue: text });
      }
      continue;
    }

    const activeOptions = group.options
      .filter((o) => o.isActive && !disabledCodes.has(o.code.trim().toUpperCase()))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    let chosenOption: CustomizationOptionRecord | undefined;
    if (rawSelection !== undefined && rawSelection.trim() !== '') {
      chosenOption = activeOptions.find((o) => o.code === rawSelection);
      if (!chosenOption) {
        throw new CustomizationQuoteError(
          'INVALID_CUSTOMIZATION_OPTION',
          `Selected option "${rawSelection}" in "${group.name}" is invalid or disabled.`,
          400
        );
      }
      const optDep = checkDependencyRule(chosenOption.eligibilityRule, {
        category: product.category,
        allowDiamondSelection,
        allowEngraving,
        metalType: resolvedMetalType,
      });
      if (!optDep.eligible) {
        throw new CustomizationQuoteError(
          'INELIGIBLE_CUSTOMIZATION_OPTION',
          optDep.reason || `Option "${chosenOption.label}" is not eligible for this selection.`,
          400
        );
      }
    } else if (group.isRequired) {
      chosenOption =
        activeOptions.find(
          (o) =>
            o.isDefault &&
            checkDependencyRule(o.eligibilityRule, {
              category: product.category,
              allowDiamondSelection,
              allowEngraving,
              metalType: resolvedMetalType,
            }).eligible
        ) ??
        activeOptions.find(
          (o) =>
            checkDependencyRule(o.eligibilityRule, {
              category: product.category,
              allowDiamondSelection,
              allowEngraving,
              metalType: resolvedMetalType,
            }).eligible
        );
      if (!chosenOption) {
        throw new CustomizationQuoteError(
          'MISSING_REQUIRED_OPTION',
          `No eligible option available for required group "${group.name}".`,
          422
        );
      }
    }

    if (chosenOption) {
      if (chosenOption.metalType) resolvedMetalType = chosenOption.metalType;
      if (chosenOption.metalPurity) resolvedMetalPurity = chosenOption.metalPurity;
      if (chosenOption.metalColor) resolvedMetalColor = chosenOption.metalColor;
      if (group.optionCategory === 'SIZE') resolvedRingSize = chosenOption.value;
      selectedEntries.push({ group, option: chosenOption });
    }
  }

  // Validate metal rate availability (fail closed — never invent rates)
  const matchedMetalRate = metalRates.find(
    (r) => r.metalType === resolvedMetalType && r.purity === resolvedMetalPurity
  );
  if (!matchedMetalRate) {
    throw new CustomizationQuoteError(
      'PRICING_CONFIGURATION_INCOMPLETE',
      `Active metal rate missing for ${resolvedMetalType} ${resolvedMetalPurity}.`,
      422
    );
  }

  // Construct effective product spec for base calculation
  const effectiveProduct: JewelleryProductSpec = {
    ...product,
    metalType: resolvedMetalType,
    metalPurity: resolvedMetalPurity,
    metalColor: resolvedMetalColor as JewelleryProductSpec['metalColor'],
    ringSize: resolvedRingSize,
    manualPriceOverrideInr: null,
  };

  // Apply diamond option override if selected
  const diamondSelection = selectedEntries.find(
    (e) => e.group.optionCategory === 'DIAMOND' && e.option
  )?.option;

  if (diamondSelection) {
    const baseDiamond = effectiveProduct.diamondComponents[0];
    const targetCarat = diamondSelection.diamondCaratWeight || baseDiamond?.totalCaratWeight || '0.2500';
    const targetShape = diamondSelection.diamondShape || baseDiamond?.shape || 'ROUND';
    const targetColor = diamondSelection.diamondColorGrade || baseDiamond?.colorGrade || 'EF';
    const targetClarity = diamondSelection.diamondClarityGrade || baseDiamond?.clarityGrade || 'VVS';
    const updatedComponent = {
      componentName: diamondSelection.label,
      shape: targetShape,
      stoneCount: baseDiamond?.stoneCount || 1,
      totalCaratWeight: targetCarat,
      colorGrade: targetColor,
      clarityGrade: targetClarity,
      cutGrade: baseDiamond?.cutGrade || 'EXCELLENT',
    };
    const rateMatch = matchDiamondRate(updatedComponent, diamondRates);
    if (!rateMatch.rateEntry && diamondSelection.priceRuleType === 'INCLUDED') {
      throw new CustomizationQuoteError(
        'PRICING_CONFIGURATION_INCOMPLETE',
        `Active diamond rate missing for ${targetShape} ${targetColor}/${targetClarity}.`,
        422
      );
    }
    effectiveProduct.diamondComponents = [
      updatedComponent,
      ...effectiveProduct.diamondComponents.slice(1),
    ];
  } else if (effectiveProduct.diamondComponents.length > 0) {
    for (const comp of effectiveProduct.diamondComponents) {
      if (!comp.rateOverridePerCaratInr) {
        const match = matchDiamondRate(comp, diamondRates);
        if (!match.rateEntry) {
          throw new CustomizationQuoteError(
            'PRICING_CONFIGURATION_INCOMPLETE',
            `Active diamond rate missing for component "${comp.componentName}".`,
            422
          );
        }
      }
    }
  }

  const baseBreakdown = calculateJewelleryPrice({
    product: effectiveProduct,
    metalRates,
    diamondRates,
    rule,
  });

  // A customization must never produce a price for a configuration the engine withholds
  // (e.g. GST unconfirmed for the purity, exactly 1.00 ct, missing weight/rate). No bypass via options.
  if (baseBreakdown.priceOnRequest) {
    throw new CustomizationQuoteError(
      'PRICE_ON_REQUEST',
      'This configuration is priced on request. Please contact our studio for a personalised quote.',
      422
    );
  }

  const baseSubtotal = new Decimal(baseBreakdown.subtotalBeforeTaxInr);
  const netWeight = new Decimal(baseBreakdown.computedNetMetalWeightGrams);
  let totalDiamondCarats = new Decimal(0);
  for (const comp of effectiveProduct.diamondComponents) {
    totalDiamondCarats = totalDiamondCarats.plus(new Decimal(comp.totalCaratWeight || '0'));
  }

  let optionAdjustments = new Decimal(0);
  const selectionSnapshot: CustomizationSelectionSnapshotItem[] = [];
  const optionBreakdownLines: CustomizationQuoteBreakdownLine[] = [];

  for (const entry of selectedEntries) {
    if (entry.textValue !== undefined) {
      const engravingFee = new Decimal(0);
      selectionSnapshot.push({
        groupCode: entry.group.code,
        groupName: entry.group.name,
        optionCategory: entry.group.optionCategory,
        selectionMode: 'TEXT',
        label: entry.textValue,
        value: entry.textValue,
        priceDeltaInr: engravingFee.toFixed(2),
      });
      continue;
    }

    const opt = entry.option!;
    const ruleVal = new Decimal(opt.priceRuleValue || '0');
    let delta = new Decimal(0);

    switch (opt.priceRuleType) {
      case 'FIXED_INR':
        delta = ruleVal;
        break;
      case 'PER_GRAM_INR':
        delta = ruleVal.times(netWeight);
        break;
      case 'PER_CARAT_INR':
        delta = ruleVal.times(opt.diamondCaratWeight ? new Decimal(opt.diamondCaratWeight) : totalDiamondCarats);
        break;
      case 'PERCENT_OF_BASE':
        delta = baseSubtotal.times(ruleVal).dividedBy(100);
        break;
      case 'METAL_RATE_PURITY':
      case 'INCLUDED':
      default:
        delta = new Decimal(0);
        break;
    }

    delta = delta.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    optionAdjustments = optionAdjustments.plus(delta);

    selectionSnapshot.push({
      groupCode: entry.group.code,
      groupName: entry.group.name,
      optionCategory: entry.group.optionCategory,
      selectionMode: 'SINGLE',
      optionCode: opt.code,
      label: opt.label,
      value: opt.value,
      priceDeltaInr: delta.toFixed(2),
    });

    if (!delta.isZero()) {
      optionBreakdownLines.push({
        key: `opt-${entry.group.code}-${opt.code}`,
        label: `${entry.group.name}: ${opt.label}`,
        amountInr: delta.toFixed(2),
        category:
          entry.group.optionCategory === 'ENGRAVING'
            ? 'ENGRAVING'
            : entry.group.optionCategory === 'DIAMOND' || entry.group.optionCategory === 'GEMSTONE'
              ? 'STONE'
              : 'OPTION',
      });
    }
  }

  const subtotalBeforeTax = baseSubtotal.plus(optionAdjustments).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gstRate = new Decimal(rule.gstRatePercent || '3.00');
  const gstAmount = subtotalBeforeTax.times(gstRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const unroundedUnit = subtotalBeforeTax.plus(gstAmount);
  const { rounded: roundedUnit, adjustment: roundingAdjustment } = applyInrRounding(
    unroundedUnit,
    rule.roundingMode
  );
  const totalPrice = roundedUnit.times(quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const breakdownLines: CustomizationQuoteBreakdownLine[] = [
    {
      key: 'metal',
      label: `${resolvedMetalType} (${resolvedMetalPurity}) Metal Value (${baseBreakdown.computedNetMetalWeightGrams}g)`,
      amountInr: baseBreakdown.payableMetalValueInr,
      category: 'METAL',
    },
    ...(new Decimal(baseBreakdown.totalDiamondValueInr).greaterThan(0)
      ? [
          {
            key: 'diamonds',
            label: `Diamonds & Stones (${baseBreakdown.totalDiamondCarats} ct)`,
            amountInr: baseBreakdown.totalDiamondValueInr,
            category: 'STONE' as const,
          },
        ]
      : []),
    {
      key: 'making',
      label: 'Craftsmanship & Making Charges',
      amountInr: baseBreakdown.makingChargeValueInr,
      category: 'BASE',
    },
    ...(new Decimal(baseBreakdown.certificationFeeInr).plus(baseBreakdown.hallmarkFeeInr).greaterThan(0)
      ? [
          {
            key: 'cert-hallmark',
            label: 'BIS Hallmark & Certification',
            amountInr: new Decimal(baseBreakdown.certificationFeeInr)
              .plus(baseBreakdown.hallmarkFeeInr)
              .toFixed(2),
            category: 'BASE' as const,
          },
        ]
      : []),
    ...optionBreakdownLines,
    {
      key: 'gst',
      label: `GST (${gstRate.toFixed(2)}%)`,
      amountInr: gstAmount.toFixed(2),
      category: 'TAX',
    },
    ...(!roundingAdjustment.isZero()
      ? [
          {
            key: 'rounding',
            label: 'INR Rounding Adjustment',
            amountInr: roundingAdjustment.toFixed(2),
            category: 'ROUNDING' as const,
          },
        ]
      : []),
  ];

  return {
    sku: product.sku,
    productTitle: product.title,
    profileId: profile.id,
    profileName: profile.name,
    quantity,
    currency: 'INR',
    pricingRuleVersion: rule.version,
    isPlaceholderConfiguration:
      rule.isPlaceholderFormula || matchedMetalRate.isPlaceholder,
    unitPriceInr: roundedUnit.toFixed(2),
    totalPriceInr: totalPrice.toFixed(2),
    subtotalBeforeTaxInr: subtotalBeforeTax.toFixed(2),
    gstRatePercent: gstRate.toFixed(2),
    gstAmountInr: gstAmount.toFixed(2),
    roundingAdjustmentInr: roundingAdjustment.toFixed(2),
    breakdownLines,
    selectionSnapshot,
    resolvedMetalType,
    resolvedMetalPurity,
    resolvedMetalColor,
    resolvedRingSize,
    calculatedAt: new Date().toISOString(),
  };
}
