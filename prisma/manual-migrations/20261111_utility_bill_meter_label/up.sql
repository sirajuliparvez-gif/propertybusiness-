-- Apply before deploying the multi-meter bill forms. Existing bills keep NULL,
-- i.e. the unit's single unnamed meter, and behave exactly as before.
-- To roll back the application, leave this nullable column in place to retain entered meter names.
ALTER TABLE "UtilityBill"
ADD COLUMN IF NOT EXISTS "meterLabel" TEXT;
