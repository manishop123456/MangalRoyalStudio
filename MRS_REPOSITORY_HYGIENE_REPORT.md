# MRS Repository Hygiene Report

**Date:** 2026-11-22, 14:20–14:30 IST (08:50–09:00 UTC) · **Repository:** `main` @ `c7de1bc`, 1 commit, **no remote** · **Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-hygiene/`

## Decision: **DO NOT COMMIT YET.** Credentials are already in Git history and their status on staging is unconfirmed.
Nothing was committed or pushed. The proposed file list is ready for review (§7), but two secret items must be resolved first (§4).

## 1. Working-tree inventory (`01-inventory.log`)
- Tracked: 854 files; **41 modified** (40 pre-existing + `next.config.ts`; `.env.example` and `.gitignore` edited in this task).
- Untracked: 448 files in total, **138** not ignored after this task (the full application backend, repositories, migrations 2–3, tests, new storefront files, reports, `deploy/staging/`).
- Ignored: `.env`, `.env.save`, `.data/`, `services/api/.data/` (JSON state with customer test data), `.uploads/`, `product-assets-inbox/` (545 MB), `processed-product-assets/` (604 MB), `private-imports/` (pricing workbook), `node_modules/`, `.next*/`, `dist/`, `*.tsbuildinfo`, `*.log`.

## 2. Database dump: moved out of the repository (preserved)
`backups/pre_hygiene_phase2_mangal_royal_studio_dev.dump`: custom-format `pg_dump` of **`mangal_royal_studio_dev`** made 2026-11-12 19:27 IST. It holds data for all 48 tables, including **AdminUser (password hashes), Customer, CustomerAddress, RefreshToken, AuditLog, orders and payments**, so it is sensitive.

| | |
|---|---|
| Moved to | `~/MRS-Secure-Backups/db-dumps/pre_hygiene_phase2_mangal_royal_studio_dev.dump` (directory mode 700, file mode 600) |
| SHA-256 before = after | `bde0e3b381e5156b0221d8fedba17d40c8a33ef5fb5738f381229254b549af60` |
| Readability | `pg_restore --list` OK |
| Deleted? | **No**: moved with `mv -n` (no overwrite). The repo's `backups/` is now empty and ignored. |

## 3. `.gitignore` updated, verified with `git check-ignore -v` (`06-check-ignore.log`)
Added:
- **Dumps and archives:** `backups/`, `*.dump`, `*.backup`, `*.bak`, `*.sql.gz`, `*.sql.zip`, `*.pgdump`, `*.tar.gz`, `*.tgz`.
- **Keys and credentials:** `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`, `id_rsa*`, `id_ed25519*`, `*credentials*.json`, `*.secret`, `rzp-key*.csv`.
- **Build and evidence:** `.next-*/`, `MRS_AUDIT_EVIDENCE/`.
- **Root spreadsheets:** `/*.csv` (supplier and asset sheets).
- **Kept tracked:** `!samples/MANGAL JEWELLERY.xlsx` (the synthetic test fixture).

Verified ignored: the dump path, `*.dump`, `*.sql.gz`, `*.pem`, `*.key`, `rzp-key.csv`, `.env`, `.env.save`, `.env.production`, the pricing workbook, `.next-showcase-verify/`, evidence CSVs, `SUPPLIER_SKU_CATALOGUE.csv`, `MRS_SUPPLIER_SKU_SPEC_TEMPLATE.csv`, both `.data/platform-state.json`, the asset inbox.
Verified still trackable: `.env.example`, `samples/MANGAL JEWELLERY.xlsx`, migrations, source files.
Note: the root copy `MANGAL JEWELLERY.xlsx` is already tracked (synthetic sample) and stays tracked.

## 4. Secrets and sensitive data (`03-sensitive-sweep.log`, `04-secret-scan.log`, `05-value-equality-checks.log`)
No secret value is printed in any log; comparisons were made by hash or by masked shape.

| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | **`.env.example` (uncommitted edit) contained a real-format Razorpay *test* key pair** (`rzp_test_…` + 24-char secret). The committed `HEAD` version has placeholders, so it is **not in Git history**. | High | **Fixed locally:** placeholders restored. **Owner action:** rotate this Razorpay test key. The same value is in `/srv/mangal-royal-studio/app/.env.example` on the staging server and in the app-source backup tarballs there (not in any image). Not changed on staging (out of scope). Whether it matches the key export in `~/Downloads/rzp-key.csv` could not be checked (reading that file was blocked). |
| S2 | **Dev-seed Admin passwords are in Git history:** the committed `apps/admin/src/app/page.tsx` contains a demo-login table with the same 3 passwords as `services/api/src/db/seed-dev-auth.ts` (equality verified by hash). They also appear in **28 current source files** (tests + seed). Current builds contain none (0 bundle files). | **High** (if staging uses them) | **Unresolved.** Staging Admin accounts were restored from a dev dump, so they very likely use these passwords (not verified: signing in to staging with them was blocked). **Owner action:** change all 3 staging Admin passwords. Before any first `git push`, decide whether to start a fresh history (the 1 existing commit contains these values). Recommended: move test/seed passwords to env variables. |
| S3 | VPS public IP in **7 untracked reports** (`HOSTINGER_*`, `VPS_*`, `TEMPORARY_SHOWCASE_DEPLOYMENT_REPORT.md`). Not in `HEAD`. | Medium (infrastructure detail) | Marked **HOLD** in the proposed list; redact before committing. |
| S4 | `docs/PHASE_3_FINAL_PREFLIGHT_REPORT.md` shows a DB URL with password `***` (already masked). `VPS_DEPLOYMENT_ENVIRONMENT_REFERENCE.md` holds a placeholder DB URL that does **not** match the live staging password (hash check). | Info | OK |
| S5 | Test fixtures contain fake keys (`rzp_live_…`, `re_9876…`) used to test redaction. | Info | OK (not real) |
| S6 | Local `.env` uses example placeholder values (weak dev `JWT_SECRET`); `.env` and `.env.save` are ignored and untracked. | Info | OK for local dev only |
| S7 | Release evidence contains the approved OTP email, staging backup paths, container IDs and pricing audits. | Medium | Now ignored (`MRS_AUDIT_EVIDENCE/`). |

**Git history:** 1 commit. `HEAD` contains placeholders in `.env.example`, no private keys, no live keys, no VPS IP, but **does** contain S2.

## 5. What produced the deployed staging build (provenance)
- Images `mrs-api` (`1c1c9279…`, built 06:32:25Z), `mrs-storefront` (`a424569f…`, 06:32:41Z) and `mrs-admin` (`166badd5…`, 06:32:38Z) were built on the VPS from **`/srv/mangal-royal-studio/app`** with **`/srv/mangal-royal-studio/deployment/Dockerfile`** + `docker-compose.app.yml` (env from `.env.app`, not captured).
- **0 files** in that app tree are newer than the image build, so the tree is exactly the build input.
- Of the 108 deployed source files, **60 are tracked and 48 untracked** in Git. **The deployment config is not in Git at all.** Git alone therefore cannot reproduce staging.

**Local working tree vs deployed (`07-provenance.log`):** 86 identical. The differences are exactly:
- the Part A remediation files (not deployed);
- the 3 test-isolation files;
- 3 new local-only files (`customer-messages.ts`, `customer-messages.test.ts`, `test-support/isolated-api.ts`);
- `.dockerignore`, which exists only on the VPS.

The Next.js build had rewritten `next-env.d.ts` and `tsconfig.json`; both were restored and match `HEAD`.

## 6. Reproducible source snapshot
- `~/MRS-Secure-Backups/source-snapshots/staging-deployed-20261122T063250Z/`: the exact deployed `app/` source (package files, `.dockerignore`, `packages/`, `services/`, `apps/storefront`, `apps/admin`) and `deployment/` (Dockerfile, both compose files, nginx config). **112 files, no `.env*` files**, plus `MANIFEST.sha256`.
- Archive: `~/MRS-Secure-Backups/source-snapshots/staging-deployed-20261122T063250Z.tgz` (mode 600), SHA-256 `4537dec931dbc33bb7a9b956ab59e53590b68a0888344c83a7d104dc7da98bb6`.
- **Added to the repo (proposed, not committed):** `deploy/staging/` with `Dockerfile`, `docker-compose.app.yml`, `docker-compose.postgres.yml`, `nginx-showcase.conf`, `dockerignore.app`. No secrets: env files are referenced by path only.
- To rebuild the deployed version: unpack the snapshot, supply `.env.app`/`.env.db` from the VPS (not stored), then `docker compose -f deployment/docker-compose.app.yml build`.

## 7. Proposed commit file list (for review, NOT committed): `08-proposed-commit-file-list.txt`
**179 entries:** 41 modified + 138 new.
- Root files 59 (reports, `.gitignore`, `.env.example`, `package.json` …) · `services/api` 42 · `apps/storefront` 31 · `docs/` 27 · `packages/shared` 9 · `apps/admin` 6 · `deploy/staging` 5.
- **HOLD (8):** the 7 VPS-IP reports and `seed-dev-auth.ts` (hard-coded passwords).
- **REVIEW (6):** test files with fixture passwords; these must not equal any real staging password (see S2).

## 8. Commands executed (summary)
`git status --short --ignored`, `git ls-files`, `git check-ignore -v`, `git show HEAD:<file>`, `git grep … HEAD`, `pg_restore --list`, `shasum -a 256`, `mv -n`, `chmod 600/700`, hash and masked-shape comparisons (no values printed), and read-only `ssh`/`tar` of the VPS app and deployment directories.

## 9. Owner actions before the first commit
1. Change the 3 staging Admin passwords (S2); confirm no environment uses the dev-seed values.
2. Rotate the Razorpay test key (S1); replace the copy in the VPS `app/.env.example`.
3. Decide on Git history: keep (and treat S2 values as burnt) or create a fresh root commit before any push.
4. Redact the VPS IP from the 7 HOLD reports (or keep them out of Git); move seed/test passwords to env variables.
5. Review `08-proposed-commit-file-list.txt`, then authorise the commit.
