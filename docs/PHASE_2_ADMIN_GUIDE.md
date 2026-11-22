# Phase 2 Admin Guide — Customization, 3D Assets & Customer Designs

## Module 20: Customization Profiles (`CUSTOMIZATION_VIEW` / `CUSTOMIZATION_MANAGE`)
- View all seeded and custom profiles (`BESPOKE_RINGS`, `FINE_JEWELLERY_STANDARD`), their eligible categories, and option counts.
- Activate/deactivate profiles, create new profiles, and assign explicit per-SKU overrides (`isCustomizable`, `allowDiamondSelection`, `allowEngraving`, `maxEngravingChars`).

## Module 21: 3D Model Assets (`CUSTOMIZATION_VIEW` / `MODEL_ASSETS_MANAGE`)
- Upload `.glb` or `.gltf` files (max 25 MB, validated server-side for `glTF` binary header or valid glTF JSON) for any product SKU, or associate an external CDN asset URL.
- Remove an active 3D asset at any time; the storefront immediately reverts to the product's standard photo gallery.

## Module 22: Customer Saved Designs (`DESIGNS_VIEW`)
- Read-only inspection of customer-saved bespoke designs, selected option snapshots, last server-quoted INR total, and timestamps.
