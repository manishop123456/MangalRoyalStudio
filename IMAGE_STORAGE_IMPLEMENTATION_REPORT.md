# Image Storage Implementation Report

**Date:** 2026-11-18  
**Project:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`

---

## 1. Architecture Summary

Product images are stored outside the application build directory and served by the Express API (`services/api`) from a configurable filesystem root via `PRODUCT_ASSETS_ROOT`:

- **Local Development Default:** `./processed-product-assets` (605 MB, 3,483 extracted crops across 272 supplier SKU folders + contact sheets).
- **Hostinger VPS Production Target:** `/srv/mangal-royal-studio/product-assets`.
- **Environment Configuration:** Added `PRODUCT_ASSETS_ROOT=./processed-product-assets` to [.env.example](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.env.example).

---

## 2. API Image Serving Hardening

Updated `GET /api/public/product-images/:category/:assetId/:filename` in [app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts):

1. **Configurable Storage Root:** Resolves `process.env.PRODUCT_ASSETS_ROOT` when set, falling back to local `processed-product-assets/` for development.
2. **Approved Formats Only:** Restricts serving to `['.png', '.jpg', '.jpeg', '.webp']` (`400 UNSUPPORTED_IMAGE_FORMAT` otherwise).
3. **Path-Traversal & Filesystem Protection:** Sanitizes `:category` and `:assetId`, applies `path.basename(:filename)`, verifies `resolved.startsWith(productAssetsBaseDir + path.sep)` and `fs.statSync(resolved).isFile()`, and returns `404 PRODUCT_IMAGE_NOT_FOUND` without exposing internal server paths.

---

## 3. Git & Asset Safety

- Added `product-assets-inbox/` and `processed-product-assets/` to [.gitignore](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.gitignore).
- Verified via `git ls-files product-assets-inbox processed-product-assets` that neither directory is tracked in Git (0 tracked files; local files untouched).

---

## 4. Verification

Read-only `supertest` against the built Express app (`PRODUCT_ASSETS_ROOT=./processed-product-assets`, `PostgresRuntimeBackend`):
- Valid image (`SKUDTG00001_p01_r1c1.png`): `200`
- Unsupported extension (`bad.txt`): `400 UNSUPPORTED_IMAGE_FORMAT`
- Missing image (`missing.png`): `404 PRODUCT_IMAGE_NOT_FOUND`
