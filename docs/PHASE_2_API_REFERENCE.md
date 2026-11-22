# Phase 2 API Reference — Mangal Royal Studio

## Public Endpoints
- `GET /api/public/products/:handleOrSku/customization`
  - Returns `{ productId, sku, handle, eligible, assignment, profile, modelAsset }`.
- `POST /api/public/customization/quote`
  - Body: `{ productHandleOrSku, selections: Record<string, string>, quantity?: number }`
  - Returns `{ quote: CustomizationQuoteResponse }` with authoritative `Decimal.js` server pricing.
- `GET /api/public/model-assets/:storageKey`
  - Serves locally managed `.glb` (`model/gltf-binary`) or `.gltf` (`model/gltf+json`) files. Rejects path traversal.

## Customer Endpoints (`requireCustomerAuth` + CSRF for mutations + strict IDOR ownership)
- `GET /api/customer/designs` — List saved designs owned by authenticated customer.
- `POST /api/customer/designs` — Save a bespoke design (`{ productHandleOrSku, name?, selections }`).
- `GET /api/customer/designs/:designId` — Fetch single owned design (`403` if owned by another customer).
- `PATCH /api/customer/designs/:designId` — Update name and/or selections (recalculates quote server-side).
- `DELETE /api/customer/designs/:designId` — Delete owned design.
- `POST /api/customer/designs/:designId/duplicate` — Duplicate owned design.
- `POST /api/customer/designs/:designId/add-to-cart` — Add owned design to cart (`{ cartId, quantity }`).

## Cart & Checkout Updates
- `POST /api/cart/:cartId/items` — Accepts optional `selections` and `customerDesignId`; recalculates unit price on server.
- `PATCH /api/cart/:cartId/items/:itemId` — Updates item quantity (`1..20`) with vault stock check.
- `POST /api/checkout/create-order` — Accepts `items[].selections` & `items[].customerDesignId`; recalculates customized prices on server and stores `customizationSnapshotJson` + `customerDesignId` on `OrderItem`.

## Admin Endpoints (`requireAuth` + RBAC + CSRF)
- `GET /api/admin/customization/profiles` (`CUSTOMIZATION_VIEW`)
- `POST /api/admin/customization/profiles` (`CUSTOMIZATION_MANAGE`)
- `PATCH /api/admin/customization/profiles/:profileId` (`CUSTOMIZATION_MANAGE`)
- `POST /api/admin/customization/profiles/:profileId/groups` (`CUSTOMIZATION_MANAGE`)
- `PATCH /api/admin/customization/groups/:groupId` (`CUSTOMIZATION_MANAGE`)
- `POST /api/admin/customization/groups/:groupId/options` (`CUSTOMIZATION_MANAGE`)
- `PATCH /api/admin/customization/options/:optionId` (`CUSTOMIZATION_MANAGE`)
- `PUT /api/admin/customization/products/:sku/assignment` (`CUSTOMIZATION_MANAGE`)
- `GET /api/admin/model-assets` (`CUSTOMIZATION_VIEW`)
- `POST /api/admin/model-assets/:sku/upload` (`MODEL_ASSETS_MANAGE`, multipart `file`, 25 MB max)
- `PUT /api/admin/model-assets/:sku/external` (`MODEL_ASSETS_MANAGE`)
- `DELETE /api/admin/model-assets/:sku` (`MODEL_ASSETS_MANAGE`)
- `GET /api/admin/designs` (`DESIGNS_VIEW`)
