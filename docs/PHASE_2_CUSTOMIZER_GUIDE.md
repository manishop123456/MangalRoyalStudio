# Phase 2 Storefront Customizer & 3D Viewer Guide

## Customizer Flow
1. On any eligible product page (`/products/[handle]`), the storefront fetches `/api/public/products/:sku/customization`.
2. When `eligible` is true and a `profile` is active, customers can switch between **Bespoke Customizer** and **Standard Ready-to-Ship**.
3. Selecting metal purity/tone, diamond grade, ring size, surface finish, or entering optional inside-band engraving triggers an authoritative `POST /api/public/customization/quote` call.
4. Stale quote responses are discarded via an `AbortController` + request sequence counter so displayed pricing always matches the latest selection.
5. Clicking **Save Design** persists the configuration to `/api/customer/designs` (when signed in). Saved designs appear in `/account` under **Saved Bespoke Designs** with options to **Reopen & Edit** (`?designId=...`), **Add to Bag**, **Duplicate**, or **Delete**.

## 3D Model Viewer
- If the product has an `ACTIVE` `ProductModelAsset`, a **Photo Gallery | Interactive 3D View** toggle appears above the media frame.
- `Product3DViewer` is loaded lazily via `next/dynamic(..., { ssr: false })` only when the user selects **Interactive 3D View**.
- Customers can drag to orbit, scroll to zoom, toggle auto-spin, or reset the camera. If WebGL2 is unavailable or no 3D asset is configured, the storefront cleanly uses the standard Dawn photo gallery.
