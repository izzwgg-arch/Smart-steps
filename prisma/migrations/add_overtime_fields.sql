-- Add overtime fields to PayrollEmployee
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "overtimeRateHourly" DECIMAL(10, 2);
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "overtimeStartTime" INTEGER;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "overtimeEnabled" BOOLEAN DEFAULT false;

-- Add overtime breakdown fields to PayrollRunLine
ALTER TABLE "PayrollRunLine" ADD COLUMN IF NOT EXISTS "regularMinutes" INTEGER DEFAULT 0;
ALTER TABLE "PayrollRunLine" ADD COLUMN IF NOT EXISTS "overtimeMinutes" INTEGER DEFAULT 0;
ALTER TABLE "PayrollRunLine" ADD COLUMN IF NOT EXISTS "regularPay" DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE "PayrollRunLine" ADD COLUMN IF NOT EXISTS "overtimePay" DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE "PayrollRunLine" ADD COLUMN IF NOT EXISTS "overtimeRateUsed" DECIMAL(10, 2);
