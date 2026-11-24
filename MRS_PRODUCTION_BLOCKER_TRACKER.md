# MRS Production Blocker Tracker

- **Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean`
- **Base Commit:** `e85f15b` (`main`, preserved intact)
- **Date:** 2026-11-22
- **Overall Release Status:** **BLOCKED — OWNER & INFRASTRUCTURE ACTIONS REQUIRED**

---

## 1. Master Blocker & Readiness Classification

Every item is classified strictly as one of: `OWNER ACTION REQUIRED`, `CODE CHANGE REQUIRED`, `INFRASTRUCTURE ACTION REQUIRED`, or `VERIFIED`.

### A. Security & Credential Gates
| Item | Classification | Evidence / Current State |
|---|---|---|
| Three staging Admin password rotations (`OWNER`, `MANAGER`, `PRICING_OPERATOR`) | `OWNER ACTION REQUIRED` | Unconfirmed in `MRS_FRESH_REPOSITORY_READINESS.md` §3 and `MRS_FINAL_COMMIT_REVIEW.md`. No authentication attempted with old credentials. |
| Three development Admin password rotations | `OWNER ACTION REQUIRED` | Unconfirmed in `MRS_FRESH_REPOSITORY_READINESS.md` §3. Local `.env` / dev DB rotation not confirmed. |
| Demo-customer password rotation | `OWNER ACTION REQUIRED` | Unconfirmed in `MRS_FRESH_REPOSITORY_READINESS.md` §3. |
| Razorpay test Key Secret rotation | `OWNER ACTION REQUIRED` | Unconfirmed in `MRS_FRESH_REPOSITORY_READINESS.md` §3 and `MRS_CREDENTIAL_REMEDIATION_REPORT.md` §3. |
| Removal of old Razorpay values from staging `/srv/mangal-royal-studio/app/.env.example` | `INFRASTRUCTURE ACTION REQUIRED` | Unconfirmed on staging VPS (`MRS_CREDENTIAL_REMEDIATION_REPORT.md` §3 notes staging `app/.env.example` still holds the old value; `.env.app` does not). |
| Access restriction & retention verification for the two staging backup tarballs | `OWNER ACTION REQUIRED` | Two app-source tarballs on staging VPS contain the old `.env.example` value (`MRS_CREDENTIAL_REMEDIATION_REPORT.md` §3); owner retention/chmod verification unconfirmed. |
| Removal of hardcoded seed credentials from source & client bundles | `VERIFIED` | `credential-hygiene.test.ts` (10/10 pass); secret scan across clean repo shows 0 real secrets; `.gitignore` excludes `.env*` (except `.env.example`), dumps, keys. |
| Non-production JWT fallback & production fail-closed `JWT_SECRET` | `VERIFIED` | `services/api/src/middleware/auth.ts` uses per-process random bytes outside production and fails closed in production if `JWT_SECRET` is absent or weak. |

### B. Database Isolation & Testing
| Item | Classification | Evidence / Current State |
|---|---|---|
| Dedicated `mangal_royal_studio_test` database provisioned & migrated | `VERIFIED` | Created `mangal_royal_studio_test` on `localhost:5432`, applied all 3 Prisma migrations (`prisma migrate deploy`), seeded synthetic data + roles/permissions + Phase 2 customization. |
| Runtime DB identity guard (`assertIsolatedTestDatabase`) | `VERIFIED` | Added `services/api/src/test-support/test-db.ts` and wired `postgres-integration.test.ts`, `postgres-runtime.e2e.test.ts`, `phase2-acceptance-audit.test.ts`, and `phase2-postgres.integration.test.ts` to refuse `mangal_royal_studio_dev`, `mangal_royal_studio_staging`, or any non-`*_test` DB. |
| Full `@mrs/api` suite (including previously skipped 27 tests) | `VERIFIED` | **13/13 files, 176/176 tests PASS** (0 skipped) against `mangal_royal_studio_test`. |
| Dedicated production PostgreSQL database (`mrs_prod_postgres`) | `INFRASTRUCTURE ACTION REQUIRED` | Not yet provisioned on Hostinger VPS; must be isolated from `mangal_royal_studio_dev`, `mangal_royal_studio_staging`, and `mangal_royal_studio_test`. |

### C. Pricing Governance & Catalogue
| Item | Classification | Evidence / Current State |
|---|---|---|
| Exactly `1.00 ct` diamond: Price on Request | `VERIFIED` | Already enforced in `packages/shared/src/pricing-engine.ts` and covered by `pricing-matrix.test.ts` (35/35 pass). |
| `22K` and `Platinum 950` GST: fail-closed (Price on Request) | `VERIFIED` | Already enforced in `packages/shared/src/pricing-engine.ts` until exact GST treatment is approved. |
| `RATES_WRITE`: restrict to `OWNER` only | `CODE CHANGE REQUIRED` | `packages/shared/src/types.ts` lines 58 (`MANAGER`) and 78 (`PRICING_OPERATOR`) still include `RATES_WRITE`, and `services/api/src/app.test.ts` line 773 asserts it. Pending explicit owner sign-off to apply. |
| 272 incomplete supplier products remain `DRAFT` | `VERIFIED` | `MRS_FINAL_CATALOGUE_RECONCILIATION.md` confirms 8 `ACTIVE` (6 priced + 2 POR) and 272 `DRAFT`. |

### D. Domain, Hostinger Infrastructure & Owner Account
| Item | Classification | Evidence / Current State |
|---|---|---|
| Canonical `.com` domain & authoritative DNS provider confirmation | `OWNER ACTION REQUIRED` | No `.com` domain is confirmed in repo docs; `HOSTINGER_VPS_INITIAL_SETUP_REPORT.md` mentions GoDaddy DNS while the launch scope specifies Hostinger DNS. |
| Production VPS target IP / SSH alias (`~/.ssh/config`) | `INFRASTRUCTURE ACTION REQUIRED` | VPS IP is redacted (`[STAGING_SERVER_IP]`) in clean repo reports and not present in `~/.ssh/config`. |
| Production Docker stack, reverse proxy & TLS certificates | `INFRASTRUCTURE ACTION REQUIRED` | Separate `mrs_prod_*` containers, `mrs_prod_network`, Nginx/Caddy HTTPS vhost, and SSL certificates not yet provisioned. |
| Production Owner Admin account provisioning | `OWNER ACTION REQUIRED` | Requires owner-supplied strong password via interactive/stdin one-time procedure (`MRS_PRODUCTION_OWNER_SETUP_GUIDE.md`). |
| SEO files (`robots.ts`, `sitemap.ts`) in `apps/storefront/src/app/` | `CODE CHANGE REQUIRED` | Not yet present in `apps/storefront/src/app/`. |

### E. Source & Release Verification
| Item | Classification | Evidence / Current State |
|---|---|---|
| Base commit `e85f15b` preserved | `VERIFIED` | `git log -n 1` shows `e85f15b` intact on `main`. |
| Local TypeScript & workspace builds | `VERIFIED` | `npm run typecheck` (4/4) and production builds (`@mrs/shared`, `@mrs/api`, `@mrs/storefront`, `@mrs/admin`) all exit `0`. |
| Release commit in `mangalroyalstudio-clean` | `CODE CHANGE REQUIRED` | Uncommitted test-isolation & DB-guard changes + pending `RATES_WRITE` / SEO changes require final review and local commit before release transfer. |
