# Phase 2 Implementation Report — Mangal Royal Studio

## Overview
Phase 2 delivers configurable bespoke jewellery customization, an authoritative server-side `Decimal.js` quote engine, Dawn-aligned storefront customizer UI, lazy-loaded WebGL2 3D `.glb` viewer with photo-gallery fallback, customer saved designs with strict IDOR ownership protection, customized cart/checkout order snapshots, admin customization & 3D asset management modules, and PostgreSQL bulk Excel import/rollback support.

## Implemented Workstreams
- **Workstream A (Customization Domain & Persistence):**
  - Added `CustomizationProfile`, `CustomizationGroup`, `CustomizationOption`, `ProductCustomizationAssignment`, `CustomerDesign`, and `ProductModelAsset` to `services/api/prisma/schema.prisma` with additive migration `20261112180000_phase2_customization_and_3d_assets`.
  - Added `PostgresCustomizationRepository` (`services/api/src/db/repositories/customization-repository.ts`) and wired it through `RuntimeBackend` (`PostgresRuntimeBackend` & `JsonRuntimeBackend`).
  - Created idempotent dev seed `services/api/src/db/seed-phase2-customization.ts` (`BESPOKE_RINGS` & `FINE_JEWELLERY_STANDARD`, 2 profiles, 8 groups, 26 options).
- **Workstream B (Authoritative Customization Pricing Engine):**
  - Implemented `resolveEligibleCustomizationProfile`, `calculateCustomizationQuote`, and `CustomizationQuoteError` in `packages/shared/src/customization-pricing.ts` using `Decimal.js` precision 28 and explicit INR rounding & GST rules.
  - Fails closed (`400`/`422`) when pricing rules, metal rates, or diamond rates are missing, or when ineligible/blocked options are requested.
- **Workstream C (Dawn-Aligned Storefront Customizer):**
  - Created `apps/storefront/src/components/ProductCustomizer.tsx` with stepped configuration groups, color swatches, engraving character limits, live server quote calculation with `AbortController` + sequence-number stale-response protection, and price breakdown display.
  - Integrated into `apps/storefront/src/app/products/[handle]/page.tsx`.
- **Workstream D (Lazy-Loaded 3D Viewer & Asset Storage):**
  - Created `services/api/src/services/model-storage.ts` (`LocalManagedModelStorage`, `.glb`/`.gltf` magic-byte & JSON validation, 25 MB limit).
  - Created `apps/storefront/src/components/Product3DViewer.tsx` (zero-dependency WebGL2 `.glb` parser + interactive orbit/zoom canvas) lazy-loaded via `next/dynamic(..., { ssr: false })` only when an `ACTIVE` `ProductModelAsset` exists and the user opens 3D view.
- **Workstream E (Customer Saved Designs):**
  - Added `/api/customer/designs*` endpoints with `requireCustomerAuth`, CSRF validation, and strict `design.customerId === req.customerUser.id` ownership checks.
  - Added Saved Bespoke Designs management in `apps/storefront/src/app/account/page.tsx` with Reopen & Edit (`?designId=...`), Duplicate, Delete, and Add to Bag.
- **Workstream F (Customized Cart, Checkout & Order Snapshots):**
  - Updated `POST /api/cart/:cartId/items`, `PATCH /api/cart/:cartId/items/:itemId`, and `POST /api/checkout/create-order` to recalculate customized prices on the server and persist `customizationSnapshotJson` and `customerDesignId` on `OrderItem`.
  - Updated `apps/storefront/src/components/StorefrontShell.tsx`, `cart/page.tsx`, and `checkout/page.tsx`.
- **Workstream G (Admin Modules & RBAC):**
  - Added `CUSTOMIZATION_VIEW`, `CUSTOMIZATION_MANAGE`, `MODEL_ASSETS_MANAGE`, and `DESIGNS_VIEW` permissions in `packages/shared/src/types.ts`.
  - Created `apps/admin/src/components/AdminPhase2Modules.tsx` and wired modules 20–22 into `apps/admin/src/app/page.tsx`.
- **Workstream H (PostgreSQL Bulk Import Hardening):**
  - Migrated all `/api/admin/imports*` routes in `services/api/src/app.ts` from `dbStore.getState()` to `RuntimeBackend` (`PostgresOperationsRepository`), enforcing `TEST-*` exclusion, transactional commits, rollback, and preservation of existing product prices and `MRS-EAR-2001` (`9` units).
