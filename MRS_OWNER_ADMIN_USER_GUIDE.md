# Mangal Royal Studio — Owner & Admin User Guide

*Updated 2026-11-21. For the short version see `MRS_OWNER_QUICK_START.md`.*

## 1. Opening the temporary showcase
- Link: **https://michelle-den-comedy-legs.trycloudflare.com** (temporary Cloudflare Quick Tunnel, **not permanent**; it changes when the showcase or server restarts).
- Access: Cloudflare One-Time PIN. Enter **[OWNER_EMAIL]**, then type the PIN emailed to that inbox. No other address is allowed.
- The showcase is **read-only**. Registration, login, cart, checkout, online payment, shipping and email are disabled there. Admin is never reachable through this link.

## 2. Opening Admin (private)
Admin runs only on the server's private network. Open an SSH tunnel from a computer that holds the server key:
`ssh -i ~/.ssh/mrs_vps_ed25519 -L 3001:127.0.0.1:3001 -L 4000:127.0.0.1:4000 mrsdeploy@<server address>`, then browse to **http://localhost:3001** and sign in. **Sign Out** ends the session and revokes it on the server; sessions also expire after 24 h.

Roles (enforced by the server, not just hidden in the menu):
- **OWNER:** everything, including users, settings and pricing-run approval/publish.
- **MANAGER:** catalogue, orders, inventory, imports, rates; no users, settings or customer PII.
- **PRICING_OPERATOR:** rates, pricing previews, products, imports; **no** orders, customers, users or settings (verified: 403).
- Note: MANAGER and PRICING_OPERATOR can currently publish the market-rate card. Tell your developer if only the owner should.

## 3. Products: Draft vs Active
- **Active:** visible on the storefront and showcase. **Draft:** visible only in Admin; the public site returns "not found" for it.
- Search and filter in **Products** by SKU, name, status or category; the list is paginated.
- Today: **8 Active**, **272 Draft** supplier pieces. The drafts have photographs but no metal, purity or weight data, so they cannot be priced. Fill in `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv`; the import runs as dry-run → error report → commit, and only valid rows are published.
- Editing names, descriptions and images: change one product at a time and save. Never attach another product's photo; if there is no photo, the site shows a neutral "Image coming soon" placeholder.

## 4. Market rates (the control for all calculated prices)
In **Gold & Metal Rates**, card **"Owner-updated market rates"**:

| Field | Unit | Current approved value |
|---|---|---|
| 14K / 18K / 22K gold | ₹ per gram | 10,200 / 12,300 / 11,510 |
| Platinum 950 | ₹ per gram | 3,911 |
| Making charge | ₹ per **net** metal gram | 2,500 |
| Diamond below 1.00 ct / above 1.00 ct | ₹ per carat, chosen by the piece's **total** carats | 30,000 / 45,000 |
| 24K | — | blocked (no approved rate) |

Change a value, tick the confirmation, and press **Confirm & Publish Owner-Updated Market Rates**. Without the tick nothing changes; negative or non-numeric values are rejected. Each publish creates a new version, takes effect immediately, and is logged in **Rate Card Audit History** (old value, new value, who, when).

**Staging still has placeholder rates. Publish the values above once there** (see Quick Start §4).

## 5. How prices are calculated
`net metal g × metal rate` + `net metal g × making rate` + `total diamond ct × diamond rate` + approved additional charges → **+3% GST (14K/18K)** → rounded half-up to ₹1.
- Gross weight is never used as metal weight, and diamond weight is never added to metal weight.
- Stored supplier wastage, certification and hallmark fees are **not** charged (owner rate card). They stay on record.

**Price on request** is shown, and the piece cannot be carted or checked out, when: GST is unconfirmed (22K, Platinum 950); total diamonds are exactly 1.00 ct; the purity is 24K; or net weight, metal rate or other data is missing or invalid.

**Owner fixed price (override):** set on a product, it is shown instead of the calculated price and is **not** changed by rate updates. Remove it to return to the calculated price. Admin shows both values.

## 6. Orders, customers, inventory, collections
These Admin pages work for inspection. Do not create test orders or customers on staging. Online payment (Razorpay test mode only), Shopify sync (dry-run), Shiprocket and email are **not live**.

## 7. Pending owner decisions
1. GST for 22K and Platinum 950. 2. Rate for exactly 1.00 ct total. 3. 24K rate (only if selling 24K). 4. Real specs for the 272 supplier pieces. 5. Who may publish live rates. 6. Instagram/LinkedIn profile links. 7. Engagement-offer percentage (the offer strip stays hidden until set).

## 8. Reporting a problem
Send your developer the page link, a screenshot and the time. Never share passwords or OTP PINs.
