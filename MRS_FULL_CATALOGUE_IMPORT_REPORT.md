# MRS Full Catalogue Import Report

- **Date / Time:** `2026-11-24 20:18 IST`
- **Source Commit:** `07d5cb3` (`ab374e1bd528f72a8d9d06371323f5ce8180a64ede1a08b63001b6433613a1d0`)
- **Pre-Import Production Backup SHA-256:** `3da3891f4a583428bad456daa37cef85e96a98950a40cf8889157c454c5d746e` (`pre_full_catalogue_mangal_royal_studio_prod_20261124T143446Z.dump`)
- **Post-Import Production Backup SHA-256:** `c4eff5677e8ddc104391fe343a44f28cf9e9bed890b65d9792a7ef1cc685a706` (`post_full_catalogue_mangal_royal_studio_prod_20261124T143917Z.dump`)

## Import Summary
- Transactional, idempotent SKU-based upsert executed inside `mrs_prod_api` against `mangal_royal_studio_prod`.
- Preserved the `8` existing baseline `ACTIVE` products untouched.
- Normalized all `http://localhost:4000/api/public/product-images/...` URLs to relative `/api/public/product-images/...` (`localhostImgs: 0`).
- Fixed `PRODUCT_ASSETS_ROOT=/srv/mangal-royal-studio-prod/product-assets` in production `.env.app` (`HTTP/1.1 200 OK` verified for `/api/public/product-images/BRACLET/SKUBGG00002/SKUBGG00002_p01_r1c1.png`).
- Fixed `maxPageSize: 500` on `/api/admin/products` (`07d5cb3`) so Admin loads all `280` products instead of clamping at `100`.
- `0` customers, `0` orders, `0` sessions, and `0` carts transferred from staging.
