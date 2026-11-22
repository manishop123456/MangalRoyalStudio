# Implementation Plan — Mangal Royal Studio Platform

This document defines the milestone-by-milestone execution plan under the approved architecture:
- **Customer Storefront:** Shopify Liquid Theme (`apps/shopify-theme/`, cloned from `jewellery-theme-backup/` which remains untouched).
- **Custom Admin Dashboard:** Next.js App Router + TypeScript (`apps/admin/`).
- **Custom Backend API:** Node.js + Express + TypeScript + Prisma ORM (`services/api/`).
- **Shared Core & Pricing Engine:** TypeScript + Zod + Decimal.js (`packages/shared/`).

---

## Milestone 0 — Theme Audit & Architecture Alignment (COMPLETED)
- Inspected all 377 files in `jewellery-theme-backup/`.
- Produced `AUDIT_REPORT.md`, `PAGE_STRUCTURE.md`, `DESIGN_SYSTEM.md`, `THEME_ASSETS.md`, `EXISTING_FUNCTIONALITY.md`, and `DECISIONS.md`.
- Revised `SYSTEM_ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` to use the Shopify Liquid theme as the primary customer-facing storefront and Next.js for the custom Admin Dashboard.

---

## Milestone 1 — Monorepo Foundation, Shared Pricing Core, Prisma Schema & Vertical Slice
1. **Workspace & Shared Package (`packages/shared`):**
   - Configure npm workspaces (`packages/shared`, `services/api`, `apps/admin`).
   - Implement shared TypeScript strict types, Zod validation schemas, RBAC roles/permissions (`OWNER`, `MANAGER`, `PRICING_OPERATOR`), and the pure `decimal.js` Jewellery Pricing Engine (supporting 14K/18K/22K/24K Gold, Silver, Platinum, multi-component Diamond matrices, `PER_GRAM` / `PERCENTAGE` / `FLAT` making charges, wastage, certification fees, configurable GST, and INR rounding).
   - Add unit tests for the pricing engine and validation schemas.
2. **Database Schema & Backend Foundation (`services/api`):**
   - Create `prisma/schema.prisma` with all 21 normalized models (`AdminUser`, `Role`, `Permission`, `Customer`, `ProductMetadata`, `JewellerySpecification`, `DiamondComponent`, `Category`, `InventoryRecord`, `GoldRate`, `DiamondRate`, `PricingRule`, `PricingRun`, `PricingRunItem`, `PricingSnapshot`, `ImportJob`, `ImportError`, `OrderMetadata`, `PaymentRecord`, `Shipment`, `Discount`, `Banner`, `Content`, `IntegrationEvent`, `AuditLog`).
   - Build Express server with centralized error handling, Zod request validation, JWT/session RBAC middleware, rate limiting, structured logging, `/health` readiness check, and resilient data persistence.
3. **Shopify Theme Foundation (`apps/shopify-theme`):**
   - Clone `jewellery-theme-backup/` into `apps/shopify-theme/` (leaving `jewellery-theme-backup/` 100% untouched).
   - Fix all audited theme bugs (CSS selector typo in `brand-story.liquid`, `card-product` snippet arguments in `main-collection-product-grid.liquid` & `main-search.liquid`, unified `mrs:wishlist` state across cards and PDP, smart PDP option swatches, and configurable live price-breakup & order-tracking sections).
4. **Custom Admin Dashboard Shell (`apps/admin`):**
   - Scaffold Next.js App Router admin application with luxury Mangal Royal Studio branding (`#7D132A` burgundy sidebar, `#190303` espresso ink, `#FBE8DB` champagne accents), authentication login flow, and interactive overview dashboard.

---

## Milestone 2 — Jewellery Pricing Engine, Gold Rates & Diamond Matrix Modules
- Implement full CRUD + immutable history APIs and Admin UI pages for:
  - **Gold & Metal Rate Management** (`14K`, `18K`, `22K`, `24K` Gold, `925` Silver, `950` Platinum) with effective timestamps and source references.
  - **Diamond Rate Matrix Management** (Shape × Sieve/Carat bracket × Color/Clarity grade `EF-VVS`, `EF-VS`, `GH-VS`, etc.).
  - **Jewellery Pricing Rules & Repricing Workflow:**
    - Interactive Price Calculator & Formula Configurator (with clearly marked owner-configurable placeholders).
    - **Preview (`DRY_RUN`) -> Validate -> Owner Approval -> Publish** state machine with safety guardrails (max % change threshold alerts) and immutable `PricingSnapshot` generation.

---

## Milestone 3 — 11-Sheet Excel/CSV Bulk Importer (`MANGAL JEWELLERY.xlsx`)
- Generate sample 11-sheet `samples/MANGAL JEWELLERY.xlsx` workbook matching Indian diamond jewellery catalogue conventions (`Rings`, `Earrings`, `Pendants`, `Necklaces`, `Bracelets`, `Bangles`, `Mangalsutra`, `Solitaires`, `Nose Pins`, `Chains`, `Antique`).
- Implement multi-sheet `.xlsx` and `.csv` upload parser (`xlsx`), automatic sheet detection, category mapping, SKU uniqueness & duplicate detection, gross/net/diamond weight validation, dry-run preview, downloadable CSV error report, import history, retry support, and gated Shopify GraphQL Admin API synchronization.

---

## Milestone 4 — Complete 19-Module Admin Dashboard, Webhooks, Payments & Shiprocket Shipping
- Complete all 19 Admin Dashboard modules in `apps/admin` backed by real `services/api` endpoints:
  1. Overview Dashboard
  2. Product & Jewellery Spec Management
  3. Category Management
  4. Inventory Management
  5. Order Management
  6. Customer Management
  7. Jewellery Pricing Management & Runs
  8. Gold Rate Management
  9. Diamond Rate Management
  10. Bulk Excel/CSV Import (11-sheet support)
  11. Discount Management
  12. Banner Management
  13. Content Management
  14. Shipping Management (Shiprocket AWB, labels, pickup, tracking)
  15. Payment Management (Razorpay / Shopify Checkout reconciliation)
  16. Reports & Analytics
  17. Admin Users & RBAC Roles
  18. Store Settings
  19. Activity / Audit Logs
- Implement HMAC-verified idempotent webhook handlers (`/api/webhooks/shopify`, `/api/webhooks/shiprocket`, `/api/webhooks/razorpay`).

---

## Milestone 5 — Verification, Automated Tests, Typechecks & Documentation
- Run Vitest unit & API integration tests across `packages/shared` and `services/api`.
- Run TypeScript strict typechecks (`tsc --noEmit`) and production builds across `packages/shared`, `services/api`, and `apps/admin`.
- Update `PROGRESS.md`, `IMPLEMENTATION_LOG.md`, and `README.md` with complete run instructions and verification results.
