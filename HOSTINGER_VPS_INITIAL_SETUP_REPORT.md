# Hostinger VPS Initial Setup Report

**Date:** 2026-11-19  
**VPS IPv4:** `[STAGING_SERVER_IP]`  
**Hostname:** `srv2177504` (Hostinger KVM 2)  
**Overall Status:** **COMPLETE & VERIFIED**

---

## 1. Server Verification & Resource Summary

| Attribute | Verified Value |
| --- | --- |
| Operating System | `Ubuntu 26.04.1 LTS` (`resolute`) |
| Kernel & Arch | `Linux 7.0.0-38-generic` (`x86-64`, KVM/QEMU) |
| vCPUs (`nproc`) | `2` |
| RAM (`free -h`) | `7.7Gi` total (`557Mi` used, `7.2Gi` available, `0B` swap) |
| Storage (`df -h /`) | `/dev/sda1`: `96G` total (`2.2G` used, `94G` available, `3%`) |

---

## 2. SSH Key Authentication & Deployment User (`mrsdeploy`)

- **SSH Key Pair (Local Mac):** `/Users/macbook/.ssh/mrs_vps_ed25519` (`chmod 600`) & `/Users/macbook/.ssh/mrs_vps_ed25519.pub` (`chmod 644`)
- **Key Fingerprint:** `SHA256:7hMJcZdXEW6kN2pAX///VcLxIIbwXbIgux+FXzNfk3M mrs-vps-admin`
- **`root` Key-Based Login:** Verified (`BatchMode=yes`, `PasswordAuthentication=no` -> `root`; root access preserved as recovery path).
- **Dedicated Deployment User (`mrsdeploy`):**
  - Created with `/home/mrsdeploy` and `/bin/bash`.
  - Membership: `uid=1000(mrsdeploy) gid=1000(mrsdeploy) groups=1000(mrsdeploy),27(sudo),986(docker)`.
  - *(Security Note: Membership in the `docker` group grants root-equivalent privileges on the host.)*
  - `/home/mrsdeploy/.ssh` (`chmod 700`) and `/home/mrsdeploy/.ssh/authorized_keys` (`chmod 600`) configured and verified in a separate SSH session.

---

## 3. Firewall (UFW), Fail2ban & Automatic Security Updates

### UFW (`sudo ufw status verbose`)
```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
22/tcp (v6)                ALLOW IN    Anywhere (v6)
80/tcp (v6)                ALLOW IN    Anywhere (v6)
443/tcp (v6)               ALLOW IN    Anywhere (v6)
```

### Fail2ban (`sudo fail2ban-client status sshd`)
- Configured `/etc/fail2ban/jail.d/sshd.local` with `backend = systemd`, `port = 22`, `maxretry = 5`, `findtime = 10m`, `bantime = 1h`.
- Service status: `active` (`Journal matches: _SYSTEMD_UNIT=ssh.service + _COMM=sshd`).

### Unattended Upgrades
- Service status: `active` (`/etc/apt/apt.conf.d/20auto-upgrades` enabled for daily package list updates and unattended security upgrades).

---

## 4. Docker Installation & Network Isolation

- **Repository:** Official Docker Ubuntu repository (`https://download.docker.com/linux/ubuntu resolute stable`, signed by `/etc/apt/keyrings/docker.asc`).
- **Installed Versions:**
  - `Docker version 29.10.0, build fdd4b8e`
  - `Docker Compose version v5.8.0`
  - `systemctl is-active docker` -> `active`
- **Verification:** Ran `hello-world` test container (verified pass) and removed the test container and image (`0` containers running).
- **Private Docker Network:** Created internal bridge network `mrs_internal_net` (`07f6676588d0`).
- **Docker Port Policy for Upcoming Deployment:**
  - Because Docker `ports:` rules write directly to `iptables` and can bypass UFW if bound to `0.0.0.0`, only the reverse proxy (ports `80`/`443`) may bind to `0.0.0.0`.
  - Storefront (`3000`), Admin (`3001`), Express API (`4000`), and PostgreSQL (`5432`) must communicate over `mrs_internal_net` (or bind strictly to `127.0.0.1` if host-published) and must **never** publish `0.0.0.0:5432`, `:4000`, `:3000`, or `:3001`.

---

## 5. Application Directory Structure (`/srv/mangal-royal-studio`)

```text
drwxr-xr-x 7 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio
drwxr-xr-x 2 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio/app
drwxr-x--- 2 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio/backups
drwxr-xr-x 2 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio/deployment
drwxr-x--- 2 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio/logs
drwxr-xr-x 2 mrsdeploy mrsdeploy 4096 Nov 19 09:27 /srv/mangal-royal-studio/product-assets
```

---

## 6. Public Listening Ports Audit (`sudo ss -tulpn`)

- **Public Listeners:** Only `0.0.0.0:22` and `[::]:22` (`sshd`).
- **Local Loopback Only:** `127.0.0.53:53` & `127.0.0.54:53` (`systemd-resolve`), `127.0.0.1:323` & `[::1]:323` (`chronyd`).
- **PostgreSQL `5432` / Docker TCP API:** Not listening / not exposed.

---

## 7. Next SSH Connection Command & Remaining Deployment Tasks

### Exact Next SSH Connection Command
```bash
ssh -i ~/.ssh/mrs_vps_ed25519 mrsdeploy@[STAGING_SERVER_IP]
```

### Remaining Tasks (Next Milestones)
1. Provision PostgreSQL (bound strictly to `127.0.0.1:5432` or internal Docker network `mrs_internal_net`) and migrate/seed the production schema.
2. Transfer `processed-product-assets/` (`605 MB`) via `rsync` to `/srv/mangal-royal-studio/product-assets/` as `mrsdeploy`.
3. Deploy the application stack (`services/api`, `apps/storefront`, `apps/admin`) behind Nginx/Caddy reverse proxy on ports `80`/`443`.
4. Point GoDaddy DNS records to `[STAGING_SERVER_IP]` and issue TLS certificates once owner-approved.
