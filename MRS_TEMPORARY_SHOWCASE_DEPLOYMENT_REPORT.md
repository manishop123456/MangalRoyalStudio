# Mangal Royal Studio — Temporary Showcase Deployment Report

**Deployed:** 2026-11-21 18:46:07–18:46:34 UTC (00:16 IST, 22 Nov) · **Environment:** Hostinger VPS staging (`mrsdeploy`, SSH key only) · **Main domain / DNS:** untouched

## 1. What is running

| Component | State |
|---|---|
| Public URL (temporary) | **https://michelle-den-comedy-legs.trycloudflare.com**, a Cloudflare Quick Tunnel. Not permanent: it changes whenever the tunnel container is recreated or the VPS restarts. The previous URL (`ted-inflation-adapters-carolina…`) now returns 530. |
| Access control | Cloudflare One-Time PIN. Allowed recipient: **[OWNER_EMAIL]** (changed from `owner@mangalroyalstudio.com`). Tunnel log confirms "Authentication: One-Time PIN (using Cloudflare Access) · Allowed recipients: 1 address". |
| `mrs_api` / `mrs_storefront` / `mrs_admin` | new images, healthy, bound to `127.0.0.1:4000/3000/3001` only |
| `mrs_postgres` | untouched (not recreated, volume intact, port 5432 not published) |
| `mrs_showcase_proxy` (nginx) | read-only allowlist, hardened config reloaded (see §4) |
| `mrs_showcase_tunnel` | recreated from the same local image `sha256:e613aadb…` (no pull), restart policy now `unless-stopped` (was `no`) |
| Database | `mangal_royal_studio_staging`. No data written by this deployment, **no migration needed** (schema and all 3 migrations byte-identical, all applied). |

**Deployed code:** git base `c7de1bc` plus the working-tree changes listed in the final report (no commit made). 29 source files synced; images `mrs-api:staging sha256:da307613…`, `mrs-storefront:staging sha256:8d40acf4…`, `mrs-admin:staging sha256:c7c194c4…`.

## 2. Backups and rollback

| Item | Path on VPS | SHA-256 / check |
|---|---|---|
| DB (custom format) | `/srv/mangal-royal-studio/backups/staging_pre_deploy_mangal_royal_studio_staging_20261121T183943Z.dump` | `fe7dd9a9d12342365b8e50bfcf9c687e1ffa1e1f62f32e7c4cc6c77e1fc60200`; `pg_restore --list` OK: dbname `mangal_royal_studio_staging`, 261 TOC entries, 48 table-data entries |
| App source | `…/backups/app_source_pre_deploy_20261121T183943Z.tgz` | `0c120080fe98dda6cccf81f954f5a922e2ac678412cacbfd846fb29b68064b1b` |
| Deployment config | `…/backups/deployment_config_pre_deploy_20261121T183943Z.tgz` | `10660122fd5e6966af96c1b45aabd04abd22c986ae69eeea49bf0ba2a6a7faeb` |
| nginx config before hardening | `…/backups/nginx-showcase.conf.pre_hardening_20261121T183943Z` | |
| Previous images | `mrs-api:rollback-20261121T183943Z` (`cca3ae8d…`), `mrs-storefront:rollback-…` (`bd694496…`), `mrs-admin:rollback-…` (`66ad322c…`) | kept |
| Previous tunnel | container `mrs_showcase_tunnel_old_20261121T183943Z` (stopped), command saved in `…/backups/tunnel_cmd_pre_deploy_20261121T183943Z.json` | |

**Rollback (app only; the DB is not touched):**
```bash
cd /srv/mangal-royal-studio/deployment
for s in api storefront admin; do docker tag mrs-$s:rollback-20261121T183943Z mrs-$s:staging; done
docker compose -f docker-compose.app.yml up -d --no-deps --no-build mrs_api mrs_storefront mrs_admin
# proxy config: cat ../backups/nginx-showcase.conf.pre_hardening_20261121T183943Z > nginx-showcase.conf && docker exec mrs_showcase_proxy nginx -s reload
```
Restore the DB only if data is damaged, after a fresh backup, with `pg_restore --clean` into `mangal_royal_studio_staging`. That is a destructive action and needs explicit approval.

## 3. Verification results

| Test (evidence in `MRS_AUDIT_EVIDENCE/run-20261121T233202/`) | Result |
|---|---|
| Public vantage (`40-public-url-otp-verification.log`): HTTPS; plain HTTP → 301 HTTPS; every path (`/`, catalogue, `/api/v1/admin`, `/api/v1/auth/login`, `/admin`) → 302 to Cloudflare login; POST/PUT/PATCH/DELETE → 401 | **PASS** |
| Approved visitor's view through the proxy (`41-showcase-proxy-acceptance.log`): pages 200, catalogue API, only ACTIVE, no internal fields, list = detail price, all 8 images load, draft 404/absent from search, 15 sensitive routes 403, 24 write attempts 403, 10 path/case-bypass attempts blocked, no stack/internal leaks, no `X-Powered-By`, CORS not reflected | **95/95 PASS** |
| Direct reachability of ports 3000/3001/4000/5432/8080/20241 on the public IP | all unreachable; UFW deny-by-default, only 22/80/443 allowed (unchanged) |
| Admin | reachable **only** via SSH port-forward (200 on `127.0.0.1:3001`); `/admin` and `/api/*/admin` blocked publicly |
| Navigation/footer (`43-storefront-nav-footer-audit.log`) | the 6 required nav items and 16 footer links present; 31 internal routes 200; 0 dead `#` links; no review stars; no literal "x%" |
| OTP login with the approved email | **NOT VERIFIED.** Needs the inbox owner to request and enter the PIN. The allow-list is confirmed from the tunnel log only. |
| Browser E2E / screenshots | **NOT RUN.** No Chrome/Playwright on this Mac; the Playwright Chromium download stalled (~160 KB in 15 min) and was stopped. HTTP-level SSR checks above were run instead. |

## 4. Security changes made on staging

1. **Proxy case-bypass closed.** `/API/v1/admin/...` previously passed the case-sensitive nginx rules and reached the API (it still required login, so no data leaked). All rules are now case-insensitive, any other `/api` path in any case is denied, and `cart`, `wishlist`, `health`, `docs.json`, `roles` and `public/pricing` are explicitly denied.
2. `X-Powered-By` hidden; `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` added.
3. The app source directory was world-writable (135 entries, `drwxrwxrwx`); `o-w` removed.
4. Tunnel restart policy `unless-stopped`, so it recovers after a crash or reboot (with a **new URL**, read via `docker logs mrs_showcase_tunnel | grep trycloudflare`).

## 5. Open items

1. **Prices on the showcase are not yet owner-approved.** The staging DB still has the placeholder rate card, so the 7 priced products show old stored prices, and `MRS-EAR-2001` shows ₹40,648 although the owner rule makes it Price on request. Fix: the owner signs in to staging Admin (SSH tunnel) and publishes the rate card once (`MRS_OWNER_QUICK_START.md` §4). I did not do this, because signing in to staging Admin with the repository's dev-seed passwords was blocked as unauthorized access.
2. **Staging admin accounts appear to come from the dev database restore** (`staging_ready_mangal_royal_studio_dev_20261119.dump`). If their passwords are the dev-seed values committed in `services/api/src/db/seed-dev-auth.ts`, rotate them before any wider use. This was not tested (see 1).
3. cloudflared metrics listen on `*:20241` (blocked by UFW). Optionally add `--metrics 127.0.0.1:20241`.
4. Session revocation on logout is in-memory: it resets if the API restarts, after which old tokens last until normal expiry (24 h).
5. Instagram/LinkedIn footer links point to the sites' home pages; the owner should supply profile URLs. "Bridal Sets" → `/collections/antique`; "Virtual Try-On" opens the `MRS-RNG-1001` customizer.
