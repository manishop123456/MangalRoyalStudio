# Mangal Royal Studio — Theme Assets, Media, Icons, CSS & JS Inventory

This document catalogs all images, custom inline SVGs, icon files, stylesheets, JavaScript modules, fonts, and locale assets inside `jewellery-theme-backup/`.

---

## 1. Shopify Store Images (`shopify://shop_images/*`)

All configured images across `config/settings_data.json`, `sections/footer-group.json`, and `templates/index.json` are hosted on the Shopify store's Files/Media library (`shopify://shop_images/...`) and served via `cdn.shopify.com` when rendered:

| # | Image Filename (`shopify://shop_images/...`) | Where Used | Role & Dimensions in Theme |
| :-: | :--- | :--- | :--- |
| 1 | `Group_1000004348.png` | `config/settings_data.json` (`settings.logo`) | Header Brand Logo (`110px` desktop width, `130px` mobile max-width). |
| 2 | `6b6217cf80a12befaeed66e6688a7640fc7d7c82.png` | `sections/footer-group.json` (`custom_footer_cmNB7q`) | Footer Brand Logo (`120px` width on `#7d132a` burgundy background). |
| 3 | `2cad1ff177013aa3114de81b745559fa80ff958a.jpg` | `templates/index.json` (`slideshow_nAcmpg` -> `slide_RE9X4N`) | Homepage Hero Banner Slide 1 background (`610px` desktop / `400px` mobile height). |
| 4 | `0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png` | `templates/index.json` (`shop_by_shape_fhKnUK` -> `shape_item_UziV4c`) | Shop by Shape — `"Round"` diamond icon (`80x80px` desktop, `64x64px` mobile). |
| 5 | `7d83bf726259819272b0f6c542fa03a7d0d65025.png` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_Y7t8eG`) | Shop by Category — `"Rings"` card image (`410px` desktop / `300px` mobile height). |
| 6 | `4aa92d916448df116c23b56c699ebfd6e343cf83.jpg` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_T3c9aB`) | Shop by Category — `"Bracelets"` card image (`-48px` desktop vertical stagger). |
| 7 | `c4fa0f8f347290ae8527157b7eb38a66611c8a98.jpg` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_m2n4pQ`) | Shop by Category — `"Earrings"` card image. |
| 8 | `9888b4340c0daaf63638652dd17a78e59d8d37bb.jpg` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_k8L1zR`) | Shop by Category — `"Bangles"` card image (`-48px` desktop vertical stagger). |
| 9 | `3e0daaf9fa4ef07c2e542a7bf2eb27c5cd06e1bb.jpg` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_v5W7xN`) | Shop by Category — `"Pendants"` card image. |
| 10 | `5dc6a5f06299d80025a3d4945ab1bece52931e36.png` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_j9H3dF`) | Shop by Category — `"Necklaces"` card image (`-48px` desktop vertical stagger). |
| 11 | `2859edef8aa975cb5c3eb444462c985be61a24e4.jpg` | `templates/index.json` (`shop_by_catogory_6TLAit` -> `category_item_q6P2sM`) | Shop by Category — `"Antique"` card image. |
| 12 | `e19be3172053d7c0b01e8875a7d6bf100fb571df.png` | `templates/index.json` (`brand_story_cABfpx` -> `image_top`) | Brand Story — Top wide collage image (`172px` desktop / `200px` mobile height). |
| 13 | `7639a76a07625bb79914ba2544f4d8b35e74aa11.png` | `templates/index.json` (`brand_story_cABfpx` -> `image_bottom_left`) | Brand Story — Bottom-left collage image (`262x273px` desktop). |
| 14 | `b890046a036c6e4eb1b538dc0791871d26e4596f.png` | `templates/index.json` (`brand_story_cABfpx` -> `image_bottom_right`) | Brand Story — Bottom-right collage image (`flex: 1`, `273px` height desktop). |
| 15 | `b7ba10190c510a268db40d1e9a87a774b73deac9.png` | `templates/index.json` (`shop_by_price_7pqwbQ` -> Blocks 1 & 3) | Shop by Price — `"UNDER ₹15K"` and `"₹25K TO ₹50K"` square card image (`285x285px`). |
| 16 | `cf4460ad799a545b7fa760e490ba843ed33bc589.png` | `templates/index.json` (`shop_by_price_7pqwbQ` -> Blocks 2 & 4) | Shop by Price — `"₹15K TO ₹25K"` and `"₹50K AND ABOVE"` square card image (`285x285px`). |
| 17 | `59205e0bf94ef6a4257d713defef8fe89d9fe5b8.png` | `templates/index.json` (`image_banner`) | Full-width luxury quote banner image (`"Luxury today is not just about what you wear..."`). |
| 18 | `32830c2dc27609f18b884bc5ab307d57f0f8f900.png` | `templates/index.json` (`why_lab_grown_CqHY3r`) | Why Lab Grown — Left column portrait editorial image (`795px` desktop / `420px` mobile height). |

> **Note on About Us Images (`templates/page.about-us.json`):** The 4 image-bearing editorial sections on the About Us page (`heritage-modern-editorial`, `legacy-jewellery-editorial`, `visionaries-editorial-collage-fixed`, `about-story`) currently do not have `shopify://shop_images/...` URLs assigned in `templates/page.about-us.json` and render their built-in styled placeholder boxes (`#efe4dc`, `#ead3c2`, `#f2e5dc`, `#FAF2EC`) until images are selected in the CMS or provided by the owner.

---

## 2. Custom Inline SVGs Embedded in Liquid Sections & Snippets

Many of the most important brand icons are embedded directly as inline `<svg>` elements inside custom `.liquid` files rather than stored in `assets/`:

| Source File | Inline SVG Icons & Illustrations |
| :--- | :--- |
| `sections/header.liquid` | • Hamburger menu 3-line SVG (`22x22px`)<br>• Close `X` SVG (`18x18px`)<br>• Dropdown chevron down SVG (`10x10px`)<br>• Search magnifier SVG (`20x20px`)<br>• Wishlist heart outline SVG (`20x20px`, `stroke-width="1.6"`)<br>• Customer account user outline SVG (`20x20px`, `stroke-width="1.6"`)<br>• Shopping bag/cart outline SVG (`20x20px`, `stroke-width="1.6"`) |
| `sections/custom-footer.liquid` | • Accordion chevron SVG (`12x8px`)<br>• Instagram icon SVG (`18x18px`)<br>• Facebook icon SVG (`18x18px`)<br>• YouTube, X/Twitter, Pinterest, LinkedIn icon SVGs (`18x18px`) |
| `snippets/card-product.liquid` | • `pc_icon_cart`: Custom shopping cart stroke SVG (`24x24` viewBox, `stroke-width="1.3"`)<br>• `pc_icon_heart`: Dual-path heart SVG (`.pc-heart-line` outline + `.pc-heart-fill` solid fill on active) |
| `sections/slideshow.liquid` | • Button diagonal arrow-up-right SVG (`14x14px`)<br>• Carousel Prev/Next horizontal arrow SVGs (`24x24px`, `stroke-width="1.5"`) |
| `sections/shop-by-shape.liquid` | • 7 geometric diamond-cut fallback SVGs (`64x64` viewBox): `Round`, `Cushion`, `Emerald`, `Pear`, `Oval`, `Princess`, `Heart` |
| `sections/trust-bar.liquid` | • `certificate`: IGI Certified document + ribbon badge SVG (`48x48` viewBox)<br>• `exchange`: Lifetime Exchange 3D cube + circular arrows SVG (`48x48` viewBox)<br>• `shipping`: Free Shipping delivery truck + motion lines SVG (`48x48` viewBox)<br>• `resizing`: Free Resizing diamond ring + sparkle rays SVG (`48x48` viewBox) |
| `sections/why-lab-grown.liquid` | • `flower`: 8-petal botanical flower SVG (`36x36` viewBox — *"Physically identical"*)<br>• `leaf`: Dual-leaf eco sprout SVG (`36x36` viewBox — *"Consciously made"*)<br>• `gem`: Faceted diamond + top rays SVG (`36x36` viewBox — *"Exceptional value"*) |
| `sections/content.liquid` | • `shield` (*Legacy & Trust*), `diamond` (*Modern Luxury*), `leaf` (*Conscious Brilliance*), `heart` (*Emotional Storytelling*) SVGs (`32x32` viewBox) |
| `sections/mangal-group-legacy.liquid` | • `diamond` (*Mangal Royal Studio*), `bank` (*Mangal Credit & Fincorp*), `finance` (*Mangal Finserv*), `building` (*Mangal BuildHome*), `theatre` (*Mangal Entertainment*), `heart` (*Mangal Charitable Trust*) SVGs (`48x48` viewBox, `stroke-width="1.8"`, `#A51F43`) |

---

## 3. Standalone SVG & Image Assets (`assets/*.svg`, `assets/*.gif`)

The `assets/` directory contains **83 SVG files** and **1 GIF file**:

- **UI & Navigation Icons (35 files):** `icon-account.svg`, `icon-accordion.svg`, `icon-arrow.svg`, `icon-caret.svg`, `icon-Cart-Empty.svg`, `icon-cart.svg`, `icon-checkmark.svg`, `icon-checkmark-badge.svg`, `icon-close.svg`, `icon-close-small.svg`, `icon-clipboard.svg`, `icon-discount.svg`, `icon-error.svg`, `icon-filter.svg`, `icon-hamburger.svg`, `icon-heart.svg`, `icon-info.svg`, `icon-minus.svg`, `icon-padlock.svg`, `icon-pause.svg`, `icon-play.svg`, `icon-plus.svg`, `icon-Refresh.svg`, `icon-remove.svg`, `icon-return.svg`, `icon-search.svg`, `icon-share.svg`, `icon- silhouette.svg`, `icon-sort.svg`, `icon-spinner.svg`, `icon-success.svg`, `icon-tick.svg`, `icon- trash.svg`, `icon-unavailable.svg`, `icon-zoom.svg`, `square.svg`.
- **Product & Feature Badge Icons (27 files):** `icon-apple.svg`, `icon-banana.svg`, `icon-bottle.svg`, `icon-box.svg`, `icon-carrot.svg`, `icon-chat-bubble.svg`, `icon-check-mark.svg`, `icon-clipboard.svg`, `icon-dairy.svg`, `icon-dairy-free.svg`, `icon-dryer.svg`, `icon-eye.svg`, `icon-fire.svg`, `icon-gluten-free.svg`, `icon-iron.svg`, `icon-leaf.svg`, `icon-leather.svg`, `icon-lightning-bolt.svg`, `icon-lipstick.svg`, `icon-lock.svg`, `icon-map-pin.svg`, `icon-nut-free.svg`, `icon-pants.svg`, `icon-paw-print.svg`, `icon-pepper.svg`, `icon-perfume.svg`, `icon-plane.svg`, `icon-plant.svg`, `icon-price-tag.svg`, `icon-question-mark.svg`, `icon-recycle.svg`, `icon-ruler.svg`, `icon-shirt.svg`, `icon-shoe.svg`, `icon-snowflake.svg`, `icon-star.svg`, `icon-stopwatch.svg`, `icon-truck.svg`, `icon-washing.svg`, `icon-3d-model.svg`.
- **Social Media Icons (11 files):** `icon-facebook.svg`, `icon-instagram.svg`, `icon-pinterest.svg`, `icon-snapchat.svg`, `icon-spotify.svg`, `icon-tiktok.svg`, `icon-tumblr.svg`, `icon-twitter.svg`, `icon-vimeo.svg`, `icon-youtube.svg`.
- **Masks & Animations (2 files):** `mask-arch.svg`, `sparkle.gif`.

---

## 4. Stylesheets (`assets/*.css` — 52 Files)

| Category | CSS Files in `assets/` |
| :--- | :--- |
| **Core Global Styles (1)** | `base.css` (CSS reset, grid system, `.page-width`, typography utilities, button base styles, color scheme variables, scroll animation keyframes). |
| **Component Styles (35)** | `component-accordion.css`, `component-article-card.css`, `component-card.css`, `component-cart.css`, `component-cart-drawer.css`, `component-cart-items.css`, `component-cart-notification.css`, `component-collection-hero.css`, `component-complementary-products.css`, `component-deferred-media.css`, `component-discounts.css`, `component-disclosures.css`, `component-facets.css`, `component-image-with-text.css`, `component-list-menu.css`, `component-list-payment.css`, `component-list-social.css`, `component-loading-overlay.css`, `component-localization-form.css`, `component-mega-menu.css`, `component-menu-drawer.css`, `component-modal-video.css`, `component-newsletter.css`, `component-pagination.css`, `component-pickup-availability.css`, `component- predictive-search.css`, `component-price.css`, `component-product-model.css`, `component-product-variant-picker.css`, `component-rating.css`, `component-rte.css`, `component-search.css`, `component-show-more.css`, `component-slider.css`, `component-slideshow.css`, `component-swatch.css`, `component-swatch-input.css`, `component-totals.css`, `component-volume-pricing.css`. |
| **Section Styles (11)** | `section-blog-post.css`, `section-collection-list.css`, `section-contact-form.css`, `section-email-signup-banner.css`, `section-featured-blog.css`, `section-featured-product.css`, `section-footer.css`, `section-image-banner.css`, `section-main-blog.css`, `section-main-page.css`, `section-main-product.css`, `section-multiline-marquee.css`, `section-password.css`, `section-related-products.css`, `section-rich-text.css`. |
| **Template & Utility Styles (5)** | `template-collection.css`, `template-giftcard.css`, `customer.css`, `collage.css`, ` collapsible-content.css`, `details-disclosure.css`, `disclosure.css`, `magnific-popup.css`, `mask-blobs.css`, `quantity-popover.css`, `quick-add.css`, `quick-order-list.css`, `recipient-form.css`. |

> **Important Note:** All 19 custom Mangal Royal Studio sections and `snippets/card-product.liquid` embed their own scoped `<style>` blocks directly inside the `.liquid` files rather than relying on external `.css` files in `assets/`.

---

## 5. JavaScript Modules (`assets/*.js` — 36 Files)

| Category | JavaScript Files in `assets/` |
| :--- | :--- |
| **Global & PubSub Core (7)** | `constants.js` (`ON_CHANGE_DEBOUNCE_TIMER`, `PUB_SUB_EVENTS`), `pubsub.js` (`subscribe`, `publish`), `global.js` (Dawn web components: `QuantityInput`, `MenuDrawer`, `HeaderDrawer`, `ModalDialog`, `ModalOpener`, `DeferredMedia`, `SliderComponent`, `SlideshowComponent`, `VariantSelects`), `animations.js` (scroll trigger `IntersectionObserver`), `details-disclosure.js`, `details-modal.js`, `standard-actions-override.js` (Shopify Standard Actions cart synchronization). |
| **Cart & Checkout (3)** | `cart.js` (`CartRemoveButton`, `CartItems` with debounced `/cart/change.js` updates and section rendering), `cart-drawer.js` (`CartDrawer`, `CartDrawerItems`), `cart-notification.js` (`CartNotification` popup modal). |
| **Product & Media (12)** | `product-info.js`, `product-form.js`, `product-modal.js`, `product-model.js`, `media-gallery.js`, `magnify.js`, `pickup-availability.js`, `price-per-item.js`, `quantity-popover.js`, `quick-add.js`, `quick-add-bulk.js`, `quick-order-list.js`, `recipient-form.js`, `disclosures.js`, `share.js`. *(Note: `sections/main-product.liquid` and `snippets/card-product.liquid` use their own self-contained inline JS controllers).* |
| **Collection, Search & Navigation (6)** | `facets.js` (`FacetFiltersForm`, `PriceRange`, `FacetRemove` AJAX filtering/sorting with `history.pushState`), `show-more.js`, `search-form.js`, `main-search.js`, `predictive-search.js` (`PredictiveSearch` live dropdown queries to `/search/suggest`), `localization-form.js`. |
| **Customer & Misc (4)** | `customer.js` (address book add/edit/delete + country/province selector), `theme-editor.js`, `auto- close-drawer.js`. |

---

## 6. Fonts & Locale Files

1. **Fonts:**
   - **Shopify Font Library (`settings_data.json`):** `Poppins` Regular (`poppins_n4`) and Bold (`poppins_n7`) loaded via `font_face` filter in `layout/theme.liquid`.
   - **Google Fonts (`@import` in custom sections):** `Cormorant Garamond` (400, 500, 600, 700), `Great Vibes` (400), `Allura` (400), `Parisienne` (400), `Playfair Display` (400–700), `DM Sans` (400, 500, 600, 700), `Montserrat` (400, 500, 600, 700), `Lato` (400), `Inter` (400).
   - **Custom Named Fonts in CSS Stacks:** `Battlemade`, `Begum`, `Gotham` (referenced in CSS stacks; no `.woff2` files present in `assets/`).
2. **Locales (`locales/`):**
   - 58 files covering 29 languages. Primary active storefront locale is `locales/en.default.json` (English).

