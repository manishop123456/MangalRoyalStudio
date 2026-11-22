# Mangal Royal Studio — Shopify Theme & Architecture Audit Report

**Date:** 2026-11-05  
**Source Audited:** `jewellery-theme-backup/` (Read-Only Audit)  
**Brand Identity:** Mangal Royal Studio — *"A unit of Mangal Royal Jewels Pvt Ltd — since 1975"* (IGI-certified lab-grown diamond & gold jewellery)  
**Target Architecture:** Next.js (App Router) + TypeScript Storefront & Admin UI, Custom Node.js/Express + TypeScript Backend, PostgreSQL Database, and Shopify (Storefront API + GraphQL Admin API + Shopify Checkout) as the Commerce System of Record.

---

## 1. Executive Summary

We have completed a comprehensive, file-by-file inspection of `jewellery-theme-backup` (377 files total) and all root architecture specifications (`AGENTS.md`, `SYSTEM_ARCHITECTURE.md`, `DATA_MODEL.md`, `API_SPEC.md`, `SECURITY.md`, `IMPLEMENTATION_PLAN.md`).

### Key Conclusions
1. **Base Theme & Customizations:** The supplied theme is built on **Shopify Dawn v15.5.0** (Online Store 2.0), heavily modified with **19 bespoke, self-contained Liquid sections** and a custom `<pc-product-card>` web component designed specifically for **Mangal Royal Studio**.
2. **Design Source of Truth:** Virtually all visible customer-facing UI (Announcement Bar, Sticky Header, Hero Slideshow, Featured Collection Carousel, Shop by Shape, Shop by Category, Brand Story, Trust Bar, Shop by Price, Why Lab Grown, Testimonials, Custom Product Detail Page, About Us 6-section Editorial Page, and Custom Burgundy Footer) uses custom-scoped CSS with explicit desktop, tablet, and mobile pixel settings rather than standard Dawn styling.
3. **Current Pricing Model in Theme:** The theme currently displays static Shopify variant `price` and `compare_at_price` in INR (`₹`) with no dynamic metal/diamond/making-charge price breakdown or calculation engine. Product metal/diamond details on the PDP are read from simple text metafields (`custom.gold`, `custom.diamonds`, `custom.categories`) with hardcoded fallbacks (`"24 carat"`, `"As applicable"`, `"Gold, Rings"`).
4. **No Theme Files Modified:** In strict compliance with project rules, `jewellery-theme-backup` was inspected read-only and remains 100% untouched.

---

## 2. Theme Identity & Directory Inventory

| Property | Value | Source |
| :--- | :--- | :--- |
| **Base Theme Name** | `Dawn` | `config/settings_schema.json` |
| **Base Theme Version** | `15.5.0` | `config/settings_schema.json` |
| **Author** | Shopify (customized for Mangal Royal Studio) | `config/settings_schema.json`, `sections/*.liquid` |
| **Total File Count** | **377 files** | `jewellery-theme-backup/` |

### Directory Breakdown (`jewellery-theme-backup/`)

| Directory | File Count | Description |
| :--- | :---: | :--- |
| `layout/` | 2 | `theme.liquid` (main storefront wrapper) and `password.liquid` (storefront password gate). |
| `config/` | 2 | `settings_schema.json` (theme settings definitions) and `settings_data.json` (active colour schemes, typography, cart settings). |
| `templates/` | 21 | 13 top-level JSON templates (`index`, `product`, `collection`, `list-collections`, `cart`, `search`, `page`, `page.about-us`, `page.contact`, `blog`, `article`, `404`, `password`), 1 Liquid template (`gift_card.liquid`), and 7 customer account JSON templates (`templates/customers/*.json`). |
| `sections/` | 73 | 2 section groups (`header-group.json`, `footer-group.json`), **19 custom/heavily-customized Mangal Royal Studio sections**, and 52 standard Dawn sections. |
| `snippets/` | 48 | Includes the custom self-contained `card-product.liquid` (`<pc-product-card>`), `price.liquid`, `facets.liquid`, `product-disclosures.liquid`, `cart-notification.liquid`, `cart-drawer.liquid`, `header-*.liquid`, and Dawn utility snippets. |
| `assets/` | 172 | 52 CSS files (`base.css`, `component-*.css`, `section-*.css`, `template-*.css`), 36 JS files (`global.js`, `cart.js`, `facets.js`, `product-info.js`, `standard-actions-override.js`, etc.), 83 SVG icons (`icon-*.svg`), and 1 GIF (`sparkle.gif`). |
| `locales/` | 58 | 29 language locale pairs (`*.json` + `*.schema.json`), with `en.default.json` and `en.default.schema.json` active. |
| Root | 1 | `AGENTS.md` |

---

## 3. Custom vs. Standard Dawn Components

### 3.1 Custom / Heavily Customized Sections & Snippets (Must Recreate 1:1 in Next.js)

| File | Section / Component Name | Used On | Purpose & Key Characteristics |
| :--- | :--- | :--- | :--- |
| `sections/announcement-bar.liquid` | Announcement Bar | Global (`header-group.json`) | Burgundy (`#7a1023`) top bar, 34px desktop / 32px mobile height, `"Get 10% OFF On Engagement Rings"`. |
| `sections/header.liquid` | `.mrs-header` & `<mrs-header-drawer>` | Global (`header-group.json`) | Custom 3-column sticky header (`62px` height), desktop dropdown nav (`main-menu`), search modal, `/pages/wishlist` link, account link, cart bubble (`15x15px`), and custom left-sliding mobile drawer with `+`/`−` accordions. |
| `sections/custom-footer.liquid` | `#MRSFooter-*` Custom Footer | Global (`footer-group.json`) | Burgundy (`#7d132a`) footer with top newsletter bar (`"Join the mailing list"`), 5-column desktop grid (Brand + 3 menus + Social links), and mobile collapsible accordions. Replaces disabled Dawn `sections/footer.liquid`. |
| `sections/slideshow.liquid` | Hero Banner Slideshow | Homepage (`index.json` #1) | Full-bleed hero (`610px` desktop / `400px` mobile), Eyebrow (`"TRADITION IN TRUST"`), Cursive Heading (`"Brilliance For Today"`), `"Shop Now"` CTA with diagonal arrow and expanding underline, circular bottom-right prev/next buttons. |
| `sections/featured-collection.liquid` | Featured Collection (`<pc-carousel>`) | Homepage (`index.json` #2), PDP (`product.json` #5) | `"The most loved"` / `"Our Bestsellers"`. 4-column desktop carousel with circular side arrows, 2-column mobile grid, `"View All →"` bottom CTA. |
| `snippets/card-product.liquid` | Universal Product Card (`<pc-product-card>`) | Homepage, PDP, Collection Grid, Search | Portrait (`285/397`) media with hover secondary image zoom (`scale(1.055)`), top-right burgundy badge (`#7D132A`), 2-line uppercase title, price + compare price, inline cart & heart wishlist icon buttons, and full-width `"Buy Now"` button (`#7D132A`, hover fill `#5E0E20`). |
| `sections/shop-by-shape.liquid` | Shop by Shape | Homepage (`index.json` #3) | Burgundy (`#86142c`) section with 7 diamond cuts (`Round`, `Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart`). 7-item flex row on desktop, horizontal scroll-snap on tablet, 3-col grid on mobile. |
| `sections/shop-by-catogory.liquid` | Shop by Category *(note filename typo)* | Homepage (`index.json` #4) | Warm peach (`#f8e1cf`) section with 7 categories (`Rings`, `Bracelets`, `Earrings`, `Bangles`, `Pendants`, `Necklaces`, `Antique`). Desktop 4-col grid with `-48px` vertical stagger on alternating columns; mobile swipe carousel (`83.333%` card width). |
| `sections/brand-story.liquid` | Brand Story | Homepage (`index.json` #5) | 2-column split (42% text / 58% 3-image collage). `"ROOTED IN LEGACY"` + overlapping `"Build for today."` script heading (`-24px` margin-top) + scroll fade animations. |
| `sections/trust-bar.liquid` | Trust Bar | Homepage (`index.json` #6), PDP (`product.json` #4) | Burgundy (`#8b0d2b`) bar (`84px` desktop / `78px` mobile) with 4 custom stroke SVGs (`IGI Certified`, `Lifetime Exchange`, `Free Shipping`, `Free Resizing`). 4-col grid on desktop, 22-second infinite CSS marquee on mobile. |
| `sections/shop-by-price.liquid` | Shop by Price | Homepage (`index.json` #7) | 4 square (`285px`) cards with `28px` burgundy bottom strip (`"UNDER ₹15K"`, `"₹15K TO ₹25K"`, `"₹25K TO ₹50K"`, `"₹50K AND ABOVE"`). Infinite loop drag carousel on desktop & mobile (`2.5` cards visible on mobile + dot indicators). |
| `sections/why-lab-grown.liquid` | Why Lab Grown | Homepage (`index.json` #9) | Warm peach (`#f9e2d2`) 50/50 split: `795px` tall portrait image on left; `"The conscious choice"` / `"Why lab grown?"` + 3 custom SVG feature rows (`flower`, `leaf`, `gem`) + `"Shop now"` CTA on right. |
| `sections/testimonals.liquid` | Testimonials Carousel *(note filename typo)* | Homepage (`index.json` #10) | `"Loved by families"` / `"WHAT OUR CUSTOMERS SAY"`, top-right circular prev/next buttons, horizontal carousel showing ~2.15 bordered review cards (`576px` wide, 5s autoplay, touch swipe). |
| `sections/main-product.liquid` | Premium Product Page (`#premium-product-*`) | PDP (`product.json` #1) | Custom 2-column PDP (55% 4-image editorial grid with full-screen lightbox / 45% sticky info panel). Includes breadcrumbs, title, star rating, price, circular shape swatches + dropdown selects, quantity + Add to Cart + Wishlist + Buy Now buttons, 2x2 details grid (`Gold`, `Diamonds`, `Categories`, `SKU`), shipping note, and 4 `<details>` accordions. |
| `sections/mangal-physical-store-cta.liquid` | Physical Store CTA | PDP (`product.json` #6) | Peach (`#FBE8DB`) banner with `#E7D1C4` top/bottom borders: `"Loved it online? Now you can find it in our physical store."` + `"visit our store !"` script + `"GET STORE LOCATION"` button (`#8E1230`). |
| `sections/heritage-modern-editorial.liquid` | Heritage Modern Editorial | About Us (`page.about-us.json` #2) | 47%/53% split hero: `"We believe in blend"` / `"WHERE HERITAGE MEETS THE MODERN DIAMOND."`, body copy, belief line, `"EXPLORE OUR COLLECTION"` button, and right portrait image. |
| `sections/legacy-jewellery-editorial.liquid` | Legacy Jewellery Editorial | About Us (`page.about-us.json` #3) | Peach (`#f7e0d0`) 50/50 split with overlapping 2-image stage on left (`390x290` back + `390x300` front offset) and 1975 founding narrative on right. |
| `sections/content.liquid` | Core Values | About Us (`page.about-us.json` #4) | Burgundy (`#7d132a`) 4-column desktop grid (`Legacy & Trust`, `Modern Luxury`, `Conscious Brilliance`, `Emotional Storytelling`) with `#b88996` left borders; mobile slider with prev/next arrows + `<select>` dropdown. |
| `sections/visionaries-editorial-collage-fixed.liquid` | Brand Promise Collage | About Us (`page.about-us.json` #5) | Burgundy (`#8d102c`) band with 5-image collage on left (`480x500` desktop stage) and `"BRAND PROMISE"` / `"Every piece. Every detail. Every time."` on right. |
| `sections/mangal-group-legacy.liquid` | Mangal Group Legacy | About Us (`page.about-us.json` #6) | 3x2 grid of 6 company cards (`Mangal Royal Studio`, `Mangal Credit and Fincorp`, `Mangal Finserv`, `Mangal BuildHome`, `Mangal Entertainment`, `Mangal Charitable Trust`) with `#D99AAA` borders and custom SVGs. |
| `sections/mangal-forever-piece-cta.liquid` | Forever Piece CTA | About Us (`page.about-us.json` #7) | Peach (`#FBE8DB`) centered CTA: `"Ready to find your forever piece?"` with `"SHOP COLLECTIONS"` (`#170A09`) and `"GET AT HOME SERVICE"` outlined button. |
| `sections/about-story.liquid` | Visionaries Editorial | Built in theme, not currently placed in `page.about-us.json` | Alternating 2-column profile section (`"THE VISIONARIES BEHIND MANGAL ROYAL STUDIO"`) with mobile dot/arrow carousel. Available to enable if desired. |

---

## 4. Technical Bugs, Quirks & Gaps Discovered in the Existing Theme

During our file-by-file audit, we uncovered **12 specific technical issues and incomplete configurations** in `jewellery-theme-backup` that must be documented and addressed (with owner approval where applicable) during the Next.js rebuild:

1. **Missing Custom Font Files (`Battlemade`, `Begum`, `Gotham`):**
   - Multiple custom sections (`slideshow.liquid`, `featured-collection.liquid`, `shop-by-shape.liquid`, `shop-by-catogory.liquid`, `brand-story.liquid`, `trust-bar.liquid`, `shop-by-price.liquid`, `why-lab-grown.liquid`, `testimonals.liquid`, `header.liquid`, `custom-footer.liquid`) specify `'Battlemade'`, `'Begum'`, and `'Gotham'` first in their CSS `font-family` stacks.
   - However, **no `.woff2`, `.woff`, `.ttf`, or `.otf` font files exist in `assets/`**, nor is there any `@font-face` declaration in `layout/theme.liquid` or `assets/base.css` for those three fonts. Currently, browsers silently fall back to the Google Fonts / system fonts loaded in each section (`Great Vibes` / `Allura`, `Cormorant Garamond` / `Georgia`, `Lato` / `DM Sans` / `Montserrat` / `Inter` / `Poppins`).
2. **Broken CSS Selector Typo in `sections/brand-story.liquid` (Lines 230–248):**
   - Lines 230–248 contain a hardcoded `<style>` override targeting `iv.brand-story-template--18061448413289__brand_story_cABfpx .brand-story__main-heading` (missing the `d` in `div`), plus a hard-coded Shopify section instance ID.
3. **Incompatible Wishlist `localStorage` Keys & Missing `/pages/wishlist` Page:**
   - The header wishlist icon links to `/pages/wishlist`, but there is **no `templates/page.wishlist.json` template** in the theme.
   - Furthermore, `snippets/card-product.liquid` saves wishlist items to `localStorage.getItem('pc:wishlist')` as an array of **product IDs**, whereas `sections/main-product.liquid` saves wishlist items to `localStorage.getItem('mangal-wishlist')` as an array of **product handles**! Wishlisting a product on a collection/homepage card does not show as wishlisted on the product detail page, and vice versa.
4. **Mismatched Snippet Parameters in `sections/main-collection-product-grid.liquid`:**
   - `main-collection-product-grid.liquid` calls `{% render 'card-product' %}` passing Dawn's old parameter names (`media_aspect_ratio`, `show_secondary_image`, `skip_styles`), whereas the custom `snippets/card-product.liquid` expects `image_ratio`, `show_hover_image`, and `skip_card_styles`. Because `skip_card_styles` is not passed, `main-collection-product-grid.liquid` outputs the `<style>` block on every single product card in a collection grid instead of once per page.
5. **Orphaned Blocks in `templates/product.json`:**
   - `templates/product.json` still lists Dawn's default blocks (`vendor`, `title`, `price`, `variant_picker`, `quantity_selector`, `buy_buttons`, `description`, `share`) under `sections.main`, even though `sections/main-product.liquid` was replaced with the custom `Premium Product Page` section that does not use blocks.
6. **PDP Option Swatch Assumption (`sections/main-product.liquid` Line 818):**
   - In `main-product.liquid`, whenever `product.options.size > 1`, the first option (`forloop.first`) is rendered as circular diamond-shape icon buttons (`.pp-shape` with `.pp-shape-mark`, hiding the option text inside the button) regardless of whether Option 1 is actually "Shape", "Metal Purity", or "Ring Size".
7. **Incomplete Images/Links in `templates/index.json`:**
   - **Hero Slideshow (`slideshow_nAcmpg`):** Slide 1 is fully configured, but Slide 2 (`slide_mwwjMg`) has no image or button link (`shopify://svg-placeholder`).
   - **Shop by Shape (`shop_by_shape_fhKnUK`):** Block 1 (`Round`) has image `0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png` and link `/collections/round`, while the other 6 shapes (`Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart`) have blank images and links in `templates/index.json` (rendering SVG geometric placeholders).
   - **Shop by Price (`shop_by_price_7pqwbQ`):** All 4 price cards have images and labels, but their `link` settings are currently empty (`""`).
   - **Why Lab Grown (`why_lab_grown_CqHY3r`):** The `"Shop now"` button `button_link` is currently empty (`""`).
   - **Testimonials (`testimonals_MTcpn9`):** All 4 testimonial cards contain the same placeholder review text (`"Jay Veer"`).
8. **Content Spelling Typos in Theme JSON / Filenames:**
   - Section filenames: `sections/shop-by-catogory.liquid` and `sections/testimonals.liquid`.
   - `shop_by_shape_fhKnUK` subtitle in `templates/index.json`: `"Crafter for you"` (likely intended as `"Crafted for you"`).
   - `custom_footer_cmNB7q` menu 3 handle in `sections/footer-group.json`: `"servies"` (typo in Shopify menu handle).
   - `custom_footer_cmNB7q` social links: both Instagram and Facebook URLs are set to `https://www.instagram.com/`.
9. **Cart Notification vs. Custom Product Page Add-to-Cart:**
   - `config/settings_data.json` sets `"cart_type": "notification"`. While `snippets/card-product.liquid` requests section rendering for `<cart-notification>` / `<cart-drawer>`, `sections/main-product.liquid` posts to `/cart/add.js` without requesting sections and only displays inline text `"Added to cart"` (`data-status`) without updating the header `.cart-count-bubble` DOM element!
10. **Static Metafield Fallbacks on PDP:**
    - When `custom.gold` is not populated on a product, `main-product.liquid` falls back to displaying `"24 carat"` (even though diamond jewellery is typically 14K or 18K gold).
11. **Multiple Redundant Google Fonts `@import` Calls:**
    - Almost every custom section injects its own `<style>@import url('https://fonts.googleapis.com/css2?...');</style>` inside `<body>`, causing 8+ separate render-blocking Google Fonts CSS requests on the homepage and About Us page. In Next.js, we can load these cleanly once via `next/font/google` and `next/font/local` while preserving exact visual fidelity.
12. **Unused Section (`sections/about-story.liquid`):**
    - `sections/about-story.liquid` (`"THE VISIONARIES BEHIND MANGAL ROYAL STUDIO"`) is built in the theme but not currently referenced in `templates/page.about-us.json`.

---

## 5. Reusability & Next.js Migration Assessment

| Layer / Asset | Reusable Directly? | Migration Strategy for Next.js + Custom Backend |
| :--- | :---: | :--- |
| **Visual Design, Layouts, Spacing & CSS Rules** | **Yes (100%)** | Port all custom CSS variables, grid templates, typography scales, colours, and responsive breakpoints (`<=749px`, `<=767px`, `<=989px`, `>=990px`) 1:1 into modular Next.js TypeScript components. |
| **Inline SVG Icons & Graphics** | **Yes (100%)** | Extract all custom inline SVGs (Header, Footer, Card Product, Trust Bar, Why Lab Grown, Core Values, Mangal Group Legacy, Diamond Shape Placeholders) and `assets/icon-*.svg` into typed React icon components. |
| **Shopify Media (`shopify://shop_images/*`)** | **Yes (via Shopify CDN)** | Fetch active product/collection/editorial images from Shopify Storefront API / CDN (`cdn.shopify.com`) and configure `next.config.ts` `images.remotePatterns`. |
| **Catalog, Variants, Cart & Checkout** | **Yes (via Shopify APIs)** | Use **Shopify Storefront API** for customer-facing products, collections, search, and cart mutations (`cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`), redirecting to `cart.checkoutUrl` on Shopify. |
| **Jewellery Pricing Engine** | **New (Custom Backend)** | Build in the Node.js/Express + TypeScript + PostgreSQL backend (`rate_cards`, `pricing_rules`, `product_Exit/jewellery_specs`, `price_DryRun/calculation_runs`, `price_snapshots`) and publish approved prices to Shopify variants via Shopify GraphQL Admin API. |
| **Bulk Product Import (600+ SKU CSV)** | **New (Custom Backend)** | Build CSV validator, dry-run preview, downloadable error report, and controlled batch/bulk sync to Shopify GraphQL Admin API + PostgreSQL. |
| **Shiprocket & Notifications** | **New (Custom Backend)** | Integrate Shiprocket API and Shopify order/fulfillment webhooks (`orders/paid`, `orders/cancelled`, `refunds/create`) in the custom backend with HMAC verification and idempotency. |

---

## 6. Shopify Basic Plan Capabilities & Risks

Per `AGENTS.md`, we must not assume Shopify Basic supports Plus-only checkout modifications:
1. **Checkout UI Extensions & Custom Checkout Pages:** On Shopify Basic, Checkout UI Extensions (beyond basic branding settings in the Shopify Admin Checkout Editor) are restricted to Shopify Plus. Therefore, **using Shopify's native hosted `cart.checkoutUrl` with Razorpay configured as a native payment gateway inside Shopify Admin** is the safest, PCI-compliant, and plan-supported path.
2. **Custom App & GraphQL Admin API Access:** Shopify Basic supports creating a custom app in the Shopify Dev Dashboard with GraphQL Admin API and Storefront API scopes, subject to standard API rate limits (which our backend batching/bulk operations will respect with retry/backoff).
3. **Customer Accounts:** Shopify Basic supports both legacy Multipass-free Customer Accounts (Storefront API `customerAccessTokenCreate` or Shopify New Customer Accounts OAuth).

---

## 7. Proposed Milestone Plan

In accordance with `AGENTS.md` and `IMPLEMENTATION_PLAN.md`, no implementation code has been written yet. Upon owner approval of this audit and `DECISIONS.md`, we propose executing one milestone at a time:

- **Milestone 0 — Theme Audit & Architecture Alignment (COMPLETED IN THIS STEP)**
  - Deliverables: `AUDIT_REPORT.md`, `PAGE_STRUCTURE.md`, `DESIGN_SYSTEM.md`, `THEME_ASSETS.md`, `EXISTING_FUNCTIONALITY.md`, `DECISIONS.md`.
- **Milestone 1 — Monorepo Foundation, Database Schema & Shopify Read-Only Connectivity**
  - Scaffold `apps/web` (Next.js + TypeScript strict), `apps/api` (Express + TypeScript strict), `packages/shared` (Zod schemas & types), Prisma/PostgreSQL migrations (`DATA_MODEL.md`), health checks, and read-only Shopify Storefront/Admin API clients.
- **Milestone 2 — Exact 1:1 Storefront Recreation (Next.js)**
  - Recreate Announcement Bar, Sticky Header + Mobile Drawer, Custom Footer, all 10 Homepage sections, Collection page with facets/sorting, Universal Product Card, Custom Premium Product Page (PDP), Cart Drawer/Notification & Cart Page, About Us (6 editorial sections), Contact, Search, and Policy pages matching `jewellery-theme-backup` pixel-for-pixel.
- **Milestone 3 — Admin Authentication, RBAC & Jewellery Pricing Engine**
  - Implement Owner / Manager / Pricing Operator authentication, rate cards (Gold 14K/18K/22K/24K, Silver, Platinum, Diamond quality/size matrix), versioned formula rules, per-product jewellery attributes, preview -> validation -> owner approval -> publish workflow, immutable pricing snapshots, and unit/integration tests.
- **Milestone 4 — Bulk CSV Import & Sync Engine (600+ Products)**
  - Implement CSV parser, strict validation (headers, SKU/handle uniqueness, weights, purities, image URLs), dry-run preview, downloadable CSV error report, and batched Shopify GraphQL Admin API product/variant/metafield sync with retry/backoff.
- **Milestone 5 — Checkout Hand-off, Webhooks, Shiprocket Shipping & Order Ops**
  - Verify Shopify Checkout + Razorpay hand-off, implement HMAC-verified idempotent Shopify webhooks (`orders/create`, `orders/paid`, `orders/cancelled`, `refunds/create`), order pricing snapshot linkage, Shiprocket shipment/AWB/label/tracking integration, and admin order dashboard.
- **Milestone 6 — End-to-End QA, Security Hardening & Production Cutover Readiness**
  - Full test suite, Lighthouse & responsive visual verification against original Shopify theme, security checklist verification, and deployment runbook.

