# Deployment, Environment & Operations Guide (`DEPLOYMENT.md`)

> **Code-Verified Audit Status:** Audited against root `package.json`, workspace `package.json` files, `.env.example` (lines 1–64), `services/api/prisma/schema.prisma`, and `services/api/src/store/data-store.ts`. See [CODE_VERIFICATION_AUDIT.md](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md) for full details.

---

## 1. Monorepo Services & Port Assignments (`VERIFIED`)

| Workspace Package | Directory | Dev Command | Production Start Command | Default Port |
| :--- | :--- | :--- | :--- | :--- |
| **`@mrs/storefront`** | `apps/storefront` | `npm run dev:storefront` (`next dev -p 3000`) | `npm run start --workspace=@mrs/storefront` (`-p 3000`) | **`3000`** |
| **`@mrs/admin`** | `apps/admin` | `npm run dev:admin` (`next dev -p 3001`) | `npm run start --workspace=@mrs/admin` (`-p 3001`) | **`3001`** |
| **`@mrs/api`** | `services/api` | `npm run dev:api` (`tsx watch src/index.ts`) | `npm run start --workspace=@mrs/api` (`node dist/index.js`) | **`4000`** |
| **Shopify Liquid Preview** | `apps/shopify-theme` | `npm run preview:storefront` | N/A (Local inspection utility) | **`9292`** |

---

## 2. Environment Variables Audit (`.env.example` vs Code Usage)

The table below compares every variable declared in [`.env.example`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/.env.example#L1-L64) against actual `process.env.*` references in the codebase:

| Environment Variable | Declared in `.env.example` | Referenced in Source Code | Verification Status & Notes |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes (`development`) | `services/api/src/app.ts` (`line 2085`) | **VERIFIED** |
| `PORT` | Yes (`4000`) | `services/api/src/index.ts` (`line 6`) | **VERIFIED** |
| `API_PORT` | No | `services/api/src/index.ts` (`line 6`) | **UNDECLARED IN `.env.example`** (`Number(process.env.PORT \|\| process.env.API_PORT \|\| 4000)`) |
| `CORS_ORIGIN` | Yes (`http://localhost:3000`) | Not read in `app.ts` (`app.use(cors())` allows all origins) | **DECLARED BUT UNUSED** |
| `NEXT_PUBLIC_API_BASE_URL` | Yes (`http://localhost:4000/api`) | Not read in `apps/` | **MISMATCH** — `apps/admin` and `apps/storefront` read **`NEXT_PUBLIC_API_URL`** (`http://localhost:4000`) instead |
| `NEXT_PUBLIC_API_URL` | No | `apps/admin/src/app/page.tsx` (`line 11`), `apps/storefront/src/app/page.tsx` (`line 11`) | **UNDECLARED IN `.env.example`** (Should be added to `.env.example`) |
| `DATABASE_URL` | Yes (`postgresql://...`) | `services/api/prisma/schema.prisma` (`line 7`) | **VERIFIED FOR PRISMA** (Runtime API currently persists to `.data/platform-state.json`) |
| `JWT_SECRET` | Yes | `services/api/src/middleware/auth.ts` (`line 15`) | **VERIFIED** |
| `SESSION_SECRET` | Yes | Not read in `services/api/src/` | **DECLARED BUT UNUSED** |
| `SHOPIFY_STORE_DOMAIN` | Yes | `services/api/src/app.ts` (`line 97`), `shopify-service.ts` | **VERIFIED** |
| `SHOPIFY_ADMIN_API_VERSION` | Yes (`2025-01`) | `services/api/src/services/shopify-service.ts` (`line 20`) | **VERIFIED** |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Yes | `services/api/src/services/shopify-service.ts` (`line 18`) | **VERIFIED** |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Yes | `services/api/src/services/shopify-service.ts` (`line 19`) | **VERIFIED** |
| `SHOPIFY_WEBHOOK_SECRET` | Yes | `services/api/src/app.ts` (`line 2302`) | **VERIFIED** |
| `RAZORPAY_KEY_ID` | Yes | `services/api/src/app.ts` (`line 2046`) | **VERIFIED** |
| `RAZORPAY_KEY_SECRET` | Yes | `services/api/src/app.ts` (`line 2076`), `shiprocket-service.ts` (`line 56`) | **VERIFIED** |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | `services/api/src/app.ts` (`line 2146`) | **VERIFIED** |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` / `SHIPROCKET_WEBHOOK_TOKEN` | Yes | Not read in `shiprocket-service.ts` | **DECLARED BUT UNUSED** (Shiprocket service is currently simulated in memory) |
| `DEFAULT_CURRENCY` / `DEFAULT_GST_PERCENT` / `PRICE_ROUNDING_MODE` | Yes | Configured via `dbStore.pricingRule` in `data-store.ts` | **DECLARED IN `.env.example`** |

---

## 3. Database & Persistence Status (`IMPORTANT PRE-DEPLOYMENT NOTE`)

1. **Prisma Schema & Migration (`services/api/prisma/`):**
   - `services/api/prisma/schema.prisma` defines **40 models** and **1 enum (`RoleName`)**.
   - Initial SQL migration is generated at `services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql`.
   - **Migration Status:** **Generated, NOT applied** to a live PostgreSQL instance.
2. **Current Runtime Persistence (`services/api/src/store/data-store.ts`):**
   - The Express API currently persists state to `.data/platform-state.json` via `PlatformDataStore` (`dbStore`).
   - Before deploying to a multi-instance production environment, `services/api` routes should be wired to `@prisma/client` backed by a managed PostgreSQL 16 database, and `npx prisma migrate deploy` should be run during the release pipeline.
