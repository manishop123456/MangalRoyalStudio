# MRS Credential Remediation Report

**Date:** 2026-11-22, 14:35–15:05 IST (09:05–09:35 UTC) · **Scope:** local source only. No commit, push, deployment, DNS change, staging/production change, credential rotation, authentication attempt with discovered credentials, or payment operation.
**Evidence:** `MRS_AUDIT_EVIDENCE/run-20261122-credentials/` (git-ignored). No credential value appears in any report or log.

## Disclosure: values shown in my terminal during this task
While inspecting test files, two redaction filters failed and **three credential values were printed in this session's terminal output**: the **owner** and **pricing** dev-seed Admin passwords, and the dev **demo-customer** password. They were not written to any file, report or evidence log (verified: 0 occurrences in evidence). They are already scheduled for rotation (below); treat them as exposed. All later inspection printed counts and classifications only.

## 1. Inventory (Phase 1)
| Item | Finding |
|---|---|
| **Hard-coded Admin passwords** (3 dev-seed values: owner / manager / pricing) | Before: **15 files, 65 occurrences**: 8 source/test files (`seed-dev-auth.ts`, `store/data-store.ts`, `app.test.ts`, 5 other tests) + 7 docs (`README.md`, `SECURITY.md`, `ADMIN_MODULES.md`, `API_DOCUMENTATION.md`, `CODE_VERIFICATION_AUDIT.md`, `POST_MIGRATION_FULL_AUDIT.md`, `VPS_STAGING_ACCESS_GUIDE.md`). The earlier "28" counted each file once per password in `.ts`/`.tsx` only. |
| Committed history (`HEAD` `c7de1bc`) | **9 files** contain them: 6 docs, `data-store.ts`, `app.test.ts`, and **`apps/admin/src/app/page.tsx` (a client-side demo-login table)**. |
| Seed / default-credential mechanisms | (1) `db/seed-dev-auth.ts`: PostgreSQL seed with 3 literal Admin passwords. (2) `store/data-store.ts` `createInitialSeedState()`: JSON first-run state with the same 3 Admin passwords **and a shared demo-customer password** for 3 seeded customers. (3) `scripts/create-dev-customer.ts`: already safe (env-only, ≥ 12 chars, refuses production). |
| Insecure fallbacks | **`NON_PROD_FALLBACK_JWT_SECRET`**: a hard-coded JWT signing secret used whenever `JWT_SECRET` is missing or a placeholder outside production (the local `.env` has a placeholder, so local sessions were signed with a public value). Production already refused weak secrets. |
| `VPS_STAGING_ACCESS_GUIDE.md` | Contained the owner seed password as the *staging* access instruction, which strongly suggests staging Admin uses the dev-seed values. **Not verified** (no authentication attempted, by instruction). |
| Razorpay | See §3. |
| Other secrets in source/history | None real: fake keys in redaction tests (`auth-config.test.ts`, `phase5a-razorpay.test.ts`); `.env.example` DB URL placeholder; masked `***` in one doc. Deployment config (`deploy/staging/`) references env files by path only. |

## 2. Source remediation (Phase 2)
| Change | Detail |
|---|---|
| `services/api/src/config/seed-credentials.ts` (new) | `MRS_SEED_OWNER_PASSWORD`, `MRS_SEED_MANAGER_PASSWORD`, `MRS_SEED_PRICING_PASSWORD` (required for explicit seeding: ≥ 14 chars, not a placeholder, never logged) and optional `MRS_SEED_CUSTOMER_PASSWORD`. |
| `db/seed-dev-auth.ts` | Literals removed. All three passwords are resolved **before any database access**; if one is missing or weak it stops with `SEED_CREDENTIALS_MISSING: set MRS_SEED_…` (variable name only) and writes nothing. |
| `store/data-store.ts` | First-run Admins and demo customers use the env values if present; **otherwise a random, never-stored password, so the accounts are locked**. No fallback password exists. Password hashing (salted scrypt) is unchanged. |
| `middleware/auth.ts` | The non-production JWT fallback is now `crypto.randomBytes(48)` per process (sessions end on restart). Production still requires a strong `JWT_SECRET`. |
| Tests | `vitest.config.ts` + `test-support/seed-credentials.setup.ts` give each run **random** seed passwords (always overwritten; shell values are never used). They also point the default JSON store at a fresh temp file, which fixes a second isolation defect: `app.test.ts` had been reading the developer's live `services/api/.data/platform-state.json`. The 3 dev-PostgreSQL tests now create a **temporary Admin with a random password** and delete it afterwards (`test-support/test-credentials.ts`). The wrong-password probe now uses a value guaranteed to be wrong. |
| Docs (7) | Values replaced with `<set via MRS_SEED_*_PASSWORD>`. |
| `.env.example` | Placeholders only (masked-shape audit of every key/secret/token/password line); duplicate `RAZORPAY_MODE` removed; `MRS_SEED_*` documented with placeholders. |
| Regression tests | `credential-hygiene.test.ts` (10): required seed passwords reject missing/short/placeholder values without echoing them; the seed script stops before DB access; the JSON default locks accounts without env values; configured values work; the JWT fallback is random per process; production refuses a weak JWT secret; **production source of API, Admin, storefront and shared contains no `password: '…'` or `hashPassword('…')` literal**. |

**Result:** the 3 Admin and 1 demo-customer values have **0 occurrences** in the working tree (data folders excluded; those hold hashes only). Client bundles (61 files) contain 0 seed values and 0 secret variable names.

**Remaining literals, accepted and documented:**
- Throwaway passwords for accounts the tests create and delete (customer registration and login tests).
- One invalid "legacy backdoor" value in a test that asserts it is **rejected** (401).
- Fake Razorpay/Resend keys used to test redaction.

## 3. Razorpay (Phase 3)
- **Variables:** `RAZORPAY_KEY_ID` (public key identifier, `rzp_test_` / `rzp_live_` prefix), `RAZORPAY_KEY_SECRET` (**secret**), `RAZORPAY_WEBHOOK_SECRET` (secret), `RAZORPAY_MODE` (`test`).
- **Exposed value:** the uncommitted `.env.example` held **both** a real-format **test Key ID** (`rzp_test_` + 14 chars) **and a 24-character Key Secret**. The secret is the sensitive part. Never committed (`HEAD` had placeholders). Local `.env` holds placeholders only.
- **Staging runtime does NOT use it:** `.env.app` and the running `mrs_api` container have **no** `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (only `RAZORPAY_MODE`); health reports `razorpayConfigured: false`. Copies exist only in `/srv/mangal-royal-studio/app/.env.example` and the two app-source backup tarballs there (not in any image). Not modified (out of scope).
- **Test mode preserved:** `assertRazorpayTestMode()` rejects `rzp_live_*` keys; `RAZORPAY_MODE=test`; no payment operation performed.

**Owner rotation procedure (Razorpay test key):**
1. Razorpay Dashboard → **Test Mode** → Account & Settings → **API Keys** → *Regenerate Test Key*. This invalidates the old secret immediately.
2. Store the new Key ID and Secret only in a password manager and in the target server's env file (`/srv/mangal-royal-studio/deployment/.env.app`, mode 600) if and when payments are enabled. Never in `.env.example`, reports or chat.
3. On the VPS, replace the two `RAZORPAY_*` lines in `app/.env.example` with the placeholders from the repo's `.env.example`. Decide whether to keep or securely remove the two app-source backup tarballs that contain the old value.
4. If a webhook was configured, regenerate `RAZORPAY_WEBHOOK_SECRET` the same way.
5. Delete or secure `~/Downloads/rzp-key.csv` after storing the key in a password manager.

**Owner rotation procedure (Admin and seeded accounts):**
1. Change the 3 staging Admin passwords (and any other environment restored from the dev dump).
2. Set the 3 demo customers on staging to locked or new passwords.
3. For local dev, put new values in your local `.env` as `MRS_SEED_*` (never committed).

## 4. Verification (Phase 5): all executed
| Command | Result |
|---|---|
| `npm run typecheck` (4 workspaces) | PASS |
| `npm run test --workspace=@mrs/shared` | 51/51 |
| `npm run test --workspace=@mrs/api` | **176/176** (incl. 10 new credential tests, PostgreSQL E2E with temporary admins) |
| `npm run test --workspace=@mrs/storefront` / `npx vitest run --root apps/admin` | 24/24 / 3/3 |
| Auth/RBAC/credential focus run | 55 passed (27 outside the name filter skipped) |
| Builds: shared, api, storefront, admin (Next into `.next-verify`) | PASS |
| Hard-coded password scan / bundle scan / `git check-ignore -v` | 0 / 0 / all sensitive paths ignored, new source trackable |
| Owner's local data file | unchanged (`5d202bad…`); tests no longer read it |
