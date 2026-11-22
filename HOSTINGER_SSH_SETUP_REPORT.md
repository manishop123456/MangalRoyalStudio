# Hostinger VPS SSH Setup Report

**Date:** 2026-11-19  
**Target VPS:** `root@[STAGING_SERVER_IP]:22` (Hostinger KVM 2 — `srv2177504`)  
**Status:** **PASS** (Key-based SSH authentication verified; read-only server diagnostics completed; no VPS modifications made)

---

## 1. SSH Key & Authentication Verification

- **Key Pair:** `/Users/macbook/.ssh/mrs_vps_ed25519` (`chmod 600`) & `/Users/macbook/.ssh/mrs_vps_ed25519.pub` (`chmod 644`)
- **Fingerprint:** `SHA256:7hMJcZdXEW6kN2pAX///VcLxIIbwXbIgux+FXzNfk3M mrs-vps-admin`
- **Verification Command:**
  ```bash
  ssh -i ~/.ssh/mrs_vps_ed25519 -o BatchMode=yes -o PasswordAuthentication=no root@[STAGING_SERVER_IP]
  ```
- **Authentication Result:** **PASS** (`whoami` -> `root`, passwordless BatchMode login succeeded)

---

## 2. Read-Only VPS Diagnostics

### `whoami`
```text
root
```

### `hostnamectl`
```text
 Static hostname: srv2177504
       Icon name: computer-vm
         Chassis: vm 🖴
      Machine ID: 2c57ea02dbe54659af049aa46c9e9e81
         Boot ID: a11264fd14274ed2a9130b9782b89ef9
    Product UUID: 2c57ea02-dbe5-4659-af04-9aa46c9e9e81
  Virtualization: kvm
Operating System: Ubuntu 26.04.1 LTS
          Kernel: Linux 7.0.0-38-generic
    Architecture: x86-64
 Hardware Vendor: QEMU
  Hardware Model: Standard PC _i440FX + PIIX, 1996_
Hardware Version: pc-i440fx-11.1
Firmware Version: rel-1.17.0-0-gb52ca86e094d-prebuilt.qemu.org
   Firmware Date: Tue 2014-04-01
    Firmware Age: 12y 7month 2w 5d
```
*(Note: The VPS is running **Ubuntu 26.04.1 LTS** rather than 24.04 LTS.)*

### `free -h` (RAM — 8 GB KVM 2 Tier Confirmed)
```text
               total        used        free      shared  buff/cache   available
Mem:           7.7Gi       427Mi       7.4Gi       724Ki       155Mi       7.3Gi
Swap:             0B          0B          0B
```

### `df -h /` (Disk — 100 GB NVMe KVM 2 Tier Confirmed)
```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        96G  1.2G   95G   2% /
```

### `nproc` (CPU — 2 vCPU KVM 2 Tier Confirmed)
```text
2
```
