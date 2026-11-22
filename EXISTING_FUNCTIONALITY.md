# Mangal Royal Studio — Existing Storefront & Commerce Functionality

This document details how every interactive feature, product display, pricing element, cart flow, filter, and Shopify integration currently operates in `jewellery-theme-backup/`.

---

## 1. Navigation, Sticky Header, Mobile Drawer & Predictive Search

### 1.1 Sticky Header (`sections/header.liquid`)
- **Sticky Mode:** Configured with `sticky_header_type: "always"`. Uses `<sticky-header data-sticky-type="always">` which keeps the `62px`-tall `.mrs-header` fixed at the top of the viewport with a subtle shadow (`0 2px 12px rgba(0, 0, 0, 0.04)`) once scrolled past.
- **Desktop Navigation (`>= 990px`):**
  - 3-column CSS Grid (`1fr auto 1fr`):
    - **Left:** Brand logo (`Group_1000004348.png`, `110px` wide) linking to `/`.
    - **Center:** Horizontal navigation (`main-menu`) with `32px` gap, `12px` uppercase `Gotham` links, `0.6px` letter-spacing, and animated `1px` `#7a1023` bottom underline on hover/current page.
    - **Dropdown Submenus:** Top-level items with children render `<div class="mrs-nav__item--has-dropdown">`. Hovering or focusing opens a `220px` min-width dropdown panel (`.mrs-dropdown`, `#ffffff` bg, `1px solid #eeeeee`, shadow `0 12px 28px rgba(0,0,0,0.08)`). Supports 3rd-level nested sublinks (`.mrs-dropdown__sublist`).
    - **Right Action Icons (`20px` gap):**
      1. **Search:** Opens Dawn `<details-modal class="header__search">` full-width top modal with `<predictive-search>` (queries `/search/suggest?q=...&resources[type]=product,page,article,collection`).
      2. **Wishlist:** Link (`<a href="/pages/wishlist">`) with heart outline SVG.
      3. **Account:** Link (`<a href="/account">` or `/account/login`) with user outline SVG (hidden on mobile `<= 989px`, moved to drawer footer).
      4. **Cart:** Link (`<a href="/cart" id="cart-icon-bubble">`) with shopping bag SVG and `.cart-count-bubble` (`15x15px` circle, `#190303` bg, `#ffffff` text, `9px` font) when `cart.item_count > 0`.
- **Mobile Navigation Drawer (`<= 989px` — `<mrs-header-drawer>`):**
  - Grid changes to `auto 1fr auto` (Hamburger button on left, centered `130px` logo, Search + Wishlist + Cart icons on right).
  - Clicking the hamburger button opens `<mrs-header-drawer>`, sliding in `.mrs-drawer` from the left (`width: 88vw; max-width: 370px`, `cubic-bezier(0.22, 1, 0.36, 1)` over `0.32s`) with a `45%` dark backdrop overlay (`[data-mrs-drawer-overlay]`), locking `document.body.style.overflow = 'hidden'`.
  - **Mobile Accordions:** Parent menu links have a dedicated `[data-mrs-submenu-toggle]` button (`+` icon that rotates `45deg` into `×` when `aria-expanded="true"`), expanding 2nd and 3rd level submenus smoothly via `grid-template-rows: 0fr -> 1fr`.
  - **Drawer Footer:** Displays a full-width `"Sign In / Sign Up"` (or `"My Account"`) button with user icon, plus country/language `<localization-form>` selectors if multiple currencies/languages are enabled.

---

## 2. Product Card Functionality (`snippets/card-product.liquid`)

The theme uses a custom, self-contained `<pc-product-card>` web component across Homepage Featured Collection, PDP Featured Collection, Collection Grids, and Search Results:

1. **Media & Hover Behaviour:**
   - Default aspect ratio is `portrait` (`285 / 397`).
   - First 4 cards in a section load with `loading="eager" fetchpriority="high"`; remaining cards use `loading="lazy"`.
   - When `p.media[1]` exists and `show_hover_image: true`, hovering on desktop (`@media (hover: hover)`) scales the primary image to `1.055` and cross-fades to `p.media[1]`.
2. **Badges (`.pc-card__badges`):**
   - Positioned `top-right` (`padding: 10px`).
   - Priority:
     1. If `p.available == false`: renders dark gray `"SOLD OUT"` badge (`#3A3232`).
     2. Else if `p.compare_at_price > p.price`: renders burgundy (`#7D132A`) `"SALE"` badge (or `"XX% OFF"` if `show_sale_percent: true`).
     3. Plus custom badge if `custom_badge` parameter or `p.metafields.custom.badge.value` / `p.metafields.custom.card_badge.value` is populated.
3. **Price Display (`.pc-card__price`):**
   - Displays `{{ p.price | money_without_trailing_zeros }}` (`16px` desktop / `14px` mobile).
   - If `on_sale` (`p.compare_at_price > p.price` and `p.available`): displays strikethrough `{{ p.compare_at_price | money_without_trailing_zeros }}` in muted `#6B5B5B`.
4. **Cart & Wishlist Icon Actions (`.pc-card__actions`):**
   - **Cart Icon Button (`[data-pc-add]`):**
     - If sold out: `disabled`.
     - If product has multiple variants (`p.variants.size > 1` or `has_only_default_variant == false`): renders an `<a href="{{ p.url }}">` link to the PDP so the customer can select options.
     - If single default variant: renders `<button data-pc-add>` which performs an AJAX `POST /cart/add.js` with `quantity: 1` and triggers `<cart-drawer>` or `<cart-notification>` (`ui.renderContents(data)` + `ui.open()`), then dispatches `cart:refresh` and `PUB_SUB_EVENTS.cartUpdate`.
   - **Wishlist Heart Button (`[data-pc-wish]`):**
     - Toggles product ID in `localStorage` under key `'pc:wishlist'`, toggles `.is-active` (filling the heart in `#7D132A`), dispatches `CustomEvent('pc:wishlist:toggle')`, and includes guarded bridges for Wishlist King (`window.wishlistKing`) and Swym (`window._swat`).
5. **Primary `"Buy Now"` Button (`.pc-buy`):**
   - Full-width burgundy bar (`#7D132A`, `30px` height desktop / `34px` mobile) with animated `#5E0E20` hover sweep.
   - If single variant: clicking `[data-pc-buy]` posts `quantity: 1` to `/cart/add.js` and immediately redirects `window.location.href = '/checkout'`.
   - If multiple variants: renders `<a class="pc-buy" href="{{ p.url }}">` linking to the PDP.

---

## 3. Product Detail Page (PDP) Functionality (`sections/main-product.liquid` & `sections/disclosures.liquid`)

### 3.1 Gallery & Full-Screen Lightbox
- Displays up to 4 product media items (`{% for media in product.media limit: 4 %}`) in an editorial grid:
  - Media 1: `.pp-media--hero` (full 2-column width, `1 / 1` square aspect ratio).
  - Media 2: `.pp-media--tall` (left column, spans 2 rows vertically).
  - Media 3 & 4: `.pp-media--small` (right column stacked, `4 / 3` landscape aspect ratio).
- Supports `image`, `video` (`video_tag`), `external_video`, and 3D `model` (`model_viewer_tag`).
- Clicking any image opens `<div class="pp-lightbox" data-lightbox>` with the `1800px`-wide image URL (`Escape` key, close `×` button, or backdrop click closes the lightbox).

### 3.2 Variant Selection & Dynamic Price/SKU Updates
- Reads the serialized `{{ product | json }}` payload from `<script type="application/json" data-product-json>`.
- When options change (via `.pp-shape` buttons or `.pp-select` dropdowns), `updateVariant()` matches the selected `optionValues` against `product.variants`:
  - Updates hidden `<input name="id" data-variant-id>`.
  - Formats `variant.price` and `variant.compare_at_price` using `Intl.NumberFormat(undefined, { style: 'currency', currency })` and updates `[data-price]` and `[data-compare]`.
  - Updates `[data-meta-sku]` with `variant.sku` (or fallback `"AB_223456"`).
  - Toggles `disabled` state and label (`"Add to cart"` vs `"Sold out"`) on the Add to Cart and Buy Now buttons.

### 3.3 Jewellery Product Details & Metafields Display
The PDP displays a 2x2 specification grid (`.pp-meta-grid`) below the Buy Now button:

| Label Setting | Default Label | Metafield Source Looked Up by Theme | Hardcoded Fallback in Theme |
| :--- | :--- | :--- | :--- |
| `gold_label` | **Gold** | `product.metafields.custom.gold.value` | `"24 carat"` |
| `diamond_label` | **Diamonds** | `product.metafields.custom.diamonds.value` | `"As applicable"` |
| `category_label` | **Categories** | `product.metafields.custom.categories.value` -> `product.type` | `"Gold, Rings"` |
| `sku_label` | **SKU** | `current_variant.sku` | `"AB_223456"` |

### 3.4 Accordions & Product Disclosures
- **4 Built-in `<details class="pp-accordion">` Tabs:**
  1. **Descriptions** (open by default): renders `{{ product.description }}`.
  2. **Care instructions** (closed by default): *"Store jewellery separately, avoid direct contact with chemicals, and clean gently with a soft cloth."*
  3. **Shipping** (closed by default): *"Free shipping on all orders. Delivery times may vary by location."*
  4. **Returns & cancellations** (closed by default): *"Returns and cancellations are subject to the store policy for this product."*
- **Shopify Legal/Compliance Disclosures (`sections/disclosures.liquid` + `snippets/product-disclosures.liquid`):**
  - Reads `product.metafields.shopify.disclosure.value`. If present and enabled for `'product_page'`, renders an expandable `<details class="disclosures__details">` section below the main PDP section.

---

## 4. Collection Filtering, Sorting & Pagination (`sections/main-collection-product-grid.liquid` & `snippets/facets.liquid`)

- **Pagination:** 16 products per page (`products_per_page: 16`), 4 columns on desktop (`columns_desktop: 4`), 2 columns on mobile (`columns_mobile: "2"`).
- **Filtering (`enable_filtering: true`, `filter_type: "horizontal"`):**
  - Uses Shopify Storefront Search & Discovery filters (`collection.filters`).
  - Supports `boolean` / `list` filters (checkboxes, swatches, or images) and `price_range` filters (`<price-range>` min/max currency inputs).
  - On mobile (`<= 749px`), filters and sorting collapse into a slide-out `<menu-drawer class="mobile-facets__wrapper">` drawer.
- **Sorting (`enable_sorting: true`):**
  - Supports Shopify collection sort options (`manual`, `best-selling`, `title-ascending`, `title-descending`, `price-ascending`, `price-descending`, `created-ascending`, `created-descending`).
- **AJAX Updates (`assets/facets.js`):**
  - Changing any filter or sort option fetches the updated section HTML via `?section_id=...`, replaces `#ProductGridContainer` and `#main-collection-filters` without a full page reload, and updates browser URL history via `window.history.pushState`.

---

## 5. Cart & Checkout Flows

1. **Cart Type Configuration (`config/settings_data.json`):**
   - `cart_type: "notification"` (renders `snippets/cart-notification.liquid` inside `sections/header.liquid`).
   - Note: Full `snippets/cart-drawer.liquid` (`<cart-drawer>`) code is also present in the theme and supported by `snippets/card-product.liquid` and `assets/standard-actions-override.js`.
2. **Cart Page (`/cart` — `templates/cart.json`):**
   - Displays line items with image, title, variant options, line-item properties, unit/discounted prices, `<quantity-input>` (`-` / `+` / numeric input), and `<cart-remove-button>`.
   - Changing quantities triggers debounced AJAX `POST /cart/change.js` (`assets/cart.js`) and re-renders `main-cart-items`, `cart-icon-bubble`, `cart-live-region-text`, and `main-cart-footer`.
   - Footer displays estimated total (`{{ cart.total_price | money_with_currency }}`), tax/shipping note, primary `"Checkout"` button (`name="checkout"` submitting to `/cart` -> Shopify Checkout), and `{{ content_for_additional_checkout_buttons }}`.

---

## 6. Interactive Carousels & Custom Scripts Summary

Because custom sections are self-contained, the theme uses **6 distinct carousel/slider implementations** across different sections:

1. **Hero Slideshow (`sections/slideshow.liquid`):** Custom IIFE fade/slide switcher with circular bottom-right prev/next buttons, optional autoplay, and `touchstart`/`touchend` swipe (`40px` threshold).
2. **Featured Collection (`sections/featured-collection.liquid`):** Custom `<pc-carousel>` Web Component (`scrollBy` with `scroll-snap-type: x mandatory`, `ResizeObserver`, and circular left/right edge buttons on desktop).
3. **Trust Bar Mobile Marquee (`sections/trust-bar.liquid`):** Pure CSS `@keyframes tb-marquee-scroll` (`22s linear infinite`) over duplicated track items on `<= 749px`.
4. **Shop by Price (`sections/shop-by-price.liquid`):** Custom infinite-loop cloning carousel (`initShopByPriceCarousel`) with mouse drag (`is-dragging`), touch swipe, and mobile dot indicators.
5. **Testimonials (`sections/testimonals.liquid`):** Custom `transform: translate3d` track slider (`TestimonialsSlider-*`) with header prev/next buttons, 5-second autoplay timer (pauses on `mouseenter`), and touch swipe (`45px` threshold).
6. **About Us — Core Values & Visionaries (`sections/content.liquid`, `sections/about-story.liquid`):** Mobile-only (`<= 749px`) single-slide switcher with Prev/Next arrows + `<select>` dropdown (`content.liquid`) or dot indicators (`about-story.liquid`) + touch swipe.

---

## 7. Shopify Platform Features & Third-Party Integrations

1. **Shopify Native Features Used:**
   - `{{ content_for_header }}` (Trekkie / Shopify Analytics / StandardEvents).
   - `standard_event_data` filter on `<collection-component>` and `<cart-items>` + `assets/standard-actions-override.js` (`window.Shopify.actions.openCart` and `updateCart`).
   - Customer Accounts (`/account/login`, `/account/register`, `/account`, `/account/orders/*`, `/account/addresses`).
   - Newsletter signup form (`{% form 'customer' %}` in `sections/custom-footer.liquid` with `contact[tags]="newsletter"`).
   - Contact form (`{% form 'contact' %}` in `sections/contact-form.liquid`).
   - Predictive Search API (`/search/suggest`).
   - Storefront Filtering (`collection.filters` / `search.filters`).
   - Product Metafields (`custom.gold`, `custom.diamonds`, `custom.categories`, `custom.badge`, `custom.card_badge`, `reviews.rating`, `reviews.rating_count`, `shopify.disclosure`).
2. **Third-Party App References:**
   - **No third-party `<script>` tags or app blocks (`@app`) are active** in `layout/theme.liquid` or any `templates/*.json` file.
   - `snippets/card-product.liquid` includes optional guarded JS hooks for **Wishlist King** (`window.wishlistKing`) and **Swym Wishlist Plus** (`window._swat`), falling back to `localStorage` when neither app is installed.

