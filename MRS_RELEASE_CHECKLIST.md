# Mangal Royal Studio — Release Readiness Checklist

*Updated 2026-11-21. Evidence: `MRS_AUDIT_EVIDENCE/run-20261121T233202/`.*

## Automated & local verification
- [x] Typecheck, 4 workspaces: PASS (`10-typecheck.log`)
- [ ] Lint: **NOT CONFIGURED.** No lint script or ESLint config exists in any workspace.
- [x] Tests: **215/215 PASS**. Shared 45 (incl. 29-case pricing matrix) · API 163 (incl. PostgreSQL runtime E2E, RBAC, webhooks, imports, 13 public-exposure/POR/logout tests) · Storefront 7 (`11-tests.log`)
- [x] Production builds, 4 workspaces: PASS (`12-build.log`); client bundles contain no rate card, secrets or DB URL
- [x] Engine = owner workbook formula on 222/222 priced rows; independent cross-check 8/8
- [x] Local HTTP smoke + RBAC against PostgreSQL: 59/59 PASS (`http-smoke-security-local.log`)
- [ ] Browser E2E / screenshots: **NOT RUN** (no Chrome/Playwright; the download stalled)
- [x] Protected JSON hashes unchanged; theme folders untouched; workbook git-ignored

## Staging (temporary showcase)
- [x] DB backup taken and verified (`pg_restore --list`), SHA-256 recorded; rollback images tagged
- [x] App deployed, containers healthy, ports loopback-only, Postgres not published, UFW unchanged
- [x] Proxy read-only acceptance 95/95; case-bypass fixed; security headers added
- [x] OTP allow-list = [OWNER_EMAIL] (tunnel log); unauthenticated → Cloudflare login
- [ ] **Owner publishes the approved rate card in staging Admin** (staging still on placeholder rates, so showcase prices are NOT owner-approved)
- [ ] Owner confirms OTP access works from the manishop6789 inbox
- [ ] Rotate staging admin passwords if they match the dev seed

## Commercial sign-offs required for full GO
- [ ] GST for 22K and Platinum 950
- [ ] Rate for exactly 1.00 ct total diamond weight
- [ ] 24K rate (only if 24K will be sold)
- [ ] Real specifications for the 272 supplier SKUs (`MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv`) and real photography
- [ ] Policy: should MANAGER / PRICING_OPERATOR be allowed to publish live rates?
- [ ] Brand social profile URLs; engagement offer % (strip hidden until set)

## Before any production launch (not authorised in this release)
- [ ] Permanent domain + named Cloudflare Tunnel/Access (Quick Tunnel is temporary)
- [ ] Production secrets, Razorpay live, Shiprocket, email provider, each separately verified
- [ ] Persistent session revocation (currently in-memory) and HSTS at the edge
