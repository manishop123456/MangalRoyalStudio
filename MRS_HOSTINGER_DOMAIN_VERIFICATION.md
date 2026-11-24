# MRS Hostinger & Domain Verification Report

- **Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean`
- **Date:** 2026-11-22
- **Status:** **OWNER & INFRASTRUCTURE VERIFICATION REQUIRED** (No DNS changes made)

---

## 1. Findings from Repository & Local SSH Configuration

1. **Candidate Domains Found in Documentation:**
   - **Email / Brand Domain Reference:** `mangalroyalstudio.com` appears in `README.md` (`owner@mangalroyalstudio.com`), `SECURITY.md`, `WEBSITE_COMPLETION_RC1_REPORT.md` (`concierge@mangalroyalstudio.com`), and `postgres-runtime.e2e.test.ts`.
   - **Shopify Store Domain:** `mangal-royal-studio.myshopify.com` (reference in `VPS_DEPLOYMENT_ENVIRONMENT_REFERENCE.md` and `package.json`).
   - **Temporary Staging Showcase URL:** `*.trycloudflare.com` (ephemeral Cloudflare tunnel used only for private staging preview).
   - **Canonical Production `.com` Domain:** Not explicitly confirmed in any deployment config (`deploy/staging/nginx-showcase.conf` uses `server_name _;`).

2. **Authoritative DNS Provider Ambiguity:**
   - `HOSTINGER_VPS_INITIAL_SETUP_REPORT.md` line 110 states: *"Point GoDaddy DNS records to `[STAGING_SERVER_IP]` and issue TLS certificates once owner-approved."*
   - `ANTIGRAVITY_PROMPT.md` line 115 notes: *"GoDaddy domain is not connected."*
   - The production launch specification references launching on the owner-controlled Hostinger `.com` domain.
   - **Conclusion:** It is currently ambiguous whether authoritative DNS is managed at **Hostinger** or **GoDaddy** (or registered at GoDaddy with Hostinger nameservers).

3. **Current A, AAAA, CNAME & Nameserver Records:**
   - Not queried or modified because the canonical `.com` domain has not been confirmed by the owner and no DNS provider credentials are present.

4. **Existing VPS Target & SSH Configuration:**
   - Local SSH key exists: `/Users/macbook/.ssh/mrs_vps_ed25519` (`chmod 600`).
   - No `~/.ssh/config` host alias is configured locally, and the VPS IP is redacted as `[STAGING_SERVER_IP]` across all clean-repository reports (`HOSTINGER_SSH_SETUP_REPORT.md`, `HOSTINGER_VPS_INITIAL_SETUP_REPORT.md`).
   - Existing staging architecture on the Hostinger KVM 2 VPS (`srv2177504`, Ubuntu 26.04.1 LTS) uses Docker Compose (`deploy/staging/docker-compose.app.yml`, `docker-compose.postgres.yml`), `mrs_internal_net`, and Nginx reverse proxy, with `/srv/mangal-royal-studio/` as the staging root.

---

## 2. Classifications & Required Actions

| Item | Classification | Action Needed |
|---|---|---|
| Confirm exact canonical `.com` domain (e.g., `mangalroyalstudio.com` vs `www.mangalroyalstudio.com`) | `OWNER ACTION REQUIRED` | Owner must explicitly confirm the canonical `.com` domain and whether `www` should redirect to apex (or vice versa). |
| Confirm authoritative DNS provider (Hostinger vs GoDaddy) & export current DNS zone | `OWNER ACTION REQUIRED` | Owner must confirm where nameservers point and export existing A, AAAA, CNAME, MX, SPF, DKIM, DMARC, and TXT records before any edit. |
| Provide/verify SSH target alias (`mrs-vps`) in `~/.ssh/config` | `INFRASTRUCTURE ACTION REQUIRED` | Configure a private local SSH alias pointing to the Hostinger KVM VPS using `~/.ssh/mrs_vps_ed25519` without recording the IP in repo files. |
| Provision separate production Docker/Nginx stack on VPS | `INFRASTRUCTURE ACTION REQUIRED` | Create `/srv/mangal-royal-studio-prod/` with `mrs_prod_postgres`, `mrs_prod_api`, `mrs_prod_storefront`, `mrs_prod_admin` (SSH-only), `mrs_prod_network`, and HTTPS reverse proxy. |
