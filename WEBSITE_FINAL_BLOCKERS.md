# Website Final Blockers (RC1)

**Date:** 2026-11-18  
**RC1 Verdict:** **PASS WITH OWNER ACTIONS**

---

## 1. Launch Blockers Requiring Owner Input / Action

1. **272 Supplier `DRAFT` SKUs Missing Commercial Data:**
   - All `272` supplier SKUs (`SKUDTG*`, `SKUDRG*`, `SKURIGO*`, `SKUDNG*`, `SKUPDG*`, `SKUBGG*`, `SKUBRG*`, `SKUDBG*`, `SKUGTG*`) lack product titles, descriptions, metal purities/weights, diamond specifications, retail pricing, and stock quantities ([SUPPLIER_CATALOGUE_PENDING_DETAILS.csv](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/SUPPLIER_CATALOGUE_PENDING_DETAILS.csv)). They remain safely in `DRAFT` status.
2. **Low-Resolution Collage Crops (`3,115` images `< 600px`):**
   - Uncollaged studio originals (`>= 1000×1000px`) are needed for high-resolution zoom, plus manual SKU identification of the `43` unmatched assets on the contact sheets and confirmation of the `3` cross-SKU duplicate pairs.
3. **Interactive Browser UI Verification Blocked on Current Host:**
   - Chrome remote debugging (`chrome://inspect/#remote-debugging`) is not enabled and Playwright/Chromium is not installed, so desktop (`1440px`), tablet (`768px`), and mobile (`390×844`) interactive click/screenshot verification has not yet been executed.
4. **Postponed Integrations (Intentionally Out of Scope for RC1):**
   - 3D `.glb` model import, live Razorpay payments, live Shopify sync, Shiprocket shipping, and Hostinger VPS deployment (`rsync` of `605 MB` `processed-product-assets/` to `/srv/mangal-royal-studio/product-assets/`).
