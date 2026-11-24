# MRS Production Security Audit

- **Date / Time:** `2026-11-23 19:45 IST`
- **Production Domain:** `PENDING OWNER CONFIRMATION`
- **Source Commit:** `f24dcb6`
- **Release Artifact SHA-256:** `4523592c39cc96263ef1c09be24e3494d4d8133f0e6ec4455ecfb1001716ddf1`
- **Hostinger Deployment Identity:** `srv2177504` (SSH key `~/.ssh/mrs_vps_ed25519` present; target IP not configured)
- **Production Database Identity:** `mangal_royal_studio_prod` (pending provisioning)
- **Migration List:** 3 additive Prisma migrations (`20261105000000`, `20261112000000`, `20261112180000`)
- **Backup Checksum:** `N/A — pending VPS provisioning`
- **Product Counts:** `8` ACTIVE, `272` DRAFT
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED`

## Application & Source Security Controls (`VERIFIED`)
- **Credential Hygiene:** `credential-hygiene.test.ts` (`10/10` passed). No hardcoded seed passwords, Razorpay secrets, or `.env` files in tracked source.
- **Session & JWT Security:** Production fails closed if `JWT_SECRET` is absent or weak (`auth-config.test.ts` `5/5` passed). Salted `scrypt` password hashing, `HttpOnly` cookies, and server-side logout token revocation verified.
- **RBAC Governance:** `RATES_WRITE` restricted strictly to `OWNER` (`packages/shared/src/types.ts`, `app.test.ts` test `7b`). `MANAGER` and `PRICING_OPERATOR` receive `403 Forbidden` on all rate mutation endpoints.
- **Checkout / Payment Guard:** `NEXT_PUBLIC_ONLINE_CHECKOUT_ENABLED` defaults to `false`; Razorpay checkout is not exposed to storefront customers.

## Blocking Security Gates (`OWNER / INFRASTRUCTURE ACTION REQUIRED`)
1. Confirm rotation of all 3 staging Admin passwords (`OWNER`, `MANAGER`, `PRICING_OPERATOR`).
2. Confirm rotation of all 3 development Admin passwords.
3. Confirm rotation/locking of the 3 demo-customer accounts.
4. Confirm Razorpay test Key Secret rotation in Razorpay Dashboard, removal of old values from staging `/srv/mangal-royal-studio/app/.env.example`, and owner retention decision for the two staging backup tarballs.
5. Provision unique production `OWNER` Admin interactively on `mrs_prod_api` (`>= 16` chars, never sent in chat).

## Rollback Steps
- No production deployment or DNS cutover occurred; staging remains untouched. Local source rollback: `git reset --hard e85f15b` (if ever needed).
