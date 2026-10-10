import test from "node:test";
import assert from "node:assert/strict";
import {
  isDirectlyEditableTransactionType,
  isValidTransactionDate,
} from "@/lib/transaction-edit";

test("only standalone manual ledger types are directly editable", () => {
  assert.equal(isDirectlyEditableTransactionType("MAINTENANCE_EXPENSE"), true);
  assert.equal(isDirectlyEditableTransactionType("OTHER"), true);
  assert.equal(isDirectlyEditableTransactionType("OWNER_WITHDRAWAL"), false);
  assert.equal(isDirectlyEditableTransactionType("RENT_RECEIVED_FROM_TENANT"), false);
  assert.equal(isDirectlyEditableTransactionType("UTILITY_EXPENSE"), false);
  assert.equal(isDirectlyEditableTransactionType("PAYROLL_EXPENSE"), false);
});

test("transaction date validation rejects malformed and impossible dates", () => {
  assert.equal(isValidTransactionDate("2026-10-10"), true);
  assert.equal(isValidTransactionDate("2026-02-29"), false);
  assert.equal(isValidTransactionDate("2024-02-29"), true);
  assert.equal(isValidTransactionDate("2026-13-01"), false);
  assert.equal(isValidTransactionDate("10/10/2026"), false);
});
