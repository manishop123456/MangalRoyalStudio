# MRS Production Browser Test Report

- **Date / Time:** `2026-11-23 19:45 IST`
- **Production Domain:** `PENDING OWNER CONFIRMATION`
- **Source Commit:** `f24dcb6`
- **Release Artifact SHA-256:** `4523592c39cc96263ef1c09be24e3494d4d8133f0e6ec4455ecfb1001716ddf1`
- **Hostinger Deployment Identity:** `srv2177504` (pending deployment)
- **Production Database Identity:** `mangal_royal_studio_prod` (pending)
- **Migration List:** 3 additive Prisma migrations
- **Backup Checksum:** `N/A`
- **Product Counts:** `8` ACTIVE, `272` DRAFT
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED`

## Browser Verification Status
- **Live Production / Staging Browser Tests:** **NOT RUN — BLOCKED** (production origin and DNS cutover have not been executed pending owner security rotations, canonical domain confirmation, and VPS SSH target configuration).
- **Local Pre-Release Verification Executed:**
  - `@mrs/storefront` (`24/24` passed, including live isolated test API integration in `storefront-helpers.test.ts` and `customer-messages.test.ts`).
  - `@mrs/admin` (`3/3` passed).
  - Production Next.js builds for `@mrs/storefront` (including `/robots.txt` and `/sitemap.xml` and Catalogue+Enquiry `/cart` & `/checkout`) and `@mrs/admin` passed (`EXIT_CODE=0`).
- **Required Post-Deploy Gate:** Once deployed to staging and production origin, run desktop + mobile browser checks (homepage, collections, PDPs, images, POR enquiry CTA, checkout disabled notice, console error check, HTTPS, `robots.txt`, `sitemap.xml`) before GoDaddy DNS cutover.
