# Storefront Acceptance Report (RC1)

**Date:** 2026-11-18  
**App:** `apps/storefront` (`http://localhost:3000`)

---

## 1. Verified Storefront Improvements

- **Homepage (`/`):** Loads live `ACTIVE` products from `/api/v1/products` (`8` baseline `MRS-*` products, `0` `DRAFT`s). Fabricated `TESTIMONIALS` and fake `★★★★★` ratings removed in prior cleanup.
- **Collections (`/collections`, `/collections/[handle]`):** Serves `all`, `rings`, `earrings`, `bracelets`, `necklaces`, `pendants`, `bangles`, `antique`, `best-sellers` with `0` `DRAFT` leaks.
- **Product Detail (`/products/[handle]`):**
  - Fixed SSR crash (`products` empty before client fetch) -> HTTP `200` on `/products/royal-celeste-solitaire-ring`.
  - Removed fake `★★★★★ 4.9 (28 Verified Studio Reviews)` block.
  - Fixed `MRS-RNG-1001` metal finish mismatch: now syncs on `matchedProduct` load and restricts metal purity/finish options to `product.variants` or the product's verified specification (`18K` `ROSE GOLD`).
  - Removed `brandStoryLeft` / `brandStoryRight` fallback gallery padding.
- **Cart (`/cart`) & Contact (`/pages/contact`, `/contact`):**
  - Cleared pre-filled `'ENGAGEMENT10'` coupon input default.
  - Replaced simulated consultation form with direct `mailto:` / `tel:` studio concierge actions and explicit notice.
- **Image URL Resolution:** All storefront image consumers (`ProductCard`, `products/[handle]`, `customize/[productId]`, `cart`, `StorefrontShell`) use `resolveProductImageUrl(..., API_ORIGIN)`.

---

## 2. Verification Status

- **Unit & Integration Tests (`@mrs/storefront`):** `7/7` passed (`vitest run`, including live `http://localhost:4000/api/v1` check).
- **Production Build:** `next build` succeeded (`22/22` routes).
- **Live HTTP Probes:** `/`, `/collections/all`, `/collections/rings`, `/products/royal-celeste-solitaire-ring`, `/pages/contact`, `/cart` all returned `200`.
- **Interactive Browser Visual Check (1440px, 768px, 390x844):** **NOT RUN** (Chrome remote debugging not enabled; `playwright`/`chromium` not installed).
