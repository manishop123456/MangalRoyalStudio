# MRS Product Image Audit

- **Date / Time:** `2026-11-24 19:20 IST`
- **Production Asset Storage:** `/srv/mangal-royal-studio/production/product-assets` (`3,523` files across 12 category folders).

## 8 Production `ACTIVE` Product Images (Live HTTP + SHA-256 Verification)
| SKU | Status | Content-Type | Bytes | SHA-256 (16 hex) | Classification |
|---|---|---|---|---|---|
| `MRS-RNG-1001` | `200` | `image/jpeg` | `32462` | `da62e179ce1ff901` | `IMAGE_VERIFIED` (unique) |
| `MRS-RNG-1002` | `200` | `image/jpeg` | `165968` | `79ad59de6dcdb7cc` | `IMAGE_VERIFIED` (unique) |
| `MRS-BRC-3001` | `200` | `image/png` | `290564` | `6c39bb3f75ce0b0a` | `IMAGE_VERIFIED` (unique) |
| `MRS-PND-4001` | `200` | `image/png` | `129779` | `b74495d065ac8bbc` | `IMAGE_VERIFIED` (unique) |
| `MRS-BNG-5001` | `200` | `image/jpeg` | `59301` | `58e1872807c8e0c1` | `IMAGE_VERIFIED` (unique) |
| `MRS-NCK-6001` | `200` | `image/jpeg` | `249908` | `3ae4f08b81f9ee03` | `IMAGE_VERIFIED` (unique) |
| `MRS-EAR-2001` | `200` | `image/jpeg` | `60268` | `c5d9656e496ff95c` | `IMAGE_MAPPING_UNCERTAIN` (shares identical SHA-256 with `MRS-ANT-7001`) |
| `MRS-ANT-7001` | `200` | `image/jpeg` | `60268` | `c5d9656e496ff95c` | `IMAGE_MAPPING_UNCERTAIN` (shares identical SHA-256 with `MRS-EAR-2001`) |

## Supplier Draft Image Notes (`272` `DRAFT` SKUs)
- All `272` drafts have local/synced image references (`missingImages: 0` in DB), but `LOW_RESOLUTION_ASSETS.csv` flags crops `< 600 px`, and 3 SKU pairs share identical photos (`SKUDTG00007`/`SKUDTG00019`, `SKURIGO2916`/`SKURIGO2917`, `SKUDRG00017`/`SKUDRG00063`).
- Owner confirmation/replacement is required for the duplicate `MRS-EAR-2001` / `MRS-ANT-7001` image pair.
