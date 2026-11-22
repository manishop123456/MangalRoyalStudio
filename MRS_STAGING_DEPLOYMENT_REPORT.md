# MRS Staging Deployment Report

**Status: CONDITIONAL PASS — STAGING DEPLOYED WITH BLOCKED PRODUCTS**

**Deployed:** 2026-11-22 06:32:50 → healthy 06:33:15 UTC (12:03 IST) · **Target:** existing Hostinger VPS staging (`mrsdeploy`, SSH key only). **Production, main domain and DNS: untouched.**
**Code:** `main` @ `c7de1bc` + working tree (not committed). 9 files synced (engine, types, app, runtime backend, tests).
**Images:** `mrs-api:staging sha256:1c1c9279…` · `mrs-storefront:staging sha256:a424569f…` · `mrs-admin:staging sha256:166badd5…`
**Database:** `mangal_royal_studio_staging` (verified by `current_database()` before backup). **No migration** (schema unchanged); no data written.

## Backup
`/srv/mangal-royal-studio/backups/staging_pre_deploy_mangal_royal_studio_staging_20261122T063149Z.dump`
SHA-256 `2693274674e0ded825d324b5908de87a4f207a901f6475f5f3595a89e5370e72` · `pg_restore --list`: dbname `mangal_royal_studio_staging`, 261 TOC entries, 48 table-data entries.
Also: `app_source_pre_deploy_20261122T063149Z.tgz` (`e7021dcd…`), `deployment_config_pre_deploy_20261122T063149Z.tgz` (`c5d7cac2…`), images tagged `rollback-20261122T063149Z`.

## Commands executed (on the VPS, via SSH)
`pg_dump -Fc` → `pg_restore --list` → `sha256sum` → `tar` app/deployment → `docker tag … rollback-…` → `rsync` (code dirs only, no `--delete`) → `docker compose -f docker-compose.app.yml build` → `docker compose … up -d --no-deps mrs_api mrs_storefront mrs_admin`. Postgres, proxy and tunnel were not recreated.

## Post-deployment verification (all executed; logs in `MRS_AUDIT_EVIDENCE/run-20261122-final/`)
| Check | Result |
|---|---|
| Containers healthy; ports bound to 127.0.0.1 only; 5432 unpublished; public-IP ports 3000/3001/4000/5432/8080 unreachable | PASS |
| Proxy acceptance (approved visitor's view): pages, catalogue = 8 ACTIVE, no internal fields, list = detail = collection, 8/8 images load, draft hidden, 15 sensitive routes 403, 20 write attempts 403, 7 path/case tricks blocked, no leaks, headers, CORS | **79/79 PASS** |
| **No unapproved price visible:** all 8 products Price on request (`PRICING_RULE_NOT_APPROVED`) because staging still holds the placeholder card | PASS (expected fail-closed) |
| Direct API: client-price cart 422, checkout 422, draft 404, admin 401, malformed 400, Shopify dry-run, no DB writes | PASS |
| Deployed engine vs independent formula (approved card, staging specs) | **8/8 MATCH** |
| Public URL https://michelle-den-comedy-legs.trycloudflare.com: HTTPS, every path → Cloudflare OTP, POST 401, HTTP→HTTPS; allow-list = [OWNER_EMAIL] | PASS (OTP login itself not performed; needs the inbox) |
| Admin | reachable only through an SSH port-forward (200) |
| Payment / shipping / email | Razorpay test mode, Shopify writes off, no Shiprocket/email credentials configured |
| Browser E2E / screenshots | **NOT RUN** (no browser tooling; the Playwright download stalled on 2026-11-21) |

## Why CONDITIONAL
1. **The approved rate card is not yet published on staging**, so every product shows Price on request. The owner publishes it once in staging Admin (`MRS_OWNER_LAUNCH_CHECKLIST.md` step 1). Expected prices afterwards are in `MRS_FINAL_PRICING_ENGINE_AUDIT.md` §4.
2. 272 drafts have no specifications; 2 ACTIVE products are Price on request by owner decision.
3. Two tests failed for environmental reasons (owner's local server/data), documented in the pricing audit; lint is not configured; browser E2E not run.
