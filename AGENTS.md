# Instructions for AI coding agents

## First actions
- Read all project documentation before coding.
- Inspect the supplied Shopify theme and report its structure, theme name/version if discoverable, key templates/sections/assets, custom scripts, apps or external dependencies referenced, and any obvious risks.
- Do not change the theme during the audit.
- Produce `AUDIT_REPORT.md` and `DECISIONS.md`.
- Ask for approval before destructive actions, live-store writes, production deployment, DNS changes, or publishing a theme.

## Architecture constraints
- Shopify is the commerce system of record for catalog, variants, inventory, carts/checkout, customers and orders.
- Use a custom backend for jewellery pricing workflows and integrations. Keep secrets server-side.
- Use PostgreSQL for app-specific records, not as a second competing product/order database.
- Use Shopify GraphQL Admin API for store administration. Pin a supported stable API version and document it.
- Use Shopify Storefront API for customer-facing product/catalog/cart functionality where suitable.
- Keep the storefront independent of the Liquid theme unless the audit and owner explicitly choose a Shopify theme-based implementation instead.
- Do not assume Shopify Basic supports every checkout customization or custom app extension. Verify plan-specific capabilities before designing checkout modifications.

## Jewellery pricing safety
- Do not guess the commercial formula. Model it as versioned, configurable rules.
- Support per-product metal purity, net/gross weight, stone details, making charge mode, wastage, fixed adjustments, tax configuration and manual override where approved.
- Treat diamond pricing as a configurable quality/size matrix or explicitly approved rate table; do not assume one universal per-carat price.
- Implement preview -> validation -> owner approval -> publish.
- Store rate snapshots, formula version, calculation breakdown and timestamps for every published pricing run.
- Never retroactively change historical orders. Shopify order line prices are the purchase-time record; preserve a corresponding pricing snapshot for audit.
- Include rounding rules and currency (INR) explicitly.

## Bulk operations
- Support 600+ products.
- Validate CSV headers, required fields, SKU/handle uniqueness, weights, image URLs and product references.
- Provide dry-run and downloadable error report.
- Use Shopify-supported bulk operations or controlled batching, with retry/backoff and progress tracking.
- Avoid accidental duplicate products or uncontrolled mass price changes.

## Security
- Validate all inputs on the server.
- Use role-based access for owner, manager and pricing operator.
- Verify webhook HMAC/signatures and make webhook handlers idempotent.
- Verify Razorpay signatures and payment webhooks server-side if a custom payment flow is ever approved.
- Never store raw card data.
- Never put secrets in `NEXT_PUBLIC_*` variables or client bundles.
- Add audit logs for rate changes, pricing approvals, product imports, refunds and admin actions.
- Use least-privilege Shopify scopes.

## Code quality
- TypeScript strict mode.
- Keep modules small and typed.
- Add tests for pricing calculations, permissions, webhooks, imports and sync jobs.
- Use migrations for database changes.
- Include loading, empty, error and success states in UI.
- Do not silently swallow errors.
- Keep `.env.example` current; never commit `.env`.
- Do not claim a feature is complete without tests and a clear verification note.

## Workflow
1. Audit.
2. Propose decisions and milestones.
3. Wait for approval.
4. Implement one milestone at a time.
5. Run lint, typecheck, tests and build.
6. Summarize changed files, commands run, results, remaining risks and next step.
