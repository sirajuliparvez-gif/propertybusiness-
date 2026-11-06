-- Apply before deploying the receipt pages. Older transactions have no group.
-- Application rollback can leave this nullable column and its index in place.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "paymentReceiptId" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_paymentReceiptId_idx" ON "Transaction" ("paymentReceiptId");
