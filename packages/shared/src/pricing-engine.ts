import { Decimal } from 'decimal.js';
import type {
  DiamondComponentCalculation,
  DiamondComponentSpec,
  DiamondRateMatrixEntry,
  JewelleryProductSpec,
  MetalRateRecord,
  OwnerMarketRateCard,
  PriceCalculationBreakdown,
  PricingFormulaRule,
  RoundingMode,
} from './types.js';

// Configure Decimal.js for high-precision financial calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function applyInrRounding(
  amount: Decimal,
  mode: RoundingMode
): { rounded: Decimal; adjustment: Decimal } {
  let rounded: Decimal;

  switch (mode) {
    case 'NEAREST_1':
      rounded = amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      break;
    case 'NEAREST_10':
      rounded = amount.dividedBy(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(10);
      break;
    case 'NEAREST_100':
      rounded = amount.dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(100);
      break;
    case 'NEAREST_99': {
      const hundredBlock = amount.dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(100);
      rounded = Decimal.max(new Decimal(99), hundredBlock.minus(1));
      break;
    }
    case 'NONE':
    default:
      rounded = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      break;
  }

  const adjustment = rounded.minus(amount);
  return { rounded, adjustment };
}

export function isCaratInSlab(
  carat: Decimal,
  slab: Pick<DiamondRateMatrixEntry, 'sizeMinCarat' | 'sizeMaxCarat' | 'minInclusive' | 'maxInclusive'>
): boolean {
  const min = new Decimal(slab.sizeMinCarat);
  const max = new Decimal(slab.sizeMaxCarat);
  const minOk = slab.minInclusive !== false ? carat.greaterThanOrEqualTo(min) : carat.greaterThan(min);
  const maxOk = slab.maxInclusive !== false ? carat.lessThanOrEqualTo(max) : carat.lessThan(max);
  return minOk && maxOk;
}

export function doesDiamondSlabCoverExactOneCarat(
  slab: Pick<DiamondRateMatrixEntry, 'sizeMinCarat' | 'sizeMaxCarat' | 'minInclusive' | 'maxInclusive'>
): boolean {
  return isCaratInSlab(new Decimal('1'), slab);
}

export function doDiamondSlabsOverlap(
  a: Pick<DiamondRateMatrixEntry, 'sizeMinCarat' | 'sizeMaxCarat' | 'minInclusive' | 'maxInclusive'>,
  b: Pick<DiamondRateMatrixEntry, 'sizeMinCarat' | 'sizeMaxCarat' | 'minInclusive' | 'maxInclusive'>
): boolean {
  const aMin = new Decimal(a.sizeMinCarat);
  const aMax = new Decimal(a.sizeMaxCarat);
  const bMin = new Decimal(b.sizeMinCarat);
  const bMax = new Decimal(b.sizeMaxCarat);
  const aMinInc = a.minInclusive !== false;
  const aMaxInc = a.maxInclusive !== false;
  const bMinInc = b.minInclusive !== false;
  const bMaxInc = b.maxInclusive !== false;

  const aEndsBeforeB = aMax.lessThan(bMin) || (aMax.equals(bMin) && (!aMaxInc || !bMinInc));
  const bEndsBeforeA = bMax.lessThan(aMin) || (bMax.equals(aMin) && (!bMaxInc || !aMinInc));
  return !aEndsBeforeB && !bEndsBeforeA;
}

export function matchDiamondRate(
  component: DiamondComponentSpec,
  diamondRates: DiamondRateMatrixEntry[]
): { rateEntry: DiamondRateMatrixEntry | null; averageStoneCarat: Decimal } {
  const count = Math.max(1, component.stoneCount);
  const totalCarats = new Decimal(component.totalCaratWeight || '0');
  const averageStoneCarat = totalCarats.dividedBy(count);

  // A diamond weighing exactly 1.0000 ct is always Price on Request, even if an active row could otherwise match.
  if (averageStoneCarat.equals(1)) {
    return { rateEntry: null, averageStoneCarat };
  }

  const activeRates = diamondRates.filter((r) => r.isActive);

  // Exact shape + carat bracket (with explicit inclusive/exclusive bounds) + color + clarity match.
  // Never silently fall back across different shapes, colors, or clarity grades.
  const exactMatch = activeRates.find((r) => {
    const shapeMatches = r.shape === component.shape || r.shape === 'ANY';
    const sizeMatches = isCaratInSlab(averageStoneCarat, r);
    const colorMatches =
      r.colorGrade.toUpperCase() === component.colorGrade.toUpperCase() || r.colorGrade.toUpperCase() === 'ANY';
    const clarityMatches =
      r.clarityGrade.toUpperCase() === component.clarityGrade.toUpperCase() || r.clarityGrade.toUpperCase() === 'ANY';
    return shapeMatches && sizeMatches && colorMatches && clarityMatches;
  });

  if (exactMatch) {
    return { rateEntry: exactMatch, averageStoneCarat };
  }

  // Never fall back to an arbitrary diamond rate when no bracket matches.
  return { rateEntry: null, averageStoneCarat };
}

function isValidNonNegativeDecimal(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true; // treated as 0 / absent
  try {
    const d = new Decimal(value as Decimal.Value);
    return d.isFinite() && !d.isNegative();
  } catch {
    return false;
  }
}

/**
 * Replaces non-numeric, non-finite or negative numeric inputs with '0' and reports them, so the
 * engine never throws, never produces NaN/Infinity, and withholds the price for that product.
 */
function sanitizeNumericInputs(product: JewelleryProductSpec): {
  product: JewelleryProductSpec;
  invalidFields: string[];
} {
  const invalidFields: string[] = [];
  const check = (name: string, value: unknown): string | undefined => {
    if (isValidNonNegativeDecimal(value)) return value as string | undefined;
    invalidFields.push(name);
    return '0';
  };
  const override = product.manualPriceOverrideInr;
  const overrideValid = isValidNonNegativeDecimal(override);
  if (!overrideValid) invalidFields.push('manualPriceOverrideInr');
  return {
    invalidFields,
    product: {
      ...product,
      grossWeightGrams: check('grossWeightGrams', product.grossWeightGrams) ?? '0',
      netMetalWeightGrams: check('netMetalWeightGrams', product.netMetalWeightGrams) ?? '0',
      makingChargeValue: check('makingChargeValue', product.makingChargeValue) ?? '0',
      wastageValue: check('wastageValue', product.wastageValue) ?? '0',
      certificationFeeInr: check('certificationFeeInr', product.certificationFeeInr) ?? '',
      hallmarkFeeInr: check('hallmarkFeeInr', product.hallmarkFeeInr) ?? '',
      fixedAdjustmentInr: isValidDecimalAllowNegative(product.fixedAdjustmentInr)
        ? product.fixedAdjustmentInr
        : (invalidFields.push('fixedAdjustmentInr'), '0'),
      manualPriceOverrideInr: overrideValid ? override : null,
      diamondComponents: (product.diamondComponents || []).map((c, i) => ({
        ...c,
        totalCaratWeight: check(`diamondComponents[${i}].totalCaratWeight`, c.totalCaratWeight) ?? '0',
        rateOverridePerCaratInr: check(
          `diamondComponents[${i}].rateOverridePerCaratInr`,
          c.rateOverridePerCaratInr
        ),
      })),
    },
  };
}

function isValidDecimalAllowNegative(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  try {
    return new Decimal(value as Decimal.Value).isFinite();
  } catch {
    return false;
  }
}

export function calculateJewelleryPrice(params: {
  product: JewelleryProductSpec;
  metalRates: MetalRateRecord[];
  diamondRates: DiamondRateMatrixEntry[];
  rule: PricingFormulaRule;
}): PriceCalculationBreakdown {
  const { product: rawProduct, metalRates, diamondRates, rule } = params;
  const warnings: string[] = [];
  const { product, invalidFields } = sanitizeNumericInputs(rawProduct);
  if (invalidFields.length > 0) {
    warnings.push(`Invalid numeric product data (${invalidFields.join(', ')}); price withheld.`);
  }
  const ownerRateCardMode = Boolean(rule.useRateCardMakingCharge);
  const diamondTierBasis =
    rule.diamondTierBasis ?? (ownerRateCardMode ? 'TOTAL_PRODUCT_CARAT' : 'COMPONENT_AVERAGE_STONE');
  const applyProductLevelFees = rule.applyProductLevelFees ?? !ownerRateCardMode;

  // 1. Find applicable metal rate for metalType + metalPurity
  const matchingMetalRate = metalRates.find(
    (r) => r.metalType === product.metalType && r.purity === product.metalPurity
  );

  const is24kBlocked =
    product.metalPurity === '24K' &&
    (!matchingMetalRate || matchingMetalRate.source !== 'OWNER_CONFIRMED_24K');

  let missingMetalRate = false;
  if (is24kBlocked) {
    warnings.push(
      '24K gold rate is BLOCKED pending owner confirmation (conflicting values supplied: ₹15,400/g inclusive GST vs ₹154,000/g).'
    );
  } else if (
    !product.metalPurity ||
    !matchingMetalRate ||
    new Decimal(matchingMetalRate.ratePerGramInr || '0').lessThanOrEqualTo(0)
  ) {
    missingMetalRate = true;
    warnings.push(
      `Missing active metal rate for ${product.metalType} ${product.metalPurity}; defaulted rate to 0.`
    );
  }

  const metalRatePerGram =
    !is24kBlocked && !missingMetalRate && matchingMetalRate
      ? new Decimal(matchingMetalRate.ratePerGramInr)
      : new Decimal('0');

  // 2. Calculate total diamond weight in carats & stone weight in grams
  let totalDiamondCarats = new Decimal(0);
  for (const comp of product.diamondComponents) {
    totalDiamondCarats = totalDiamondCarats.plus(new Decimal(comp.totalCaratWeight || '0'));
  }

  const stoneToGramFactor = new Decimal(rule.stoneWeightToGramsFactor || '0.2');
  const stoneWeightInGrams = totalDiamondCarats.times(stoneToGramFactor);
  const grossWeightGrams = new Decimal(product.grossWeightGrams || '0');
  const explicitNetWeightGrams = new Decimal(product.netMetalWeightGrams || '0');

  // Never assume gross weight equals net gold weight; never add diamond weight to metal weight
  let computedNetMetalWeightGrams: Decimal;
  if (product.netWeightMode === 'GROSS_MINUS_STONE_WEIGHT') {
    if (grossWeightGrams.greaterThan(0) && stoneWeightInGrams.greaterThan(0)) {
      computedNetMetalWeightGrams = Decimal.max(
        new Decimal(0),
        grossWeightGrams.minus(stoneWeightInGrams)
      );
    } else {
      computedNetMetalWeightGrams = Decimal.max(new Decimal(0), explicitNetWeightGrams);
    }
  } else {
    computedNetMetalWeightGrams = Decimal.max(new Decimal(0), explicitNetWeightGrams);
  }

  let missingNetWeight = false;
  if (computedNetMetalWeightGrams.lessThanOrEqualTo(0)) {
    missingNetWeight = true;
    warnings.push(
      `Net metal weight is missing or zero for SKU ${product.sku}; never assuming gross weight equals net metal weight.`
    );
  }

  if (computedNetMetalWeightGrams.greaterThan(grossWeightGrams) && grossWeightGrams.greaterThan(0)) {
    warnings.push(
      `Net metal weight (${computedNetMetalWeightGrams.toFixed(3)}g) exceeds gross weight (${grossWeightGrams.toFixed(3)}g).`
    );
  }

  // 3. Base Metal Value & Wastage (VA) — only when explicitly configured
  const baseMetalValue = computedNetMetalWeightGrams.times(metalRatePerGram);
  const wastageInput = new Decimal(product.wastageValue || '0');
  let wastageGrams = new Decimal(0);
  let wastageValueInr = new Decimal(0);
  const effectiveWastageMode = applyProductLevelFees ? product.wastageMode : 'NONE';
  if (!applyProductLevelFees && product.wastageMode && product.wastageMode !== 'NONE' && wastageInput.greaterThan(0)) {
    warnings.push('Product-level wastage is stored but not applied: owner rate card excludes wastage unless approved.');
  }

  switch (effectiveWastageMode) {
    case 'PERCENT_METAL_VALUE':
      wastageValueInr = baseMetalValue.times(wastageInput).dividedBy(100);
      if (metalRatePerGram.greaterThan(0)) {
        wastageGrams = wastageValueInr.dividedBy(metalRatePerGram);
      }
      break;
    case 'PERCENT_METAL_WEIGHT':
      wastageGrams = computedNetMetalWeightGrams.times(wastageInput).dividedBy(100);
      wastageValueInr = wastageGrams.times(metalRatePerGram);
      break;
    case 'FLAT_GRAMS':
      wastageGrams = wastageInput;
      wastageValueInr = wastageGrams.times(metalRatePerGram);
      break;
    case 'NONE':
    default:
      break;
  }

  const payableMetalValueInr = baseMetalValue.plus(wastageValueInr);

  // 4. Diamond Components Calculation (do not apply diamond charges when no diamond weight exists)
  const diamondBreakdowns: DiamondComponentCalculation[] = [];
  let totalDiamondValueInr = new Decimal(0);
  let anyDiamondPlaceholder = false;
  let missingDiamondRate = false;
  let exact1CaratMissing = false;
  const useTotalCaratTier = diamondTierBasis === 'TOTAL_PRODUCT_CARAT';

  for (const comp of product.diamondComponents) {
    const caratWeight = new Decimal(comp.totalCaratWeight || '0');
    const stoneCount = Math.max(1, comp.stoneCount || 1);
    const averageStoneCarat = caratWeight.greaterThan(0)
      ? caratWeight.dividedBy(stoneCount)
      : new Decimal(0);

    if (caratWeight.lessThanOrEqualTo(0)) {
      diamondBreakdowns.push({
        componentName: comp.componentName,
        shape: comp.shape,
        stoneCount,
        totalCaratWeight: '0.000',
        averageStoneCarat: '0.0000',
        matchedRateId: 'NO_DIAMOND_WEIGHT',
        appliedRatePerCaratInr: '0.00',
        componentValueInr: '0.00',
        isPlaceholderRate: false,
      });
      continue;
    }

    // Owner rate card: the tier is chosen from the product's combined carat weight, not per-stone size.
    const { rateEntry } = useTotalCaratTier
      ? matchDiamondRate(
          { ...comp, stoneCount: 1, totalCaratWeight: totalDiamondCarats.toFixed(4) },
          diamondRates
        )
      : matchDiamondRate(comp, diamondRates);

    let appliedRate = new Decimal(0);
    let compValue = new Decimal(0);
    let matchedId = 'UNMATCHED';
    let isPlaceholderRate = false;

    if (comp.rateOverridePerCaratInr && new Decimal(comp.rateOverridePerCaratInr).greaterThan(0)) {
      appliedRate = new Decimal(comp.rateOverridePerCaratInr);
      compValue = caratWeight.times(appliedRate);
      matchedId = 'SKU_OVERRIDE';
    } else if (rateEntry && new Decimal(rateEntry.rateInr || '0').greaterThan(0)) {
      appliedRate = new Decimal(rateEntry.rateInr);
      compValue =
        rateEntry.pricingType === 'FLAT_PER_STONE'
          ? appliedRate.times(comp.stoneCount)
          : caratWeight.times(appliedRate);
      matchedId = rateEntry.id;
      isPlaceholderRate = rateEntry.isPlaceholder;
      if (isPlaceholderRate) anyDiamondPlaceholder = true;
    } else {
      missingDiamondRate = true;
      const isExactOneCarat = useTotalCaratTier
        ? totalDiamondCarats.equals(new Decimal(1))
        : averageStoneCarat.equals(new Decimal(1)) || caratWeight.equals(new Decimal(1));
      if (isExactOneCarat) {
        exact1CaratMissing = true;
        matchedId = 'UNCONFIGURED_EXACT_1CT';
        warnings.push(
          `Diamond rate for exact 1.00 ct is not supplied (requires separate owner input) on component "${comp.componentName}".`
        );
      } else {
        warnings.push(
          `No matching diamond rate matrix rule found for ${comp.shape} ${comp.colorGrade}/${comp.clarityGrade} (${caratWeight.toFixed(2)} ct).`
        );
      }
    }

    totalDiamondValueInr = totalDiamondValueInr.plus(compValue);
    diamondBreakdowns.push({
      componentName: comp.componentName,
      shape: comp.shape,
      stoneCount: comp.stoneCount,
      totalCaratWeight: caratWeight.toFixed(3),
      averageStoneCarat: averageStoneCarat.toFixed(4),
      matchedRateId: matchedId,
      appliedRatePerCaratInr: appliedRate.toFixed(2),
      componentValueInr: compValue.toFixed(2),
      isPlaceholderRate,
    });
  }

  // 5. Making Charges (always uses net metal weight for per-gram calculations)
  const useRateCardMaking = Boolean(rule.useRateCardMakingCharge && rule.makingChargePerGramInr);
  const rawProductMaking = new Decimal(product.makingChargeValue || '0');
  const makingChargeInput = useRateCardMaking
    ? new Decimal(rule.makingChargePerGramInr!)
    : rawProductMaking.greaterThan(0)
      ? rawProductMaking
      : new Decimal(rule.makingChargePerGramInr || '0');
  const effectiveMakingMode = useRateCardMaking ? 'PER_GRAM_NET' : product.makingChargeMode;
  let makingChargeValueInr = new Decimal(0);

  switch (effectiveMakingMode) {
    case 'PER_GRAM_NET':
    case 'PER_GRAM_GROSS':
      makingChargeValueInr = computedNetMetalWeightGrams.times(makingChargeInput);
      break;
    case 'PERCENTAGE_OF_METAL':
      makingChargeValueInr = payableMetalValueInr.times(makingChargeInput).dividedBy(100);
      break;
    case 'FLAT_PER_PIECE':
      makingChargeValueInr = makingChargeInput;
      break;
  }

  // 6. Certification, Hallmark & Fixed Adjustments (do not infer unless configured)
  const storedCertificationFee = new Decimal(
    product.certificationFeeInr !== undefined && product.certificationFeeInr !== ''
      ? product.certificationFeeInr
      : rule.defaultCertificationFeeInr || '0'
  );
  const storedHallmarkFee = new Decimal(
    product.hallmarkFeeInr !== undefined && product.hallmarkFeeInr !== ''
      ? product.hallmarkFeeInr
      : rule.defaultHallmarkFeeInr || '0'
  );
  const certificationFee = applyProductLevelFees ? storedCertificationFee : new Decimal(0);
  const hallmarkFee = applyProductLevelFees ? storedHallmarkFee : new Decimal(0);
  if (!applyProductLevelFees && (storedCertificationFee.greaterThan(0) || storedHallmarkFee.greaterThan(0))) {
    warnings.push(
      'Stored certification/hallmark fees are not applied: owner rate card includes only approved additional charges.'
    );
  }
  const fixedAdjustment = new Decimal(product.fixedAdjustmentInr || '0');

  const subtotalBeforeTax = payableMetalValueInr
    .plus(totalDiamondValueInr)
    .plus(makingChargeValueInr)
    .plus(certificationFee)
    .plus(hallmarkFee)
    .plus(fixedAdjustment);

  // 7. GST Calculation — apply 3% GST only where confirmed (14K, 18K). GST for 22K and Platinum is not confirmed.
  const confirmedGstPurities = rule.confirmedGstPurities ?? ['14K', '18K'];
  const gstConfirmed = confirmedGstPurities.includes(product.metalPurity);
  const gstRatePercent = gstConfirmed
    ? new Decimal(rule.gstRatePercent || '3.00')
    : new Decimal(0);
  const gstAmount = gstConfirmed
    ? subtotalBeforeTax.times(gstRatePercent).dividedBy(100)
    : new Decimal(0);

  if (!gstConfirmed && !is24kBlocked) {
    warnings.push(
      `GST for ${product.metalPurity} is not confirmed — tax rule is not extended.`
    );
  }

  const unroundedTotal = subtotalBeforeTax.plus(gstAmount);

  // 8. Rounding, Blockers & Manual Override
  const { rounded: calculatedPriceDecimal, adjustment: roundingAdjustment } = applyInrRounding(
    unroundedTotal,
    rule.roundingMode
  );

  // Fail closed: a sellable price may only come from an owner-APPROVED, non-placeholder rule and
  // non-placeholder rates. (allowPlaceholderPricing is set only by the JSON test backend.)
  const usesUnapprovedPricing =
    !rule.allowPlaceholderPricing &&
    (rule.status !== 'APPROVED' ||
      rule.isPlaceholderFormula ||
      Boolean(matchingMetalRate?.isPlaceholder) ||
      anyDiamondPlaceholder);
  if (usesUnapprovedPricing) {
    warnings.push('Pricing rule or rates are not owner-approved (placeholder/unapproved); price withheld.');
  }

  let blockerReason: string | null = null;
  if (invalidFields.length > 0) {
    blockerReason = 'INVALID_PRODUCT_DATA';
  } else if (is24kBlocked) {
    blockerReason = '24K_RATE_BLOCKED_PENDING_CONFIRMATION';
  } else if (usesUnapprovedPricing) {
    blockerReason = 'PRICING_RULE_NOT_APPROVED';
  } else if (missingMetalRate) {
    blockerReason = 'MISSING_METAL_RATE';
  } else if (missingNetWeight) {
    blockerReason = 'MISSING_NET_METAL_WEIGHT';
  } else if (exact1CaratMissing) {
    blockerReason = 'DIAMOND_RATE_MISSING_EXACT_1CT';
  } else if (missingDiamondRate) {
    blockerReason = 'DIAMOND_RATE_MISSING';
  } else if (!gstConfirmed) {
    blockerReason = 'GST_UNCONFIRMED_FOR_PURITY';
  } else if (calculatedPriceDecimal.lessThanOrEqualTo(0) || !calculatedPriceDecimal.isFinite()) {
    blockerReason = 'NON_POSITIVE_TOTAL';
    warnings.push('Calculated total is not a positive finite amount; price withheld.');
  }

  const hasManualOverride =
    product.manualPriceOverrideInr !== undefined &&
    product.manualPriceOverrideInr !== null &&
    product.manualPriceOverrideInr !== '' &&
    new Decimal(product.manualPriceOverrideInr).greaterThan(0);

  const priceOnRequest = !hasManualOverride && blockerReason !== null;
  const calculatedPrice = blockerReason !== null ? new Decimal(0) : calculatedPriceDecimal;

  const finalProposedPrice = hasManualOverride
    ? new Decimal(product.manualPriceOverrideInr!)
    : blockerReason !== null
      ? new Decimal(0)
      : calculatedPriceDecimal;

  if (hasManualOverride) {
    warnings.push(
      `Manual price override active (₹${finalProposedPrice.toFixed(2)} instead of formula ₹${calculatedPrice.toFixed(2)}).`
    );
  }

  const displayPriceLabel = priceOnRequest
    ? 'Price on request'
    : `₹${Math.round(finalProposedPrice.toNumber()).toLocaleString('en-IN')}`;

  const priceSource: PriceCalculationBreakdown['priceSource'] = hasManualOverride
    ? 'OWNER_MANUAL_OVERRIDE'
    : priceOnRequest
      ? 'PRICE_ON_REQUEST'
      : 'CALCULATED_MARKET_RATE';

  // 9. Delta vs. Current Shopify Price & Guardrail Check
  const oldPrice = new Decimal(product.currentShopifyPriceInr || '0');
  const priceDelta = finalProposedPrice.minus(oldPrice);
  const priceDeltaPercent = oldPrice.greaterThan(0)
    ? priceDelta.dividedBy(oldPrice).times(100)
    : new Decimal(0);

  const maxThreshold = new Decimal(rule.maxPriceDeltaPercentThreshold || '15.00');
  const exceedsMaxDeltaThreshold =
    oldPrice.greaterThan(0) && priceDeltaPercent.abs().greaterThan(maxThreshold);

  if (exceedsMaxDeltaThreshold) {
    warnings.push(
      `Price swing of ${priceDeltaPercent.toFixed(2)}% exceeds safety threshold of ±${maxThreshold.toFixed(2)}%. Owner review required.`
    );
  }

  const isPlaceholderConfiguration = Boolean(
    rule.isPlaceholderFormula || matchingMetalRate?.isPlaceholder || anyDiamondPlaceholder
  );

  return {
    sku: product.sku,
    formulaVersion: rule.version,
    isPlaceholderConfiguration,
    currency: 'INR',
    metalType: product.metalType,
    metalPurity: product.metalPurity,
    grossWeightGrams: grossWeightGrams.toFixed(3),
    totalDiamondCarats: totalDiamondCarats.toFixed(3),
    stoneWeightInGrams: stoneWeightInGrams.toFixed(3),
    computedNetMetalWeightGrams: computedNetMetalWeightGrams.toFixed(3),
    metalRatePerGramInr: metalRatePerGram.toFixed(2),
    baseMetalValueInr: baseMetalValue.toFixed(2),
    wastageMode: effectiveWastageMode,
    wastageGrams: wastageGrams.toFixed(3),
    wastageValueInr: wastageValueInr.toFixed(2),
    payableMetalValueInr: payableMetalValueInr.toFixed(2),
    diamondComponents: diamondBreakdowns,
    totalDiamondValueInr: totalDiamondValueInr.toFixed(2),
    makingChargeMode: effectiveMakingMode,
    makingChargeRateInput: makingChargeInput.toFixed(2),
    makingChargeValueInr: makingChargeValueInr.toFixed(2),
    certificationFeeInr: certificationFee.toFixed(2),
    hallmarkFeeInr: hallmarkFee.toFixed(2),
    fixedAdjustmentInr: fixedAdjustment.toFixed(2),
    subtotalBeforeTaxInr: subtotalBeforeTax.toFixed(2),
    gstRatePercent: gstRatePercent.toFixed(2),
    gstMode: rule.gstMode,
    gstAmountInr: gstAmount.toFixed(2),
    unroundedTotalInr: unroundedTotal.toFixed(2),
    roundingMode: rule.roundingMode,
    roundingAdjustmentInr: roundingAdjustment.toFixed(2),
    calculatedPriceInr: calculatedPrice.toFixed(2),
    manualOverrideApplied: hasManualOverride,
    finalProposedPriceInr: finalProposedPrice.toFixed(2),
    priceOnRequest,
    priceOnRequestReason: priceOnRequest ? blockerReason : null,
    displayPriceLabel,
    priceSource,
    gstConfirmed,
    diamondTierBasis,
    productLevelFeesApplied: applyProductLevelFees,
    rateCardLabel: rule.rateCardLabel || 'Owner-updated market rates',
    rateCardUpdatedAt: matchingMetalRate?.effectiveAt || rule.createdAt,
    oldPriceInr: oldPrice.toFixed(2),
    priceDeltaInr: priceDelta.toFixed(2),
    priceDeltaPercent: priceDeltaPercent.toFixed(2),
    exceedsMaxDeltaThreshold,
    warnings,
    calculatedAt: new Date().toISOString(),
  };
}

export const OWNER_MARKET_RATE_CARD_LABEL = 'Owner-updated market rates' as const;

export const OWNER_MARKET_METAL_RATES: MetalRateRecord[] = [
  {
    id: 'mr-14k',
    metalType: 'GOLD',
    purity: '14K',
    ratePerGramInr: '10200.00',
    currency: 'INR',
    source: OWNER_MARKET_RATE_CARD_LABEL,
    sourceReference: 'Owner-updated 14K Gold market rate (₹10,200/g)',
    isPlaceholder: false,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'mr-18k',
    metalType: 'GOLD',
    purity: '18K',
    ratePerGramInr: '12300.00',
    currency: 'INR',
    source: OWNER_MARKET_RATE_CARD_LABEL,
    sourceReference: 'Owner-updated 18K Gold market rate (₹12,300/g)',
    isPlaceholder: false,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'mr-22k',
    metalType: 'GOLD',
    purity: '22K',
    ratePerGramInr: '11510.00',
    currency: 'INR',
    source: OWNER_MARKET_RATE_CARD_LABEL,
    sourceReference: 'Owner-updated 22K Gold market rate (₹11,510/g; GST unconfirmed)',
    isPlaceholder: false,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'mr-24k',
    metalType: 'GOLD',
    purity: '24K',
    ratePerGramInr: '0.00',
    currency: 'INR',
    source: 'BLOCKED_PENDING_CONFIRMATION',
    sourceReference:
      'BLOCKED pending owner confirmation (conflicting values supplied: ₹15,400/g inclusive GST vs ₹154,000/g)',
    isPlaceholder: true,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'mr-plat-950',
    metalType: 'PLATINUM',
    purity: '950_PLATINUM',
    ratePerGramInr: '3911.00',
    currency: 'INR',
    source: OWNER_MARKET_RATE_CARD_LABEL,
    sourceReference: 'Owner-updated Platinum (950) market rate (₹3,911/g; GST unconfirmed)',
    isPlaceholder: false,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
];

export const OWNER_MARKET_DIAMOND_RATES: DiamondRateMatrixEntry[] = [
  {
    id: 'dr-under-1ct-ef-vvs',
    shape: 'ANY',
    sieveRange: '> 0.0000 ct to < 1.0000 ct',
    sizeMinCarat: '0.0000',
    sizeMaxCarat: '1.0000',
    minInclusive: false,
    maxInclusive: false,
    colorGrade: 'ANY',
    clarityGrade: 'ANY',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '30000.00',
    currency: 'INR',
    version: 2,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'dr-over-1ct-ef-vvs',
    shape: 'ANY',
    sieveRange: '> 1.0000 ct to <= 99.0000 ct',
    sizeMinCarat: '1.0000',
    sizeMaxCarat: '99.0000',
    minInclusive: false,
    maxInclusive: true,
    colorGrade: 'ANY',
    clarityGrade: 'ANY',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '45000.00',
    currency: 'INR',
    version: 2,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-20T00:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-20T00:00:00.000Z',
  },
];

export const OWNER_MARKET_PRICING_RULE: PricingFormulaRule = {
  id: 'rule-v2-owner-market',
  version: 2,
  name: 'Owner-updated market rates (v2)',
  description:
    'Owner-updated market rates: 14K ₹10,200/g, 18K ₹12,300/g, 22K ₹11,510/g, Pt950 ₹3,911/g, 24K BLOCKED pending confirmation; Making ₹2,500/g net metal weight; Diamonds (tier by combined product carat weight) <1.00ct ₹30,000/ct, >1.00ct ₹45,000/ct (=1.00ct pending owner input); wastage/certification/hallmark not included unless approved; 3% GST confirmed on 14K & 18K only. [MAKING_CHARGE_PER_GRAM_INR:2500.00]',
  status: 'APPROVED',
  isPlaceholderFormula: false,
  stoneWeightToGramsFactor: '0.2000',
  gstRatePercent: '3.00',
  gstMode: 'INCLUSIVE',
  roundingMode: 'NEAREST_1',
  maxPriceDeltaPercentThreshold: '15.00',
  defaultCertificationFeeInr: '0.00',
  defaultHallmarkFeeInr: '0.00',
  makingChargePerGramInr: '2500.00',
  useRateCardMakingCharge: true,
  confirmedGstPurities: ['14K', '18K'],
  diamondTierBasis: 'TOTAL_PRODUCT_CARAT',
  applyProductLevelFees: false,
  rateCardLabel: OWNER_MARKET_RATE_CARD_LABEL,
  approvedBy: 'owner@mangalroyalstudio.com',
  approvedAt: '2026-11-20T00:00:00.000Z',
  createdAt: '2026-11-20T00:00:00.000Z',
};

export function buildOwnerMarketRateCard(params: {
  metalRates: MetalRateRecord[];
  diamondRates: DiamondRateMatrixEntry[];
  rule: PricingFormulaRule | null;
}): OwnerMarketRateCard {
  const { metalRates, diamondRates, rule } = params;
  const findMetal = (type: string, purity: string, fallback: string) =>
    metalRates.find((r) => r.metalType === type && r.purity === purity)?.ratePerGramInr ?? fallback;

  const under1ct =
    diamondRates.find((d) => d.isActive && Number(d.sizeMaxCarat) < 1)?.rateInr ?? '30000.00';
  const over1ct =
    diamondRates.find((d) => d.isActive && Number(d.sizeMinCarat) > 1)?.rateInr ?? '45000.00';

  const latestTimestamp =
    [
      ...metalRates.map((m) => m.effectiveAt),
      ...diamondRates.map((d) => d.effectiveAt),
      rule?.createdAt || '',
    ]
      .filter(Boolean)
      .sort()
      .pop() || new Date().toISOString();

  const latestActor =
    metalRates[0]?.createdBy || rule?.approvedBy || 'owner@mangalroyalstudio.com';

  return {
    label: OWNER_MARKET_RATE_CARD_LABEL,
    version: rule?.version ?? 2,
    lastUpdatedAt: latestTimestamp,
    updatedBy: latestActor,
    rates: {
      gold14kPerGramInr: findMetal('GOLD', '14K', '10200.00'),
      gold18kPerGramInr: findMetal('GOLD', '18K', '12300.00'),
      gold22kPerGramInr: findMetal('GOLD', '22K', '11510.00'),
      gold24kStatus: 'BLOCKED_PENDING_CONFIRMATION',
      gold24kBlockedNote:
        'BLOCKED pending owner confirmation (conflicting values supplied: ₹15,400/g inclusive GST vs ₹154,000/g). Neither value is active.',
      platinum950PerGramInr: findMetal('PLATINUM', '950_PLATINUM', '3911.00'),
      makingChargePerGramInr: rule?.makingChargePerGramInr ?? '2500.00',
      diamondUnder1CaratPerCaratInr: under1ct,
      diamondOver1CaratPerCaratInr: over1ct,
      diamondExact1CaratStatus: 'PENDING_OWNER_INPUT',
      diamondExact1CaratNote:
        'No rate supplied for exactly 1.00 ct; requires separate owner input. Products with = 1.00 ct diamonds return Price on request.',
    },
    gstRules: {
      confirmedPurities: rule?.confirmedGstPurities ?? ['14K', '18K'],
      confirmedGstPercent: rule?.gstRatePercent ?? '3.00',
      unconfirmedPurities: ['22K', '950_PLATINUM'],
      gold24kGstNote: '24K supplied rate note mentions inclusive GST, but 24K is BLOCKED pending owner confirmation.',
    },
  };
}


