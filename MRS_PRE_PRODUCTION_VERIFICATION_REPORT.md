# MRS Pre-Production Verification Report

**Date:** 2026-11-22, 12:32–13:05 IST (07:02–07:35 UTC) · **Environments:** local Mac (`mangal_royal_studio_dev`) and VPS staging (`mangal_royal_studio_staging`, container `mrs_postgres`, unpublished). Credentials not shown.
**Git:** `main` @ `c7de1bc` (1 commit, **no remote**), plus an uncommitted working tree. **Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-preprod/`
**Not done (by instruction):** no production deployment, no DNS change, no live integrations, no product activation, no data writes.

## Release decision: **CONDITIONAL PASS** (staging only). **Not production-ready.**
Mandatory items 5 and 6 cannot run until the owner publishes the approved rate card on staging. Browser verification passed every functional and security check, but real-price display could not be tested yet and three low-severity showcase findings (B1–B3) remain.

| # | Item | Status |
|---|---|---|
| 1 | Test-count reconciliation | **PASS** |
| 2 | Working-tree changes / no unrelated files | **PASS** for this task's changes, with 2 repository-hygiene findings |
| 3 | Test-only changes not pushed or deployed | **PASS** |
| 4 | Staging version and data unchanged | **PASS** |
| 5 | Active rate version and pricing rules after owner publication | **NOT RUN**: blocked, staging still on placeholder card v1 |
| 6 | Six priced products vs independent calculation (live staging) | **NOT RUN** live (blocked by 5); pre-verified on the deployed engine 8/8 |
| 7 | Two Price-on-request products protected | **PASS** (current state); re-check the specific reasons after 5 |
| 8 | Real-browser tests on the staging showcase | **PASS** for 46/46 functional & security checks · **FAIL** (low severity) on a clean console · **NOT RUN** for real-price display (blocked by 5) |
| 9 | No incomplete supplier products activated | **PASS** |
| 10 | No DNS / live integrations / production deploy | **PASS** |

## 1. Test-count reconciliation: PASS
Evidence: `MRS_AUDIT_EVIDENCE/run-20261122-isolation/0[1-5]-*.log` (per-file listings).

| Run | Executions | Files | Contained in another run? |
|---|---|---|---|
| Importer | 8 | `import-json-to-postgres.test.ts` | **Yes**, it is 1 of the API run's 12 files |
| API (all) | 166 | 12 files: 26+35+5+8+5+5+47+9+5+5+1+15 = 166 | — |
| Storefront | 10 | `storefront-helpers.test.ts` | No |
| Shared pricing | 51 | 5 + 11 + 35 | No |
| Security & pricing regression | 60 | `postgres-runtime.e2e` 5 + `phase3-admin-operations` 35 + `phase2-api-security` 5 + `public-catalogue-exposure` 15 | **Yes**, all 4 files are in the API run |

**Executions: 295. Unique tests: 227** (166 API + 10 storefront + 51 shared). The importer (8) and regression (60) runs re-executed 68 tests already counted in the API run. The previously reported "227" is the unique count; all 295 executions passed.

## 2. Git working tree: PASS (with hygiene findings)
Evidence: `10-git-state.log`, `11-local-vs-staging-source.log`.
- HEAD `c7de1bc`, branch `main`, 1 commit, no remote. 40 tracked files modified, 144 untracked.
- Compared with the session-start snapshot (2026-11-21), the only tracked file newly modified is `apps/storefront/next.config.ts` (the staging `/api` rewrite merge, 2026-11-21). The other 39 modified tracked files were already modified before this work.
- **The test-isolation task changed exactly 3 files**, and none were deployed: `apps/storefront/src/lib/storefront-helpers.test.ts`, `apps/storefront/src/test-support/isolated-api.ts` (new) and `services/api/src/scripts/import-json-to-postgres.test.ts`. Proven by a file-by-file SHA-256 comparison with staging: 108 local vs 107 staging files, and those 3 are the only differences.
- Theme folders: 0 changes. The pricing workbook is git-ignored.

**Findings (pre-existing, not caused by this work, but release risks):**
- **H1. Most of the application is not in version control.** The repositories, runtime backend, sessions, migrations 2–3, Razorpay, importer, token revocation and most tests are untracked. The commit hash does not identify the deployed code; the staging tree plus its SHA-256 list is the only exact record. Commit the source before any production release.
- **H2. Database dump inside the repo, not ignored:** `backups/pre_hygiene_phase2_mangal_royal_studio_dev.dump`. It could be committed by accident; add `backups/` and `*.dump` to `.gitignore` or move it out.

## 3. Not pushed or deployed: PASS
No Git remote exists (so nothing can have been pushed), HEAD is unchanged, and the 3 test-only files differ from the staging tree (§2). Test files are also excluded from images by `.dockerignore`, and the harness file is not imported by any route.

## 4. Staging version and data: PASS
Evidence: `12-staging-version-and-data.log` (07:03 UTC).
- Running images equal the 2026-11-22 deployment: `mrs_api 1c1c9279…`, `mrs_storefront a424569f…`, `mrs_admin 166badd5…`, all healthy, started 06:32–06:33 UTC. Postgres untouched since 2026-11-19.
- Data: ACTIVE 8 (same SKUs), DRAFT 272, images 3,122, orders 3, customers 3; **0 audit entries and 0 product updates since the deploy**; 17 carts, all from before 2026-11-14 (none created by these tests).

## 5. Rate version and pricing rules: NOT RUN (blocked)
Staging still holds **placeholder rule v1** and placeholder rates (18K ₹5,740/g etc.; no audit entry since deploy), so the owner has not published the approved card. Until then every product is Price on request (fail-closed, verified).
**To complete:** after the owner publishes, check that the active rule is a new APPROVED, non-placeholder version with 14K 10,200 · 18K 12,300 · 22K 11,510 · Pt950 3,911 · making 2,500 · <1 ct 30,000 · >1 ct 45,000; GST 14K/18K = 3%; 22K/Pt and exactly 1.00 ct = Price on request.

## 6. Six priced products: NOT RUN on live staging prices
Pre-verification (`MRS_AUDIT_EVIDENCE/run-20261122-final/43-deployed-engine-independent-comparison.log`): the **deployed** `mrs_api` engine, given the staging product specs and the approved card, matches an independent formula **8/8**: RNG-1001 ₹1,39,040 · RNG-1002 ₹1,10,498 · BRC-3001 ₹3,43,938 · PND-4001 ₹30,818 · BNG-5001 ₹3,09,227 · NCK-6001 ₹6,46,881. This is not a substitute for checking the live staging catalogue after publication.

## 7. Price-on-request protection: PASS (current state)
Evidence: `20-por-protection.log`. MRS-EAR-2001 and MRS-ANT-7001: detail 200 with `priceOnRequest=true`, stored public price 0.00, label "Price on request". Cart with a client price of ₹100 → 422 `PRICE_ON_REQUEST`; checkout with ₹100 → 422. Currently the reason is `PRICING_RULE_NOT_APPROVED`. After publication the reasons must become `DIAMOND_RATE_MISSING_EXACT_1CT` and `GST_UNCONFIRMED_FOR_PURITY` (shown on the deployed engine, §6 log).

## 8. Browser tests
**Executed** with real headless Chromium 131 (Playwright 1.49.1, build 1148, fetched directly from Playwright's CDN because its installer stalled), desktop 1440×900 and mobile 390×844 (touch), against the staging showcase origin: the VPS proxy `127.0.0.1:8080` over an SSH forward, which is exactly what the OTP-protected tunnel serves. The public URL itself requires the email PIN, which I cannot receive. Evidence: `30-browser/browser-e2e.log` (50 checks), `30-browser/network-diagnostics.log`, 9 screenshots.

| Area (both viewports) | Result |
|---|---|
| Home loads, no horizontal overflow | PASS |
| Listing: all 8 ACTIVE products, 16/16 images load, labels match API | PASS |
| Detail pages: 8/8 load, label = API, all product images load | PASS |
| Cart: Price-on-request product has 0 enabled add-to-cart buttons; cart stays empty | PASS |
| Price manipulation: planted ₹1 cart line in browser storage → checkout POST refused (403), direct browser fetch refused (403); no order created | PASS |
| Draft product (`SKUBGG00002`): page "not found", API 404 | PASS |
| Admin privacy: `/admin` 404; `/api/v1/admin/products`, `/api/v1/admin/rates/market-card`, `/API/v1/admin/products` 403; no admin content | PASS |
| **Clean console / no failed requests** | **FAIL (low severity)**, see below |
| **Real prices displayed consistently** | **NOT RUN**: every product is Price on request until item 5; label consistency (Price on request) passed |

**Failure analysis** (`network-diagnostics.log`, normal browsing without probes):
- **B1 (low):** every page calls `GET /api/v1/auth/customer/me` (session check), which the read-only proxy blocks with **403**, logging a console error on every page. The block is intended; the noise is not. Fix options: have the storefront skip the session check when in showcase mode, or have the proxy answer that one path with a JSON 401 "not signed in".
- **B2 (low):** product pages auto-POST `/api/v1/public/customization/quote`, which the proxy blocks (403). The customizer shows option surcharges (e.g. "Size 18 +₹1,200") but cannot quote.
- **B3 (low, UX/information):** the product page shows the internal reason code to customers: *"Price on request (PRICING_RULE_NOT_APPROVED)"* (`30-browser/desktop-pdp-MRS-RNG-1001.png`). Show customer-friendly text instead.
- The `net::ERR_ABORTED` entries are all Next.js link **prefetches** (`rsc=1`, `next-router-prefetch=1`) cancelled by navigation. Benign; not an error.

None of these was fixed in this task (verification only; changing the proxy or redeploying was not requested).

## 9. Supplier products: PASS
272 drafts are unchanged (no activation, no data written). No spec template rows have been filled.

## 10. Scope limits: PASS
No production deployment, no DNS change, no integration enabled (Shopify dry-run with no token; Razorpay test mode; no Shiprocket/email credentials, per `/health`). Nothing committed or pushed.

## What must happen before production
1. Owner publishes the approved rate card on staging, then re-run items 5–7 and the browser pricing checks with real prices.
2. Commit the full application source (H1); ignore or move the DB dump (H2).
3. Resolve the commercial decisions (22K/Pt GST, exactly 1.00 ct, who may publish rates) and supplier specifications.
4. Fix B1–B3 (console noise from the blocked session check, customizer behaviour on the showcase, internal reason code shown to customers) and re-run the browser suite with real prices.
5. A permanent domain, production secrets and integrations, each separately authorised.
