# Phase 3 Admin UI Rendering Fix Report

**Date:** 2026-11-13  
**Workspace:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`  
**Admin URL:** `http://localhost:3001`  
**API URL:** `http://localhost:4000` (`DATA_BACKEND=postgres`, `mangal_royal_studio_dev`)

---

## 1. Root Cause

In `apps/admin/src/app/globals.css`:
- `.mrs-admin-shell` uses `display: grid; grid-template-columns: 272px 1fr; min-height: 100vh;` on desktop (`> 1024px`).
- At `@media (max-width: 1024px)` (tablet `768×1024`, mobile `390×844`, or a narrowed/split-screen Safari window `<= 1024px`), `.mrs-admin-shell` switched to `grid-template-columns: 1fr;`, stacking `.mrs-sidebar` above `.mrs-main`.
- **However, `.mrs-sidebar` retained `position: sticky; top: 0; height: 100vh; overflow-y: auto;`** inside the `1fr` single-column layout.
- As a result, at `<= 1024px`, `.mrs-sidebar` (showing the `"Royal Operations"` header and all 19 navigation items) expanded to **100% of the viewport width and 100% of the viewport height (`100vh`)** and remained sticky at `top: 0`, pushing `.mrs-main` (including the topbar and the selected module's workspace) completely below the `100vh` fold. Clicking `"Product & Jewellery Specs"` highlighted the sidebar item while `.mrs-main` updated off-screen below `100vh`.

---

## 2. Files Changed

1. `apps/admin/src/app/globals.css`
2. `apps/admin/src/app/page.tsx`

*(No changes to PostgreSQL schema, migrations, database records, `.env`, protected JSON files, `jewellery-theme-backup/`, or `apps/shopify-theme/`.)*

---

## 3. Actual Fix

1. **`apps/admin/src/app/globals.css`:**
   - Inside `@media (max-width: 1024px)`:
     - Reset `.mrs-sidebar` to `position: relative; top: auto; height: auto; overflow-y: visible; border-right: none; border-bottom: 1px solid rgba(251, 232, 219, 0.14);`.
     - Show `.mrs-mobile-nav-toggle` (`display: inline-flex !important`).
     - Collapse `.mrs-sidebar-nav-collapsible` (`display: none`) unless `.open` (`display: block`) is active.
     - Tighten `.mrs-topbar`, `.mrs-placeholder-banner`, and `.mrs-content` padding for smaller viewports.
   - Desktop (`> 1024px`) layout remains `grid-template-columns: 272px 1fr` with `.mrs-sidebar-nav-collapsible` always visible and `.mrs-mobile-nav-toggle` hidden.
2. **`apps/admin/src/app/page.tsx`:**
   - Added `mobileNavOpen` state (`useState(false)`).
   - Added a `"☰ Modules (N)"` / `"✕ Close Navigation"` toggle button inside `.mrs-brand-header`.
   - Wrapped `<nav>` and the sidebar footer in `.mrs-sidebar-nav-collapsible ${mobileNavOpen ? 'open' : ''}`.
   - Updated module button `onClick` to call `setActiveModule(item.id)` and `setMobileNavOpen(false)` so selecting a module on `<= 1024px` immediately closes the drawer and reveals the module workspace above the fold.

---

## 4. API & Backend Verification

- `GET http://localhost:4000/health` returned HTTP 200 with `"backend": "postgres"`, `"counts": {"products": 8, "categories": 9, "orders": 3, "customers": 3, "pricingRuns": 8}`.
- `GET http://localhost:3001` returned HTTP 200.

---

## 5. TypeScript, Test, Build & Checksum Results

- `npm run typecheck --workspace=@mrs/admin`: **PASS** (exit 0)
- `npx vitest run apps/admin/src/lib/admin-navigation.test.ts`: **PASS** (**3/3**)
- `DATA_BACKEND=json NODE_ENV=test npm --workspace=@mrs/api exec -- vitest run src/phase3-admin-operations.test.ts`: **PASS** (**33/33**)
- `npm run build --workspace=@mrs/admin`: **PASS** (exit 0, 4/4 static pages generated)
- Protected SHA-256 checksums:
  - `.data/platform-state.json`: `3495c9aa1d8652c9bcbfdbc875d75eaa7776cb55b50ded6bdcc2e07e6849d51b` (MATCH)
  - `services/api/.data/platform-state.json`: `84a50caa345998509d7eb3a120f54ed65e5d9554ff91350cf254472f02e56f7f` (MATCH)

---

## 6. Browser & Responsive Status / Remaining Limitations

- Automated browser execution (`browser` subagent / Chrome DevTools `DevToolsActivePort` and Playwright) is unavailable in this environment, so live Safari/Chrome DOM & screenshot verification across `1440×900`, `1280×800`, `768×1024`, and `390×844` must be confirmed directly by the developer in Safari after reloading `http://localhost:3001`.
