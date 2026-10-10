import assert from "node:assert/strict";
import test from "node:test";

import { applyRentInstallment, applyUtilityBillInstallment } from "@/lib/payment-progress";
import { resolvePaymentMonth } from "@/lib/payment-month";

test("rent payment can settle September when money arrives in October", () => {
  assert.equal(resolvePaymentMonth("2026-09", "2026-10-03"), "2026-09");
});

test("older payment forms still fall back to the payment date month", () => {
  assert.equal(resolvePaymentMonth(null, "2026-10-03"), "2026-10");
});

test("invalid billing months are rejected", () => {
  assert.throws(() => resolvePaymentMonth("2026-13", "2026-10-03"), /Invalid billing month/);
});

test("rent can be paid in two installments", () => {
  const first = applyRentInstallment({
    dueAmount: 20_000,
    alreadyPaid: 0,
    paymentAmount: 8_000,
  });
  assert.deepEqual(first, { totalPaid: 8_000, status: "PARTIAL" });

  const second = applyRentInstallment({
    dueAmount: 20_000,
    alreadyPaid: first.totalPaid,
    paymentAmount: 12_000,
  });
  assert.deepEqual(second, { totalPaid: 20_000, status: "PAID" });
});

test("utility bill can be paid in two installments", () => {
  const first = applyUtilityBillInstallment({
    totalAmount: 1_000,
    alreadyPaid: 0,
    tenantPaymentAmount: 400,
    companyCoversRest: false,
  });
  assert.deepEqual(first, {
    billPortion: 400,
    profitAmount: 0,
    companyAmount: 0,
    newPaidAmount: 400,
    status: "PARTIAL",
  });

  const second = applyUtilityBillInstallment({
    totalAmount: 1_000,
    alreadyPaid: first.newPaidAmount,
    tenantPaymentAmount: 600,
    companyCoversRest: false,
  });
  assert.deepEqual(second, {
    billPortion: 600,
    profitAmount: 0,
    companyAmount: 0,
    newPaidAmount: 1_000,
    status: "PAID",
  });
});
