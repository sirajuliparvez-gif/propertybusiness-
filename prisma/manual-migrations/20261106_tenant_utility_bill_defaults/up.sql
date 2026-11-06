-- Apply before deploying the new forms. Existing bills are untouched.
-- To roll back the application, keep this table to retain saved defaults.
BEGIN;
CREATE TABLE IF NOT EXISTS "TenantUtilityBillDefault" (
  "tenantLeaseId" TEXT NOT NULL REFERENCES "TenantLease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" "UtilityType" NOT NULL,
  "paidByCompany" BOOLEAN,
  "amount" DECIMAL(65, 30),
  PRIMARY KEY ("tenantLeaseId", "type")
);
ALTER TABLE "TenantUtilityBillDefault" ENABLE ROW LEVEL SECURITY;
COMMIT;
