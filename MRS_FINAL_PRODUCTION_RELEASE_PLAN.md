# MRS Final Production Release Plan

- **Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean`
- **Base Commit:** `e85f15b` (preserved intact)
- **Date:** 2026-11-22

---

## 1. Current Verified Baseline (`VERIFIED`)
- **TypeScript:** `npm run typecheck` passes across all 4 workspaces (`@mrs/shared`, `@mrs/api`, `@mrs/storefront`, `@mrs/admin`).
- **Tests:**
  - `@mrs/shared`: `51/51` passed.
  - `@mrs/api` (against isolated `mangal_royal_studio_test`): `176/176` passed (`0` skipped).
  - `@mrs/storefront`: `24/24` passed.
  - `@mrs/admin`: `3/3` passed.
- **Builds:** All 4 workspace production builds pass (`EXIT_CODE=0`).
- **Migrations:** All 3 Prisma migrations are additive and non-destructive.
- **Included Source Fixes:** Synthetic test-state isolation (`synthetic-platform-state.ts`, `test-db.ts`), fail-closed pricing engine (`pricing-engine.ts`), and storefront showcase hardening.

---

## 2. Ordered Steps to Reach Production Launch

### Phase A — Owner Confirmations & Decisions (`OWNER ACTION REQUIRED`)
1. Confirm completion of all 6 Phase One security actions:
   - 3 staging Admin password rotations
   - 3 dev Admin password rotations
   - Demo-customer password rotation
   - Razorpay test Key Secret rotation
   - Staging backup tarball access/retention decision
2. Confirm proposed Phase Three pricing governance decisions:
   - Restrict `RATES_WRITE` to `OWNER` only
   - Confirm `1.00 ct` diamond = Price on Request
   - Confirm `22K` and `Platinum 950` GST remain fail-closed (Price on Request)
3. Confirm canonical `.com` domain, `www` redirect preference, authoritative DNS provider (Hostinger vs GoDaddy), and exported DNS records.

### Phase B — Remaining Code Changes (`CODE CHANGE REQUIRED`)
1. Upon owner sign-off, remove `RATES_WRITE` from `MANAGER` and `PRICING_OPERATOR` in `packages/shared/src/types.ts` and update `services/api/src/app.test.ts` line 773 to assert `RATES_WRITE` is `OWNER`-only.
2. Add `apps/storefront/src/app/robots.ts` and `apps/storefront/src/app/sitemap.ts` using the confirmed canonical `.com` domain (excluding `/admin` and private routes).
3. Review `git diff`, run secret scan + full test/build suite, and create the local release commit on `main` (preserving `e85f15b`).

### Phase C — Hostinger Production Infrastructure (`INFRASTRUCTURE ACTION REQUIRED`)
1. Remove old Razorpay values from staging `/srv/mangal-royal-studio/app/.env.example` (without disrupting staging containers).
2. Provision `/srv/mangal-royal-studio-prod/` with isolated `mrs_prod_postgres`, `mrs_prod_api`, `mrs_prod_storefront`, `mrs_prod_admin` (loopback/SSH-only), and `mrs_prod_network`.
3. Generate a unique 64-char production `JWT_SECRET` and restricted `mrs_prod_app` PostgreSQL credentials.
4. Run `prisma migrate deploy` on `mangal_royal_studio_prod` after taking a verified pre-migration `pg_dump` backup.
5. Provision the production `OWNER` account interactively (`MRS_PRODUCTION_OWNER_SETUP_GUIDE.md`) and publish the owner-approved Rate Card.
6. Configure Nginx/Caddy HTTPS reverse proxy and SSL certificate for the canonical `.com` domain.

### Phase D — Origin Smoke Tests, DNS Cutover & Post-Launch Verification
1. Run direct-origin smoke tests (8 ACTIVE products: 6 priced + 2 POR; 272 drafts inaccessible; Admin private; DB private; enquiry/contact flow verified; payments/shipping safely disabled).
2. Record DNS rollback snapshot, update only website A/AAAA/CNAME records (preserving MX/SPF/DKIM/DMARC/TXT), and verify external HTTPS + canonical redirects.
3. Deliver final launch reports (`MRS_PRODUCTION_DEPLOYMENT_REPORT.md` through `MRS_OWNER_PRODUCTION_HANDOVER.md`).
