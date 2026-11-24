-- AlterTable: add explicit carat boundary inclusion flags to DiamondRate
ALTER TABLE "DiamondRate"
  ADD COLUMN IF NOT EXISTS "minInclusive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "maxInclusive" BOOLEAN NOT NULL DEFAULT true;
