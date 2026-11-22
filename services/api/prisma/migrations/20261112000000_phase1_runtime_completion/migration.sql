-- Additive migration for Phase 1 runtime completion (non-destructive)
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerificationLastSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "OrderMetadata_customerId_placedAt_idx" ON "OrderMetadata"("customerId", "placedAt");
CREATE INDEX IF NOT EXISTS "PaymentRecord_orderMetadataId_idx" ON "PaymentRecord"("orderMetadataId");
CREATE INDEX IF NOT EXISTS "RefundRecord_orderMetadataId_idx" ON "RefundRecord"("orderMetadataId");
CREATE INDEX IF NOT EXISTS "Shipment_orderMetadataId_idx" ON "Shipment"("orderMetadataId");
