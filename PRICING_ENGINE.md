# Jewellery Pricing Engine Specification (`packages/shared/src/pricing-engine.ts`)

> **Code-Verified Audit Status:** Audited against `packages/shared/src/pricing-engine.ts` (lines 1–289), `packages/shared/src/pricing-engine.test.ts` (lines 1–232), `packages/shared/src/types.ts`, and `services/api/src/store/data-store.ts`. See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Precision Configuration & Domain Enums (`VERIFIED`)

The pricing engine in [`packages/shared/src/pricing-engine.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.ts#L1-L289) uses `decimal.js` (`10.6.0`) configured globally at module load:

```ts
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
```

### Verified Type Unions (`packages/shared/src/types.ts`)

- **`MetalPurity`:** `'24K' | '22K' | '18K' | '14K' | '9K'`
- **`MakingChargeMode`:** `'PER_GRAM_NET' | 'PER_GRAM_GROSS' | 'PERCENTAGE_OF_METAL' | 'FLAT_PER_PIECE'`
- **`WastageMode`:** `'NONE' | 'PERCENT_METAL_VALUE' | 'PERCENT_METAL_WEIGHT' | 'FLAT_GRAMS'`
- **`NetWeightDerivationMode`:** `'EXPLICIT_NET_WEIGHT' | 'GROSS_MINUS_STONE_WEIGHT'` (`1 ct = 0.200 g`)
- **`RoundingMode`:** `'NEAREST_1' | 'NEAREST_10' | 'NEAREST_99' | 'NEAREST_100' | 'NONE'`
- **`PricingRuleSet.version`:** Integer (`number`, seeded as `version: 1`, `id: 'rule-v1'`)

---

## 2. Step-by-Step Calculation Pipeline (`calculateJewelleryPrice()`)

1. **Input Validation (`validatePricingInputs()`):**
   - Rejects negative `grossWeightGrams` or `netWeightGrams`.
   - Rejects `netWeightGrams > grossWeightGrams` when `netWeightDerivationMode === 'EXPLICIT_NET_WEIGHT'`.
   - Verifies that an active rate exists for `input.metalType` + `input.metalPurity`.
   - Verifies that every diamond component has a matching active `DiamondRateEntry` (`qualityGrade`, `sieveOrCaratBracket`, and `labGrown`).
2. **Effective Net Weight Resolution (`resolveEffectiveNetWeight()`):**
   - In `'EXPLICIT_NET_WEIGHT'` mode: uses `input.netWeightGrams` (`3 decimal places`).
   - In `'GROSS_MINUS_STONE_WEIGHT'` mode: subtracts `(diamondCarats + gemstoneCarats) × 0.200g` from `grossWeightGrams`.
3. **Metal Value:**
   $$\text{Metal Value} = \text{Effective Net Weight (g)} \times \text{Metal Rate per Gram (₹)}$$
4. **Diamond Value (Multi-Component Matrix Lookup):**
   - For each item in `input.diamondComponents`, looks up `ratePerCaratInr` by matching `(qualityGrade, sieveOrCaratBracket, labGrown)` and computes:
   $$\text{Component Total} = \text{Carat Weight} \times \text{Rate per Carat (₹)}$$
5. **Gemstone Value:**
   - Sums `caratWeight × ratePerCaratInr` across `input.gemstoneComponents`.
6. **Making Charges (`computeMakingCharge()`):**
   - `'PER_GRAM_NET'`: $\text{Effective Net Weight} \times \text{Making Charge Value}$
   - `'PER_GRAM_GROSS'`: $\text{Gross Weight} \times \text{Making Charge Value}$
   - `'PERCENTAGE_OF_METAL'`: $\text{Metal Value} \times \frac{\text{Making Charge Value}}{100}$
   - `'FLAT_PER_PIECE'`: $\text{Making Charge Value}$
7. **Wastage Charges (`computeWastageCharge()`):**
   - `'NONE'`: $0$
   - `'PERCENT_METAL_VALUE'`: $\text{Metal Value} \times \frac{\text{Wastage Value}}{100}$
   - `'PERCENT_METAL_WEIGHT'`: $(\text{Effective Net Weight} \times \frac{\text{Wastage Value}}{100}) \times \text{Metal Rate per Gram}$
   - `'FLAT_GRAMS'`: $\text{Wastage Value (g)} \times \text{Metal Rate per Gram}$
8. **Subtotal Before Discount:**
   $$\text{Subtotal Before Discount} = \text{Metal} + \text{Diamond} + \text{Gemstone} + \text{Making} + \text{Wastage} + \text{Certification} + \text{Hallmarking} + \text{Fixed Adjustments}$$
9. **Discount & Manual Override:**
   - Subtracts `promotionalDiscountInr` (clamped at `0`).
   - If `manualOverridePriceInr !== null` and `ruleSet.allowManualOverride === true`, replaces `subtotalAfterDiscountInr` with `manualOverridePriceInr` and sets `isManualOverrideApplied = true`.
10. **GST Calculation:**
    $$\text{GST Amount} = \text{Taxable Subtotal} \times \frac{\text{gstPercent}}{100} \quad (\text{default } 3\%)$$
11. **Final Rounding (`applyRounding()`):**
    - Applies `ruleSet.roundingMode` (`'NEAREST_1'`, `'NEAREST_10'`, `'NEAREST_99'`, `'NEAREST_100'`, or `'NONE'`) and records `roundingAdjustmentInr = finalPayablePriceInr - unroundedTotalInr`.

---

## 3. Verified Calculation Example (`packages/shared/src/pricing-engine.test.ts`)

> **Correction Note:** Earlier documentation showed an unverified example (`₹72,000/ct` diamond rate). Below is the **exact verified unit test calculation** from [`pricing-engine.test.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/packages/shared/src/pricing-engine.test.ts#L76-L115) for `MRS-RING-001` (`Royal Solitaire Lab Diamond Ring`):

| Component | Input Parameters | Formula | Verified Output (`INR`) |
| :--- | :--- | :--- | :--- |
| **Metal (`18K GOLD`)** | `3.500g` net (`4.200g` gross) @ `₹5,800/g` | $3.500 \times 5800$ | `₹20,300.00` |
| **Center Diamond (`EF_VVS`, `SOLITAIRE_1_00_PLUS`)** | `1.000 ct` (1 stone, IGI) @ `₹24,000/ct` | $1.000 \times 24000$ | `₹24,000.00` |
| **Melee Diamonds (`EF_VS`, `MELEE_0_01_0_07`)** | `0.200 ct` (12 stones, IGI) @ `₹18,000/ct` | $0.200 \times 18000$ | `₹3,600.00` |
| **Total Diamond Value** | `1.200 ct` total | $24000 + 3600$ | `₹27,600.00` |
| **Making Charge (`PER_GRAM_NET`)** | `3.500g` net @ `₹1,200/g` | $3.500 \times 1200$ | `₹4,200.00` |
| **Wastage (`NONE`)** | `0` | $0$ | `₹0.00` |
| **Certification Fee** | IGI Certificate | Flat | `₹500.00` |
| **Hallmarking Fee** | BIS Hallmark | Flat | `₹100.00` |
| **Taxable Subtotal** | — | $20300 + 27600 + 4200 + 500 + 100$ | `₹52,700.00` |
| **GST (`3.00%`)** | HSN `711319` | $52700 \times 0.03$ | `₹1,581.00` |
| **Unrounded Total** | — | $52700 + 1581$ | `₹54,281.00` |
| **Final Payable Price (`NEAREST_1`)** | Rounding Adjustment `₹0.00` | — | **`₹54,281.00`** |

---

## 4. Seeded Rates in Runtime Store (`services/api/src/store/data-store.ts`)

| Rate Type | Seeded Values in `data-store.ts` (lines 436–467) |
| :--- | :--- |
| **Metal Rates (`INR/g`)** | `24K`: `₹7,650/g` \| `22K`: `₹7,020/g` \| `18K`: `₹5,740/g` \| `14K`: `₹4,465/g` \| `9K`: `₹2,870/g` |
| **Lab-Grown Diamond Matrix (`INR/ct`)** | `EF_VVS` + `MELEE_0_01_0_07`: `₹18,500/ct` \| `EF_VVS` + `STAR_0_08_0_29`: `₹21,000/ct` \| `EF_VVS` + `POINTER_0_30_0_99`: `₹24,500/ct` \| `EF_VVS` + `SOLITAIRE_1_00_PLUS`: `₹28,000/ct` \| `EF_VS` + `MELEE_0_01_0_07`: `₹16,500/ct` \| `GH_VS` + `MELEE_0_01_0_07`: `₹14,500/ct` |

---

## 5. Governance Workflow (`Preview -> Approve -> Publish`)

1. **Preview (`POST /api/admin/pricing/preview`):** Creates a `PricingRunRecord` in `PREVIEW` status with old-vs-new price deltas for every active SKU.
2. **Owner Approval (`POST /api/admin/pricing/runs/:runId/approve`):** Restricted by `requireRole('OWNER')`; transitions the run to `APPROVED`.
3. **Publish (`POST /api/admin/pricing/runs/:runId/publish`):** Restricted by `requireRole('OWNER')`; updates `ProductRecord.priceBreakup` for all active SKUs and transitions the run to `PUBLISHED`.
