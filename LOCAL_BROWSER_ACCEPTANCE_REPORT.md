# Local Browser Acceptance Test Report

**Date:** 2026-11-18  
**Project:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Database:** `mangal_royal_studio_dev` (Read-Only)  
**Interactive Browser Status:** **BLOCKED** *(Chrome DevTools remote debugging not enabled on this machine; live HTTP/SSR/API checks PASSED)*

---

## 1. Running Services & URLs Tested

| Service | Command / Mode | URL | Status |
| --- | --- | --- | --- |
| API (`@mrs/api`) | `DATA_BACKEND=postgres PRODUCT_ASSETS_ROOT=./processed-product-assets` | `http://localhost:4000` | Running (`status: ok`, `backend: postgres`) |
| Storefront (`@mrs/storefront`) | `next start -p 3000` | `http://localhost:3000` | Running |
| Admin (`@mrs/admin`) | `next start -p 3001` | `http://localhost:3001` | Running |

---

## 2. Live HTTP, SSR & Image Endpoint Checks (Verified)

### Bugs Caught & Fixed During Live Probing
1. **`PRODUCT_ASSETS_ROOT` workspace cwd resolution ([services/api/src/app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts)):** When starting `@mrs/api` via `npm run start --workspace=@mrs/api`, `process.cwd()` is `services/api/`, causing relative `PRODUCT_ASSETS_ROOT=./processed-product-assets` to return `404`. Fixed to fall back to `path.resolve(process.cwd(), '..', '..', configuredAssetsRoot)` when the cwd-relative path does not exist.
2. **Storefront `/products/[handle]` SSR crash ([apps/storefront/src/app/products/[handle]/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/products/[handle]/page.tsx)):** `GET /products/royal-celeste-solitaire-ring` initially returned HTTP `500` (`TypeError: Cannot read properties of undefined (reading 'metalPurity')`) because `products` starts empty during SSR before client fetch. Guarded `product` and `breakup` nullability; rebuilt `@mrs/storefront`, and verified HTTP `200`.

### Verified HTTP Responses
- `GET http://localhost:3000/` -> `200`
- `GET http://localhost:3000/collections/all` -> `200`
- `GET http://localhost:3000/collections/rings` -> `200`
- `GET http://localhost:3000/products/royal-celeste-solitaire-ring` -> `200`
- `GET http://localhost:3001/` -> `200`
- Representative image endpoints across all 8 category folders on `http://localhost:4000`:
  - `/api/public/product-images/EARING/SKUDTG00001/SKUDTG00001_p01_r1c1.png` -> `200` (`62,054` bytes)
  - `/api/public/product-images/WOMEN_RINGS/SKUDRG00017/SKUDRG00017_p01_r1c1.png` -> `200` (`92,768` bytes)
  - `/api/public/product-images/MEN_RING/SKUDRG00033/SKUDRG00033_p01_r1c1.png` -> `200` (`129,404` bytes)
  - `/api/public/product-images/ITALIAN_RINGS/SKURIGO2916/SKURIGO2916_p01_r1c1.png` -> `200` (`145,570` bytes)
  - `/api/public/product-images/BRACLET/SKUDBG00001/SKUDBG00001_p01_r1c1.png` -> `200` (`115,982` bytes)
  - `/api/public/product-images/FULL_SET/SKUDNG00001/SKUDNG00001_p01_r1c1.png` -> `200` (`307,333` bytes)
  - `/api/public/product-images/SET_2_0/SKUDTG00149/SKUDTG00149_p01_r1c1.png` -> `200` (`216,517` bytes)
  - `/api/public/product-images/SET_2_0_PENDENT/SKUPDG00085/SKUPDG00085_p01_r1c1.png` -> `200` (`216,336` bytes)

---

## 3. Interactive Browser Checks Status

- **Blocker:** `chrome_devtools` MCP could not connect to Google Chrome (`ENOENT: /Users/macbook/Library/Application Support/Google/Chrome/DevToolsActivePort`).
- **Pending Browser Verifications (Not Yet Executed):**
  - Admin login, `All Products (280)` / `Draft (272)` / `Active (8)` dropdown filtering, combined category + status filtering, supplier SKU search, and Product Gallery Preview Modal (Primary badge, Next/Previous navigation, desktop & mobile `390x844` responsiveness).
  - Storefront visual rendering, browser console error check, browser network tab audit, and mobile `390x844` layout screenshots.
- **How to Unblock:** Open Google Chrome, navigate to `chrome://inspect/#remote-debugging`, enable remote debugging, and reply to resume the browser acceptance test against the already-running local servers (`:4000`, `:3000`, `:3001`).
