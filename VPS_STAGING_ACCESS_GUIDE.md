# VPS Private Staging Access Guide (SSH Tunnel)

**Date:** 2026-11-19  
**VPS:** `[STAGING_SERVER_IP]` (`mrsdeploy`)

Because the staging stack is bound strictly to `127.0.0.1` on the VPS (not exposed to the public internet), use an SSH local port-forwarding tunnel from your Mac to test the VPS staging environment in your browser.

---

## 1. Stop Local Mac Dev Servers First (If Running on Ports 3000 / 3001 / 4000)

If your local Mac is currently running services on ports `3000`, `3001`, or `4000`, stop them before opening the SSH tunnel so the tunnel can bind those local ports.

---

## 2. Open the SSH Tunnel from Your Mac

Run in macOS Terminal:

```bash
ssh -i ~/.ssh/mrs_vps_ed25519 \
  -L 3000:127.0.0.1:3000 \
  -L 3001:127.0.0.1:3001 \
  -L 4000:127.0.0.1:4000 \
  mrsdeploy@[STAGING_SERVER_IP]
```

Keep this SSH session open while testing.

---

## 3. Private Staging URLs in Your Mac Browser

- **Storefront:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3001
  - **Owner Email:** `owner@mangalroyalstudio.com`
  - **Owner Password:** `<set via MRS_SEED_OWNER_PASSWORD>`
- **API Health Endpoints:**
  - http://localhost:4000/health
  - http://localhost:4000/api/v1/health
  *(Note: the API serves health at `/health` and `/api/v1/health`.)*
- **Sample Staging Product Image:**
  - http://localhost:4000/api/public/product-images/EARING/SKUDTG00001/SKUDTG00001_p01_r1c1.png
