-- Add regular and BCBA rate/unit fields to Insurance table
-- Migration: add_insurance_regular_bcba_fields

-- Add new columns (nullable for backward compatibility)
ALTER TABLE "Insurance" ADD COLUMN IF NOT EXISTS "regularRatePerUnit" DECIMAL(10,2);
ALTER TABLE "Insurance" ADD COLUMN IF NOT EXISTS "regularUnitMinutes" INTEGER;
ALTER TABLE "Insurance" ADD COLUMN IF NOT EXISTS "bcbaRatePerUnit" DECIMAL(10,2);
ALTER TABLE "Insurance" ADD COLUMN IF NOT EXISTS "bcbaUnitMinutes" INTEGER;

-- Data backfill: Set defaults from existing ratePerUnit
-- For existing records, set regularRatePerUnit = ratePerUnit (if null)
UPDATE "Insurance" 
SET "regularRatePerUnit" = "ratePerUnit"
WHERE "regularRatePerUnit" IS NULL;

-- Set regularUnitMinutes to 15 (default) if null
UPDATE "Insurance"
SET "regularUnitMinutes" = 15
WHERE "regularUnitMinutes" IS NULL;

-- Set bcbaRatePerUnit = regularRatePerUnit (fallback) if null
UPDATE "Insurance"
SET "bcbaRatePerUnit" = "regularRatePerUnit"
WHERE "bcbaRatePerUnit" IS NULL AND "regularRatePerUnit" IS NOT NULL;

-- Set bcbaUnitMinutes = regularUnitMinutes (fallback) if null
UPDATE "Insurance"
SET "bcbaUnitMinutes" = "regularUnitMinutes"
WHERE "bcbaUnitMinutes" IS NULL AND "regularUnitMinutes" IS NOT NULL;

-- Set bcbaUnitMinutes to 15 if still null
UPDATE "Insurance"
SET "bcbaUnitMinutes" = 15
WHERE "bcbaUnitMinutes" IS NULL;
