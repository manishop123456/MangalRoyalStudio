# MRS Owner Production Handover

- **Date / Time:** `2026-11-23 21:22 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`)
- **Source Commit:** `ad96cb0`
- **Release Artifact SHA-256:** `bc5517e4e4ce0d03aa60c2fe761877c6aead551ee34a79cb1d89910fbccb3a16`
- **Hostinger Deployment Identity:** `srv2177504` (`189.72.158.142`)
- **Production Database Identity:** `mangal_royal_studio_prod` (`mrs_prod_postgres`)
- **Migration List:** 3 additive Prisma migrations
- **Backup Checksum:** `427a3ab2a5467d2600150b9a9b59d2e40e650ee010d57188e390119703d4cce6`
- **Product Counts:** `0` in prod (pending selective transfer of `8` verified `ACTIVE` products)
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED` (`CATALOGUE_ENQUIRY_MODE=true`)

## Final Owner Actions Required to Complete Public Launch
1. **Confirm Security Rotations:**
   - Confirm 3 staging Admin passwords, 3 dev Admin passwords, demo-customer accounts, and Razorpay test Key Secret have been rotated, authorize cleanup of `/srv/mangal-royal-studio/app/.env.example`, and confirm retention of the two staging backup tarballs.
2. **Interactive Production `OWNER` Account Setup:**
   - Run the interactive stdin `OWNER` account creation (`>= 16` chars, never in chat) on `mrs_prod_api`.
3. **Publish Approved Rate Card & Selective Catalogue Transfer:**
   - Sign in via SSH tunnel (`ssh -L 3101:127.0.0.1:3101 -L 4100:127.0.0.1:4100 mrs-vps`), publish the approved Rate Card via the full Admin Rate Card form, and transfer only the `8` verified `ACTIVE` products (`6` priced + `2` POR) to `mangal_royal_studio_prod`.
4. **GoDaddy DNS Cutover & Let's Encrypt SAN TLS:**
   - Update only the apex `A` record for `mangalroyalstudio.com` in GoDaddy to `189.72.158.142` (preserving `www` `CNAME`, Google Workspace `MX`, `SPF`, `TXT`, and `_dmarc`), then run `certbot --nginx -d mangalroyalstudio.com -d www.mangalroyalstudio.com` and apply the permanent `www` → apex `301` redirect.
