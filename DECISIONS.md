# Mangal Royal Studio — Architectural Decisions & Configuration Policy

This document records the approved architectural decisions for the Mangal Royal Studio platform and documents the configurable commercial parameters in the Jewellery Pricing Engine.

---

## Part 1: Approved Architectural Decision Records (ADRs)

### ADR-01: Shopify Liquid Theme as Primary Customer-Facing Storefront
- **Decision:** Use the **Shopify Liquid Theme** (`apps/shopify-theme/`, cloned from `jewellery-theme-backup/`) as the primary customer-facing storefront rather than building a separate Next.js storefront.
- **Original Backup Protection:** Keep `jewellery-theme-backup/` 100% untouched as the pristine original backup. All bug fixes, unified wishlist features, PDP price-breakup components, and order-tracking templates are implemented inside `apps/shopify-theme/`.
- **Rationale:** Preserves 100% of the existing Mangal Royal Studio visual design, 19 custom Liquid sections, Online Store 2.0 Theme Editor compatibility, native Shopify cart/checkout session handling, and global Shopify CDN performance.

### ADR-02: Next.js Custom Admin Dashboard (`apps/admin`)
- **Decision:** Build the separate **Custom Admin Dashboard** in **Next.js (App Router, TypeScript strict mode)** (`apps/admin/`) to extend Shopify's capabilities with 19 specialized modules (Jewellery Pricing Engine, Gold & Metal Rate Cards, Diamond Rate Matrix, 11-Sheet Excel/CSV Bulk Importer, Repricing Preview/Approval/Publish, Shiprocket Fulfilment & AWB Management, Payment Reconciliation, RBAC Users, and Audit Logs).
- **Rationale:** Avoids duplicating Shopify's native storefront/checkout while giving operators, managers, and owners a purpose-built command center for Indian fine jewellery operations.

### ADR-03: Commerce System of Record vs. Custom Backend (`services/api`)
- **Decision:** Shopify remains the single system of record for products, variants, media, collections, inventory, customer accounts, cart, and checkout.
- **Custom Backend (Node.js/Express + TypeScript + Prisma/PostgreSQL):** Owns metal/diamond rate cards, versioned jewellery pricing formulas, product jewellery specifications, dry-run calculation previews, owner approval workflows, immutable pricing snapshots, bulk Excel/CSV validation/import jobs, audit logs, and Shiprocket shipping automation.
- **Live Store Write Gate:** Controlled by `SHOPIFY_LIVE_WRITES_ENABLED=false` by default so no unapproved writes or theme publishes ever mutate the live Shopify store without explicit owner sign-off.

### ADR-04: Jewellery Pricing Engine — Configurable Placeholders & Decimal Arithmetic
- **Decision:**
  - All financial and weight calculations use exact base-10 decimal arithmetic (`decimal.js`) in `packages/shared`.
  - Commercial parameters (gold rates for 14K/18K/22K/24K, silver/platinum rates, diamond rate matrix by shape/sieve/clarity/color, making charge modes `PER_GRAM`/`PERCENTAGE`/`FLAT`, wastage modes `NONE`/`PERCENTAGE_OF_METAL_VALUE`/`PERCENTAGE_OF_WEIGHT`/`FLAT_GRAMS`, certification fees, GST %, and INR rounding modes) are stored as **explicitly marked, versioned configuration records** (`isPlaceholder: true` until owner-verified rates are locked).
  - Every pricing update follows **Preview (`DRY_RUN`) -> Validate -> Owner Approval (`OWNER` role only) -> Publish** with immutable `PricingSnapshot` persistence.

### ADR-05: Checkout & Payment Flow on Shopify Basic
- **Decision:** Preserve **Shopify Hosted Checkout** (`/checkout`) with **Razorpay** configured as a supported Shopify payment provider. Backend verifies signed `orders/paid` and Razorpay webhooks server-side for order/payment reconciliation and Shiprocket eligibility.

---

## Part 2: Configurable Commercial Parameters (Owner-Editable in Admin Dashboard)

Until production rates are locked by the owner in the Admin Dashboard, the platform seeds clearly labeled `PLACEHOLDER_CONFIG` defaults that can be modified at any time via **Admin -> Gold Rate Management**, **Diamond Rate Management**, and **Jewellery Pricing Management**:

| Parameter Group | Supported Modes / Options | Default Configurable Placeholder |
| :--- | :--- | :--- |
| **Gold Purities** | `24K` (99.9%), `22K` (91.6%), `18K` (75.0%), `14K` (58.5%) | Marked `SOURCE: PLACEHOLDER_PENDING_OWNER_APPROVAL` |
| **Other Metals** | `SILVER_925`, `PLATINUM_950` | Marked `SOURCE: PLACEHOLDER_PENDING_OWNER_APPROVAL` |
| **Net Metal Weight Rule** | `EXPLICIT_NET_WEIGHT` or `GROSS_MINUS_STONE_WEIGHT` (`1 ct = 0.2 g`) | Configurable per Pricing Rule & SKU |
| **Diamond Rate Matrix** | `Shape` × `Carat Bracket (min..max)` × `Color/Clarity (EF-VVS, EF-VS, GH-VS, etc.)` | `PER_CARAT` or `FLAT_PER_STONE` (Marked Placeholder) |
| **Making Charge Modes** | `PER_GRAM` (₹/g), `PERCENTAGE` (% of metal value), `FLAT` (₹/piece) | Configurable per SKU / Category |
| **Wastage (VA) Modes** | `NONE`, `PERCENT_METAL_VALUE`, `PERCENT_METAL_WEIGHT`, `FLAT_GRAMS` | Configurable per SKU / Rule |
| **Certification / Hallmark Fee** | Flat ₹ per piece or ₹ per diamond carat (e.g., IGI certification) | Configurable per SKU / Rule |
| **GST Configuration** | Configurable rate (e.g., `3.00%` GST on jewellery) — `INCLUSIVE` or `EXCLUSIVE` | `3.00%` (`INCLUSIVE` in published variant price by default, toggleable) |
| **INR Rounding Rule** | `NEAREST_1` (`₹1`), `NEAREST_10` (`₹10`), `NEAREST_99`, `NEAREST_100` (`₹100`), `NONE` | `NEAREST_1` (`ROUND_HALF_UP`) |
