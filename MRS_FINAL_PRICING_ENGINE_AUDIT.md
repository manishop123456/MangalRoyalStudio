# MRS Final Pricing Engine Audit

**Date:** 2026-11-22, 11:44–12:06 IST · **Git:** `c7de1bc` + working tree · **Engine:** `packages/shared/src/pricing-engine.ts` (server-side only; the client bundle contains no rate card, verified by grep) · **Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-final/`

## 1. Approved rate card (owner decision re-confirmed 2026-11-22)
Workbook `Rate Card` B5–B13: 14K **₹10,200/g** · 18K **₹12,300/g** · 22K **₹11,510/g** · Pt950 **₹3,911/g** · making **₹2,500 per net g** · diamond **<1.00 ct ₹30,000/ct**, **>1.00 ct ₹45,000/ct**, tier by **combined** carats · quality EF-VVS.
- GST: **3% on 14K/18K only**.
- Wastage, certification and hallmark: **not charged**; only approved additional charges apply.
- Owner fixed price (override) takes precedence over the calculated price.
- Rounding: half-up to ₹1 on the GST-inclusive total.

**Conflict resolved:** at 11:38 IST the owner entered 18K = ₹5,821/g ("IBJA Morning Bullion Fix") in the local JSON app; it was saved as a placeholder. You confirmed the **₹12,300 rate card stands**.

| Rule | Status |
|---|---|
| GST for 22K / Platinum 950 | **Not decided** → Price on request (owner choice) |
| Exactly 1.00 ct | **Not decided** → Price on request (owner choice) |
| 24K | Blocked (no products) |
| Who may publish rates | **Not decided**: OWNER, MANAGER and PRICING_OPERATOR all hold `RATES_WRITE` |
| Discounts / customization | Discount codes and customization exist in code; no owner approval on record. Customization refuses Price-on-request configurations (422) |

**Rate-card versions:**
- Local dev: v4 (APPROVED, identical values).
- **Staging: v1 placeholder.** The approved card has not been published there yet, so all staging products show Price on request.

## 2. Defect found and fixed this release
| ID | Defect | Evidence | Fix | Regression tests |
|---|---|---|---|---|
| **P7 (high)** | **Prices were sold from unapproved rates.** The engine priced with placeholder metal/diamond rates and placeholder or non-APPROVED rules; the API then used stale stored prices. With no rule at all, cart-add used the stored price and checkout dereferenced `null`. | Staging showed placeholder-derived prices (e.g. MRS-EAR-2001 ₹40,648). The generic `/api/admin/rates/metals` form saves `isPlaceholder: true` by default, which is how the owner's ₹5,821 entry was stored. | Engine fails closed: a price requires rule `APPROVED`, not a placeholder formula, and non-placeholder matched rates; otherwise Price on request `PRICING_RULE_NOT_APPROVED`. No rule → `NO_APPROVED_PRICING_RULE` everywhere; checkout 422; create-product stores ₹0. A test-only opt-in (`allowPlaceholderPricing`) is set **only** by the JSON backend under Vitest; PostgreSQL has no such column. | 6 engine tests (`pricing-matrix.test.ts`), 2 API tests (`public-catalogue-exposure.test.ts`); the E2E test now records an explicit non-placeholder rate |

Fixes P1–P6 from 2026-11-21 (combined-carat tier, unapproved fees, client recalculation, customization bypass, invalid input, public payload) were re-verified by the suites below.

## 3. Tests (commands: `npm run typecheck`, `npm run test --workspace=@mrs/shared|@mrs/api|@mrs/storefront`, `npm run build`)
| Suite | Result |
|---|---|
| Typecheck, 4 workspaces | PASS |
| Lint | **Not configured** (no script or config) |
| Shared (engine + 35-case matrix + customization) | **51/51 PASS** |
| API (incl. PostgreSQL runtime E2E, RBAC, webhooks, imports, exposure/POR/logout/fail-closed) | **164/165**. 1 environmental failure, below |
| Storefront | **6/7**. 1 environmental failure, below |
| Builds, 4 workspaces | PASS |

**Environmental failures (not code defects; evidence in `00-phase0.log`, `11-tests.log`):**
1. *Importer test 4* expects 123 audit logs in `services/api/.data/platform-state.json`. The owner's local session this morning added 2 entries; the importer counted **125 = the file's actual count**, so it accounted for every log.
2. *Storefront live test* calls whatever runs on `localhost:4000`. That is the owner's local JSON-backed server (stock for MRS-EAR-2001 = 3, the test expects the PostgreSQL value 9). I did not stop the owner's processes, so neither test could be re-run cleanly.

**Boundary coverage** (matrix, hand-computed values):
- Purity: 14K/18K/22K/24K/Pt950, unsupported purity.
- Net weight: zero, negative, missing, text.
- Diamonds: 0 / 0.01 / 0.99 / 1.00 / 1.01 / 3.50 ct, D1+D2 crossing 1 ct and summing to exactly 1.00, invalid diamond weight.
- Rules and rates: missing GST rule, placeholder metal/diamond/formula, DRAFT/RETIRED (old) rule.
- Overrides: survive a rate change, removal, invalid override.
- Rounding: ₹35,747.18 → ₹35,747; ₹1,07,789.50 → ₹1,07,790.
- Reproducibility.

## 4. Independent calculation vs engine (approved rate card)
Same result on the local engine and on the **deployed `mrs_api` container's engine** using the **staging** specs (`20-…`, `43-…`): **8/8 MATCH**.

| SKU | Metal | Making | Diamonds | Pre-GST | GST | Final |
|---|---|---|---|---|---|---|
| MRS-RNG-1001 18K 3.8 g, 1.75 ct | 46,740 | 9,500 | 78,750 | 1,34,990 | 4,049.70 | **₹1,39,040** |
| MRS-RNG-1002 18K 3.6 g, 1.20 ct | 44,280 | 9,000 | 54,000 | 1,07,280 | 3,218.40 | **₹1,10,498** |
| MRS-BRC-3001 18K 10.4 g, 4.00 ct | 1,27,920 | 26,000 | 1,80,000 | 3,33,920 | 10,017.60 | **₹3,43,938** |
| MRS-PND-4001 14K 1.6 g, 0.32 ct | 16,320 | 4,000 | 9,600 | 29,920 | 897.60 | **₹30,818** |
| MRS-BNG-5001 18K 13.9 g, 2.10 ct | 1,70,970 | 34,750 | 94,500 | 3,00,220 | 9,006.60 | **₹3,09,227** |
| MRS-NCK-6001 18K 24.8 g, 5.80 ct | 3,05,040 | 62,000 | 2,61,000 | 6,28,040 | 18,841.20 | **₹6,46,881** |
| MRS-EAR-2001 18K, exactly 1.00 ct | — | — | — | — | — | **Price on request** |
| MRS-ANT-7001 22K | — | — | — | — | — | **Price on request** |

## 5. Security and consistency (staging, executed)
- List = detail = collection for all 8 products. Cart with a client price of ₹1 → 422; checkout with a client price → 422; draft cart/pricing → 404; unauthenticated admin → 401; malformed URL → generic 400. No DB write occurred (orders still 3, no cart row).
- Rate publishing: CSRF + `confirmPublish` + positive-number validation; each publish creates a rule version and a before/after audit row (verified locally 2026-11-21). No price cache exists: every request recalculates from the active rule, so a rate change cannot leave stale cached prices.
- **Open:** MANAGER and PRICING_OPERATOR can publish live rates (policy decision); the generic metal-rate form defaults to placeholder (now safe: such rates never price).
