# MRS Release Rollback Guide (staging)

**Release:** 2026-11-22 06:33 UTC · **Rollback tag:** `rollback-20261122T063149Z` (previous release; the 2026-11-21 release is also tagged `rollback-20261121T183943Z`)
Run on the VPS as `mrsdeploy` (`ssh -i ~/.ssh/mrs_vps_ed25519 mrsdeploy@<server>`). **Never delete Docker volumes. Never run `prisma migrate reset`.**

## 1. Application rollback (no data change), about 1 minute
```bash
cd /srv/mangal-royal-studio/deployment
for s in api storefront admin; do docker tag mrs-$s:rollback-20261122T063149Z mrs-$s:staging; done
docker compose -f docker-compose.app.yml up -d --no-deps --no-build mrs_api mrs_storefront mrs_admin
docker ps --format '{{.Names}} {{.Status}}'          # expect healthy
curl -fsS http://127.0.0.1:8080/api/v1/products | head -c 200
```
Effect: restores the previous app, which **shows unapproved placeholder-derived prices** again on staging. Use only if this release breaks something.

## 2. Source / config rollback (only if needed to rebuild)
```bash
cd /srv/mangal-royal-studio
tar -xzf backups/app_source_pre_deploy_20261122T063149Z.tgz          # restores app/
tar -xzf backups/deployment_config_pre_deploy_20261122T063149Z.tgz   # restores deployment/
```

## 3. Database restore (destructive: needs explicit owner approval)
This release wrote **no** data, so a DB restore is not needed for an app rollback. If data is ever damaged:
```bash
B=/srv/mangal-royal-studio/backups
sha256sum $B/staging_pre_deploy_mangal_royal_studio_staging_20261122T063149Z.dump   # must be 26932746…6e72
docker exec mrs_postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d mangal_royal_studio_staging -Fc' > $B/before_restore_$(date -u +%Y%m%dT%H%M%SZ).dump
docker exec -i mrs_postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d mangal_royal_studio_staging --clean --if-exists --no-owner' \
  < $B/staging_pre_deploy_mangal_royal_studio_staging_20261122T063149Z.dump
```

## 4. Showcase tunnel
If the tunnel is restarted it gets a **new** URL: `docker logs mrs_showcase_tunnel 2>&1 | grep trycloudflare | tail -1`. Stop the showcase: `docker stop mrs_showcase_tunnel`.
