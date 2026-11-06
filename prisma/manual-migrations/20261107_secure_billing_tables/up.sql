-- Billing tables are read and written by the server database role.
-- Remove Supabase's default public API grants, including on databases where
-- the tables were created before row security was added to their migrations.
BEGIN;
ALTER TABLE "RentBillPrint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentBillReceiptCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantUtilityBillDefault" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentBillNumber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentBillCounter" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "RentBillPrint", "RentBillReceiptCheck", "TenantUtilityBillDefault",
  "RentBillNumber", "RentBillCounter" FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format(
      'REVOKE ALL ON TABLE "RentBillPrint", "RentBillReceiptCheck", "TenantUtilityBillDefault",
       "RentBillNumber", "RentBillCounter" FROM %I', api_role
    );
  END LOOP;
END $$;
COMMIT;
