# VPS Product Asset Transfer Report

**Date:** 2026-11-19  
**Local Source:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio/processed-product-assets/`  
**VPS Destination:** `mrsdeploy@[STAGING_SERVER_IP]:/srv/mangal-royal-studio/product-assets/`  
**Final Verdict:** **PASS**

---

## 1. Pre-Transfer & Source Checksum Manifest

- **Source Directory:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio/processed-product-assets` (originals untouched)
- **Total Files:** `3,523` (`100%` `.png` — `3,483` primary extracted crops + `37` materialized cross-SKU crops for `SKUDTG00019`, `SKURIGO2917`, `SKUDRG00063` + `3` contact sheets)
- **Total Directories:** `327`
- **Exact Byte Size:** `626,207,395` bytes (`597.20 MiB`; `606M` disk allocation on ext4)
- **Local SHA-256 Manifest Path:** `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/scratch/processed_product_assets_sha256.manifest` (`3,523` entries, manifest SHA-256: `30ccefbfe0c4e9f947835060ac196abaa0fd8aead547fd8765911d55c2f3892f`)

---

## 2. Transfer & Verification Results

### Command Executed
```bash
rsync -av --progress --exclude='.DS_Store' \
  -e "ssh -i ~/.ssh/mrs_vps_ed25519 -o BatchMode=yes" \
  ./processed-product-assets/ \
  mrsdeploy@[STAGING_SERVER_IP]:/srv/mangal-royal-studio/product-assets/
```
*(No `--delete` flag used; hierarchy preserved as `/srv/mangal-royal-studio/product-assets/<CATEGORY>/<ASSET_ID>/<FILENAME>`.)*

### Source vs. Destination Comparison

| Check | Local Source (Mac) | VPS Destination (`[STAGING_SERVER_IP]`) | Result |
| --- | ---: | ---: | --- |
| Total Directories | 327 | 327 | PASS |
| Total Files | 3,523 | 3,523 | PASS |
| Total File Bytes | 626,207,395 | 626,207,395 | PASS |
| SHA-256 Checksum Verification (`sha256sum -c`) | 3,523 / 3,523 | 3,523 / 3,523 (`0` failures) | PASS |
| Staging DB `ProductImage` Paths Verified | 3,122 | 3,122 (`0` missing/unreadable) | PASS |
| World-Writable Files/Dirs | 0 | 0 | PASS |

---

## 3. Ownership & Permissions on VPS

- **Owner / Group:** `mrsdeploy:mrsdeploy` across `/srv/mangal-royal-studio/product-assets`
- **Directory Mode:** `0755` (`drwxr-xr-x`)
- **File Mode:** `0644` (`-rw-r--r--`, readable by any container UID via read-only bind mount; `0` world-writable entries)

---

## 4. API Storage Compatibility & Recommended Docker Bind Mount

In [services/api/src/app.ts](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/app.ts), `GET /api/public/product-images/:category/:assetId/:filename` resolves files against `path.resolve(process.env.PRODUCT_ASSETS_ROOT, category, assetId, filename)`.

When deploying `services/api` on the Hostinger VPS, configure the API service in Docker Compose with a read-only bind mount:

```yaml
services:
  api:
    environment:
      PRODUCT_ASSETS_ROOT: /srv/mangal-royal-studio/product-assets
    volumes:
      - /srv/mangal-royal-studio/product-assets:/srv/mangal-royal-studio/product-assets:ro
```

Because `mangal_royal_studio_staging` stores relative URLs (`/api/public/product-images/<CATEGORY>/<ASSET_ID>/<FILENAME>`), all `3,122` product image rows map directly to `/srv/mangal-royal-studio/product-assets/<CATEGORY>/<ASSET_ID>/<FILENAME>`.
