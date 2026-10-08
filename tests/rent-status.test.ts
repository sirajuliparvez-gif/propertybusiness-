import assert from "node:assert/strict";
import test from "node:test";

import { isRentSettled, rentPillStatus } from "@/components/properties/status-pill";
import { buildRentLedger, isMonthPastDue, RENT_DUE_DAY } from "@/lib/rent-ledger";

const october2026 = "2026-10";

test("unpaid rent stays in the payment period through the 10th", () => {
  assert.equal(isMonthPastDue(october2026, RENT_DUE_DAY, new Date(2026, 9, 10)), false);
  assert.equal(rentPillStatus("UNPAID", false), "PENDING");
});

test("unpaid rent becomes overdue after the 10th", () => {
  assert.equal(isMonthPastDue(october2026, RENT_DUE_DAY, new Date(2026, 9, 11)), true);
  assert.equal(rentPillStatus("UNPAID", true), "UNPAID");
});

test("fully paid rent is settled and displays as paid", () => {
  const dueAmount = 20_000;
  const ledger = buildRentLedger(
    new Date(2026, 9, 1),
    dueAmount,
    [
      {
        id: "payment-1",
        month: october2026,
        dueDate: new Date(2026, 9, RENT_DUE_DAY),
        dueAmount,
        paidAmount: dueAmount,
        status: "PAID",
        paidAt: new Date(2026, 9, 8),
      },
    ],
    new Date(2026, 9, 11),
    RENT_DUE_DAY
  );

  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].gap, 0);
  assert.equal(rentPillStatus(ledger[0].status, ledger[0].pastDue), "PAID");
  assert.equal(isRentSettled(ledger[0].status, ledger[0].gap), true);
});
