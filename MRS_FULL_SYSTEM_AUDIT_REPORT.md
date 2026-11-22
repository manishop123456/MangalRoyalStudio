# Mangal Royal Studio — Full System Audit Report

**Run:** 2026-11-21 23:32 IST → 2026-11-22 00:40 IST · **Base commit:** `c7de1bc` (main, no remote; nothing committed or pushed) · **Evidence:** `MRS_AUDIT_EVIDENCE/run-20261121T233202/`

## 1. Environments (identity verified before every DB operation)
| | Database | Host | Writes this run |
|---|---|---|---|
| Local | `mangal_royal_studio_dev` | localhost (Postgres.app 18.6) | tests only + one identical-value rate re-confirmation (audit test, v3; no price change). Catalogue counts unchanged (280/8/272, 3,122 images, 3 orders, 3 customers, `MRS-EAR-2001` stock 9) |
| Staging | `mangal_royal_studio_staging` | VPS container `mrs_postgres` (18.7), unpublished | **none** (backup only) |
| Production / main domain | — | — | untouched; no DNS change |

## 2. Verification matrix
| Area | Result |
|---|---|
| Typecheck (4 workspaces) | PASS |
| Lint | NOT CONFIGURED (no lint script/config) |
| Unit + integration + PostgreSQL E2E tests | **215/215 PASS** |
| Production builds (4) | PASS |
| Pricing matrix / engine vs workbook / independent cross-check | 29/29 · 222/222 · 8/8 |
| Local HTTP smoke + RBAC (PostgreSQL) | 59/59 PASS |
| Staging proxy acceptance (approved-visitor view) | 95/95 PASS |
| Public URL: HTTPS, OTP gate, writes refused, old URL dead | PASS |
| OTP login by the approved email owner | NOT VERIFIED (needs the inbox) |
| Browser E2E / screenshots | NOT RUN (no browser tooling; download stalled) |
| Catalogue import | NOT PERFORMED (owner decision: workbook is generated sample data, see `MRS_CATALOGUE_IMPORT_RECONCILIATION.md`) |

## 3. Defects fixed in this release
**Pricing** (details in `MRS_PRICING_ENGINE_AUDIT.md`):
- The diamond tier now uses the product's combined carats, as the owner rule requires.
- Stored supplier wastage, certification and hallmark fees are no longer charged.
- The storefront no longer recalculates prices with hard-coded rates.
- The customization path can no longer price a Price-on-request item (now 422).
- Invalid numbers give Price on request instead of a 500.
- A total of ₹0 or less is never shown as a price.

**Security / exposure:**
- `/api/public/pricing`, the customization config/quote, cart-add and design endpoints exposed or accepted **DRAFT** products. All public lookups now require ACTIVE.
- Public payloads leaked stale prices, supplier making values, fees, overrides, Shopify IDs and engine warnings. They are now sanitized.
- The global error handler echoed internal error text to clients on 500. It now returns a generic message (errors are logged server-side), and client errors such as a malformed URL return 400.
- **Logout did not invalidate the token:** a copied session stayed valid for 24 h. Logout now revokes the token server-side (in-memory list).
- New admin products defaulted to another SKU's photograph. A neutral placeholder is used instead.

**Staging:**
- The nginx allowlist could be bypassed with an upper-case `/API/...` path (the API still required auth). Fixed: rules are case-insensitive with default-deny.
- `X-Powered-By` is hidden and basic security headers are added.
- The world-writable app directory was fixed.
- The tunnel restart policy was added, and the OTP email was changed to the approved address.

## 4. Open findings
1. **Staging prices are not owner-approved yet.** The staging DB still has the placeholder rate card; the owner must publish the approved card in Admin once. I did not do it: signing in with the repository's dev-seed passwords was blocked as unauthorized.
2. MANAGER and PRICING_OPERATOR can publish live rates without owner approval (policy decision).
3. Staging admin accounts likely carry dev-seed passwords (DB restored from a dev dump). Rotate them.
4. Commercial: 22K/Pt GST, exactly 1.00 ct, 24K. Affected products stay Price on request (`MRS-EAR-2001`, `MRS-ANT-7001`).
5. The 272 supplier SKUs have no specs, so they stay Draft. The template is provided.
6. Lint is not configured; browser E2E was not run; session revocation is not persistent across API restarts; cloudflared metrics on `*:20241` (firewalled).

## 5. Verdict: **CONDITIONAL GO**, for the private temporary owner showcase only
The code, security controls and pricing engine are verified, and the showcase is OTP-protected and read-only. Before the owner uses the showcase to review prices, they must publish the approved rate card on staging (5 minutes, Quick Start §4). This is not a production GO.
