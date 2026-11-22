# VPS Deployment Environment Reference

**Date:** 2026-11-19  
**VPS Location:** `/srv/mangal-royal-studio/deployment/`

---

## 1. Environment Files on the VPS (No Secret Values Shown)

### `/srv/mangal-royal-studio/deployment/.env.db` (`chmod 600`, `mrsdeploy:mrsdeploy`)
Used by `mrs_postgres` (`docker-compose.postgres.yml`):
```env
POSTGRES_USER=mrs_db_admin
POSTGRES_PASSWORD=<redacted-48-char-random-hex>
POSTGRES_DB=postgres
```

### `/srv/mangal-royal-studio/deployment/.env.app` (`chmod 600`, `mrsdeploy:mrsdeploy`)
Used by `mrs_api` (`docker-compose.app.yml`):
```env
NODE_ENV=staging
API_PORT=4000
API_HOST=0.0.0.0
LOG_LEVEL=info
DATA_BACKEND=postgres
DATABASE_URL=postgresql://mrs_db_admin:<redacted>@mrs_postgres:5432/mangal_royal_studio_staging?schema=public
PRODUCT_ASSETS_ROOT=/srv/mangal-royal-studio/product-assets
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
JWT_SECRET=<redacted-64-char-random-hex>
SESSION_TTL_HOURS=24
CUSTOMER_SESSION_TTL_HOURS=24
SHOPIFY_STORE_DOMAIN=mangal-royal-studio.myshopify.com
SHOPIFY_API_VERSION=2025-01
SHOPIFY_ADMIN_API_VERSION=2025-01
SHOPIFY_LIVE_WRITES_ENABLED=false
RAZORPAY_MODE=test
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

*(Why `NODE_ENV=staging` on `mrs_api`: in `services/api/src/middleware/auth.ts`, `NODE_ENV=production` enforces live `rzp_live_*` Razorpay keys and live Resend/Shopify webhook secrets at startup, whereas `services/api/src/services/razorpay-service.ts` `assertRazorpayTestMode()` rejects `rzp_live_*` keys during the test-mode milestone. Using `NODE_ENV=staging` with a strong 64-character `JWT_SECRET` and `COOKIE_SECURE=false` enables authenticated HTTP SSH-tunnel testing without inventing third-party secrets or enabling live payments.)*

---

## 2. Build-Time & Runtime Variables for Next.js Containers

For private SSH-tunnel testing (`localhost:3000`, `localhost:3001`, `localhost:4000`), `mrs_storefront` and `mrs_admin` are built and run with:

### `mrs_storefront` (`NODE_ENV=production`)
- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_STOREFRONT_API_URL=http://localhost:4000/api/v1`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`

### `mrs_admin` (`NODE_ENV=production`)
- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

*(When transitioning from private SSH-tunnel staging to public HTTPS behind a reverse proxy, update these build args and `CORS_ORIGIN` to the public HTTPS domain and set `COOKIE_SECURE=true`.)*
