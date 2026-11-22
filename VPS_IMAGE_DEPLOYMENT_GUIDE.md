# VPS Image Deployment Guide (Hostinger VPS)

**Target VPS Asset Directory:** `/srv/mangal-royal-studio/product-assets/`  
**Current Local Source:** `processed-product-assets/` (`605 MB`)

---

## 1. Prepare the VPS Directory

On the Hostinger VPS:

```bash
sudo mkdir -p /srv/mangal-royal-studio/product-assets
sudo chown -R $USER:$USER /srv/mangal-royal-studio/product-assets
chmod -R 755 /srv/mangal-royal-studio/product-assets
```

---

## 2. Copy Processed Product Assets with `rsync`

Run from the local project root (`/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`):

```bash
rsync -avz --progress --exclude='_contact-sheets/' \
  ./processed-product-assets/ \
  <vps-user>@<vps-host>:/srv/mangal-royal-studio/product-assets/
```

*(Omit `--exclude='_contact-sheets/'` if you also want the unmatched contact sheets on the VPS; do **not** use `--delete` until you confirm the remote directory contents.)*

---

## 3. Configure Environment Variables on the VPS

In the production `.env` for `services/api`:

```env
PRODUCT_ASSETS_ROOT=/srv/mangal-royal-studio/product-assets
```

In the production build environment for `apps/storefront` and `apps/admin`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_ADMIN_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_STOREFRONT_API_URL=https://api.yourdomain.com/api/v1
```

Because PostgreSQL stores relative paths (`/api/public/product-images/<CATEGORY>/<SKU>/<FILE>.png`), both apps automatically resolve image URLs to `https://api.yourdomain.com/api/public/product-images/...`.

---

## 4. Docker Bind Mount (If Containerizing)

No `Dockerfile` or `docker-compose.yml` is currently present in the repository. If you deploy `services/api` with Docker, mount `/srv/mangal-royal-studio/product-assets` read-only into the API container so rebuilds never wipe product images:

```yaml
services:
  api:
    environment:
      - PRODUCT_ASSETS_ROOT=/srv/mangal-royal-studio/product-assets
    volumes:
      - /srv/mangal-royal-studio/product-assets:/srv/mangal-royal-studio/product-assets:ro
```
