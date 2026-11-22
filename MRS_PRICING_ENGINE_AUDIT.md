# Mangal Royal Studio — Pricing Engine Audit

**Date:** 2026-11-21 · **Engine:** `packages/shared/src/pricing-engine.ts` (single authoritative server-side engine, called only by the API) · **Currency:** INR

## 1. Owner-approved rate card used (source: final workbook, `Rate Card` sheet)

| Input | Value | Source cell | Status |
|---|---|---|---|
| 14K gold | ₹10,200 / g | Rate Card B5 | approved |
| 18K gold | ₹12,300 / g | B6 | approved |
| 22K gold | ₹11,510 / g | B7 ("CONFIRMED BY OWNER") | rate approved; **GST not confirmed (D10, Read Me B27)** |
| 24K gold | blank | B8 ("UNRESOLVED: ₹15,400/g incl. GST vs ₹154,000/g") | **blocked**; no 24K products exist |
| Platinum 950 | ₹3,911 / g | B9 | rate approved; **GST not confirmed** |
| GST | 3% on 14K and 18K only | B10 | approved for 14K/18K only |
| Diamond < 1.00 ct | ₹30,000 / ct | B11 | approved |
| Diamond > 1.00 ct | ₹45,000 / ct | B12 | approved |
| Diamond = 1.00 ct exactly | none | Read Me B18/B28 ("held pending owner clarification") | **not supplied** |
| Making charge | ₹2,500 per **net** metal gram | B13, B17 | approved |
| Diamond quality | EF-VVS | Product Pricing col S | single quality, no matrix |
| Rules | metal = net wt × rate (no wastage, D16); diamond = (D1 ct + D2 ct) × rate, **tier by combined carat weight** (B18/C18); certification and wastage not included (D20); override takes precedence (B21) | A16:D21 | approved |

On 2026-11-21 the owner explicitly chose to keep **22K/Platinum GST** and **exactly 1.00 ct** as *Price on request* until they confirm them in writing. Neither value was invented.

Rounding: GST is applied to the full pre-GST subtotal, then the GST-inclusive total is rounded **half-up to the nearest ₹1** (`NEAREST_1`). Intermediate values use Decimal.js with 28-digit precision.

## 2. Defects found and fixed

| # | Defect | Impact | Fix |
|---|---|---|---|
| P1 | The diamond tier was chosen **per component, from average stone size**, but the owner rule is **combined carat weight**. | Under-priced multi-stone pieces, e.g. `MRS-BRC-3001` (4.00 ct of 52 stones) was charged ₹30,000/ct instead of ₹45,000/ct, ≈ ₹60,000 (+GST) too low. `MRS-RNG-1002` (1.00 + 0.20 ct) was wrongly withheld as "exactly 1 ct". `MRS-EAR-2001` (2 × 0.50 = 1.00 ct) was wrongly priced. | New rule setting `diamondTierBasis: TOTAL_PRODUCT_CARAT` (the default in owner rate-card mode). Exactly 1.00 ct combined → Price on request. Legacy matrix mode is kept for non-owner rules. |
| P2 | Stored supplier **certification (₹350–1,500), hallmark (₹100) and wastage** fees were added to every price. | Every product was over-priced by ₹450–1,600 + GST, contrary to Rate Card D16/D20. | `applyProductLevelFees: false` in owner mode; the values stay stored (audit) but are not charged. The approved "additional charges" (`fixedAdjustmentInr`) are still applied. |
| P3 | The storefront **recalculated prices in the browser** using hard-coded rates whenever no server breakdown was present or the purity changed. | After an Admin rate change the storefront could show stale rates. | Removed. The storefront only displays server breakdowns (`purityBreakups` per offered purity); anything missing shows *Price on request*. The client bundle contains no rate card (grep-verified). |
| P4 | The customization quote priced a configuration even when the engine withheld it. | A 22K customization could be quoted, carted and checked out, **bypassing Price on request**. | The quote now returns **422 `PRICE_ON_REQUEST`**. Two existing tests that asserted the bypass were corrected. |
| P5 | Invalid numbers (`'abc'`, negatives) made Decimal **throw**, causing a 500 for the whole catalogue. | One bad record could break listing. | Inputs are sanitized; invalid data gives **Price on request (`INVALID_PRODUCT_DATA`)**, never NaN/Infinity/negative. A non-positive total also gives Price on request (`NON_POSITIVE_TOTAL`). |
| P6 | Public payloads carried the **stale stored price** for Price-on-request items, plus internal inputs (supplier making value, fees, override, Shopify IDs, engine warnings). | Stale/₹0 price visible on the customize page; internal data exposed. | `toPublicProduct()` on every public route: the public price always equals the server result (`0.00` + label for Price on request). The customize page uses the same formatter. |

## 3. Verification

| Check | Result |
|---|---|
| Exhaustive matrix (`packages/shared/src/pricing-matrix.test.ts`, values hand-computed) | **29/29 pass**: 14K/18K/22K/24K/Pt950; 0, 0.01, 0.99, 1.00, 1.01, 3.50 ct; D1+D2 crossing 1 ct and summing to exactly 1 ct; missing/zero/negative/text net weight; missing purity; invalid diamond weight; missing GST rule; fractional-gram rounding (₹35,747.18 → ₹35,747) and half-up (₹107,789.50 → ₹107,790); fees excluded/explicitly enabled; fixed adjustment; override set, survives a rate change, removal; invalid override; reproducibility |
| Engine vs the owner's workbook formulas (all 296 rows) | **222/222 priced rows identical to ₹1**; all 74 withheld rows also withheld (or are source-integrity rows); **0 differences** (`21-engine-vs-workbook-formula.log`) |
| Independent re-implementation vs live API (8 ACTIVE products) | **8/8 match** (`20-independent-price-crosscheck.log`) |
| Same price/status across list, detail, `/public/pricing`, collection, search, cart | 8/8 consistent; cart ignores client-sent prices (`http-smoke-security-local.log`) |
| Price on request enforcement | cart 422, checkout 422 (even with a manipulated client price), customization quote 422; draft SKUs 404 on every public route (`public-catalogue-exposure.test.ts`, 13 tests) |

### Live prices: 8 ACTIVE products (local dev DB, owner rate card v3)

| SKU | Purity | Net g | Diamonds (combined) | Final (incl. 3% GST) |
|---|---|---|---|---|
| MRS-RNG-1001 | 18K | 3.800 | 1.75 ct → ₹45,000/ct | **₹1,39,040** |
| MRS-RNG-1002 | 18K | 3.600 | 1.20 ct → ₹45,000/ct | **₹1,10,498** |
| MRS-EAR-2001 | 18K | 2.100 | exactly 1.00 ct | **Price on request** |
| MRS-BRC-3001 | 18K | 10.400 | 4.00 ct → ₹45,000/ct | **₹3,43,938** |
| MRS-PND-4001 | 14K | 1.600 | 0.32 ct → ₹30,000/ct | **₹30,818** |
| MRS-BNG-5001 | 18K | 13.900 | 2.10 ct → ₹45,000/ct | **₹3,09,227** |
| MRS-NCK-6001 | 18K | 24.800 | 5.80 ct → ₹45,000/ct | **₹6,46,881** |
| MRS-ANT-7001 | 22K | 20.900 | 2.40 ct | **Price on request** (22K GST) |

Worked example (`MRS-RNG-1001`): metal 3.8 × 12,300 = 46,740 + making 3.8 × 2,500 = 9,500 + diamonds 1.75 × 45,000 = 78,750 → subtotal 1,34,990 + GST 4,049.70 = 1,39,039.70 → **₹1,39,040**.

Full sanitized breakdown (rate version, weights, carats, components, status, final): `MRS_AUDIT_EVIDENCE/run-20261121T233202/pricing-audit-local.{csv,json}`. It contains no cost or margin data. The 272 drafts have no specifications, so there is nothing to price.

## 4. Admin rate control (verified locally against PostgreSQL)

- Unauthenticated rate read/change → 401. A cookie session without CSRF token → 403. Unconfirmed change (`confirmPublish:false`) → 400 with no change. Negative or text rate → 400 with no change.
- A confirmed change creates a new rule version (v3 in dev) and an `OWNER_MARKET_RATE_CARD_UPDATED` audit row with before/after card, actor email and timestamp. Products recalculate immediately; owner fixed overrides are not changed (test-verified).
- **Finding (not changed: owner policy decision):** `MANAGER` and `PRICING_OPERATOR` also hold `RATES_WRITE`. The market-rate card publishes live prices immediately, so either role can change prices without owner approval, which skips the preview → owner-approval step in `AGENTS.md`. Recommendation: restrict `POST /api/admin/rates/market-card` to OWNER, or route it through the pricing-run approval.

## 5. Staging status

Staging runs the fixed engine, but its database still holds the **placeholder** rate card (18K ₹5,740/g, placeholder rule v1). Today the showcase therefore shows **old stored prices that are not owner-approved** (e.g. `MRS-EAR-2001` shows ₹40,648 instead of Price on request). The owner rate card has to be published once in staging Admin (see `MRS_OWNER_QUICK_START.md` §4). After that, staging prices equal the table above, because the active-product specs are identical (verified).
