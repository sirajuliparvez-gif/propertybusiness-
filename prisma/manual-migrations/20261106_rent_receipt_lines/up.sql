-- Apply after 20261106_rent_bill_print_workflow and before deploying. Keep this nullable column during rollback.
ALTER TABLE "RentBillReceiptCheck" ADD COLUMN IF NOT EXISTS "lines" JSONB;
