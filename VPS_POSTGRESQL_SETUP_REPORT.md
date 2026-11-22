# VPS PostgreSQL 18 Setup Report

**Date:** 2026-11-19  
**VPS:** `[STAGING_SERVER_IP]` (`srv2177504`, Ubuntu 26.04.1 LTS)  
**Deployment User:** `mrsdeploy` (`~/.ssh/mrs_vps_ed25519`)  
**Status:** **COMPLETE & VERIFIED**

---

## 1. Phase 1 — Pre-Provisioning Inspection

- **Docker & Compose:** `Docker version 29.10.0, build fdd4b8e`, `Docker Compose version v5.8.0`
- **Private Docker Network:** `mrs_internal_net` (`07f6676588d0`, `bridge`)
- **Available Resources:** `94G` disk available on `/dev/sda1`, `7.2Gi` RAM available
- **Pre-Existing PostgreSQL:** `0` running containers, `0` processes listening on port `5432`
- **Local Mac Source Database:** `mangal_royal_studio_dev` running `PostgreSQL 18.6 (Postgres.app)`

---

## 2. Phase 2 — PostgreSQL 18 Docker Compose Configuration

- **Compose File:** `/srv/mangal-royal-studio/deployment/docker-compose.postgres.yml`
- **Environment File:** `/srv/mangal-royal-studio/deployment/.env.db` (`-rw-------`, `chmod 600`, owned by `mrsdeploy:mrsdeploy`; contains `POSTGRES_USER=mrs_db_admin`, a 48-character random hex `POSTGRES_PASSWORD` generated via `openssl rand -hex 24`, and `POSTGRES_DB=postgres` — never printed or committed)
- **Image:** `postgres:18` (`PostgreSQL 18.7 (Debian 18.7-1.pgdg13+2)`)
- **Persistent Volume & Mount:** `mrs_postgres_18_data:/var/lib/postgresql` with `PGDATA: /var/lib/postgresql/18/docker` (PostgreSQL 18 volume layout)
- **Container Name & Policy:** `mrs_postgres`, `restart: unless-stopped`, healthcheck `pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB` (`healthy`)
- **Network Isolation:** Attached strictly to external bridge network `mrs_internal_net` with **no `ports:` block published to the host**.

### `docker-compose.postgres.yml`
```yaml
services:
  postgres:
    image: postgres:18
    container_name: mrs_postgres
    restart: unless-stopped
    env_file:
      - .env.db
    environment:
      PGDATA: /var/lib/postgresql/18/docker
    volumes:
      - mrs_postgres_18_data:/var/lib/postgresql
    networks:
      - mrs_internal_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 12

volumes:
  mrs_postgres_18_data:
    name: mrs_postgres_18_data

networks:
  mrs_internal_net:
    external: true
```

---

## 3. Phase 3 — Staging Database & Network Isolation Verification

- **Database Created:** `mangal_royal_studio_staging` (`OWNER mrs_db_admin`, verified non-existent prior to creation).
- **Internal Docker Network Connectivity:**
  ```bash
  docker run --rm --network mrs_internal_net postgres:18 pg_isready -h mrs_postgres -p 5432 -U mrs_db_admin
  ```
  Result: `mrs_postgres:5432 - accepting connections`
- **Host Port Audit (`sudo ss -tulpn`):** Port `5432` is **not** listening on the host (`0.0.0.0:22` / `[::]:22` `sshd` is the only public listener).
