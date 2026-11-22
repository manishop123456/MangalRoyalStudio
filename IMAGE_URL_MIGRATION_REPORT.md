# Image URL Migration Report

**Date:** 2026-11-18  
**Database:** `mangal_royal_studio_dev`

---

## 1. Pre-Migration Backup & Dry-Run Verification

1. **Database Verified:** `current_database() = 'mangal_royal_studio_dev'`.
2. **Timestamped Backup Created:** `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/pre_url_migration_mangal_royal_studio_dev_20261118.dump` (`308K`).
3. **Backup Verified:** `pg_restore --list` succeeded (`261` TOC entries, `dbname: mangal_royal_studio_dev`).
4. **Pre-Migration URL Export:** Exported to `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/scratch/pre_url_migration_mapping.csv`.
5. **Dry-Run Results:** `3,122` `ProductImage.url`, `272` `ProductMetadata.imageUrl`, and `271` `ProductMetadata.hoverImageUrl` rows matched `http://localhost:4000/api/public/product-images/...`, with `0` missing files on disk.

---

## 2. Transactional Migration Results

Executed inside `BEGIN; ... COMMIT;` in `mangal_royal_studio_dev`:

| Table & Column | Rows Updated | Remaining `localhost` URLs | Relative `/api/public/product-images/...` URLs |
| --- | ---: | ---: | ---: |
| `ProductImage.url` | 3,122 | 0 | 3,122 |
| `ProductMetadata.imageUrl` | 272 | 0 | 272 |
| `ProductMetadata.hoverImageUrl` | 271 | 0 | 271 |

- Unrelated external URLs (such as the 8 `ACTIVE` `MRS-*` baseline products) were left untouched.
- Database counts preserved: `ProductMetadata=280` (`8` `ACTIVE`, `272` `DRAFT`), `ProductImage=3,122`, `OrderMetadata=3`, `Customer=3`.

---

## 3. Shared URL Resolution Helper

Added `resolveProductImageUrl(url, apiBaseOrOrigin)` in [utils.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/utils.ts) (re-exported from [index.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/packages/shared/src/index.ts)) and wired into:
- **Storefront:** [storefront-data.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/lib/storefront-data.ts) (`API_ORIGIN`), [ProductCard.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/ProductCard.tsx), [products/[handle]/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/products/[handle]/page.tsx), [customize/[productId]/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/customize/[productId]/page.tsx), [cart/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/cart/page.tsx), [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx).
- **Admin:** [apps/admin/src/app/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx) (thumbnails and gallery preview modal resolved against `API_BASE`).
