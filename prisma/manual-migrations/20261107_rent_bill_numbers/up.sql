-- Apply before the app rollout. Keep the allocated numbers during rollback.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS "Property_billMarketCode_seq";
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "billMarketCode" INTEGER
  NOT NULL DEFAULT nextval('"Property_billMarketCode_seq"');
ALTER SEQUENCE "Property_billMarketCode_seq" OWNED BY "Property"."billMarketCode";
CREATE UNIQUE INDEX IF NOT EXISTS "Property_billMarketCode_key" ON "Property" ("billMarketCode");

CREATE TABLE IF NOT EXISTS "RentBillNumber" (
  "tenantLeaseId" TEXT NOT NULL REFERENCES "TenantLease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" TEXT NOT NULL,
  "serial" INTEGER NOT NULL,
  PRIMARY KEY ("tenantLeaseId", "month")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RentBillNumber_propertyId_month_serial_key"
  ON "RentBillNumber" ("propertyId", "month", "serial");

CREATE TABLE IF NOT EXISTS "RentBillCounter" (
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" TEXT NOT NULL,
  "serial" INTEGER NOT NULL,
  PRIMARY KEY ("propertyId", "month")
);
ALTER TABLE "RentBillNumber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentBillCounter" ENABLE ROW LEVEL SECURITY;
COMMIT;
