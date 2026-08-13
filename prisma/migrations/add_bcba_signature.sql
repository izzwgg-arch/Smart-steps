-- Add signature column to BCBA table
ALTER TABLE "BCBA" ADD COLUMN IF NOT EXISTS "signature" TEXT;
