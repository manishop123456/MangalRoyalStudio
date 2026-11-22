# Data Model (initial proposal)

This is a proposal for app-specific data. Shopify remains the source of truth for products, variants, inventory and orders. Confirm the final schema after inspecting the existing store and sample products.

## Core tables

### `admin_profiles`
- `id` UUID, primary key, references auth user
- `display_name`
- `role` enum: `owner`, `manager`, `pricing_operator`
- `is_active`
- `created_at`, `updated_at`

### `metal_rates`
- `id` UUID
- `metal` enum/string: `gold`, `silver`, `platinum`
- `purity` string: e.g. `24K`, `22K`, `18K`, `14K`, or provider-specific grade
- `rate_per_gram` numeric(14,4)
- `currency` default `INR`
- `effective_at`
- `source` (manual/provider)
- `source_reference` nullable
- `created_by`
- `created_at`
- Immutable history; corrections should create a new record, not overwrite history.

### `diamond_rate_rules`
- `id` UUID
- `shape` nullable
- `size_min_carat`, `size_max_carat`
- `color_grade`, `clarity_grade`, `cut_grade`
- `rate_per_carat` numeric(14,4)
- `currency`
- `effective_at`
- `version`
- `is_active`
- `created_by`, `created_at`

Do not assume a single diamond rate. The owner must approve the actual quality/size pricing matrix and whether stone-level pricing is fixed, per-carat, or supplier-cost based.

### `pricing_rule_versions`
- `id` UUID
- `version`
- `name`
- `formula_config` JSONB
- `tax_config` JSONB
- `rounding_config` JSONB
- `status`: draft/approved/retired
- `approved_by`, `approved_at`
- `created_at`

### `product_pricing_attributes`
- `id` UUID
- `shopify_product_gid`
- `shopify_variant_gid` nullable
- `sku`
- `metal_type`
- `purity`
- `gross_weight_g`
- `net_metal_weight_g`
- `making_charge_mode`: percent/per_gram/fixed
- `making_charge_value`
- `wastage_mode`: percent/grams/fixed/none
- `wastage_value`
- `stone_config` JSONB
- `fixed_adjustment` numeric
- `manual_price_override` numeric nullable
- `pricing_enabled`
- `updated_at`

Use Shopify product/variant metafields for attributes that should travel with the product; use this table only where richer relational rules or audit workflows are required. Avoid duplicate editable values in two places.

### `pricing_runs`
- `id` UUID
- `status`: draft/validated/approved/running/completed/failed/cancelled
- `rate_snapshot` JSONB
- `rule_version_id`
- `created_by`
- `approved_by`, `approved_at`
- `started_at`, `completed_at`
- `summary` JSONB
- `created_at`

### `pricing_run_items`
- `id` UUID
- `pricing_run_id`
- `shopify_product_gid`
- `shopify_variant_gid`
- `old_price`
- `proposed_price`
- `calculation_breakdown` JSONB
- `status`
- `error_message`
- `attempt_count`
- `updated_at`

### `bulk_import_jobs`
- `id` UUID
- `status`
- `source_file_name`
- `dry_run`
- `created_by`
- `total_rows`, `valid_rows`, `failed_rows`, `processed_rows`
- `error_report_location`
- `started_at`, `completed_at`
- `created_at`

### `integration_events`
- `id` UUID
- `provider` (shopify/razorpay/shiprocket)
- `event_id`
- `event_type`
- `payload_hash`
- `status`
- `received_at`
- `processed_at`
- Unique constraint on provider + event_id where provider supplies a stable event ID.

### `shipments`
- `id` UUID
- `shopify_order_gid`
- `provider`
- `provider_order_id`
- `shipment_id`
- `awb_code`
- `courier_name`
- `label_url`
- `tracking_url`
- `status`
- `created_at`, `updated_at`

### `audit_logs`
- `id` UUID
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `before_data` JSONB
- `after_data` JSONB
- `ip_hash` nullable (avoid storing unnecessary personal data)
- `created_at`

## Data rules

- Use decimal/numeric types for money and weights; never floating-point arithmetic for financial calculations.
- Store currency explicitly.
- Store all timestamps in UTC; display in Asia/Kolkata.
- Make rate history append-only.
- Every published price must be reproducible from rate snapshot + formula version + product attributes.
- Existing order prices must not be recalculated.
- Define whether weights mean gross weight, net metal weight, stone weight, or payable weight; do not conflate them.
