# MRS Production Admin Verification

- **Date / Time:** `2026-11-24 20:18 IST`
- **Source Commit:** `07d5cb3`
- **Admin Endpoint:** `127.0.0.1:3101` (SSH tunnel only; `/admin` returns `404` publicly, `/api/v1/admin/*` returns `403` publicly)

## Verified Admin Capabilities
- **Authentication:** `OWNER` (`manishop6789@gmail.com`) provisioned via interactive hidden input (`>= 16` chars); HTTP `localhost` SSH-tunnel cookie fix (`2dddc2f`) verified.
- **Shopify Status Badge:** Displays `Shopify Integration: Disabled (Safe Default)` (`acb468f`).
- **Full 280-Product Visibility:** `/api/admin/products?pageSize=500` returns `200 OK`, `total: 280`, `returned: 280` (`274 ACTIVE`, `6 DRAFT`) (`07d5cb3`).
- **Filters & Search:** SKU search, title search, category filter, `ACTIVE`, `DRAFT`, `PRICE_ON_REQUEST`, and `ARCHIVED` filters verified (`@mrs/admin` `6/6` PASS).
- **Rate Publishing Governance:** `RATES_WRITE` restricted strictly to `OWNER` (`@mrs/api` `178/178` PASS, `0` skipped).
