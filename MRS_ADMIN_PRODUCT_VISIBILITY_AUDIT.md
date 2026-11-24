# MRS Admin Product Visibility Audit

- **Date / Time:** `2026-11-24 19:20 IST`
- **Production Database:** `mangal_royal_studio_prod` (`8` `ACTIVE`, `0` `DRAFT`)
- **API Verification:** `GET /api/admin/products?pageSize=500` on `mrs_prod_api` (`127.0.0.1:4100`) returned `200 OK`, `PRODUCTS_LEN=8`, `TOTAL=8`.

## Root Cause of Admin Visibility Issue
1. **Primary Cause (Fixed in `2dddc2f`):** `mrs_prod_api` marked session cookies `Secure` whenever `NODE_ENV === 'production'`. Accessing Admin over the plain HTTP SSH tunnel (`http://localhost:3101` → `http://localhost:4100`) caused the browser to drop the `HttpOnly` session cookie, making `GET /api/auth/me` return `401` and silently resetting the login screen before products could load.
   - **Fix:** `services/api/src/middleware/session.ts` now omits `Secure` only on plain HTTP `localhost`/`127.0.0.1` SSH-tunnel requests while keeping `Secure` enforced on all HTTPS/production traffic, and `apps/admin/src/app/page.tsx` surfaces an explicit session-cookie error if `/api/auth/me` fails after login.
2. **Filter Enhancement & Regression Coverage:**
   - Extracted `filterAdminProducts` into `apps/admin/src/lib/admin-products.ts` and added `PRICE_ON_REQUEST` filtering alongside `ACTIVE`, `DRAFT`, `ARCHIVED`, category, SKU/title search, and pagination.
   - Added `apps/admin/src/lib/admin-products.test.ts` (`3/3` PASS; `@mrs/admin` total `6/6` PASS).
