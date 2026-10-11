CREATE TABLE IF NOT EXISTS "TenantRentRate" (
  "id" TEXT NOT NULL,
  "tenantLeaseId" TEXT NOT NULL,
  "effectiveMonth" TEXT NOT NULL,
  "monthlyRentAmount" DECIMAL(65,30) NOT NULL,
  "serviceChargeType" "ServiceChargeType",
  "serviceChargeValue" DECIMAL(65,30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantRentRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantRentRate_tenantLeaseId_fkey"
    FOREIGN KEY ("tenantLeaseId") REFERENCES "TenantLease"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantRentRate_tenantLeaseId_effectiveMonth_key"
  ON "TenantRentRate"("tenantLeaseId", "effectiveMonth");

CREATE INDEX IF NOT EXISTS "TenantRentRate_tenantLeaseId_effectiveMonth_idx"
  ON "TenantRentRate"("tenantLeaseId", "effectiveMonth");
