# MRS Hostinger Infrastructure Report

- **Date / Time:** `2026-11-23 21:22 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`)
- **Source Commit:** `ad96cb0` on `main` (preserving `e85f15b`, `858ac4b`, `f24dcb6`, `cb8bc67`)
- **Release Artifact:** `/tmp/mrs-release-ad96cb0.tar.gz` (`bc5517e4e4ce0d03aa60c2fe761877c6aead551ee34a79cb1d89910fbccb3a16`)
- **Hostinger Deployment Identity:** `srv2177504` (`189.72.158.142`, Ubuntu `7.0.0-38-generic`, 2 vCPU, 7.7 GiB RAM, 86 GB free disk)
- **Production Database Identity:** `mangal_royal_studio_prod` (`mrs_prod_postgres`, healthy on `mrs_prod_network`)
- **Migration List:** `20261105000000_init_complete_platform`, `20261112000000_phase1_runtime_completion`, `20261112180000_phase2_customization_and_3d_assets`
- **Backup Checksum:** `427a3ab2a5467d2600150b9a9b59d2e40e650ee010d57188e390119703d4cce6` (post-migration)
- **Product Counts:** `0` in `mangal_royal_studio_prod` (awaiting selective transfer of `8` verified `ACTIVE` products; `272` drafts excluded)
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED` (`CATALOGUE_ENQUIRY_MODE=true`)

## Provisioned & Verified on Hostinger (`srv2177504`)
- **SSH Configuration:** Configured `~/.ssh/config` (`mrs-vps-root` and `mrs-vps` for `mrsdeploy`), verified ED25519 host key against `~/.ssh/known_hosts` (`StrictHostKeyChecking yes`).
- **Production Directory:** `/srv/mangal-royal-studio/production/` (`releases/ad96cb0`, `secrets/` `chmod 700`, `backups/`, `product-assets/`).
- **Production Containers (`mrs_prod`):**
  - `mrs_prod_postgres`: Up (healthy), internal `mrs_prod_network` only (no host port).
  - `mrs_prod_api`: Up (healthy), `127.0.0.1:4100->4000/tcp`.
  - `mrs_prod_storefront`: Up, `127.0.0.1:3100->3000/tcp`.
  - `mrs_prod_admin`: Up, `127.0.0.1:3101->3001/tcp` (SSH tunnel only).
- **Staging Preserved:** All staging containers (`mrs_postgres`, `mrs_api`, `mrs_storefront`, `mrs_admin`, `mrs_showcase_proxy`, `mrs_showcase_tunnel`) untouched and healthy.
- **Nginx & Backups:** Installed `nginx` + `certbot` (`python3-certbot-nginx`), configured pre-TLS vhost (`/api/v1/health` `200`, `/` `200`, `/robots.txt` `200`, `/sitemap.xml` `200`, `/admin` `404`, `/api/v1/admin/overview` `403`), and enabled daily `02:00 UTC` `pg_dump -Fc` backups (`/usr/local/bin/mrs-prod-backup.sh`).
