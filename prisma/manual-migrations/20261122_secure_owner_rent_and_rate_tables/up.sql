-- OwnerRentPayment and TenantRentRate were created without row security, so anyone holding the
-- public anon key could read or change every row through Supabase's API. The app reads and writes
-- them only through the server database role (Prisma), which is not affected by row security, and
-- uses the Supabase client for sign-in only. Same treatment as 20261107_secure_billing_tables.
BEGIN;
ALTER TABLE "OwnerRentPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantRentRate" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "OwnerRentPayment", "TenantRentRate" FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE "OwnerRentPayment", "TenantRentRate" FROM %I', api_role);
  END LOOP;
END $$;
COMMIT;
