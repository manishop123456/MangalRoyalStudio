# MRS Final Production Release Status

- **Date / Time:** `2026-11-24 20:18 IST`
- **Production Domain:** `mangalroyalstudio.com` (`https://mangalroyalstudio.com`, `www` → `301` → apex)
- **Source Commit:** `07d5cb3` on `main` (preserving `e85f15b`, `858ac4b`, `f24dcb6`, `cb8bc67`, `ad96cb0`, `acb468f`, `2dddc2f`, `b320440`)
- **Release Artifact:** `/tmp/mrs-release-07d5cb3.tar.gz` (`ab374e1bd528f72a8d9d06371323f5ce8180a64ede1a08b63001b6433613a1d0`)
- **Hostinger Deployment Identity:** `srv2177504` (`189.72.158.142`)
- **Production Database Identity:** `mangal_royal_studio_prod` (`mrs_prod_postgres`, isolated)
- **Latest Verified Backup SHA-256:** `c4eff5677e8ddc104391fe343a44f28cf9e9bed890b65d9792a7ef1cc685a706`
- **Product Counts:** `280` total (`274` `ACTIVE`: `6` priced once Rate Card published + `268` Price on Request; `6` `DRAFT` blocked for duplicate images)
- **Active Rate Card Version:** `PENDING OWNER PUBLISH`
- **Payment / Shipping Status:** `DISABLED` (`CATALOGUE_ENQUIRY_MODE=true`)

---

## FINAL RELEASE DECISION

### **FAIL — PRODUCTION LAUNCH BLOCKED**

#### Completed & Verified
- Full 280-SKU genuine catalogue reconciled and imported into `mangal_royal_studio_prod` (`274 ACTIVE`, `6 DRAFT` duplicate-image SKUs, `3,122` images, `0` `localhost` URLs, `0` customers/orders).
- Fixed `PRODUCT_ASSETS_ROOT` (`200 OK` on `/api/public/product-images/...`) and `maxPageSize: 500` on `/api/admin/products` (`returned: 280`).
- `@mrs/api` (`178/178` PASS, `0` skipped) and `@mrs/admin` (`6/6` PASS) verified.

#### Remaining Owner Gates Before Public Cutover
1. Confirm Phase One security rotations (staging/dev Admin passwords, demo-customer accounts, Razorpay test Key Secret, staging `.env.example` cleanup, backup tarball retention).
2. Sign in to `http://localhost:3101` (with SSH tunnel active) and publish the approved full Rate Card under **Gold & Metal Rates**.
3. Update the GoDaddy `@` `A` record for `mangalroyalstudio.com` to `189.72.158.142`, then let me run `certbot --nginx` for `mangalroyalstudio.com` + `www.mangalroyalstudio.com` and complete final public Chromium browser verification.
