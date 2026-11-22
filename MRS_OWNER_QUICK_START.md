# Mangal Royal Studio — Owner Quick Start (temporary showcase)

## 1. Open the showcase
1. Open **https://michelle-den-comedy-legs.trycloudflare.com** in any browser.
2. Cloudflare asks for an email. Enter **[OWNER_EMAIL]**. Only this address is allowed.
3. Cloudflare emails a short PIN to that inbox. Type it in, and the website opens.
4. The link is **temporary**. It changes if the server restarts or the showcase is restarted. If it stops working, ask your developer for the new link. Do not print it as the shop's permanent address.

## 2. What visitors can and cannot do
- **Can:** browse all jewellery, categories, shapes, product pages, search and About Us.
- **Cannot (switched off on purpose):** register or log in, add to cart, check out, pay online, book shipping, or receive emails. Only browsing works on the showcase.
- Only products marked **Active** are visible. **Draft** products are never shown.

## 3. Open the Admin panel (private, never on the public link)
Admin is reachable only from a computer that has the server key, through a secure SSH tunnel:
```
ssh -i ~/.ssh/mrs_vps_ed25519 -L 3001:127.0.0.1:3001 -L 4000:127.0.0.1:4000 mrsdeploy@<server address>
```
Keep that window open, then go to **http://localhost:3001** and sign in with your owner account. Use **Sign Out** when finished; it also invalidates the session on the server. Sessions expire after 24 hours. Your developer can set this up for you.

## 4. One-time task: publish your approved rates on the showcase
Until you do this, every showcase product shows **"Price on request"**: the system will not display prices calculated from old placeholder rates. Use this card, not the single-metal rate form (that form saves placeholder rates, which never produce a price).
1. In Admin, open **Gold & Metal Rates**, card **"Owner-updated market rates"**.
2. Enter: 14K **10200**, 18K **12300**, 22K **11510**, Platinum 950 **3911**, Making **2500** (per net gram), Diamond below 1 ct **30000**, Diamond above 1 ct **45000**.
3. Tick the confirmation box, then press **Confirm & Publish Owner-Updated Market Rates**. Every change is saved in the audit history with old value, new value, your email and the time.
4. The prices should then be: Royal Celeste ring ₹1,39,040 · Imperial Emerald-Cut ring ₹1,10,498 · Tennis bracelet ₹3,43,938 · Pear pendant ₹30,818 · Kada bangle ₹3,09,227 · Bridal necklace ₹6,46,881. **Price on request:** Lumière studs (exactly 1.00 ct) and the 1975 Founder choker (22K).

## 5. How a price is calculated
**Net metal weight × metal rate + net weight × ₹2,500 making + total diamond carats × diamond rate, then 3% GST, rounded to the nearest rupee.**
- The diamond rate depends on the piece's **total** carats: below 1.00 ct ₹30,000/ct, above 1.00 ct ₹45,000/ct.
- No wastage, certification or hallmark fee is added unless you approve one.
- **Price on request** appears when something is not decided or is missing: GST for 22K and Platinum, an exact 1.00 ct total, 24K gold, or missing weights. These pieces cannot be bought online.
- **Fixed price (override):** if you set a fixed price on a product, that price stays the same when rates change. The calculated price is still shown beside it in Admin.

## 6. Decisions only you can make
1. **GST for 22K and Platinum 950** (is it 3%?).
2. **Rate for exactly 1.00 ct** total diamond weight (₹30,000 or ₹45,000 per carat?).
3. **24K rate**, only if you will sell 24K.
4. **Real product details** for the 272 supplier pieces: fill in `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv` (name, metal, purity, net and gross weight, diamonds, size, stock). Until then they stay Draft. The "final pricing" spreadsheet contained sample products, not your real items, so nothing from it was published.
5. Whether managers and pricing staff may change live rates, or only you.

## 7. Problems
Send your developer the page link, a screenshot and the time it happened. Never send passwords or the email PIN to anyone.
