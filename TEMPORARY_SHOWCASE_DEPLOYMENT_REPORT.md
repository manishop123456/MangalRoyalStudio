# Temporary Owner Showcase Deployment Report

**Date:** 2026-11-19  
**VPS:** `[STAGING_SERVER_IP]` (`srv2177504`, Hostinger KVM 2)  
**Temporary Showcase HTTPS URL:** https://ted-inflation-adapters-carolina.trycloudflare.com  
**Authorized Visitor Email (Cloudflare OTP Gate):** `owner@mangalroyalstudio.com`  
**Status:** **LIVE & VERIFIED**

---

## 1. Architecture & Routing

1. **Cloudflare Quick Tunnel (`mrs_showcase_tunnel`):**
   - Image: `cloudflare/cloudflared:latest` (`version 2026.11.1`)
   - Command:
     ```bash
     cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080 --allowed-mail owner@mangalroyalstudio.com
     ```
   - Runs detached (`-d`) without `--restart`, without `--privileged`, and without Docker socket access.
   - Enforces Cloudflare's email one-time PIN login gate (`https://login.trycloudflare.com/authorize?hostname=ted-inflation-adapters-carolina.trycloudflare.com...`) restricted to `owner@mangalroyalstudio.com` and adds `x-robots-tag: none`.
2. **Read-Only Nginx Showcase Proxy (`mrs_showcase_proxy`):**
   - Image: `nginx:1.27-alpine` on `mrs_internal_net`, bound strictly to host loopback `127.0.0.1:8080->8080/tcp`.
   - Config: `/srv/mangal-royal-studio/deployment/nginx-showcase.conf`
   - Routes `/` -> `http://mrs_storefront:3000` (`GET`/`HEAD`/`OPTIONS` only).
   - Routes approved read-only `/api/` endpoints -> `http://mrs_api:4000` (`GET`/`HEAD`/`OPTIONS` only).
   - Does **not** expose `mrs_admin` (`3001`) or `mrs_postgres` (`5432`).
3. **Storefront Same-Origin API Resolution (`mrs_storefront`):**
   - Rebuilt `mrs_storefront` with `NEXT_PUBLIC_STOREFRONT_API_URL=/api/v1` and `NEXT_PUBLIC_API_BASE_URL=/api/v1` so all browser catalog fetches and `resolveProductImageUrl` image paths use relative same-origin `/api/...` URLs (zero `localhost:4000` references in browser bundles).
   - Added Next.js `rewrites()` (`/api/:path*` -> `http://mrs_api:4000/api/:path*`) so direct SSH-tunnel testing on `http://localhost:3000` also works seamlessly.

---

## 2. Public API Allowlist vs. Blocked Endpoints (`mrs_showcase_proxy`)

### Approved Read-Only Endpoints (`GET`, `HEAD`, `OPTIONS` only)
- `/api/v1/products` and `/api/v1/products/:handleOrSku` (and `/api/products*`)
- `/api/v1/collections` and `/api/v1/collections/:handle` (and `/api/collections*`)
- `/api/v1/categories` (and `/api/categories`)
- `/api/v1/public/products/:sku/customization`
- `/api/public/product-images/:category/:assetId/:filename.(png|jpg|jpeg|webp)`
- `/api/public/model-assets/:storageKey`

### Explicitly Blocked Endpoints & Methods (`HTTP 403`)
- `/api/admin/*` and `/api/v1/admin/*`
- `/api/auth/*` and `/api/v1/auth/*`
- `/api/customer/*` and `/api/v1/customer/*`
- `/api/orders/*`, `/api/v1/orders/*`, and `/api/v1/public/orders/*`
- `/api/checkout/*` and `/api/v1/checkout/*`
- `/api/payments/*` and `/api/v1/payments/*`
- `/api/webhooks/*` and `/api/v1/webhooks/*`
- All `POST`, `PUT`, `PATCH`, and `DELETE` requests to any `/` or `/api/` route

---

## 3. Verification Results

| Check | Target | Observed HTTP Result | Status |
| --- | --- | --- | --- |
| External HTTPS Gate (from Mac) | `https://ted-inflation-adapters-carolina.trycloudflare.com/` | `HTTP/2 302` -> `https://login.trycloudflare.com/authorize?...` (`cf-ray: ...-BOM`) | PASS |
| Storefront Homepage (via proxy) | `GET http://127.0.0.1:8080/` | `200` | PASS |
| Collection Page (via proxy) | `GET http://127.0.0.1:8080/collections/all` | `200` | PASS |
| Product Detail Page (via proxy) | `GET http://127.0.0.1:8080/products/royal-celeste-solitaire-ring` | `200` | PASS |
| Active Catalogue API (via proxy) | `GET http://127.0.0.1:8080/api/v1/products` | `200` (`8` `ACTIVE` products) | PASS |
| Draft Product Isolation (via proxy) | `GET http://127.0.0.1:8080/api/v1/products/SKUDTG00001` | `404` | PASS |
| Product Image Serving (via proxy) | `GET http://127.0.0.1:8080/api/public/product-images/EARING/SKUDTG00001/SKUDTG00001_p01_r1c1.png` | `200` | PASS |
| Admin API Blocked | `GET http://127.0.0.1:8080/api/admin/products` | `403` | PASS |
| Auth API Blocked | `GET http://127.0.0.1:8080/api/v1/auth/customer/me` | `403` | PASS |
| Customer Orders Blocked | `GET http://127.0.0.1:8080/api/v1/customer/orders` | `403` | PASS |
| Order Invoice Blocked | `GET http://127.0.0.1:8080/api/v1/orders/ord-1001/invoice` | `403` | PASS |
| Write Method Blocked (`POST`) | `POST http://127.0.0.1:8080/api/v1/products` | `403` | PASS |
| Checkout Mutation Blocked (`POST`) | `POST http://127.0.0.1:8080/api/v1/checkout/create-order` | `403` | PASS |
| Write Method Blocked (`DELETE`) | `DELETE http://127.0.0.1:8080/api/v1/products/MRS-RNG-1001` | `403` | PASS |
| Admin Loopback (for SSH Tunnel) | `GET http://127.0.0.1:3001/` | `200` | PASS |
| API Health Loopback | `GET http://127.0.0.1:4000/health` | `200` | PASS |

---

## 4. How to Stop the Temporary Showcase

To immediately terminate the public Quick Tunnel link from your Mac:

```bash
ssh -i ~/.ssh/mrs_vps_ed25519 mrsdeploy@[STAGING_SERVER_IP] "docker stop mrs_showcase_tunnel"
```

Once stopped, `https://ted-inflation-adapters-carolina.trycloudflare.com` will immediately cease functioning. You can also optionally stop the showcase Nginx proxy (`docker stop mrs_showcase_proxy`) while leaving `mrs_postgres`, `mrs_api`, `mrs_storefront`, and `mrs_admin` running undisturbed.

---

## 5. Known Limitations of the Read-Only Showcase

- Because all `POST`/`PUT`/`PATCH`/`DELETE` requests and `/api/v1/auth/*`, `/api/v1/customer/*`, `/api/v1/checkout/*`, and `/api/v1/payments/*` routes are blocked (`403`) at the proxy layer, customer login/registration, server-side custom design quote `POST`s, and checkout order creation are intentionally disabled in the public showcase.
- If `mrs_showcase_tunnel` is stopped or restarted, Cloudflare assigns a new random `trycloudflare.com` hostname.
