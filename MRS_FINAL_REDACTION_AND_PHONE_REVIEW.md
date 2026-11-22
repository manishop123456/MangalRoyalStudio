# MRS Final Redaction and Phone Number Review

**Date:** 2026-11-22  
**Scope:** Local-only cleanup of the **13 `HOLD` files** and inspection of the **3 `REVIEW:PHONE-NUMBER` files** identified in `MRS_FINAL_COMMIT_REVIEW.md`.  
**Restrictions Observed:** Local files only — no `git add`/staging, no commit, no push, no remote creation, no deployment, no DNS/database changes, no credential rotation, and no deletion of original reports or backups.

---

## 1. Redaction of the 13 `HOLD` Files

Unredacted originals were preserved securely outside the repository at:  
`~/MRS-Secure-Backups/unredacted-reports-20261122/` (directory mode `700`, file mode `600`).

### 7 Files Redacted for `[STAGING_SERVER_IP]`
| File | Occurrences Replaced | Verification After Edit |
|---|---:|---|
| `HOSTINGER_SSH_SETUP_REPORT.md` | 2 | `0` VPS IP occurrences remain |
| `HOSTINGER_VPS_INITIAL_SETUP_REPORT.md` | 3 | `0` VPS IP occurrences remain (`127.0.0.53`/`127.0.0.54` loopback `systemd-resolve` entries retained) |
| `TEMPORARY_SHOWCASE_DEPLOYMENT_REPORT.md` | 2 | `0` VPS IP occurrences remain |
| `VPS_APPLICATION_DEPLOYMENT_REPORT.md` | 1 | `0` VPS IP occurrences remain |
| `VPS_POSTGRESQL_SETUP_REPORT.md` | 1 | `0` VPS IP occurrences remain |
| `VPS_PRODUCT_ASSET_TRANSFER_REPORT.md` | 3 | `0` VPS IP occurrences remain |
| `VPS_STAGING_ACCESS_GUIDE.md` | 2 | `0` VPS IP occurrences remain |

### 6 Files Redacted for `[OWNER_EMAIL]`
| File | Occurrences Replaced | Verification After Edit |
|---|---:|---|
| `MRS_OWNER_ADMIN_USER_GUIDE.md` | 1 | `0` personal email occurrences remain |
| `MRS_OWNER_LAUNCH_CHECKLIST.md` | 1 | `0` personal email occurrences remain |
| `MRS_OWNER_QUICK_START.md` | 1 | `0` personal email occurrences remain |
| `MRS_RELEASE_CHECKLIST.md` | 1 | `0` personal email occurrences remain |
| `MRS_STAGING_DEPLOYMENT_REPORT.md` | 1 | `0` personal email occurrences remain |
| `MRS_TEMPORARY_SHOWCASE_DEPLOYMENT_REPORT.md` | 1 | `0` personal email occurrences remain |

**Repository-Wide Scan After Redaction:**  
Across all `1,002` non-ignored files (`git ls-files --cached --others --exclude-standard`):
- Remaining VPS public IP hits: **0**
- Remaining personal email hits (`gmail`/`yahoo`/`outlook`/`hotmail`/`icloud`/`protonmail`): **0**

---

## 2. Review of the 3 `REVIEW:PHONE-NUMBER` Files

None of the 3 files were modified automatically; all values are reported below with full surrounding context and recommendations.

### 2.1 `docs/PHASE_2_DATABASE_HYGIENE_REPORT.md`
- **Context:** Lines 56–89 (documentation, markdown list of deleted test orders).
- **Observed Strings:** `TEST-ORD-1794254010231` through `TEST-ORD-1794491415505` (31 entries).
- **Classification:** **Not a phone number** — these are `TEST-ORD-<13-digit Unix ms timestamp>` order IDs where a 10-digit regex matched a substring.
- **Recommendation:** **RETAIN** (no PII or phone number present).

### 2.2 `services/api/src/phase5a-razorpay.test.ts`
- **Context:** Executable Vitest test payloads for Razorpay checkout & webhook tests (all paired with `@example.com` emails and Mumbai placeholder addresses):
  - Lines 289, 305: `customerPhone: '+91 9820012345'` (`buyer5a@example.com`, `Aarav Mehta`)
  - Line 340: `customerPhone: '+91 9820099999'` (`verify5a@example.com`, `Diya Kapoor`)
  - Line 430: `customerPhone: '+91 9820077777'` (`webhook5a@example.com`, `Kabir Shah`)
  - Line 520: `customerPhone: '+91 9820055555'` (`race5a@example.com`, `Rohan Joshi`)
- **Classification:** **Intentional synthetic test fixtures** (sequential/repeated suffixes `12345`, `99999`, `77777`, `55555` under `@example.com`).
- **Recommendation:** **RETAIN** (clearly synthetic test data).

### 2.3 `services/api/src/app.test.ts`
- **Context:** Executable Vitest API test payloads:
  1. **Sequential test fixtures (`12345` suffix, `@example.com` / `@example.net`):**
     - Lines 570, 590: `'+91 98200 12345'` (`buyer@example.com`, `Kavita Nair`)
     - Lines 1653, 1716, 1737, 1771, 1814, 2005: `'+91 9800012345'` (`Guest Buyer` / `Test Buyer`, `@example.net`)
     - **Classification:** Intentional test fixture. **Recommendation:** **RETAIN**.
  2. **Non-sequential 10-digit numbers (paired with synthetic `@example.com` / registration personas):**
     - Line 1105: `'+91 98209 11223'` (`Ananya Kapoor`, customer registration test)
     - Line 1301: `'+91 98112 77890'` (`rohan.mehta@example.com`, `Rohan Mehta`, `22 Khan Market`)
     - Line 1368: `'+91 99250 33120'` (`priya.desai@example.com`, `Priya Desai`, `CG Road, Navrangpura`)
     - **Classification:** **Synthetic-looking / Uncertain** (paired with fictional `@example.com` personas, but non-sequential digits that could theoretically collide with real Indian mobile numbers). Left **unmodified** per policy.
     - **Recommendation:** **Owner confirmation** — either retain as synthetic test fixtures or replace with obviously reserved sequential numbers (`+91 98200 00001`, `+91 98200 00002`, `+91 98200 00003`) before publishing the clean repository.

---

## 3. Remaining Items Requiring Owner Approval Before Clean Commit

1. **Rotate exposed credentials** (outside local repo):
   - Change the 3 staging Admin passwords and lock/rotate the 3 demo customer logins.
   - Rotate the Razorpay test key in Razorpay Dashboard and clean up `/srv/mangal-royal-studio/app/.env.example` and backup tarballs on staging.
2. **Confirm the 3 non-sequential test phone numbers** in `services/api/src/app.test.ts` (lines 1105, 1301, 1368): retain as-is or normalize to `+91 98200 0000x`.
3. **Approve clean Git history execution** per `MRS_CLEAN_GIT_HISTORY_PLAN.md` (recommended: new repository directory `mangalroyalstudio-clean` without the `c7de1bc` commit).
