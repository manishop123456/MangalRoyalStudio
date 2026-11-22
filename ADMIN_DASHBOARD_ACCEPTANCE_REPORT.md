# Admin Dashboard Acceptance Report (RC1)

**Date:** 2026-11-18  
**App:** `apps/admin` (`http://localhost:3001`)

---

## 1. Verified Admin Capabilities

- **Authentication & RBAC:** Authenticated Owner login (`owner@mangalroyalstudio.com`) verified `HTTP 200` against `http://localhost:4000/api/auth/login`. RBAC permissions enforced server-side (`@mrs/api` `80/80` tests passing).
- **Overview & Database Counts:** Live PostgreSQL counts (`280` products, `3` orders, `3` customers, `8` pricing runs).
- **Product Management (`apps/admin/src/app/page.tsx`):**
  - Fetches `/api/admin/products?pageSize=500` (covers all `280` products: `8` `ACTIVE`, `272` `DRAFT`).
  - Status dropdown (`All Products (280)`, `Active`, `Draft`, `Archived`) combined with SKU/title search and category filter, resetting pagination to page 1.
  - Primary thumbnails resolved via `resolveProductImageUrl(..., API_BASE)` with `<N> imgs` count and `DRAFT`/`ACTIVE` status badges.
  - Interactive **Product Gallery Preview Modal** with supplier SKU, status, category, `Primary Image` badge, `Image X of N`, Previous/Next navigation, thumbnail strip, and graceful `onError` fallback.
- **Orders, Pricing, Inventory & Ops Modules:** Verified via `@mrs/api` `phase3-admin-operations.test.ts` (`33/33`) and `app.test.ts` (`47/47`). Unsupported Shiprocket booking explicitly disabled (`New provider bookings are disabled until Shiprocket integration is approved and configured`).

---

## 2. Verification Status

- **Navigation Unit Tests:** `3/3` passed (`apps/admin/src/lib/admin-navigation.test.ts`).
- **Typecheck & Production Build:** `tsc --noEmit` and `next build` (`4/4` pages) passed.
- **Live HTTP Probe (`http://localhost:3001/`):** `200`.
- **Interactive Browser Click-Test (1440px, 768px, 390x844):** **NOT RUN** (Chrome remote debugging not enabled).
