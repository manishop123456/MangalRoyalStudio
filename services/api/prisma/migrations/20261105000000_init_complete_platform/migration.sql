-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('OWNER', 'MANAGER', 'PRICING_OPERATOR');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminUserId" TEXT,
    "customerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shopifyCollectionId" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "excelSheetName" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProduct" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMetadata" (
    "id" TEXT NOT NULL,
    "shopifyProductGid" TEXT,
    "shopifyVariantGid" TEXT,
    "serialNumber" TEXT,
    "productTag" TEXT,
    "sku" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "categoryId" TEXT,
    "currentShopifyPrice" DECIMAL(14,2) NOT NULL,
    "compareAtPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "imageUrl" TEXT,
    "hoverImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isBestseller" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ringSize" TEXT,
    "metalPurity" TEXT NOT NULL DEFAULT '18K',
    "metalColor" TEXT NOT NULL DEFAULT 'YELLOW_GOLD',
    "priceInr" DECIMAL(14,2) NOT NULL,
    "compareAtPriceInr" DECIMAL(14,2),
    "availableQuantity" INTEGER NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "altText" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1000,
    "height" INTEGER NOT NULL DEFAULT 1000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewellerySpecification" (
    "id" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "metalType" TEXT NOT NULL DEFAULT 'GOLD',
    "metalPurity" TEXT NOT NULL DEFAULT '18K',
    "metalColor" TEXT NOT NULL DEFAULT 'ROSE_GOLD',
    "ringSize" TEXT,
    "grossWeightGrams" DECIMAL(10,3) NOT NULL,
    "netMetalWeightGrams" DECIMAL(10,3) NOT NULL,
    "netWeightMode" TEXT NOT NULL DEFAULT 'EXPLICIT_NET_WEIGHT',
    "makingChargeMode" TEXT NOT NULL DEFAULT 'PER_GRAM_NET',
    "makingChargeValue" DECIMAL(14,2) NOT NULL,
    "wastageMode" TEXT NOT NULL DEFAULT 'NONE',
    "wastageValue" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "certificationFeeInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hallmarkFeeInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fixedAdjustmentInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "manualPriceOverrideInr" DECIMAL(14,2),
    "igiCertificateNumber" TEXT,
    "isHallmarked" BOOLEAN NOT NULL DEFAULT true,
    "pricingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JewellerySpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiamondComponent" (
    "id" TEXT NOT NULL,
    "jewellerySpecificationId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL DEFAULT 'Center / Accent Diamond',
    "shape" TEXT NOT NULL DEFAULT 'ROUND',
    "stoneCount" INTEGER NOT NULL DEFAULT 1,
    "totalCaratWeight" DECIMAL(10,3) NOT NULL,
    "colorGrade" TEXT NOT NULL DEFAULT 'EF',
    "clarityGrade" TEXT NOT NULL DEFAULT 'VVS',
    "cutGrade" TEXT DEFAULT 'EXCELLENT',
    "sieveSize" TEXT,
    "certification" TEXT DEFAULT 'IGI',
    "rateOverridePerCaratInr" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiamondComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRecord" (
    "id" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "shopifyInventoryGid" TEXT,
    "locationName" TEXT NOT NULL DEFAULT 'Mumbai Studio Vault',
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 2,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryRecordId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "movementType" TEXT NOT NULL DEFAULT 'MANUAL_ADJUSTMENT',
    "quantityDelta" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRate" (
    "id" TEXT NOT NULL,
    "metalType" TEXT NOT NULL DEFAULT 'GOLD',
    "purity" TEXT NOT NULL,
    "ratePerGramInr" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "source" TEXT NOT NULL DEFAULT 'PLACEHOLDER_PENDING_OWNER_APPROVAL',
    "sourceReference" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiamondRate" (
    "id" TEXT NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'ROUND',
    "sieveRange" TEXT,
    "sizeMinCarat" DECIMAL(10,4) NOT NULL,
    "sizeMaxCarat" DECIMAL(10,4) NOT NULL,
    "colorGrade" TEXT NOT NULL,
    "clarityGrade" TEXT NOT NULL,
    "cutGrade" TEXT NOT NULL DEFAULT 'EXCELLENT',
    "pricingType" TEXT NOT NULL DEFAULT 'PER_CARAT',
    "rateInr" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiamondRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "isPlaceholderFormula" BOOLEAN NOT NULL DEFAULT true,
    "stoneWeightToGramsFactor" DECIMAL(8,4) NOT NULL DEFAULT 0.2,
    "gstRatePercent" DECIMAL(6,2) NOT NULL DEFAULT 3.00,
    "gstMode" TEXT NOT NULL DEFAULT 'INCLUSIVE',
    "roundingMode" TEXT NOT NULL DEFAULT 'NEAREST_1',
    "maxPriceDeltaPercentThreshold" DECIMAL(6,2) NOT NULL DEFAULT 15.00,
    "defaultCertificationFeeInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultHallmarkFeeInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "pricingRuleId" TEXT NOT NULL,
    "rateSnapshot" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRunItem" (
    "id" TEXT NOT NULL,
    "pricingRunId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shopifyProductGid" TEXT,
    "shopifyVariantGid" TEXT,
    "oldPriceInr" DECIMAL(14,2) NOT NULL,
    "proposedPriceInr" DECIMAL(14,2) NOT NULL,
    "priceDeltaInr" DECIMAL(14,2) NOT NULL,
    "priceDeltaPercent" DECIMAL(8,2) NOT NULL,
    "calculationBreakdown" JSONB NOT NULL,
    "exceedsThreshold" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSnapshot" (
    "id" TEXT NOT NULL,
    "productMetadataId" TEXT,
    "pricingRunId" TEXT,
    "pricingRuleId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shopifyVariantGid" TEXT,
    "publishedPriceInr" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "rateSnapshot" JSONB NOT NULL,
    "calculationBreakdown" JSONB NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRY_RUN_COMPLETED',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "detectedSheets" JSONB NOT NULL,
    "categoryMapping" JSONB NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateSkus" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "previewItems" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sku" TEXT,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "rawRowData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopifyCustomerGid" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpentInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "customerId" TEXT,
    "discountCode" TEXT,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "variantTitle" TEXT,
    "ringSize" TEXT,
    "metalPurity" TEXT,
    "metalColor" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceInr" DECIMAL(14,2) NOT NULL,
    "linePriceInr" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productMetadataId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMetadata" (
    "id" TEXT NOT NULL,
    "shopifyOrderGid" TEXT,
    "orderNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "subtotalPriceInr" DECIMAL(14,2) NOT NULL,
    "discountAmountInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingAmountInr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTaxInr" DECIMAL(14,2) NOT NULL,
    "totalPriceInr" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "financialStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'UNFULFILLED',
    "discountCode" TEXT,
    "idempotencyKey" TEXT,
    "lineItemsSnapshot" JSONB NOT NULL,
    "pricingSnapshotsJson" JSONB NOT NULL,
    "shippingAddressJson" JSONB NOT NULL,
    "billingAddressJson" JSONB,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderMetadataId" TEXT NOT NULL,
    "productMetadataId" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "ringSize" TEXT,
    "metalPurity" TEXT,
    "metalColor" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceInr" DECIMAL(14,2) NOT NULL,
    "totalPriceInr" DECIMAL(14,2) NOT NULL,
    "pricingSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "orderMetadataId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT NOT NULL,
    "providerSignature" TEXT,
    "amountInr" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CAPTURED',
    "method" TEXT DEFAULT 'UPI / Card',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" TEXT,
    "webhookEventId" TEXT,
    "failureReason" TEXT,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "orderMetadataId" TEXT NOT NULL,
    "paymentRecordId" TEXT NOT NULL,
    "providerRefundId" TEXT NOT NULL,
    "amountInr" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "initiatedBy" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderMetadataId" TEXT NOT NULL,
    "shopifyOrderGid" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'SHIPROCKET',
    "shiprocketOrderId" TEXT,
    "shipmentId" TEXT,
    "awbCode" TEXT,
    "courierName" TEXT,
    "declaredValueInr" DECIMAL(14,2) NOT NULL,
    "isInsured" BOOLEAN NOT NULL DEFAULT true,
    "packageWeightGrams" DECIMAL(8,2) NOT NULL DEFAULT 120,
    "pickupScheduledAt" TIMESTAMP(3),
    "labelUrl" TEXT,
    "manifestUrl" TEXT,
    "trackingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "trackingHistory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "value" DECIMAL(10,2) NOT NULL,
    "minOrderAmountInr" DECIMAL(14,2),
    "maxDiscountInr" DECIMAL(14,2),
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL_COLLECTIONS',
    "shopifyDiscountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "subtitle" TEXT,
    "Placement" TEXT NOT NULL DEFAULT 'HOMEPAGE_HERO',
    "imageUrl" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaLink" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL DEFAULT 'EDITORIAL',
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "referenceId" TEXT,
    "sentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_adminUserId_idx" ON "RefreshToken"("adminUserId");

-- CreateIndex
CREATE INDEX "RefreshToken_customerId_idx" ON "RefreshToken"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_shopifyCollectionId_key" ON "Category"("shopifyCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_handle_key" ON "Collection"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionProduct_collectionId_productMetadataId_key" ON "CollectionProduct"("collectionId", "productMetadataId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetadata_shopifyProductGid_key" ON "ProductMetadata"("shopifyProductGid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetadata_shopifyVariantGid_key" ON "ProductMetadata"("shopifyVariantGid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetadata_sku_key" ON "ProductMetadata"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetadata_handle_key" ON "ProductMetadata"("handle");

-- CreateIndex
CREATE INDEX "ProductMetadata_categoryId_status_idx" ON "ProductMetadata"("categoryId", "status");

-- CreateIndex
CREATE INDEX "ProductMetadata_isBestseller_status_idx" ON "ProductMetadata"("isBestseller", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productMetadataId_idx" ON "ProductVariant"("productMetadataId");

-- CreateIndex
CREATE INDEX "ProductImage_productMetadataId_sortOrder_idx" ON "ProductImage"("productMetadataId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "JewellerySpecification_productMetadataId_key" ON "JewellerySpecification"("productMetadataId");

-- CreateIndex
CREATE INDEX "DiamondComponent_jewellerySpecificationId_idx" ON "DiamondComponent"("jewellerySpecificationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryRecord_productMetadataId_key" ON "InventoryRecord"("productMetadataId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryRecordId_createdAt_idx" ON "InventoryMovement"("inventoryRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_sku_createdAt_idx" ON "InventoryMovement"("sku", "createdAt");

-- CreateIndex
CREATE INDEX "GoldRate_metalType_purity_effectiveAt_idx" ON "GoldRate"("metalType", "purity", "effectiveAt");

-- CreateIndex
CREATE INDEX "DiamondRate_shape_colorGrade_clarityGrade_isActive_idx" ON "DiamondRate"("shape", "colorGrade", "clarityGrade", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_version_key" ON "PricingRule"("version");

-- CreateIndex
CREATE INDEX "PricingSnapshot_sku_publishedAt_idx" ON "PricingSnapshot"("sku", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopifyCustomerGid_key" ON "Customer"("shopifyCustomerGid");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionToken_key" ON "Cart"("sessionToken");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_sessionToken_key" ON "Wishlist"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productMetadataId_key" ON "WishlistItem"("wishlistId", "productMetadataId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMetadata_shopifyOrderGid_key" ON "OrderMetadata"("shopifyOrderGid");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMetadata_orderNumber_key" ON "OrderMetadata"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMetadata_invoiceNumber_key" ON "OrderMetadata"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMetadata_idempotencyKey_key" ON "OrderMetadata"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderMetadata_customerEmail_placedAt_idx" ON "OrderMetadata"("customerEmail", "placedAt");

-- CreateIndex
CREATE INDEX "OrderMetadata_financialStatus_fulfillmentStatus_idx" ON "OrderMetadata"("financialStatus", "fulfillmentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_orderMetadataId_idx" ON "OrderItem"("orderMetadataId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_providerOrderId_key" ON "PaymentRecord"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_providerPaymentId_key" ON "PaymentRecord"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_idempotencyKey_key" ON "PaymentRecord"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_providerRefundId_key" ON "RefundRecord"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_awbCode_key" ON "Shipment"("awbCode");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_key_key" ON "StoreSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_provider_eventId_key" ON "IntegrationEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMetadata" ADD CONSTRAINT "ProductMetadata_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewellerySpecification" ADD CONSTRAINT "JewellerySpecification_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiamondComponent" ADD CONSTRAINT "DiamondComponent_jewellerySpecificationId_fkey" FOREIGN KEY ("jewellerySpecificationId") REFERENCES "JewellerySpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRecord" ADD CONSTRAINT "InventoryRecord_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryRecordId_fkey" FOREIGN KEY ("inventoryRecordId") REFERENCES "InventoryRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRun" ADD CONSTRAINT "PricingRun_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRunItem" ADD CONSTRAINT "PricingRunItem_pricingRunId_fkey" FOREIGN KEY ("pricingRunId") REFERENCES "PricingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_pricingRunId_fkey" FOREIGN KEY ("pricingRunId") REFERENCES "PricingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMetadata" ADD CONSTRAINT "OrderMetadata_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderMetadataId_fkey" FOREIGN KEY ("orderMetadataId") REFERENCES "OrderMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderMetadataId_fkey" FOREIGN KEY ("orderMetadataId") REFERENCES "OrderMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_orderMetadataId_fkey" FOREIGN KEY ("orderMetadataId") REFERENCES "OrderMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderMetadataId_fkey" FOREIGN KEY ("orderMetadataId") REFERENCES "OrderMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

