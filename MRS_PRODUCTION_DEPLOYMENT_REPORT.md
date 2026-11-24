# MRS Production Deployment Report

- **Date / Time:** `2026-11-23 21:22 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`, `www` → `301` → apex configured in `deploy/production/nginx-production.conf`)
- **Source Commit:** `ad96cb0` on `main` (preserving `e85f15b`, `858ac4b`, `f24dcb6`, `cb8bc67`)
- **Release Artifact:** `/tmp/mrs-release-ad96cb0.tar.gz` (`bc5517e4e4ce0d03aa60c2fe761877c6aead551ee34a79cb1d89910fbccb3a16`)
- **Hostinger Deployment Identity:** `srv2177504` (`189.72.158.142`)
- **Production Database Identity:** `mangal_royal_studio_prod` (`mrs_prod_postgres`)
- **Migration List:** `20261105000000_init_complete_platform`, `20261112000000_phase1_runtime_completion`, `20261112180000_phase2_customization_and_3d_assets`
- **Backup Checksum:** `427a3ab2a5467d2600150b9a9b59d2e40e650ee010d57188e390119703d4cce6`
- **Product Counts:** `0` in prod (pending selective transfer of `8` verified `ACTIVE` products; `272` drafts excluded)
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED` (`CATALOGUE_ENQUIRY_MODE=true`)
- **Release Decision:** **FAIL — PRODUCTION LAUNCH BLOCKED** (origin stack live internally; public DNS cutover & TLS issuance paused pending owner security rotations, interactive `OWNER` setup, and Rate Card / catalogue transfer)

## Summary of Executed Deployment Steps
1. Added `CATALOGUE_ENQUIRY_MODE=true` startup config support (`ad96cb0`) and verified `auth-config.test.ts` (`6/6` PASS).
2. Verified SSH (`mrs-vps-root` & `mrs-vps`), transferred `/tmp/mrs-release-ad96cb0.tar.gz` with matching SHA-256, and extracted to `/srv/mangal-royal-studio/production/releases/ad96cb0`.
3. Generated isolated production secrets in `/srv/mangal-royal-studio/production/secrets/` (`chmod 600`), started `mrs_prod_postgres`, took verified pre- and post-migration backups, ran `prisma migrate deploy`, and seeded `3` roles + `24` permissions (`userCount: 0`).
4. Built and started `mrs_prod_api` (`127.0.0.1:4100`), `mrs_prod_storefront` (`127.0.0.1:3100`), and `mrs_prod_admin` (`127.0.0.1:3101`).
5. Installed `nginx` and `certbot`, verified direct-origin smoke tests (`/api/v1/health` `200`, `/` `200`, `/robots.txt` `200`, `/sitemap.xml` `200`, `/admin` `404`, `/api/v1/admin/overview` `403`).
