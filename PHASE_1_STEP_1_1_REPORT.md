# MANGAL ROYAL STUDIO — PHASE 1, STEP 1.1 REPORT
## Git Initialization, Backup & Mac Environment Stabilization (`PHASE_1_STEP_1_1_REPORT.md`)

**Date:** November 7, 2026  
**Target Environment:** MacBook Retina 2017 — Intel Core m3-7Y32 @ 1.10 GHz (`darwin-x64`), 8 GB RAM, macOS Ventura `13.7.8` (Build `22H730`)  
**Step 1.1 Status:** **PARTIALLY COMPLETE** (All repository backup, Git initialization, `.gitignore`, `.env` configuration, `dotenv` startup loader, and Prisma `v6.19.3` macOS Intel `darwin-x64` binary generation tasks are **COMPLETE and VERIFIED**; PostgreSQL installation requires a manual GUI/admin step as detailed in Section 6 & Section 11).  
**Step 1.2 Status:** **NOT STARTED** (Strict scope enforced; zero security, auth, payment, pricing, database migration, or UI changes made).

---

## 1. Project Root & Pre-Change Verification

Before executing any changes, the project location and critical files were verified:

- **Verified Project Root:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio`
- **Available Disk Space:** `202 GiB` free of `233 GiB` (`8%` capacity used on `/System/Volumes/Data`).
- **Running Processes on Ports `3000`, `3001`, `4000`, `5432`, `9292`:** `0` running processes (`lsof` verified all ports free).
- **Critical Files & State Files Verified Prior to Changes:**
  - `package.json`: `1,267` bytes (modified `Nov 5 19:02`)
  - `PROGRESS.md`: `2,925` bytes (modified `Nov 5 16:47`)
  - `.env.example`: `2,613` bytes (modified `Nov 5 16:47`)
  - `services/api/prisma/schema.prisma`: `29,693` bytes (modified `Nov 5 19:02`)
  - **Root JSON State File (`.data/platform-state.json`):** `70,127` bytes (modified `Nov 5 16:50`) — **Untouched**
  - **API JSON State File (`services/api/.data/platform-state.json`):** `3,112,142` bytes (modified `Nov 7 15:29`) — **Untouched**
  - **Original Shopify Theme Backup (`jewellery-theme-backup/`):** `378` files (`377` theme files + `1` `AGENTS.md`) — **Untouched**
  - **Working Shopify Theme (`apps/shopify-theme/`):** `382` files — **Untouched**

---

## 2. Backup Location, Size & Verification Results

Before initializing Git or modifying any configuration files, a complete timestamped backup was created outside the project root using `rsync -a`:

- **Exact Backup Path:**
  `/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/mangalroyalstudio-backup-20261107-161000`
- **Excluded Reproducible Build/Cache Directories Only:** `node_modules`, `.next`, `dist`, `*.tsbuildinfo`
- **Backup Verification Metrics:**
  - **Total Backup Size:** `17 MB`
  - **Total Backed-Up Files:** `855` files
  - **`jewellery-theme-backup/` in Backup:** `378` files (matches source `378` files)
  - **`apps/shopify-theme/` in Backup:** `382` files (matches source `382` files)
  - **`.data/platform-state.json` in Backup:** `70,127` bytes (`Nov 5 16:50`, byte-identical)
  - **`services/api/.data/platform-state.json` in Backup:** `3,112,142` bytes (`Nov 7 15:29`, byte-identical)
  - **`MANGAL JEWELLERY.xlsx` & `samples/MANGAL JEWELLERY.xlsx` in Backup:** `388,837` bytes each (`Nov 5 18:21`, byte-identical)

---

## 3. Git Status & Initial Baseline Commit

1. **Secret Scan Prior to Staging:** Scanned all workspace files (excluding `node_modules`, `.next`, `dist`) for live API keys (`shpat_`, `rzp_live_`, private keys, `.env` files). Confirmed zero live credentials exist in tracked files.
2. **Repository Initialization:** Initialized Git in `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio/.git/` on branch `main`.
3. **Initial Baseline Commit (Pre-Step 1.1 Changes):**
   - **Commit Hash:** `a2757c199b1b90550a7cd363e6dd446f05c9396d` (`a2757c1`)
   - **Commit Message:** `chore: initial post-migration baseline commit on macOS`
   - **Files Tracked:** `855` files (including all source workspaces, Prisma schema & migration SQL, both `.data/platform-state.json` files, `MANGAL JEWELLERY.xlsx`, `jewellery-theme-backup/`, `apps/shopify-theme/`, `.env.example`, and documentation).

---

## 4. `.gitignore` Changes

Updated [`.gitignore`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.gitignore#L1-L20) to additionally exclude TypeScript incremental build caches (`*.tsbuildinfo`), `.cache/`, and macOS metadata files (`.AppleDouble`, `.LSOverride`, `._*`), while keeping `.env` and `.env.*` ignored and `!.env.example` tracked:

```gitignore
node_modules/
.next/
out/
dist/
build/
coverage/
*.tsbuildinfo
.cache/
.env
.env.*
!.env.example
*.log
.DS_Store
.AppleDouble
.LSOverride
._*
.vscode/
.idea/
.vercel/
.turbo/
```

Verified via `git check-ignore -v .env` (`output: .gitignore:9:.env .env`).

---

## 5. Environment Configuration Changes

### 5.1 Resolution of `NEXT_PUBLIC_ADMIN_API_URL` vs `NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL`
Inspection of all `process.env.*` references across the codebase revealed why a single shared variable name caused a prefix conflict between Admin and Storefront:
- [`apps/admin/src/app/page.tsx:16`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/src/app/page.tsx#L16) reads `process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'` and appends `/api/auth/login` and `/api/admin/...` (expecting **no** `/api/v1` suffix).
- [`apps/storefront/src/lib/storefront-data.ts:12`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/src/lib/storefront-data.ts#L12) reads `process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1'` and appends `/products`, `/checkout/...` (expecting the `/api/v1` suffix).

Without modifying `apps/admin/src/app/page.tsx` or `apps/storefront/src/lib/storefront-data.ts`, we resolved this cleanly in the Next.js configuration files and [`.env.example`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.env.example):
1. **[`apps/admin/next.config.mjs`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/next.config.mjs#L1-L17):** Resolves `NEXT_PUBLIC_ADMIN_API_URL || NEXT_PUBLIC_API_URL || NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'` and strips any trailing `/api` or `/api/v1` suffix.
2. **[`apps/storefront/next.config.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/next.config.ts#L1-L31):** Resolves `NEXT_PUBLIC_STOREFRONT_API_URL || NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'` and automatically appends `/api/v1` if omitted.
3. **[`.env.example`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.env.example#L1-L61):** Added `API_HOST=0.0.0.0`, `STOREFRONT_PORT=9292`, `SHOPIFY_API_VERSION=2025-01`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000`, and `NEXT_PUBLIC_STOREFRONT_API_URL=http://localhost:4000/api/v1` with clear comments and safe local placeholder values.
4. **Local `.env` Created:** Copied `.env.example` to `.env` (`27` keys verified loaded, ignored by Git).
5. **Reliable API Startup `.env` Loading ([`services/api/src/index.ts:1-20`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/index.ts#L1-L20)):** Wired the already-installed `dotenv` (`^16.4.7`) package at the top of `services/api/src/index.ts` to load root `../../../.env` (and local `.env`) **before** dynamically importing `./app.js`, ensuring `process.env` is populated before module-level constants in `auth.ts`, `shopify-service.ts`, and `data-store.ts` are evaluated.

---

## 6. PostgreSQL Installation and Connection Status

- **Inspection Results:**
  - Checked `/Applications/Postgres.app`, `/Library/PostgreSQL`, `/usr/local/var/postgres`, `/opt/homebrew/var/postgres`, `psql`, `postgres`, `pg_isready`, `brew`, `docker`, `podman`, `port`, and `conda`.
  - **Result:** Neither PostgreSQL, Postgres.app, Homebrew, nor Docker is currently installed on this Mac, and port `5432` is not listening.
- **Why Automatic Installation Stopped (Per Section 7 Safeguards):**
  - Installing **Postgres.app** (requires downloading a ~250 MB `.dmg` from `https://postgresapp.com`, mounting and dragging `Postgres.app` into `/Applications/`, launching the macOS GUI app, and clicking **"Initialize"**) or installing **Homebrew** (requires interactive `sudo` administrator password and Xcode Command Line Tools prompt) requires interactive user/admin approval outside the workspace.
  - Per your strict instruction (*"If installation requires user interaction, download approval, administrator password, or a GUI step, stop and provide exact instructions for me. Do not pretend installation succeeded"*), exact step-by-step installation instructions for macOS Ventura 13.7.8 Intel x64 are provided in **Section 11** below.

---

## 7. Prisma Version and Darwin x64 Engine Status

- **Installed Versions:**
  - `prisma`: `6.19.3`
  - `@prisma/client`: `6.19.3`
  - `@prisma/engines`: `6.19.3`
  - *(Note: Prisma was NOT upgraded to v7/v8, preserving exact schema and lockfile compatibility).*
- **Darwin x64 Engine Generation & Verification:**
  - Executed: `/Users/macbook/.nvm/versions/node/v26.13.0/bin/node ./node_modules/prisma/build/index.js generate --schema services/api/prisma/schema.prisma`
  - Downloaded and verified macOS Intel (`darwin-x64`) engines:
    - `node_modules/@prisma/engines/libquery_engine-darwin.dylib.node` (`21,127,120` bytes)
    - `node_modules/@prisma/engines/schema-engine-darwin` (`23,320,672` bytes)
    - `node_modules/.prisma/client/libquery_engine-darwin.dylib.node` (`21,127,120` bytes)
  - Verified `./node_modules/.bin/prisma version` (`Computed binaryTarget: darwin`, `Architecture: x64`).
  - Verified `./node_modules/.bin/prisma validate --schema services/api/prisma/schema.prisma` (`The schema at services/api/prisma/schema.prisma is valid 🚀`).
  - Verified `new PrismaClient()` instantiation in Node `v26.13.0` on `darwin-x64`.

---

## 8. Dependency Vulnerability Summary (`npm audit`)

`npm audit` was inspected without modifying `package.json`, `package-lock.json`, or running `npm audit fix`:

| Package | Severity | Advisory Summary | Workspace Impact | Recommended Later Remediation |
|---|---|---|---|---|
| `tinypool` (`<=2.1.1`, via `vitest`) | **Critical (2)** | Prototype Pollution gadget in worker options (`GHSA-5gmw-xhrv-c9v3`, `GHSA-85c8-ppgw-ccpr`) | Dev/Test only (`vitest`) | Upgrade `vitest` in a dedicated test-tooling maintenance step. |
| `xlsx` (`*`) | **High (2)** | Prototype Pollution (`GHSA-4r6h-8v6p-xvw6`) & ReDoS (`GHSA-5pgg-2g8v-p4x9`) | Runtime (`services/api` Excel importer — admin-authenticated only) | Replace `xlsx` with `exceljs` or pinned SheetJS CDN tarball (`0.20.x`) when refactoring importer in Phase 2/3. |
| `postcss` (`<=8.5.22`, via `next`) | **High (1)** | CSS sourceMappingURL path traversal / `.map` disclosure (`GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`) | Build-time CSS compilation (`next`) | Addressed via `overrides` or Next.js patch upgrade after core milestones. |
| `deepmerge-ts` (`<8.0.0`, via `@prisma/config`) | **High (3)** | Stack exhaustion on recursive object graphs (`GHSA-ggr8-5vv4-36mx`) | CLI dev tool only (`prisma`) | Non-breaking `npm audit fix` on `deepmerge-ts` when approved. |
| `zod` (`<4.6.6`) | **High (1)** | Memory exhaustion validating oversized constrained collections (`GHSA-mrhx-c7xc-m3w5`) | Runtime (`packages/shared`, `services/api`) | Enforce strict array `.max()` bounds in Zod schemas and JSON body limits (avoid major Zod v4 breaking upgrade until evaluated). |
| `@vitest/mocker`, `esbuild`, `vite`, `vite-node` | **Moderate (4)** | Dev server / mock path traversal (`GHSA-82fw-gwwq-j7x9`, `GHSA-67mh-4wv8-2f99`) | Dev/Test only (`vitest`) | Dev-only; upgrade with `vitest` later. |

---

## 9. Files Changed in Step 1.1

1. [`.gitignore`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.gitignore) — Added `*.tsbuildinfo`, `.cache/`, `.AppleDouble`, `.LSOverride`, `._*`.
2. [`.env.example`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/.env.example) — Added `API_HOST`, `STOREFRONT_PORT`, `SHOPIFY_API_VERSION`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_STOREFRONT_API_URL` alongside `NEXT_PUBLIC_ADMIN_API_URL`.
3. `.env` — Created local environment file from `.env.example` (git-ignored).
4. [`services/api/src/index.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/services/api/src/index.ts) — Added `dotenv.config()` loading root and workspace `.env` before importing `./app.js`.
5. [`apps/admin/next.config.mjs`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/admin/next.config.mjs) — Mapped `NEXT_PUBLIC_ADMIN_API_URL` / `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` cleanly for Admin.
6. [`apps/storefront/next.config.ts`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/apps/storefront/next.config.ts) — Mapped `NEXT_PUBLIC_STOREFRONT_API_URL` / `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_URL` cleanly with `/api/v1` normalization for Storefront.
7. [`PROGRESS.md`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PROGRESS.md) — Appended non-destructive Phase 1, Step 1.1 status note at the bottom.
8. [`PHASE_1_STEP_1_1_REPORT.md`](file:///Users/macbook/Documents/mangal%20royal%20studio/mangalroyalstudio/PHASE_1_STEP_1_1_REPORT.md) — Created this report.

---

## 10. Commands Executed

1. `pwd`, `df -h . /tmp`, `ls -la ...`, `find jewellery-theme-backup -type f | wc -l`, `lsof -i :3000 -i :3001 -i :4000 -i :9292` (Pre-change verification)
2. `rsync -a --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='*.tsbuildinfo' "/Users/macbook/Documents/mangal royal studio/mangalroyalstudio/" "/Users/macbook/.gemini/antigravity/brain/878953ef-b2d3-4f88-bd94-6998fdfd4527/backups/mangalroyalstudio-backup-20261107-161000/"` (Full backup outside project directory)
3. `git init`, `git add .`, `git commit -m "chore: initial post-migration baseline commit on macOS"` (`a2757c1`)
4. `cp .env.example .env` & `git check-ignore -v .env`
5. `/Users/macbook/.nvm/versions/node/v26.13.0/bin/node ./node_modules/prisma/build/index.js generate --schema services/api/prisma/schema.prisma` (Generated Prisma Darwin x64 binaries & client)
6. `./node_modules/.bin/prisma version` & `./node_modules/.bin/prisma validate --schema services/api/prisma/schema.prisma`
7. `/Users/macbook/.nvm/versions/node/v26.13.0/bin/node /Users/macbook/.nvm/versions/node/v26.13.0/bin/npm audit`
8. `npm run typecheck` (Verified all 4 workspaces pass with 0 TypeScript errors)

---

## 11. Manual Steps Required from You (PostgreSQL Installation on macOS Ventura 13.7.8)

To install **PostgreSQL 16** via **Postgres.app** (the cleanest native option for macOS Ventura 13.7.8 Intel x64 without requiring Homebrew compilation):

1. **Download Postgres.app (PostgreSQL 16 Universal macOS):**
   - Open your browser and download the **Postgres.app with PostgreSQL 16** `.dmg` from [https://postgresapp.com/downloads.html](https://postgresapp.com/downloads.html) (supports macOS Ventura 13.7.8 Intel x64).
2. **Install & Initialize:**
   - Open the downloaded `.dmg` file and drag **Postgres** into your **Applications** folder (`/Applications/Postgres.app`).
   - Open **Postgres.app** from `/Applications` and click **"Initialize"** to start a local PostgreSQL 16 server on port `5432`.
3. **Add `psql` and `pg_isready` to your PATH:**
   Run the following command in your Mac Terminal (requires your Mac login password):
   ```zsh
   sudo mkdir -p /etc/paths.d && echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
   ```
4. **Verify in a New Terminal Tab:**
   ```zsh
   psql --version
   pg_isready -h localhost -p 5432
   ```
   *(Do not create tables or run migrations yet—database creation and Prisma migration deployment are reserved for Step 1.3).*

---

## 12. Remaining Blockers

1. **Local PostgreSQL Installation Pending Manual GUI Step:** Until Postgres.app (or Homebrew `postgresql@16`) is installed and running on `localhost:5432`, Step 1.3 (Prisma migration deployment and database seeding) cannot execute against a live database. *(Note: Step 1.2 Security & Authentication Hardening does not require PostgreSQL to be running and can proceed immediately once approved).*

---

## 13. Confirmation Regarding Step 1.2

**Confirmed:** **Phase 1, Step 1.2 (Security & Authentication Hardening) has NOT been started.** Authentication, authorization, password hashing, payment verification, pricing logic, JSON persistence, database migrations, and UI components remain completely untouched.
