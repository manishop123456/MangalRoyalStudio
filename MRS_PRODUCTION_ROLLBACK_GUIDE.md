# MRS Production Rollback Guide

- **Date / Time:** `2026-11-23 19:45 IST`
- **Production Domain:** `PENDING OWNER CONFIRMATION`
- **Source Commit:** `f24dcb6` (base commit `e85f15b` preserved)
- **Release Artifact SHA-256:** `4523592c39cc96263ef1c09be24e3494d4d8133f0e6ec4455ecfb1001716ddf1`
- **Hostinger Deployment Identity:** `srv2177504`
- **Production Database Identity:** `mangal_royal_studio_prod` (pending)
- **Migration List:** 3 additive Prisma migrations
- **Backup Checksum:** `N/A — no production state created yet`
- **Product Counts:** `8` ACTIVE, `272` DRAFT
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED`

## Rollback Procedures
1. **DNS Rollback (GoDaddy):** Restore the pre-cutover exported apex `A` and `www` `CNAME` records with original TTLs; leave `MX`, `SPF`, `DKIM`, `DMARC`, and `TXT` records untouched.
2. **Application Container Rollback (Hostinger VPS):** Stop `mrs_prod_api`, `mrs_prod_storefront`, `mrs_prod_admin`, and re-tag/start the previous known-good container images in `/srv/mangal-royal-studio-prod/`.
3. **Database Rollback:** Restore the pre-deployment `pg_dump -Fc` backup into `mangal_royal_studio_prod` using `pg_restore --clean --if-exists` after verifying its SHA-256 checksum.
4. **Source Rollback (Local Clean Repo):** `git checkout e85f15b` (preserves initial clean import).
