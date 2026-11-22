# Mangal Royal Studio — Implementation & Verification Log

## 1. Audit & Architecture Alignment
- Completed exhaustive file-by-file inspection of [`jewellery-theme-backup/`](jewellery-theme-backup/) (377 files, Shopify Dawn 15.5.0 + 19 custom Mangal Royal Studio sections) without modifying any original file.
- Produced [`AUDIT_REPORT.md`](AUDIT_REPORT.md), [`PAGE_STRUCTURE.md`](PAGE_STRUCTURE.md), [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`THEME_ASSETS.md`](THEME_ASSETS.md), [`EXISTING_FUNCTIONALITY.md`](EXISTING_FUNCTIONALITY.md), and [`DECISIONS.md`](DECISIONS.md).
- Implemented the **IMPORTANT ARCHITECTURE CHANGE — SHOPIFY STOREFRONT**:
  - Customer storefront remains on the **Shopify Liquid Theme** in [`apps/shopify-theme/`](apps/shopify-theme/).
  - Did **not** build a separate Next.js customer storefront.
  - Built the separate **Next.js 15 Custom Admin Dashboard** in [`apps/admin/`](apps/admin/) for the 19 operational and pricing modules.

## 2. Shopify Liquid Theme Enhancements (`apps/shopify-theme/`)
- Cloned [`jewellery-theme-backup/`](jewellery-theme-backup/) into [`apps/shopify-theme/`](apps/shopify-theme/).
- Fixed broken CSS selector typo in [`apps/shopify-theme/sections/brand-story.liquid`](apps/shopify-theme/sections/brand-story.liquid).
- Fixed `{% render 'card-product' %}` parameter names in [`apps/shopify-theme/sections/main-collection-product-grid.liquid`](apps/shopify-theme/sections/main-collection-product-grid.liquid) and [`apps/shopify-theme/sections/main-search.liquid`](apps/shopify-theme/sections/main-search.liquid).
- Unified Wishlist `localStorage` state across [`apps/shopify-theme/snippets/card-product.liquid`](apps/shopify-theme/snippets/card-product.liquid) and [`apps/shopify-theme/sections/main-product.liquid`](apps/shopify-theme/sections/main-product.liquid).
- Fixed PDP option selector rendering in [`apps/shopify-theme/sections/main-product.liquid`](apps/shopify-theme/sections/main-product.liquid) so diamond shape icons only render for Shape/Cut options while Purity/Color/Size options use dropdowns.
- Added [`apps/shopify-theme/snippets/product-price-breakup.liquid`](apps/shopify-theme/snippets/product-price-breakup.liquid) for transparent Metal + Diamond + Making + GST breakup on the PDP.
- Added [`apps/shopify-theme/sections/main-wishlist.liquid`](apps/shopify-theme/sections/main-wishlist.liquid) + [`apps/shopify-theme/templates/page.wishlist.json`](apps/shopify-theme/templates/page.wishlist.json) and [`apps/shopify-theme/sections/order-tracking.liquid`](apps/shopify-theme/sections/order-tracking.liquid) + [`apps/shopify-theme/templates/page.order-tracking.json`](apps/shopify-theme/templates/page.order-tracking.json).

## 3. Shared Financial Core (`packages/shared/`)
- Created [`packages/shared/src/types.ts`](packages/shared/src/types.ts), [`packages/shared/src/schemas.ts`](packages/shared/src/schemas.ts), and [`packages/shared/src/pricing-engine.ts`](packages/shared/src/pricing-engine.ts).
- Implemented `calculateJewelleryPrice`, `matchDiamondRate`, and `applyInrRounding` using `decimal.js`.
- Verified with unit tests in [`packages/shared/src/pricing-engine.test.ts`](packages/shared/src/pricing-engine.test.ts).

## 4. Backend API, Prisma Schema & 11-Sheet Excel Importer (`services/api/`)
- Created normalized PostgreSQL schema in [`services/api/prisma/schema.prisma`](services/api/prisma/schema.prisma) with 25 models.
- Implemented persistent state & seed data in [`services/api/src/store/data-store.ts`](services/api/src/store/data-store.ts) with configurable placeholders (`isPlaceholder: true`).
- Implemented JWT authentication and RBAC middleware (`OWNER`, `MANAGER`, `PRICING_OPERATOR`) in [`services/api/src/middleware/auth.ts`](services/api/src/middleware/auth.ts).
- Implemented 11-sheet Excel/CSV importer in [`services/api/src/services/excel-importer.ts`](services/api/src/services/excel-importer.ts) and generated [`samples/MANGAL JEWELLERY.xlsx`](samples/MANGAL JEWELLERY.xlsx) via [`services/api/src/scripts/generate-sample-excel.ts`](services/api/src/scripts/generate-sample-excel.ts).
- Implemented Shopify GraphQL Admin API (`2025-01`) sync service with `SHOPIFY_LIVE_WRITES_ENABLED` guard in [`services/api/src/services/shopify-service.ts`](services/api/src/services/shopify-service.ts) and Shiprocket/Razorpay services in [`services/api/src/services/shiprocket-service.ts`](services/api/src/services/shiprocket-service.ts).
- Implemented REST endpoints in [`services/api/src/app.ts`](services/api/src/app.ts) and verified with integration tests in [`services/api/src/app.test.ts`](services/api/src/app.test.ts).

## 5. Next.js Custom Admin Dashboard (`apps/admin/`)
- Built the Mangal Royal Studio Custom Admin Dashboard in [`apps/admin/src/app/page.tsx`](apps/admin/src/app/page.tsx) and [`apps/admin/src/app/globals.css`](apps/admin/src/app/globals.css) covering all 19 modules with live API connectivity and standalone fallback calculation.
