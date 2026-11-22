# Mangal Royal Studio — Design System & Visual Specification

**IMPORTANT:** The existing Shopify theme in `jewellery-theme-backup` is the exact design source of truth. Every colour, font stack, font size, container width, grid gap, border radius, and responsive breakpoint documented below comes directly from `config/settings_data.json`, `layout/theme.liquid`, and the section/snippet `.liquid` files.

---

## 1. Colour Palette

### 1.1 Global Dawn Colour Schemes (`config/settings_data.json`)

| Scheme ID | Background | Text | Button Background | Button Label | Secondary Button Label / Border | Shadow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`scheme-1`** (Default Light) | `#FFFFFF` | `#121212` | `#121212` | `#FFFFFF` | `#121212` | `#121212` |
| **`scheme-2`** (Soft Gray) | `#F3F3F3` | `#121212` | `#121212` | `#F3F3F3` | `#121212` | `#121212` |
| **`scheme-3`** (Dark Banner) | `#242833` | `#FFFFFF` | `#FFFFFF` | `#000000` | `#FFFFFF` | `#121212` |
| **`scheme-4`** (Inverse Dark) | `#121212` | `#FFFFFF` | `#FFFFFF` | `#121212` | `#FFFFFF` | `#121212` |
| **`scheme-5`** (Royal Blue) | `#334FB4` | `#FFFFFF` | `#FFFFFF` | `#334FB4` | `#FFFFFF` | `#121212` |

### 1.2 Mangal Royal Studio Brand & Section-Specific Colours

The custom sections define the true visual identity of **Mangal Royal Studio** using rich royal burgundy/wine tones, warm champagne/peach backgrounds, and deep espresso ink text:

| Token Role | Hex Value(s) | Exact Usage in Theme |
| :--- | :--- | :--- |
| **Primary Burgundy / Royal Wine** | `#7D132A` | Custom Footer bg, Featured Collection eyebrow & `"Buy Now"` button + badge, Shop by Category script heading, Brand Story script heading, Shop by Price eyebrow & card bottom strip, Why Lab Grown eyebrow & CTA button, Testimonials Next button, Core Values section bg. |
| **Announcement Bar Burgundy** | `#7A1023` | Announcement bar background, border, and Header link hover colour. |
| **Shop by Shape Burgundy** | `#86142C` | Shop by Shape section background (`#f8d8df` hover tint). |
| **Trust Bar Burgundy** | `#8B0D2B` | Trust Bar background (Homepage & PDP). |
| **Brand Promise / Testimonials Burgundy** | `#8D102C` / `#8D0F2B` / `#8F1028` | Brand Promise Collage band background (`#8d102c`), Testimonials stars (`#8d0f2b`) & subheading (`#8f1028`), Mangal Group Legacy top border (`#8D102C`). |
| **PDP & Editorial Accent Burgundy** | `#8E1230` / `#8E1732` / `#A51F43` | PDP price, Add to Cart button, Buy Now border/text, Physical Store CTA button (`#8E1230`); About Us Hero CTA (`#8e1732`); Mangal Group Legacy icons & links (`#A51F43`). |
| **Burgundy Button Hover (Dark Wine)** | `#5E0E20` / `#5E0F22` / `#6F1026` | Product Card `"Buy Now"` hover fill (`#5E0E20`), Why Lab Grown button hover (`#5e0f22`), About Us Hero button hover (`#6f1026`). |
| **Warm Peach / Champagne Surface** | `#F8E1CF` / `#F9E2D2` / `#F7E0D0` / `#FBE8DB` | Shop by Category bg (`#f8e1cf`), Why Lab Grown bg (`#f9e2d2`), Legacy Jewellery Editorial bg (`#f7e0d0`), Physical Store CTA & Forever Piece CTA bg (`#FBE8DB`). |
| **Primary Ink (Deep Espresso)** | `#190303` | Header text/icons, Product Card title/price/icons, Homepage section headings (`Our Bestsellers`, `Shop by category`, `ROOTED IN LEGACY`, `Shop by prices`, `Why lab grown?`, `WHAT OUR CUSTOMERS SAY`). |
| **Editorial Ink (Warm Charcoal)** | `#2D2021` / `#2F2325` / `#302326` | PDP main text (`#2D2021`), About Us headings (`#2f2325`, `#302326`). |
| **Body Copy / Muted Text** | `#3E3E3E` / `#5F5555` / `#6B5B5B` / `#777070` | Brand Story & Why Lab Grown body (`#3e3e3e`), Testimonials body (`#3d3d3d`), Product Card muted/compare price (`#6B5B5B`), PDP muted labels (`#777070`). |
| **Card & Media Surfaces** | `#F6F3F1` / `#F6F6F5` / `#F4F1EE` | Product Card image surface (`#F6F3F1`), PDP media surface (`#F6F6F5`), Category card surface (`#f4f1ee`). |
| **Dividers & Borders** | `#EEEEEE` / `#E6E0DE` / `#E2E2E2` / `#E7D1C4` / `#D99AAA` / `#B88996` | Header bottom border (`#eeeeee`), PDP borders (`#E6E0DE`), Testimonial card border (`#e2e2e2`), Physical Store CTA border (`#E7D1C4`), Mangal Group card border (`#D99AAA`), Core Values column divider (`#b88996`), Footer divider (`#a53850`). |
| **Review Star Gold / Burgundy** | `#E39A16` / `#C9A227` / `#8D0F2B` | PDP rating stars (`#E39A16`), Product Card rating stars (`#C9A227`), Homepage Testimonials stars (`#8d0f2b`). |

---

## 2. Typography

### 2.1 Font Families & Fallback Stacks

The theme combines four typographic voices:

1. **Script / Cursive Eyebrow Font:**
   - **Configured CSS Stack (Homepage sections):** `'Battlemade', 'Great Vibes', 'Allura', cursive`
   - **Configured CSS Stack (About Us & PDP CTA sections):** `'Allura', cursive` or `'Great Vibes', cursive`
   - *Audit Note:* Because `Battlemade` font files are not uploaded to `assets/`, homepage sections render using Google Font **`Great Vibes`** (when imported) or **`Allura`**.
2. **Display / Editorial Serif Font:**
   - **Configured CSS Stack (Homepage & Footer sections):** `'Begum', 'Cormorant Garamond', Georgia, serif`
   - **Configured CSS Stack (PDP & About Us sections):** `'Cormorant Garamond', Georgia, serif`
   - *Audit Note:* Because `Begum` font files are not uploaded to `assets/`, headings render using Google Font **`Cormorant Garamond`** or **`Georgia`**.
3. **UI & Body Sans-Serif Font:**
   - **Configured CSS Stack (Header, Footer, Homepage sections):** `'Gotham', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (or `'Lato', sans-serif` in Shop by Price)
   - **Configured CSS Stack (PDP & About Us sections):** `'DM Sans', Arial, sans-serif` or `'Montserrat', Arial, sans-serif`
   - **Global Dawn Base Font (`settings_data.json`):** `'Poppins', sans-serif` (`type_header_font: "poppins_n4"`, `type_body_font: "poppins_n4"`, `heading_scale: 100`, `body_scale: 100`).

### 2.2 Complete Section-by-Section Typography Scale (Desktop / Tablet / Mobile)

| Component / Element | Font Stack | Weight | Transform / Tracking | Desktop (`>=990px`) | Tablet (`750–989px`) | Mobile (`<=749px`) |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| **Announcement Bar** | `Gotham`, `Inter`, sans-serif | 400 | `0.4px` tracking | `12px` / `1` | `12px` | `10px` |
| **Header Nav Links** | `Gotham`, `Inter`, sans-serif | 400 | Uppercase, `0.6px` | `12px` / `1` | — | `15px` (Drawer) |
| **Hero Slide Eyebrow** | `Begum`, `Cormorant Garamond`, serif | 400 | Uppercase, `1.5px` | `34px` / `1.15` | `18px` | `15px` |
| **Hero Slide Script Heading** | `Battlemade`, `Great Vibes`, cursive | 400 | Normal | `64px` / `1.05` | `20px` | `27px` |
| **Hero Slide Description** | `Gotham`, `Inter`, sans-serif | 400 | Normal | `14px` / `1.55` | `13px` | `11px` |
| **Homepage Section Eyebrow (Script)**<br>*(Bestsellers, Shape, Category, Price, Why Lab Grown)* | `Battlemade`, `Great Vibes`, `Allura`, cursive | 400 | Normal | `64px` / `1.0` | `50px–54px` | `34px–36px` |
| **Homepage Section Heading (Serif)**<br>*(Bestsellers, Shape, Category, Price, Why Lab Grown, Testimonials)* | `Begum`, `Cormorant Garamond`, Georgia, serif | 400 | Uppercase, `0.02em–0.05em` | `45px` / `1.1` | `36px–38px` | `28px–30px` |
| **Brand Story Small Heading** | `Begum`, `Cormorant Garamond`, serif | 400 | Uppercase, `0.5px` | `58px` / `1.02` | `46px` | `30px` |
| **Brand Story Script Heading** | `Battlemade`, `Great Vibes`, cursive | 400 | Normal (`-24px` top margin) | `114px` / `0.9` | `96px` | `58px` |
| **Brand Story Body Copy** | `Gotham`, `Helvetica Neue`, sans-serif | 400 | Normal | `16px` / `1.45` | `15px` | `14px` |
| **Product Card Title (`.pc-card__title`)** | Inherited (`Poppins` / `Gotham`) | 400 | Uppercase, `0.12em` | `14px` / `18px` | `13px` | `12px` / `16px` |
| **Product Card Price (`.pc-price`)** | Inherited (`Poppins` / `Gotham`) | 400 | `0.12em` | `16px` / `22px` | `15px` | `14px` / `20px` |
| **Product Card Buy Button (`.pc-buy`)** | Inherited (`Poppins` / `Gotham`) | 400 | Uppercase, `0.1em` | `14px` (`30px` h) | `13px` | `12px` (`34px` h) |
| **Category Card Title** | `Begum`, `Cormorant Garamond`, serif | 400 | Uppercase, `1px` | `28px` | `24px` | `22px` |
| **Trust Bar Item Title / Text** | `Begum` / `Gotham` | 400 | Normal | `20px` / `14px` | `18px` / `13px` | `18px` / `13px` |
| **Shop by Price Strip Label** | `Lato`, `Helvetica Neue`, sans-serif | 400 | Uppercase, `0.08em` | `16px` (`28px` strip) | `15px` | `12px` |
| **PDP Product Title (`.pp-title`)** | `Cormorant Garamond`, serif | 600 | `0px` | `34px` / `1.1` | `34px` | `28px` / `1.1` |
| **PDP Price / Compare Price** | `DM Sans`, sans-serif | 600 / 400 | Normal | `15px` / `12px` | `15px` / `12px` | `15px` / `11px` |
| **PDP Buttons & Accordions** | `DM Sans`, sans-serif | 500 | Uppercase, `1px` | `10px` | `10px` | `10px` |
| **About Us Section Headings** | `Cormorant Garamond`, serif | 500 | Uppercase | `28px–34px` / `1.05` | `28px` | `22px–25px` |
| **About Us Eyebrows / Scripts** | `Allura`, cursive | 400 | Normal | `22px–32px` | `22px` | `20px–26px` |
| **About Us Body Copy** | `DM Sans` / `Montserrat`, sans-serif | 400 | Normal | `11px–12px` / `1.5` | `11px–12px` | `12px` / `1.5` |
| **Footer Newsletter Heading** | `Begum`, `Cormorant Garamond`, serif | 400 | Normal | `45px` / `1.1` | `36px` | `30px` |
| **Footer Links & Body** | `Gotham`, `Helvetica Neue`, sans-serif | 400 | Normal | `14px–16px` | `14px` | `14px` |

---

## 3. Containers, Spacing & Grid System

### 3.1 Section Container Widths & Padding

Unlike a single uniform container, the theme uses specific max-widths per section to create its editorial rhythm:

| Section | Max Container Width | Desktop Padding (Top / Bottom / Sides) | Mobile Padding (Top / Bottom / Sides) |
| :--- | :---: | :---: | :---: |
| **Global Dawn `.page-width`** | `1200px` (`120rem`) | `5rem` (`50px`) sides (`>=750px`) | `1.5rem` (`15px`) sides |
| **Header (`.mrs-header`)** | `100%` (Full width) | `0px` top/bottom, `40px` sides (`height: 62px`) | `0px` top/bottom, `12px` sides (`height: 62px`) |
| **Hero Slideshow** | `100%` (Full bleed) | Content inset `64px` sides (`height: 610px`) | Content inset `20px` sides (`height: 400px`) |
| **Featured Collection** | `1440px` | `70px` top, `70px` bottom, `70px` sides | `44px` top, `44px` bottom, `16px` sides |
| **Shop by Shape** | `1280px` | `56px` top, `56px` bottom, `40px` sides | `36px` top, `36px` bottom, `16px` sides |
| **Shop by Category** | `1280px` | `80px` top, `90px` bottom, `70px` sides | `50px` top, `60px` bottom, `16px` sides |
| **Brand Story** | `1320px` | `110px` top, `110px` bottom, `40px` sides | `60px` top, `60px` bottom, `16px` sides |
| **Trust Bar** | `1300px` | `0px` (`height: 84px`), `24px` sides | `0px` (`height: 78px`), `0px` sides (Marquee) |
| **Shop by Price** | `1440px` | `50px` top, `90px` bottom, `70px` sides | `45px` top, `55px` bottom, `16px` sides |
| **Why Lab Grown** | `1440px` | `90px` top, `90px` bottom, `70px` sides | `50px` top, `55px` bottom, `16px` sides |
| **Testimonials** | `1300px` | `70px` top, `70px` bottom, `32px` left | `45px` top, `55px` bottom, `16px` sides |
| **Product Detail Page (`main-product`)** | `1280px` | `24px` top, `24px` bottom, `36px` sides | `18px` top, `18px` bottom, `16px` sides |
| **Physical Store CTA** | `1160px` | `20px` top, `20px` bottom, `38px` sides (`min-h: 145px`) | `28px` top, `28px` bottom, `18px` sides (`min-h: 230px`) |
| **About Us Sections** | `1000px–1360px` | `28px–48px` top/bottom, `30px–42px` sides | `24px–32px` top/bottom, `16px–18px` sides |
| **Custom Footer (`#MRSFooter`)** | `1440px` | `56px` top, `24px` bottom, `60px` sides | `40px` top, `24px` bottom, `22px` sides |

### 3.2 Border Radii & Borders
- **Sharp Editorial Corners (`0px` radius):** Product cards, category cards, price cards, PDP gallery images, PDP inputs/buttons, footer newsletter inputs/buttons, and CTA buttons all use **`0px` border-radius** on desktop for a sharp luxury editorial aesthetic.
- **Selective Rounded Elements:**
  - Why Lab Grown image on mobile: `14px` border-radius (`0px` on desktop).
  - Mangal Group Legacy cards: `8px` border-radius (`1px solid #D99AAA`).
  - Carousel Prev/Next navigation buttons & PDP shape swatches: `50%` (full circle).

---

## 4. Responsive Breakpoints & Mobile Behaviour

The theme uses the following media query breakpoints:
- **`<= 749px` (Mobile)** / **`>= 750px` (Tablet & Up):** Primary Dawn & custom section mobile breakpoint.
- **`<= 767px` (Mobile)** / **`>= 768px` (Tablet & Up):** Used by `custom-footer.liquid` and `why-lab-grown.liquid`.
- **`<= 989px` (Tablet & Mobile)** / **`>= 990px` (Desktop):** Primary navigation drawer vs. desktop horizontal nav breakpoint, and 4-column to 2/3-column grid transition.
- **`>= 1300px` (Wide Desktop):** Used by `testimonals.liquid` for fixed `576px` review cards.

### Summary of Desktop vs. Mobile Layout Transformations

| Component | Desktop (`>= 990px`) | Tablet (`750px – 989px`) | Mobile (`<= 749px`) |
| :--- | :--- | :--- | :--- |
| **Header Navigation** | Left logo (`110px`), centered inline menu (`32px` gap), right Search / Wishlist / Account / Cart icons. | Hamburger menu on left, centered logo (`130px`), right Search / Wishlist / Cart icons. | Hamburger menu on left opens `<mrs-header-drawer>` (`88vw`, max `370px`) with `+`/`−` accordions and `"Sign In / Sign Up"` footer. |
| **Featured Collection** | 4-column `<pc-carousel>` (`36px` gap) with circular side prev/next arrows. | 3-column `<pc-carousel>` (`20px` gap). | 2-column CSS Grid (`14px` gap), no carousel arrows. |
| **Shop by Shape** | 7-item single-row flex layout (`16px` gap). | Horizontal scroll-snap track (`18px` gap). | 3-column CSS Grid (`24px` gap). |
| **Shop by Category** | 4-column CSS Grid (`32px` col gap, `56px` row gap) with **`-48px` vertical stagger** on columns 2 & 4 (`410px` image height). | 2-column CSS Grid (`24px` gap), stagger removed (`0px`). | Horizontal scroll-snap carousel (`83.333%` card width, `16px` gap, `300px` image height). |
| **Brand Story** | 2-column split (42% text / 58% 3-image collage). | Stacked single column. | Stacked single column; `"Build for today."` overlaps `"ROOTED IN LEGACY"` by `-14px`. |
| **Trust Bar** | 4-column static grid (`84px` height). | 2-column static grid (`20px` padding). | **Infinite CSS Marquee** (`tb-marquee-scroll`, `22s` linear infinite, duplicated items, `88vw` item width, `78px` height). |
| **Shop by Price** | 4-card infinite drag carousel (`285px` cards, `37px` gap). | Infinite drag carousel (`24px` gap). | Infinite drag carousel showing **2.5 cards** (`14px` gap) + bottom dot indicators (`7x7px`). |
| **Why Lab Grown** | 50%/50% split (`795px` image height, `0px` radius). | Stacked single column (`520px` image height). | Stacked single column (`420px` image height, `14px` radius, full-width `"Shop now"` button). |
| **Testimonials** | Left header + right prev/next arrows; carousel showing ~2.15 cards (`576px` card width). | Carousel showing ~1.6 cards. | Carousel showing 1 card (`100%` width, `26px 22px` padding) with arrows in header row. |
| **Product Detail Page (PDP)** | 55% 2-col asymmetric 4-image gallery + 45% sticky info panel (`top: 20px`). | Stacked gallery + info panel. | 2-col mobile gallery (Hero & Tall images full-width `1:1`; Small images `1fr 1fr` `1:1`) + stacked info panel. |
| **About Us — Core Values** | 4-column grid with `#b88996` left vertical borders. | 2-column grid. | Single-card interactive slider with Prev/Next arrows + `<select>` dropdown selector. |
| **Custom Footer** | Side-by-side Newsletter bar + 5-column grid (`1.1fr 0.8fr 1fr 1fr 0.7fr`). | Stacked Newsletter + 4-column grid (Brand spans full width). | Stacked Newsletter + centered Brand + **collapsible menu accordions** + horizontal social row. |

---

## 5. Animations, Transitions & Interactive Micro-Interactions

1. **Global Scroll Reveal (`assets/animations.js` + `assets/base.css`):**
   - `animations_reveal_on_scroll: true` in `settings_data.json`. Elements with `.scroll-trigger.animate--slide-in` or `.animate--fade-in` animate into view via `IntersectionObserver` with staggered `--animation-order` CSS variables.
2. **Product Card Hover Effects (`snippets/card-product.liquid`):**
   - Primary image scales to `scale(1.055)` over `0.9s cubic-bezier(.22,.61,.36,1)` while cross-fading (`opacity: 0 -> 1` over `0.5s`) to the second product media (`p.media[1]`).
   - `"Buy Now"` button (`#7D132A`) reveals a left-to-right sliding background fill (`::before`, `#5E0E20`, `transform: scaleX(0 -> 1)` over `0.45s cubic-bezier(.22,.61,.36,1)`).
   - Cart and Wishlist icon buttons lift `translateY(-2px)` and turn `#7D132A` on hover.
3. **Hero Slideshow CTA (`sections/slideshow.liquid`):**
   - `"Shop Now"` link features a bottom `1px` white line that expands from `90px` width to `100%` on hover (`0.3s ease`), while the diagonal arrow SVG translates `translate(2px, -2px)`.
4. **Header Navigation Links (`sections/header.liquid`):**
   - Top-level `.mrs-nav__link` items feature an underline pseudo-element (`height: 1px; background: #7a1023`) that animates `width: 0 -> 100%` (`0.22s ease`) on hover/active.
5. **Shop by Category Cards (`sections/shop-by-catogory.liquid`):**
   - Image zooms to `scale(1.04)` over `0.5s ease` on hover while the arrow icon shifts `translate(2px, -2px)`.
6. **Brand Story Scroll Reveal (`sections/brand-story.liquid`):**
   - Dedicated `IntersectionObserver` (`threshold: 0.15`) triggers `[data-bs-animate="fade-left"]`, `fade-right`, and `fade-up` (`0.8s cubic-bezier(0.22, 1, 0.36, 1)`).
7. **Trust Bar Mobile Marquee (`sections/trust-bar.liquid`):**
   - Continuous `@keyframes tb-marquee-scroll` (`0% { transform: translate3d(0,0,0) } 100% { transform: translate3d(-50%,0,0) }`, `22s linear infinite`), pausing on `:hover` / `:active`.

