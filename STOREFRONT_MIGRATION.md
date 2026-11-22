# Storefront Migration & Design Fidelity Audit (`apps/storefront`)

> **Code-Verified Audit Status:** Audited against `jewellery-theme-backup/` (378 files; untouched since `2026-11-05 15:03:36`), `apps/shopify-theme/` (382 files), `apps/storefront/src/app/globals.css`, and `apps/storefront/src/app/page.tsx`. See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Visual Source of Truth & Theme File Inventory

- **Original Backup Directory (`jewellery-theme-backup/`):** **VERIFIED UNTOUCHED**
  - Contains **378 files** total (`191` in `assets/`, `2` in `config/`, `2` in `layout/`, `51` in `locales/`, `71` in `sections/`, `39` in `snippets/`, `21` in `templates/` = `377` Shopify theme files + `1` root `AGENTS.md`).
- **Active Liquid Preview Directory (`apps/shopify-theme/`):** **VERIFIED**
  - Contains **382 files** (`377` original theme files + `5` custom additions: `sections/main-wishlist.liquid`, `sections/order-tracking.liquid`, `snippets/product-price-breakup.liquid`, `templates/page.order-tracking.json`, `templates/page.wishlist.json`).
  - Served locally on port `9292` via `services/api/src/scripts/storefront-preview-server.ts` using `liquidjs` (`10.30.1`).
- **Next.js Custom Storefront (`apps/storefront/`):** **PARTIALLY IMPLEMENTED**
  - Runs on port `3000` (`next dev -p 3000`).
  - Implemented as an interactive Single-Page Application (SPA) inside `apps/storefront/src/app/page.tsx` (`889 lines`) using a `view` state machine (`'HOME' | 'COLLECTION' | 'PRODUCT' | 'SEARCH' | 'WISHLIST' | 'CHECKOUT' | 'ORDER_CONFIRMATION' | 'ACCOUNT' | 'TRACKING'`) + slide-over Cart Drawer (`cartDrawerOpen`).

---

## 2. Verified Design System Tokens (`apps/storefront/src/app/globals.css`)

| Token | CSS Variable | Value in `globals.css` | Source in `jewellery-theme-backup/` | Status |
| :--- | :--- | :--- | :--- | :--- |
| Primary Brand Burgundy | `--mrs-burgundy` | `#7D132A` | `sections/featured-collection.liquid`, `sections/shop-by-catogory.liquid` | **VERIFIED** |
| Announcement Bar Burgundy | `--mrs-burgundy-bar` | `#7A1023` | `sections/announcement-bar.liquid` | **VERIFIED** |
| Shop by Shape Burgundy | `--mrs-burgundy-shape` | `#86142C` | `sections/shop-by-shape.liquid` | **VERIFIED** |
| Trust Bar Burgundy | `--mrs-burgundy-trust` | `#8B0D2B` | `sections/trust-bar.liquid` | **VERIFIED** |
| Footer Deep Burgundy | `--mrs-burgundy-footer` | `#5B0B1C` | `sections/custom-footer.liquid` | **VERIFIED** |
| Warm Peach Surface | `--mrs-peach` | `#F8E1CF` | `sections/featured-collection.liquid` (`.mrs-bestsellers-peach-bg`) | **VERIFIED** |
| Warm Peach Secondary | `--mrs-peach-warm` | `#FBE8DB` | `sections/testimonals.liquid`, `sections/why-lab-grown.liquid` | **VERIFIED** |
| Champagne Accent | `--mrs-champagne` | `#F3DEC9` | `sections/shop-by-shape.liquid` | **VERIFIED** |
| Primary Ink Text | `--mrs-ink` | `#190303` | `config/settings_data.json` (`text: #190303`) | **VERIFIED** |
| Product Card Aspect Ratio | `.mrs-product-card-media` | `aspect-ratio: 285 / 397` | `sections/featured-collection.liquid` (`285 / 397`) | **VERIFIED** |
| Script Font Stack | `--font-script` | `'Battlemade', 'Great Vibes', 'Allura', cursive` | `layout/theme.liquid` (`Battlemade`) | **PARTIALLY IMPLEMENTED** (loads Google Fonts `Great Vibes` & `Allura` fallback unless local `Battlemade` font is installed) |
| Serif Heading Font Stack | `--font-serif` | `'Begum', 'Cormorant Garamond', Georgia, serif` | `layout/theme.liquid` (`Begum`) | **PARTIALLY IMPLEMENTED** (loads Google Fonts `Cormorant Garamond` fallback unless local `Begum` font is installed) |
| Body Sans Font Stack | `--font-sans` | `'Gotham', 'Inter', 'Poppins', sans-serif` | `layout/theme.liquid` (`Gotham`) | **PARTIALLY IMPLEMENTED** (loads Google Fonts `Inter` & `Poppins` fallback unless local `Gotham` font is installed) |

---

## 3. Section-by-Section Mapping: `jewellery-theme-backup` vs `apps/storefront`

> **Correction Note:** Earlier documentation referenced non-existent `mrs-*` Liquid filenames (e.g., `mrs-bestsellers.liquid`, `mrs-shop-by-category.liquid`). The table below lists the **exact verified Liquid filenames** in `jewellery-theme-backup/sections/` and `templates/index.json`.

| Order | Original Liquid Section File (`jewellery-theme-backup/sections/`) | Template Block Key (`templates/index.json`) | Next.js Implementation (`apps/storefront/src/app/page.tsx`) | Verification Classification & Visual Discrepancies |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `announcement-bar.liquid` | `announcement-bar` | `.mrs-announcement-bar` (lines 382–385) | **VERIFIED** (`#7A1023`, uppercase tracking, `FREE INSURED SHIPPING PAN-INDIA \| IGI & SGL CERTIFIED LAB-GROWN DIAMONDS \| BIS HALLMARKED GOLD`) |
| 2 | `header.liquid` | `header` | `.mrs-header-wrapper` (lines 388–453) | **VERIFIED** (Search trigger, brand logo `/theme-assets/brand-logo.png`, centered desktop navigation, Account/Wishlist/Cart badge icons) |
| 3 | `slideshow.liquid` | `slideshow_jF4k8W` | `.mrs-hero-banner` (lines 469–475) | **PARTIALLY IMPLEMENTED** — Renders Slide 1 (`Desktop_Banner_1.png` and mobile `Mobile_Banner_1.png`), but omits Slide 2 and prev/next slideshow controls |
| 4 | `featured-collection.liquid` | `featured_collection` | `.mrs-bestsellers-peach-bg` (lines 478–529) | **PARTIALLY IMPLEMENTED** — Uses exact `#F8E1CF` peach background, `Battlemade` script `"Our"` + `Begum` `"BESTSELLERS"`, `285 / 397` cards, and `#7D132A` `"VIEW ALL"` button, but renders a 4-column static grid instead of a horizontal carousel with prev/next arrows (`‹` / `›`) |
| 5 | `shop-by-shape.liquid` | `shop_by_shape_U9GVkE` | `.mrs-shop-by-shape` (lines 532–554) | **PARTIALLY IMPLEMENTED** — Uses `#86142C` burgundy background and script `"Diamonds"` overlay, but `DIAMOND_SHAPES` in `page.tsx` (lines 71–80) defines **8 shapes** (`Round`, `Heart`, `Radiant`, `Princess`, `Pear`, `Oval`, `Marquise`, `Emerald`) using external `cdn.shopify.com` icons instead of the **7 shapes** in `shop-by-shape.liquid` (`Round`, `Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart`) |
| 6 | `shop-by-catogory.liquid` *(original spelling in theme)* | `shop_by_catogory_b8C9wL` | `.mrs-shop-by-category` (lines 557–583) | **VERIFIED** — 6-column asymmetric grid (`Rings`, `Earrings`, `Bracelets`, `Necklace`, `Pendant`, `Mangalsutra`) with staggered odd/even vertical offsets (`margin-top: 28px`) and `#7D132A` pill buttons |
| 7 | `brand-story.liquid` | `brand_story_H4m2Lp` | `.mrs-brand-story` (lines 586–607) | **VERIFIED** — Two-column editorial layout with `"Where Luxury Meets Responsibility"` heading, `"DISCOVER MORE"` CTA, and `/theme-assets/brand-story.png` |
| 8 | `trust-bar.liquid` | `trust_bar_X7n3Qp` | `.mrs-trust-bar` (lines 610–626) | **VERIFIED** — `#8B0D2B` background with 4 trust items (`100% Certified Jewellery`, `BIS Hallmarked Gold`, `Lifetime Exchange & Buyback`, `Insured Doorstep Delivery`) |
| 9 | `shop-by-price.liquid` | `shop_by_price_T6v1Km` | `.mrs-shop-by-price` (lines 629–653) | **VERIFIED** — 4 Luxury Within Reach price tiers (`Under ₹20K`, `Under ₹40K`, `Under ₹60K`, `Above ₹60K`) filtering catalog products by price range |
| 10 | `image-banner.liquid` | `image_banner_M9p4Rt` | `.mrs-promo-banner` (lines 656–669) | **VERIFIED** — Full-width promotional banner (`/theme-assets/promo-banner.png`) with `"EXPLORE COLLECTION"` button |
| 11 | `why-lab-grown.liquid` | `why_lab_grown_W2k8Vn` | `.mrs-why-lab-grown` (lines 672–708) | **VERIFIED** — `#FBE8DB` warm peach section with 5 value pillars (`Ethically Grown`, `Chemically & Optically Identical`, `Certified Excellence`, `Up to 60% Better Value`, `Sustainable Luxury`) |
| 12 | `testimonals.liquid` *(original spelling in theme)* | `testimonals_Q5j7Yp` | `.mrs-testimonials` (lines 711–742) | **PARTIALLY IMPLEMENTED** — Renders 3 static testimonial cards instead of the interactive testimonial slider in `testimonals.liquid` |
| 13 | `custom-footer.liquid` | `custom-footer` | `.mrs-footer` (lines 843–885) | **VERIFIED** — `#5B0B1C` deep burgundy footer with 4 columns, newsletter capture, policy links, and copyright bar |

---

## 4. Storefront Views & URL Routing Audit

| View / Feature | Implementation in `apps/storefront/src/app/page.tsx` | Direct App Router URL File (`src/app/...`) | Classification |
| :--- | :--- | :--- | :--- |
| Homepage | `view === 'HOME'` | `src/app/page.tsx` (`/`) | **VERIFIED** |
| Collection / Shop View | `view === 'COLLECTION'` (Category, Shape, Price Tier filters + Sort) | None (`/collections/[slug]` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Product Detail View (PDP) | `view === 'PRODUCT'` (Metal purity, weight, certificate badge, Live Price Breakup table, Pincode checker, Add to Bag / Buy Now) | None (`/products/[slug]` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Slide-Over Cart Drawer | `cartDrawerOpen` (Qty `+/-`, remove item, coupon input, GST summary, Proceed to Checkout) | N/A (Drawer overlay) | **VERIFIED** |
| Checkout View | `view === 'CHECKOUT'` (Shipping address form, payment method selector, order creation + simulated Razorpay verification) | None (`/checkout` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Order Confirmation & Tracking | `view === 'ORDER_CONFIRMATION'` & `view === 'TRACKING'` | None (`/orders/[id]` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Wishlist View | `view === 'WISHLIST'` | None (`/wishlist` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Customer Account View | `view === 'ACCOUNT'` | None (`/account` file not created) | **PARTIALLY IMPLEMENTED** (SPA state view only) |
| Mobile Navigation Drawer | `.mrs-desktop-nav` hides below `990px`, no hamburger drawer toggle in `page.tsx` | N/A | **NOT IMPLEMENTED** |
