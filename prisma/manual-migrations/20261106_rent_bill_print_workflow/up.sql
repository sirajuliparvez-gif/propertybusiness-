-- Apply before deploying this workflow. Keep both tables during an application rollback.
BEGIN;
CREATE TABLE IF NOT EXISTS "RentBillPrint" (
  "tenantLeaseId" TEXT NOT NULL REFERENCES "TenantLease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("tenantLeaseId", "month", "revision")
);
CREATE TABLE IF NOT EXISTS "RentBillReceiptCheck" (
  "receiptId" TEXT PRIMARY KEY,
  "tenantLeaseId" TEXT NOT NULL REFERENCES "TenantLease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" TEXT NOT NULL,
  "printRevision" INTEGER,
  "expectedCents" INTEGER NOT NULL,
  "receivedCents" INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS "RentBillReceiptCheck_tenantLeaseId_month_idx"
  ON "RentBillReceiptCheck" ("tenantLeaseId", "month");
COMMIT;
