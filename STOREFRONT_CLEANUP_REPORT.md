# Storefront Cleanup Report

**Date:** 2026-11-15  
**Scope:** Audit and cleanup of `apps/storefront` to remove fabricated reviews, static product catalogue fallbacks, and sample promotional copy while preserving the Mangal Royal Studio design, customer flows, and protected files/data.

---

## 1. Changes Applied

### 1.1 Removed Fabricated Testimonials & Fake Star Ratings
- **File:** [page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/page.tsx)
- **What was removed:**
  - Removed the hardcoded `TESTIMONIALS` constant (`Ananya Sharma`, `Rohan & Meera Mehta`, `Priya Desai`).
  - Removed the `WHAT OUR CUSTOMERS SAY` homepage section (`{/* 12. TESTIMONIALS (sections/testimonals.liquid) */}`) rendering `★★★★★` fake star ratings and `"Verified Buyer"` labels.

### 1.2 Removed Static Storefront Catalogue Fallback
- **File:** [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx)
- **What was changed:**
  - Removed `STOREFRONT_PRODUCTS` import and changed initial `products` state from `useState<JewelleryProductSpec[]>(STOREFRONT_PRODUCTS)` to `useState<JewelleryProductSpec[]>([])`.
  - Updated `loadProducts()` so backend responses control `products` directly (`setProducts(data.products)` or `setProducts([])` if absent) and error messages report `"Live catalogue unavailable (...). Please retry."` instead of falling back to a static reference array.

### 1.3 Replaced Sample Promotional Announcement & Cart Placeholder
- **Files:**
  - [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx)
  - [cart/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/cart/page.tsx)
- **What was changed:**
  - Replaced `"Get 10% OFF On Engagement Rings — Use Code ENGAGEMENT10"` in the announcement bar with `"IGI Certified Lab-Grown Diamonds • BIS Hallmarked Gold • Insured Pan-India Delivery"`.
  - Replaced `placeholder="ENGAGEMENT10"` on the cart privilege code input with `placeholder="Enter privilege code"`.

---

## 2. Audit Notes (Remaining / Preserved Items)

- **Footer & Navigation:** Inspected in [StorefrontShell.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/StorefrontShell.tsx); clean, no fake newsletter form.
- **Product Card:** Inspected in [ProductCard.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/components/ProductCard.tsx); clean, no fake ratings.
- **Contact Page:** [pages/contact/page.tsx](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/app/pages/contact/page.tsx) contains a client-only inquiry form (`setSubmitted(true)` without a backend endpoint) and shares routes with `/contact` (`22` static/dynamic storefront routes built cleanly). Left intact to avoid breaking existing navigation.
- **Protected Assets Untouched:** `jewellery-theme-backup/`, `apps/shopify-theme/`, `.data/platform-state.json`, `services/api/.data/platform-state.json`, and baseline PostgreSQL data were not modified.

---

## 3. Verification Results

| Check | Result | Details |
| --- | --- | --- |
| `@mrs/shared` tests | PASS | 2 files, 7 tests passed (`vitest run`) |
| `@mrs/storefront` tests | PASS | 1 file, 7 tests passed (including live API integration against `http://localhost:4000/api/v1`) |
| `@mrs/admin` navigation tests | PASS | 1 file, 3 tests passed (`apps/admin/src/lib/admin-navigation.test.ts`) |
| `@mrs/api` tests (`DATA_BACKEND=json`) | PASS | 2 files, 80 tests passed (`src/app.test.ts` 47, `src/phase3-admin-operations.test.ts` 33) |
| Workspace `typecheck` | PASS | `@mrs/shared`, `@mrs/api`, `@mrs/admin`, `@mrs/storefront` (`tsc --noEmit`) |
| Workspace `build` | PASS | `@mrs/shared`, `@mrs/api`, `@mrs/admin` (4 pages), `@mrs/storefront` (22 pages) |
| Protected JSON SHA-256 | VERIFIED | `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b`<br>`services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` |
| PostgreSQL Baseline Counts | VERIFIED | `ProductMetadata=8`, `OrderMetadata=3`, `Customer=3`, `ProductImage=0` |
