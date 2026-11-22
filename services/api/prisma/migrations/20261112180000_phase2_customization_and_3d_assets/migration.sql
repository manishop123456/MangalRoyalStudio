-- Phase 2: Jewellery Customization, Saved Designs, 3D Model Assets & Cart/Order Snapshots
-- Strictly additive, backward-compatible migration for mangal_royal_studio_dev.

-- 1. Additive columns on CartItem and OrderItem
ALTER TABLE "CartItem"
  ADD COLUMN IF NOT EXISTS "customizationSelections" JSONB,
  ADD COLUMN IF NOT EXISTS "customizationSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "pricingBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "customerDesignId" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "customizationSnapshotJson" JSONB,
  ADD COLUMN IF NOT EXISTS "customerDesignId" TEXT;

-- 2. CustomizationProfile
CREATE TABLE IF NOT EXISTS "CustomizationProfile" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "eligibleCategories" JSONB NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomizationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomizationProfile_code_key" ON "CustomizationProfile"("code");
CREATE INDEX IF NOT EXISTS "CustomizationProfile_isActive_isDefault_idx" ON "CustomizationProfile"("isActive", "isDefault");

-- 3. CustomizationGroup
CREATE TABLE IF NOT EXISTS "CustomizationGroup" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "stepOrder" INTEGER NOT NULL DEFAULT 1,
  "selectionMode" TEXT NOT NULL DEFAULT 'SINGLE',
  "optionCategory" TEXT NOT NULL DEFAULT 'OTHER',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "dependencyRule" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomizationGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomizationGroup_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomizationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomizationGroup_profileId_code_key" ON "CustomizationGroup"("profileId", "code");
CREATE INDEX IF NOT EXISTS "CustomizationGroup_profileId_stepOrder_isActive_idx" ON "CustomizationGroup"("profileId", "stepOrder", "isActive");

-- 4. CustomizationOption
CREATE TABLE IF NOT EXISTS "CustomizationOption" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "value" TEXT NOT NULL,
  "swatchHex" TEXT,
  "imageUrl" TEXT,
  "priceRuleType" TEXT NOT NULL DEFAULT 'INCLUDED',
  "priceRuleValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "metalType" TEXT,
  "metalPurity" TEXT,
  "metalColor" TEXT,
  "diamondShape" TEXT,
  "diamondCaratWeight" DECIMAL(10,4),
  "diamondColorGrade" TEXT,
  "diamondClarityGrade" TEXT,
  "gemstoneType" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "eligibilityRule" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomizationOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomizationOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomizationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomizationOption_groupId_code_key" ON "CustomizationOption"("groupId", "code");
CREATE INDEX IF NOT EXISTS "CustomizationOption_groupId_sortOrder_isActive_idx" ON "CustomizationOption"("groupId", "sortOrder", "isActive");

-- 5. ProductCustomizationAssignment
CREATE TABLE IF NOT EXISTS "ProductCustomizationAssignment" (
  "id" TEXT NOT NULL,
  "productMetadataId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "isCustomizable" BOOLEAN NOT NULL DEFAULT true,
  "allowDiamondSelection" BOOLEAN NOT NULL DEFAULT true,
  "allowEngraving" BOOLEAN NOT NULL DEFAULT false,
  "maxEngravingChars" INTEGER NOT NULL DEFAULT 20,
  "disabledOptionCodes" JSONB NOT NULL DEFAULT '[]',
  "configOverrides" JSONB,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCustomizationAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductCustomizationAssignment_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCustomizationAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomizationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCustomizationAssignment_productMetadataId_key" ON "ProductCustomizationAssignment"("productMetadataId");
CREATE INDEX IF NOT EXISTS "ProductCustomizationAssignment_profileId_isCustomizable_idx" ON "ProductCustomizationAssignment"("profileId", "isCustomizable");

-- 6. CustomerDesign
CREATE TABLE IF NOT EXISTS "CustomerDesign" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productMetadataId" TEXT NOT NULL,
  "productSku" TEXT NOT NULL,
  "productHandle" TEXT NOT NULL,
  "productTitle" TEXT NOT NULL,
  "profileId" TEXT,
  "name" TEXT NOT NULL,
  "selections" JSONB NOT NULL,
  "selectionSnapshot" JSONB NOT NULL,
  "lastQuotedPriceInr" DECIMAL(14,2) NOT NULL,
  "lastPriceBreakdown" JSONB NOT NULL,
  "pricingRuleVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'SAVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDesign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerDesign_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerDesign_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomerDesign_customerId_status_updatedAt_idx" ON "CustomerDesign"("customerId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomerDesign_productMetadataId_idx" ON "CustomerDesign"("productMetadataId");

-- 7. ProductModelAsset
CREATE TABLE IF NOT EXISTS "ProductModelAsset" (
  "id" TEXT NOT NULL,
  "productMetadataId" TEXT NOT NULL,
  "productSku" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL_MANAGED',
  "storageKey" TEXT NOT NULL,
  "assetUrl" TEXT NOT NULL,
  "previewImageUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductModelAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductModelAsset_productMetadataId_fkey" FOREIGN KEY ("productMetadataId") REFERENCES "ProductMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductModelAsset_productMetadataId_key" ON "ProductModelAsset"("productMetadataId");
CREATE INDEX IF NOT EXISTS "ProductModelAsset_productSku_status_idx" ON "ProductModelAsset"("productSku", "status");
