# MRS Showcase Remediation Report

**Date:** 2026-11-22, 13:50–14:30 IST (08:20–09:00 UTC) · **Scope:** local code only. **No staging or production deployment**, no DNS change, no rate-card publication, no product activation, no data change.
**Git:** `main` @ `c7de1bc` + working tree (nothing committed or pushed) · **Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-remediation/`

## Result: all three showcase issues fixed locally and verified in a real browser. **Not yet on staging** (deployment not authorised).

| Issue (pre-production report) | Fix | Verified |
|---|---|---|
| **B1** every page called `GET /api/v1/auth/customer/me`; the read-only proxy returns 403, so a console error on every page | The session check runs only if this browser signed in here (non-sensitive `localStorage` hint set on sign-in/verification, cleared on sign-out or failed check). The session cookie stays HttpOnly. Anonymous and showcase visitors make no session request. | 0 console errors and 0 failed requests while browsing 15 pages (desktop + mobile) |
| **B2** product pages auto-POSTed a customization quote (403 on showcase); surcharges such as "+₹1,200" were shown even though no quote could be produced | Quotes are fetched **on demand** (first option change or "Get Bespoke Price"), never on page load. A failed or refused quote shows a friendly "not available / contact the studio" note and a **Contact the Studio** link. Surcharge amounts are shown **only next to a valid server quote**. Price-on-request pieces never request a quote. | No quote request on load; after a blocked quote: friendly note, contact link, no "+₹" amounts, no internal text |
| **B3** product page showed internal codes ("Price on request (PRICING_RULE_NOT_APPROVED)") | All customer text comes from one helper (`lib/customer-messages.ts`) that maps HTTP status and error code to fixed sentences and **never renders server text**. | No internal codes or rule wording on any page (scan of every visited page) |

**Additional leaks found and fixed while auditing (item 5: never reveal internals):**
- Product page breakdown for **Price-on-request** pieces showed metal and making values computed from **unapproved rates**, plus "Pending owner rate (= 1.00 ct)" and "Pending owner tax confirmation". It is now replaced by a "Price on request" panel with a contact link; no partial amounts.
- Priced-piece wording: "Owner-updated market rates" → "Today's gold & diamond rates"; "(Owner-Approved Fixed Override Price…)" → "(Inclusive of 3% GST)", with GST % from the server result; the making-charge mode name ("PER GRAM NET") removed; the zero-value certification/hallmark row is hidden.
- Customizer: "Pricing Formula v{n}" removed.
- **11 screens** rendered raw server `message` text (account, orders, designs, login, register, verify-email, checkout, customize). All now use `friendlyApiError()` / `friendlyThrown()`.
- The catalogue error showed the raw exception text ("Live catalogue unavailable (…)"); now a fixed sentence.
- **API (defence in depth):** the Price-on-request `message` on cart (`app.ts`), checkout (`app.ts`) and customization quote (`customization-pricing.ts`) no longer embeds the reason code or SKU. The machine-readable `error` / `reason` fields are unchanged, so clients and tests still get the code.

**Preserved:** Price-on-request protection (server 422 on cart, checkout and quote; no "add to cart" for POR in the UI), draft isolation, read-only proxy rules, fail-closed pricing. No pricing values changed.

## Browser verification (real Chromium 131, headless)
Staging could not be redeployed, so the **staging showcase was mirrored locally**:
- Storefront **production build** in the staging configuration (relative `/api/v1`, internal rewrite), built into a separate folder `.next-showcase-verify` so the owner's running `next dev` was not touched.
- Dedicated API on 127.0.0.1:4400 reading the **local dev DB**, which holds the approved rate card v4. This is what staging will show after the owner publishes: 6 priced, 2 Price on request.
- A local Node stand-in for the staging nginx proxy with the **same rules** (case-insensitive deny list, catalogue allowlist, `/api` default-deny, GET/HEAD/OPTIONS only).

| Run | Result |
|---|---|
| `browser-e2e-v2` (desktop 1440×900 + mobile 390×844) | **88/88 PASS** (`browser/browser-e2e.log`) |
| Includes | normal browsing 0 console errors / 0 failed requests / 0 internal text; listing 8 cards, images load; **real prices** on 6 PDPs equal server values (₹1,39,040 · ₹1,10,498 · ₹3,43,938 · ₹30,818 · ₹3,09,227 · ₹6,46,881); POR panels on 2 PDPs; customizer on-demand quote + blocked-quote state; POR cannot be carted; tampered ₹1 cart refused (403); draft page/API refused; admin paths 403/404 |
| Screenshots | `browser/after-pdp-price-on-request-MRS-EAR-2001.png`, `browser/after-customizer-quote-unavailable-MRS-RNG-1001.png`, `browser/after-pdp-priced-MRS-RNG-1001-top.png` + 8 standard views |

Limits: a local mirror, not staging itself (the proxy is a Node port of the nginx rules, not nginx). Re-run `browser-e2e-v2` against staging after the next authorised deploy and rate-card publication. Mirror processes were stopped afterwards; only processes started by this task were stopped.

## Automated verification (commands executed)
| Command | Result |
|---|---|
| `npm run test --workspace=@mrs/shared` | **51/51** |
| `npm run test --workspace=@mrs/api` | **166/166** |
| `npm run test --workspace=@mrs/storefront` | **24/24** (10 existing + **14 new** in `customer-messages.test.ts`: no server text/codes for 9 statuses × 6 hostile bodies, code mapping, thrown-error filtering, session hint) |
| `npx vitest run --root apps/admin` | 3/3 (admin navigation, not part of the root `test` script) |
| `npm run typecheck` (4 workspaces) | PASS |
| `npm run build --workspace=@mrs/shared` / `@mrs/api` | PASS |
| storefront + admin `next build` (into `.next-verify`) | PASS |
| New API assertions | POR `message` on cart, checkout and quote contains no `ERROR_CODE` / SKU token (exposure + phase-2 security tests) |

Unique tests now: 51 + 166 + 24 = **241** (+3 admin). Lint is still not configured.

## Unchanged-state confirmation (`20-unchanged-state.log`)
- **Staging:** same images (`1c1c9279…`, `a424569f…`, `166badd5…`) started 06:32–06:33 UTC; 0 audit entries and 0 product updates since; 8 ACTIVE / **272 DRAFT**; rule still placeholder v1 (owner has not published). Health: Razorpay not configured, email not configured, Shopify dry-run with no token.
- **Production:** none exists and none was touched. DNS unchanged.
- **Local dev DB** (designated test database): 8 ACTIVE / **272 DRAFT**, stock unchanged (e.g. MRS-EAR-2001 = 9), 3 orders, approved rule v4, 0 new rate rows. The PostgreSQL integration tests refreshed `updatedAt` and the stored reference price of the 8 baseline products (08:55:52 UTC, during `@mrs/api` tests). The public price is always recalculated live.
- **Owner's local processes:** not stopped. Their `next dev` and `tsx watch` restarted their own child servers when watched files changed (`next.config.ts` edit; rebuilt shared package). Parents unchanged since 11:33–11:34 IST.

## Files changed (Part A)
New: `apps/storefront/src/lib/customer-messages.ts`, `apps/storefront/src/lib/customer-messages.test.ts`
Modified:
- Storefront components: `components/StorefrontShell.tsx`, `components/ProductCustomizer.tsx`, `components/Product3DViewer.tsx`
- Storefront pages: `app/products/[handle]/page.tsx`, `app/customize/[productId]/page.tsx`, `app/checkout/page.tsx`, `app/account/page.tsx`, `app/account/login/page.tsx`, `app/account/register/page.tsx`, `app/account/verify-email/page.tsx`, `app/account/orders/page.tsx`, `app/account/designs/page.tsx`
- Build config: `apps/storefront/next.config.ts` and `apps/admin/next.config.mjs` (optional `NEXT_DIST_DIR` build directory; default `.next` unchanged)
- API and shared: `services/api/src/app.ts`, `packages/shared/src/customization-pricing.ts`
- Tests: `services/api/src/public-catalogue-exposure.test.ts`, `services/api/src/phase2-api-security.test.ts`

## Remaining / owner actions
1. **Deploy** these fixes to staging (needs authorisation), then publish the approved rate card and re-run the browser suite there.
2. **Content (database, not code):** a customization profile description reads "Re-prices diamond components using the active diamond rate matrix". Reword it in Admin → Customization.
3. **Cosmetic:** the customizer's Tailwind classes have no effect (Tailwind is not configured in the storefront), so its option buttons look plain. The new notices use inline styles.
4. Visitors who were signed in before this change have no session hint; they appear signed out until they sign in once more.
