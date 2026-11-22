# API Specification (initial contract)

All admin endpoints require authentication and role authorization. Validate request bodies with a schema library such as Zod. Exact paths may evolve after the audit.

## Health
- `GET /health` — liveness/readiness without exposing secrets.

## Metal rates
- `GET /api/admin/rates/metals` — list current rates and history.
- `POST /api/admin/rates/metals` — create a new rate record.
- `GET /api/admin/rates/metals/:id` — retrieve rate record.

## Diamond pricing
- `GET /api/admin/rates/diamonds`
- `POST /api/admin/rates/diamonds`
- `PATCH /api/admin/rates/diamonds/:id` — only if versioning/history is preserved; prefer creating a new version.

## Product pricing
- `GET /api/admin/pricing/products` — list Shopify products with pricing attributes.
- `PUT /api/admin/pricing/products/:variantId/attributes`
- `POST /api/admin/pricing/preview` — calculate proposed prices, no Shopify writes.
- `POST /api/admin/pricing/runs/:runId/validate`
- `POST /api/admin/pricing/runs/:runId/approve` — owner role only.
- `POST /api/admin/pricing/runs/:runId/publish` — owner role only; starts durable background job.
- `GET /api/admin/pricing/runs/:runId` — progress and errors.

## Bulk products
- `POST /api/admin/imports/products` — upload CSV, defaults to dry-run.
- `GET /api/admin/imports/:jobId`
- `GET /api/admin/imports/:jobId/errors`

## Shopify webhooks
- `POST /api/webhooks/shopify` — verify Shopify HMAC, record event, process idempotently.
- Subscribe only to required topics and document each topic.

## Logistics
- `POST /api/admin/orders/:orderId/shipments` — create shipment only after eligibility and payment/order checks.
- `GET /api/admin/orders/:orderId/shipments`
- `POST /api/webhooks/shiprocket` — verify according to current provider documentation and process idempotently.

## Payments
Prefer Shopify-managed checkout and Razorpay's supported Shopify provider integration.
- Do not invent a custom payment endpoint unless a separately approved custom payment architecture is required.
- If custom Razorpay Checkout is approved later, backend must create the payment order, verify signature, validate amount/currency/order association, process signed webhooks idempotently, and reconcile with Shopify. Browser success redirect alone is never proof of payment.

## API conventions
- JSON responses with stable error codes.
- Never return access tokens or secrets.
- Pagination for list endpoints.
- Idempotency keys for writes that may be retried.
- Rate limits on admin and webhook routes.
