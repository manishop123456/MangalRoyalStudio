# MRS Owner Launch Checklist

*Updated 22 Nov 2026, 12:06 IST. This covers the private temporary showcase only; nothing here is a production launch.*

**Showcase link (temporary, changes on restart):** https://michelle-den-comedy-legs.trycloudflare.com. Sign in with the PIN emailed to **[OWNER_EMAIL]**.

## Today: what you will see
All 8 products show **"Price on request"**. This is deliberate: the showcase stopped displaying prices that came from old, unapproved placeholder rates. Prices appear as soon as you complete step 1.

## Steps for you
1. **Publish your approved rates on the showcase (about 5 minutes).** Open staging Admin through the SSH tunnel (see `MRS_OWNER_QUICK_START.md` §3), go to **Gold & Metal Rates → Owner-updated market rates** and enter 14K **10200**, 18K **12300**, 22K **11510**, Platinum 950 **3911**, Making **2500**, Diamond below 1 ct **30000**, above 1 ct **45000**. Tick the box and press **Confirm & Publish Owner-Updated Market Rates**.
   Then check: Royal Celeste ring ₹1,39,040 · Imperial Emerald-Cut ring ₹1,10,498 · Tennis bracelet ₹3,43,938 · Pear pendant ₹30,818 · Kada bangle ₹3,09,227 · Bridal necklace ₹6,46,881. The studs and the 22K choker stay "Price on request".
   Do **not** use the separate single-metal rate form for this; it saves rates as placeholders, and placeholders never produce a price.
2. **Your local app:** this morning's entry of 18K = ₹5,821 was saved as a placeholder, and the other local rates are still old placeholders. You confirmed ₹12,300 is correct. Publish the same card in your local Admin; until then your local site also shows Price on request.
3. **Decide:** GST for 22K and Platinum 950 · the rate for exactly 1.00 ct · whether managers and pricing staff may publish rates.
4. **Product data:** fill in `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` for the pieces you want to sell (272 supplier pieces are waiting; none can be shown without real weights and metal details).
5. **Confirm** the names and photos of the 8 live products, and supply Instagram/LinkedIn profile links.
6. **Change the staging Admin passwords** (they likely match development defaults).

## Status summary
| | |
|---|---|
| Live (ACTIVE) products | 8 (6 priced once step 1 is done, 2 Price on request) |
| Blocked (DRAFT) products | 272, missing specifications |
| Pricing audit | engine matches independent calculation 8/8 on the deployed server |
| Checkout, payment, shipping, email | switched off on the showcase |
| Release status | **CONDITIONAL PASS — STAGING DEPLOYED WITH BLOCKED PRODUCTS** |
