# Mangal Royal Studio — PostgreSQL & Prisma Database Schema (Code-Verified)

**Schema File:** [`services/api/prisma/schema.prisma`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma) (`758` lines)  
**Generated Migration SQL:** [`services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/migrations/20261105000000_init_complete_platform/migration.sql) (`36,308` bytes)  
**Audit Reference:** [`CODE_VERIFICATION_AUDIT.md`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/CODE_VERIFICATION_AUDIT.md)

---

## 1. Implementation & Persistence Status

| Component | Classification | Verification Evidence |
|---|---|---|
| **Prisma Schema (`40` Models + `1` Enum)** | `VERIFIED` | Validated via `npx prisma validate`; client generated (`@prisma/client` `v6.19.3`). |
| **Initial SQL Migration (`migration.sql`)** | `VERIFIED` (Generated Only) | Generated DDL for all 40 tables, indexes, and foreign keys. **Not yet applied** to a live PostgreSQL instance (`prisma migrate deploy` pending live database). |
| **Runtime API Persistence** | `SIMULATED` (JSON File Store) | [`services/api/src/store/data-store.ts`](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/src/store/data-store.ts) persists runtime state to `.data/platform-state.json`. `@prisma/client` is not yet wired into `services/api/src/app.ts`. |

---

## 2. Numeric Precision in `schema.prisma` (`VERIFIED`)

All monetary values (`INR`), metal weights (`grams`), diamond weights (`carats`), and rates use PostgreSQL `DECIMAL` types:
- **Monetary Amounts (`INR`):** `@db.Decimal(14, 2)`
- **Per-Gram / Per-Carat Rates (`INR`):** `@db.Decimal(14, 4)`
- **Weights (`grams` & `carats`):** `@db.Decimal(10, 3)`
- **Diamond Sieve Carat Brackets:** `@db.Decimal(10, 4)`
- **Stone-to-Gram Conversion Factor:** `@db.Decimal(8, 4)`
- **Percentages (`GST`, `Delta %`):** `@db.Decimal(6, 2)` and `@db.Decimal(8, 2)`

---

## 3. Complete Inventory of All 40 Relational Models in `schema.prisma`

### Group 1: Authentication, Staff & RBAC (4 Models + `enum RoleName`)
1. **`Role`** ([line 20](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L20)) — `OWNER`, `MANAGER`, `PRICING_OPERATOR`.
2. **`Permission`** ([line 30](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L30)) — Granular permission codes mapped many-to-many with `Role`.
3. **`AdminUser`** ([line 38](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L38)) — Staff accounts with `email`, `passwordHash`, `roleId`, and `isActive`.
4. **`RefreshToken`** ([line 53](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L53)) — Refresh token schema for `AdminUser` and `Customer` *(Note: Schema defined; runtime token rotation not yet implemented in `auth.ts`)*.

### Group 2: Catalog, Variants, Images & Jewellery Specifications (8 Models)
5. **`Category`** ([line 73](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L73)) — The 11 jewellery categories mapped to Excel sheets and Shopify collections.
6. **`Collection`** ([line 88](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L88)) — Storefront collections (`handle` unique).
7. **`CollectionProduct`** ([line 101](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L101)) — Join table (`@@unique([collectionId, productMetadataId])`).
8. **`ProductMetadata`** ([line 112](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L112)) — Master SKU record (`sku`, `handle`, `title`, `currentShopifyPrice`, `compareAtPrice`).
9. **`ProductVariant`** ([line 150](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L150)) — Ring size, metal purity, and metal color variants.
10. **`ProductImage`** ([line 169](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L169)) — Product media gallery ordered by `sortOrder`.
11. **`JewellerySpecification`** ([line 185](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L185)) — 1:1 with `ProductMetadata`; stores purity, gross/net weights, making charge mode/value, wastage mode/value, certification/hallmark fees, and manual override.
12. **`DiamondComponent`** ([line 212](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L212)) — Multi-stone diamond specs (`shape`, `stoneCount`, `totalCaratWeight`, `colorGrade`, `clarityGrade`, `cutGrade`, `certification`).

### Group 3: Inventory & Stock Movements (2 Models)
13. **`InventoryRecord`** ([line 235](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L235)) — Available, reserved, and `lowStockThreshold` quantities per product.
14. **`InventoryMovement`** ([line 249](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L249)) — Stock movement audit log indexed by `[inventoryRecordId, createdAt]` and `[sku, createdAt]`.

### Group 4: Jewellery Pricing Engine & Snapshots (6 Models)
15. **`GoldRate`** ([line 271](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L271)) — Metal rate per gram (`@db.Decimal(14, 4)`), purity, and source.
16. **`DiamondRate`** ([line 287](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L287)) — Diamond rate matrix by shape, carat range (`@db.Decimal(10, 4)`), color, and clarity.
17. **`PricingRule`** ([line 309](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L309)) — Versioned formula rule configuration.
18. **`PricingRun`** ([line 330](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L330)) — Repricing batch state machine (`PREVIEWED`, `VALIDATED`, `APPROVED`, `PUBLISHED`).
19. **`PricingRunItem`** ([line 351](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L351)) — Per-SKU delta and breakdown within a `PricingRun`.
20. **`PricingSnapshot`** ([line 370](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L370)) — Immutable published and purchase-time calculation snapshots.

### Group 5: Bulk Excel Importer (2 Models)
21. **`ImportJob`** ([line 394](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L394)) — Tracks workbook import runs, row counts, and preview items.
22. **`ImportError`** ([line 414](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L414)) — Row-level validation failures (`sheetName`, `rowNumber`, `sku`, `field`, `message`).

### Group 6: Customers, Addresses, Carts & Wishlists (6 Models)
23. **`Customer`** ([line 432](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L432)) — Customer profile and lifetime spend (`@db.Decimal(14, 2)`).
24. **`CustomerAddress`** ([line 454](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L454)) — Customer shipping/billing addresses.
25. **`Cart`** ([line 474](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L474)) — Shopping cart container (`sessionToken` unique).
26. **`CartItem`** ([line 487](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L487)) — Shopping cart line items.
27. **`Wishlist`** ([line 507](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L507)) — Customer wishlist container.
28. **`WishlistItem`** ([line 517](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L517)) — Saved products in a wishlist.

### Group 7: Orders, Payments, Refunds & Shiprocket Shipments (5 Models)
29. **`OrderMetadata`** ([line 534](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L534)) — Order header, financial/fulfillment statuses, and GST totals.
30. **`OrderItem`** ([line 573](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L573)) — Individual order line items with purchase-time `pricingSnapshotJson`.
31. **`PaymentRecord`** ([line 594](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L594)) — Razorpay payment records.
32. **`RefundRecord`** ([line 616](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L616)) — Partial and full refund records.
33. **`Shipment`** ([line 632](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L632)) — Shiprocket AWB and courier tracking records.

### Group 8: Promotions, Content, Notifications, Settings & Audit (7 Models)
34. **`Discount`** ([line 659](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L659)) — Promotional coupon codes.
35. **`Banner`** ([line 678](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L678)) — Hero and campaign banner records.
36. **`Content`** ([line 694](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L694)) — Editorial and policy page content.
37. **`Notification`** ([line 707](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L707)) — Email/SMS/WhatsApp notification records.
38. **`StoreSetting`** ([line 721](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L721)) — Key-value JSON configuration store.
39. **`IntegrationEvent`** ([line 729](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L729)) — Webhook idempotency table (`@@unique([provider, eventId])`).
40. **`AuditLog`** ([line 742](file:///c:/Users/manis/Videos/TCSC/sab%20saman/vs%20code%20projects/mangalroyalstudio/services/api/prisma/schema.prisma#L742)) — Immutable administrative audit trail.
