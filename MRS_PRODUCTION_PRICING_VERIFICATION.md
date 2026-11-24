# MRS Production Pricing Verification

- **Date / Time:** `2026-11-23 19:45 IST`
- **Production Domain:** `PENDING OWNER CONFIRMATION`
- **Source Commit:** `f24dcb6`
- **Release Artifact SHA-256:** `4523592c39cc96263ef1c09be24e3494d4d8133f0e6ec4455ecfb1001716ddf1`
- **Hostinger Deployment Identity:** `srv2177504` (pending VPS deployment)
- **Production Database Identity:** `mangal_royal_studio_prod` (pending provisioning)
- **Migration List:** 3 additive Prisma migrations
- **Backup Checksum:** `N/A — pending VPS provisioning`
- **Product Counts:** `8` ACTIVE (`6` priced + `2` Price on Request), `272` DRAFT
- **Active Rate Card Version:** `PENDING OWNER PUBLISH` (must be published via Admin full Rate Card form by `OWNER`)
- **Payment / Shipping Status:** `DISABLED`

## Pricing Governance & Engine Verification (`VERIFIED`)
- **OWNER-Only Rate Publishing:** `RATES_WRITE` removed from `MANAGER` and `PRICING_OPERATOR` in `packages/shared/src/types.ts`. Verified via `app.test.ts` (`7b`): non-OWNER rate publish requests return `403 Forbidden`.
- **Fail-Closed Rules (`packages/shared/src/pricing-engine.ts`):**
  - Exactly `1.00 ct` diamond → Price on Request.
  - `22K` Gold GST unapproved → Price on Request.
  - `Platinum 950` GST unapproved → Price on Request.
  - `24K` Gold → Disabled/blocked pending owner confirmation.
  - Unapproved / placeholder rate card → Price on Request (`public-catalogue-exposure.test.ts` `15/15` passed).
- **Test Coverage:** `@mrs/shared` `51/51` passed (`pricing-matrix.test.ts` 35/35, `pricing-engine.test.ts` 11/11, `customization-pricing.test.ts` 5/5). Server-side pricing rejects client-manipulated cart/checkout totals (`phase2-api-security.test.ts` `5/5` passed).
- **Pending Production Step:** Owner must publish the approved Rate Card in staging Admin, verify all 6 priced products and 2 POR products, and transfer only the approved rate-card configuration to production.
