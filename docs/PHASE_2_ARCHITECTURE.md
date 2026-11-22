# Mangal Royal Studio — Phase 2 Architecture Decision & Design

**Date:** 2026-11-12  
**Status:** Approved for Phase 2 Implementation  
**Target Database:** `mangal_royal_studio_dev` (PostgreSQL 18.6, Prisma 6.19.3)  

---

## 1. Existing Architecture Reused

Phase 2 builds directly on the verified Phase 1 monorepo foundation without creating parallel systems:

- **Monorepo Workspaces:** `@mrs/shared` (`packages/shared`), `@mrs/api` (`services/api`), `@mrs/admin` (`apps/admin`), `@mrs/storefront` (`apps/storefront`).
- **Runtime Backend Abstraction (`services/api/src/db/runtime-backend.ts`):** `RuntimeBackend` interface with explicit `PostgresRuntimeBackend` (`DATA_BACKEND=postgres`, fail-closed) and `JsonRuntimeBackend` (`DATA_BACKEND=json`).
- **Pricing Core (`packages/shared/src/pricing-engine.ts`):** `Decimal.js` (`precision: 28`, `ROUND_HALF_UP`), `calculateJewelleryPrice()`, `applyInrRounding()`, `matchDiamondRate()`, and versioned `PricingRule` / `MetalRate` / `DiamondRate` records.
- **Auth & RBAC (`services/api/src/middleware/auth.ts`, `session.ts`):** HttpOnly session cookies, session-bound CSRF + Origin validation, separate Admin and Customer JWT secrets/audiences, and `requirePermission()` RBAC middleware.
- **Protected Reference Assets:** `jewellery-theme-backup/`, `apps/shopify-theme/`, `.data/platform-state.json`, and `services/api/.data/platform-state.json` remain strictly read-only.

---

## 2. New Components & Responsibilities

### Domain & Persistence (`services/api/prisma/schema.prisma`, `services/api/src/db/repositories/`)
- **`CustomizationProfile`:** Named configuration template (e.g., Bridal Rings, Fine Necklaces) with eligible product categories and active status.
- **`CustomizationGroup`:** Ordered step within a profile (`METAL`, `PURITY`, `METAL_COLOR`, `DIAMOND`, `GEMSTONE`, `SIZE`, `FINISH`, `SETTING`, `ENGRAVING`, `OTHER`) with `selectionMode` (`SINGLE` | `TEXT`), `isRequired`, and `dependencyRule` JSON.
- **`CustomizationOption`:** Individual selectable option with swatch/image metadata, pricing rule (`INCLUDED`, `FIXED_INR`, `PER_GRAM_INR`, `PER_CARAT_INR`, `PERCENT_OF_BASE`, `METAL_RATE_PURITY`), `priceRuleValue` (`Decimal(14,4)`), jewellery attributes, and `eligibilityRule` JSON.
- **`ProductCustomizationAssignment`:** Links a `ProductMetadata` row to a `CustomizationProfile` with per-product capability flags (`isCustomizable`, `allowDiamondSelection`, `allowEngraving`, `maxEngravingChars`, `disabledOptionCodes`).
- **`CustomerDesign`:** Customer-owned saved customization configuration storing `selections`, `selectionSnapshot`, `lastQuotedPriceInr`, `lastPriceBreakdown`, and `pricingRuleVersion`.
- **`ProductModelAsset`:** Real 3D `.glb`/`.gltf` model asset metadata associated with a `ProductMetadata` row (`storageProvider`, `storageKey`, `assetUrl`, `fileSizeBytes`, `mimeType`, `status`).
- **Storage Adapter (`services/api/src/services/model-storage.ts`):** Clean abstraction (`ModelStorageAdapter`) with local managed disk storage (`services/api/.uploads/models/`) for development and explicit interface for future S3/R2/Cloudinary object storage.

### Authoritative Customization Pricing (`packages/shared/src/customization-pricing.ts`)
- Pure `Decimal.js` engine `calculateCustomizationQuote()` that validates product eligibility, group dependencies, option eligibility, and active metal/diamond/rule rates, then computes an itemized customer-safe `CustomizationQuoteResponse`.

### Storefront & Admin UI
- **`apps/storefront`:** Dawn-inspired PDP enhancement (`apps/storefront/src/app/products/[handle]/page.tsx`) with stepped `ProductCustomizer` component, lazy-loaded WebGL2 `.glb` `Product3DViewer` (`next/dynamic`, `ssr: false`) with image-gallery fallback, Saved Designs management in `/account`, and customized line-item display in `/cart` and `/checkout`.
- **`apps/admin`:** New modules in `apps/admin/src/app/page.tsx` for Customization Profiles/Groups/Options & Product Eligibility, 3D Model Asset Management, and Saved Design Inspection.

---

## 3. Data Model Changes (Additive Only)

All schema changes are implemented via an additive Prisma migration (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`):
- New tables: `CustomizationProfile`, `CustomizationGroup`, `CustomizationOption`, `ProductCustomizationAssignment`, `CustomerDesign`, `ProductModelAsset`.
- Additive columns on `CartItem`: `customizationSelections`, `customizationSnapshot`, `pricingBreakdown`, `customerDesignId`.
- Additive columns on `OrderItem`: `customizationSnapshotJson`, `customerDesignId`.
- No `DROP TABLE`, no `DROP COLUMN`, no destructive renames, and no resets.

---

## 4. Pricing Calculation Approach

1. Browser sends `{ productHandleOrSku, variantId?, selections, quantity }` to `POST /api/public/customization/quote`.
2. Backend loads the product, its `ProductCustomizationAssignment` / eligible `CustomizationProfile`, active `MetalRate`s, active `DiamondRate`s, and active `PricingRule`.
3. Every selected option is validated server-side against `isActive`, `disabledOptionCodes`, group `dependencyRule`, and option `eligibilityRule`.
4. Effective `JewelleryProductSpec` is constructed from selected metal/purity/color and diamond attributes; `calculateJewelleryPrice()` computes base metal, diamond, making, and wastage values in `Decimal`.
5. Option-level adjustments (`FIXED_INR`, `PER_GRAM_INR`, `PER_CARAT_INR`, `PERCENT_OF_BASE`) are accumulated in `Decimal`, GST (`gstRatePercent`) is applied, and `applyInrRounding()` produces the final `unitPriceInr` and `totalPriceInr`.
6. If any required commercial rate or configuration is missing, the API fails closed (`422 PRICING_CONFIGURATION_INCOMPLETE`) rather than guessing.
7. Client-submitted totals are never trusted; `POST /api/cart/:cartId/items`, `PATCH /api/cart/:cartId/items/:itemId`, and `POST /api/checkout/create-order` always recalculate on the server.

---

## 5. Customer Customization Lifecycle

1. **Discover:** Customer opens a product page; storefront fetches `GET /api/public/products/:handleOrSku/customization`.
2. **Configure:** If eligible, customer steps through applicable groups (Metal -> Purity -> Colour -> Stone -> Size/Setting/Engraving -> Review) with debounced server quote updates.
3. **Save / Reopen:** Authenticated customers save designs via `POST /api/customer/designs`, view/edit/duplicate/delete them in `/account`, and reopen them in `/products/:handle?designId=...`.
4. **Purchase:** Adding a design or custom selection to cart recalculates the authoritative price and persists the snapshot. Checkout revalidates availability/options and stores immutable `customizationSnapshotJson` + `pricingSnapshotJson` on `OrderItem`.

---

## 6. 3D Asset Handling

- Only real `.glb` / `.gltf` assets uploaded or associated by an authorized admin (`MODEL_ASSETS_MANAGE`) are rendered.
- `Product3DViewer` is loaded lazily via `next/dynamic(..., { ssr: false })` and only mounted when the product has an `ACTIVE` `ProductModelAsset` and the user activates 3D mode.
- Products without a 3D asset render the standard high-resolution image gallery with zero fake 3D placeholders.
- Local disk storage (`services/api/.uploads/models/`) is abstracted behind `ModelStorageAdapter` and documented as a development-only adapter pending production object storage (S3/R2/Cloudinary).

---

## 7. PostgreSQL Bulk Import Remediation

- All 5 bulk import routes (`/api/admin/imports`, `/api/admin/imports/excel`, `/api/admin/imports/:jobId/errors.csv`, `/api/admin/imports/:jobId/sync-shopify`, `/api/admin/imports/:jobId/rollback`) are migrated from `dbStore.getState()` to `RuntimeBackend`.
- `PostgresRuntimeBackend` persists `ImportJob` and `ImportError` rows in PostgreSQL, executes committed product inserts transactionally (`prisma.$transaction`), excludes `TEST-*` artifacts from real catalog commits, preserves existing product prices and inventory (`MRS-EAR-2001 = 9`), and supports transactional rollback via `rollbackImportJob`.

---

## 8. Security Boundaries

- **RBAC:** New permissions `CUSTOMIZATION_VIEW`, `CUSTOMIZATION_MANAGE`, `MODEL_ASSETS_MANAGE`, `DESIGNS_VIEW` enforced on all new admin endpoints.
- **IDOR Prevention:** All `/api/customer/designs/*` routes require `requireCustomerAuth` and filter/verify `customerId === req.customerUser.id`.
- **Upload Safety:** 3D model uploads validate `.glb`/`.gltf` extension, magic bytes (`glTF` header for `.glb` or valid JSON for `.gltf`), and 25 MB size limit, storing files with sanitized UUID keys.
- **CSRF & Cookies:** All unsafe cookie-authenticated storefront and admin mutations enforce `x-csrf-token` + `Origin` checks.
- **Audit Logging:** Profile, group, option, assignment, pricing, model asset, and import changes emit sanitized `AuditLog` entries with no secrets/PII.

---

## 9. Testing Strategy & Remaining External Dependencies

- **Unit Tests:** `packages/shared` tests for customization eligibility, dependency rules, decimal quote math, and incomplete-rate fail-closed errors.
- **API & Security Tests:** Ownership/IDOR, RBAC, manipulated price rejection, invalid 3D upload rejection, and JSON-mode import tests.
- **PostgreSQL Integration & E2E Tests:** Live tests against `mangal_royal_studio_dev` verifying profile/option/assignment persistence, quote generation, design CRUD, customized cart & order snapshots, and Excel import dry-run/commit/rollback.
- **External Dependencies:** Production object storage (S3/R2/Cloudinary) for 3D `.glb` assets, live Shopify GraphQL Admin writes, live Razorpay keys, and commercial `.glb` models from the studio's CAD team remain external dependencies.
