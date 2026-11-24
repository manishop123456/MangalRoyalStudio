# MRS GoDaddy DNS & SSL Report

- **Date / Time:** `2026-11-23 19:56 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`, `www` redirects `301` to apex)
- **Source Commit:** `cb8bc67` (preserving `e85f15b`, `858ac4b`, `f24dcb6`)
- **Release Artifact SHA-256:** `6b03cf43ab4edc801c2a3592394930a5398a8378f39f848b65028af3ef046026`
- **Hostinger Deployment Identity:** `srv2177504` (VPS IP redacted/unconfigured in `~/.ssh/config`)
- **Production Database Identity:** `mangal_royal_studio_prod` (pending provisioning)
- **Migration List:** 3 additive Prisma migrations (`20261105000000`, `20261112000000`, `20261112180000`)
- **Backup Checksum:** `N/A — pending provisioning`
- **Product Counts:** `8` ACTIVE (`6` priced + `2` Price on Request), `272` DRAFT
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED` (Catalogue + Studio Enquiry mode)
- **DNS Cutover Status:** **VERIFIED AUTHORITATIVE ZONE — CUTOVER BLOCKED PENDING VPS IP & SECURITY GATES**

## 1. Authoritative DNS Zone Snapshot (Live `dig` Verification `2026-11-23`)
- **Registrar & Authoritative DNS Provider:** GoDaddy (`ns33.domaincontrol.com.`, `ns34.domaincontrol.com.`) — **CONFIRMED**.
- **Current Apex `A` Records (Pre-Cutover Rollback Values):**
  - `15.197.148.33`
  - `3.33.130.190`
- **Current `AAAA` Record:** None (do not add `AAAA` unless Hostinger production IPv6 is verified working).
- **Current `www` Record:** `CNAME` → `mangalroyalstudio.com.`
- **Email & Verification Records (MUST NOT BE MODIFIED):**
  - `MX`: `1 aspmx.l.google.com.`, `5 alt1.aspmx.l.google.com.`, `5 alt2.aspmx.l.google.com.`, `10 alt3.aspmx.l.google.com.`, `10 alt4.aspmx.l.google.com.`
  - `TXT` (SPF): `"v=spf1 include:dc-aa8e722993._spfm.mangalroyalstudio.com ~all"`
  - `TXT` (Verification): `"google-site-verification=pUXgiCq-3p81T8VzRE0ETqAIBFx8GSHJLTfaZv_1Sw0"`
  - `TXT` (`_dmarc`): `"v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;"`

## 2. Prepared Cutover & TLS Configuration
- **Nginx Config:** [nginx-production.conf](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio-clean/deploy/production/nginx-production.conf)
  - `:80` → `301 https://mangalroyalstudio.com$request_uri` (preserving `/.well-known/acme-challenge/`).
  - `:443` `www.mangalroyalstudio.com` → `301 https://mangalroyalstudio.com$request_uri`.
  - `:443` `mangalroyalstudio.com` → Storefront (`127.0.0.1:3100`) & public API (`127.0.0.1:4100`), blocking `/admin`, `/api/admin`, `/api/v1/admin`, `/api/docs.json`.
  - TLS SAN certificate target: `mangalroyalstudio.com` + `www.mangalroyalstudio.com`.
- **Planned GoDaddy DNS Changes (Once Unblocked):**
  - Replace apex `A` records (`15.197.148.33`, `3.33.130.190`) with verified Hostinger production IPv4.
  - Keep `www` `CNAME` → `mangalroyalstudio.com.`
  - Leave `NS`, `MX`, `TXT` (SPF, Google verification, `_dmarc`), and any DKIM/unrelated records untouched.
- **DNS Rollback:** Restore apex `A` records to `15.197.148.33` and `3.33.130.190` immediately if post-cutover checks fail.
