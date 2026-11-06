-- Apply before deploying the bill forms. Existing bills keep their automatic reading.
-- To roll back the application, leave this nullable column in place to retain entered readings.
ALTER TABLE "UtilityBill"
ADD COLUMN IF NOT EXISTS "previousMeterReadingOverride" DECIMAL(65, 30);
