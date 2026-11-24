# MRS Production Database Report

- **Date / Time:** `2026-11-23 21:22 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`)
- **Source Commit:** `ad96cb0`
- **Release Artifact SHA-256:** `bc5517e4e4ce0d03aa60c2fe761877c6aead551ee34a79cb1d89910fbccb3a16`
- **Hostinger Deployment Identity:** `srv2177504` (`189.72.158.142`)
- **Production Database Identity:** `mangal_royal_studio_prod` (`mrs_prod_postgres`, restricted user `mrs_prod_app`)
- **Migration List:**
  1. `20261105000000_init_complete_platform`
  2. `20261112000000_phase1_runtime_completion`
  3. `20261112180000_phase2_customization_and_3d_assets`
- **Backup Checksums:**
  - Pre-migration: `ece00a8563ad00e75e5345ece0fb96e55ae1d0b9ce9cfefff1c3e560d67c4dd3` (`pre_migration_mangal_royal_studio_prod_20261123T153848Z.dump`)
  - Post-migration: `427a3ab2a5467d2600150b9a9b59d2e40e650ee010d57188e390119703d4cce6` (`mangal_royal_studio_prod_20261123T154953Z.dump`)
- **Product Counts:** `8` verified `ACTIVE` (`MRS-RNG-1001`, `MRS-RNG-1002`, `MRS-EAR-2001`, `MRS-BRC-3001`, `MRS-PND-4001`, `MRS-BNG-5001`, `MRS-NCK-6001`, `MRS-ANT-7001`), `0` `DRAFT` (`272` staging drafts excluded), `0` customers, `0` orders
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED`

## Executed Database Operations
- Provisioned isolated `mrs_prod_postgres` on `mrs_prod_network` (no public `5432` port).
- Verified pre-migration `pg_dump -Fc` readability with `pg_restore --list`.
- Applied all 3 Prisma migrations via `npx prisma migrate deploy`.
- Seeded strictly base `Role` (`3`) and `Permission` (`24`) rows (`userCount: 0`; zero dev/test/staging users, customers, orders, or synthetic records).
- Configured automated daily `02:00 UTC` `pg_dump -Fc` backups with `pg_restore --list` verification, `.sha256` checksums, and 14-day retention.
