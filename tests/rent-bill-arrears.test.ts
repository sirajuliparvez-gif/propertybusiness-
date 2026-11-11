import { strict as assert } from "node:assert";
import test from "node:test";
import { arrearsRow, isSmallLeftover, limitToPrintedBill, type ArrearsCandidate } from "@/lib/rent-bill-print";

const candidates: ArrearsCandidate[] = [
  { id: "2026-09", month: "2026-09", kind: "rent", remainingCents: 1_500_000, dueCents: 1_500_000, paidCents: 0 },
  { id: "bill-1", month: "2026-09", kind: "utility", type: "ELECTRICITY", meterLabel: "Meter 2", remainingCents: 300_000, dueCents: 300_000, paidCents: 0 },
  { id: "2026-10", month: "2026-10", kind: "rent", remainingCents: 3_000, dueCents: 1_000_000, paidCents: 997_000 },
];

test("the previous-dues row holds only the chosen months and sums them", () => {
  assert.equal(arrearsRow(candidates, []), null);
  const row = arrearsRow(candidates, ["2026-09", "bill-1"])!;
  assert.equal(row.key, "ARREARS");
  assert.equal(row.remainingCents, 1_800_000);
  assert.deepEqual(row.lines.map(({ id }) => id), ["2026-09", "bill-1"]);
  assert.equal(row.details?.length, 2);
});

test("a printed bill lets earlier dues be received, but never more than printed or unlisted months", () => {
  const printed = [arrearsRow(candidates, ["2026-09"])!];
  const open = candidates.map(({ id, month, kind, remainingCents }) => ({ id, month, kind, remainingCents }));
  assert.deepEqual(limitToPrintedBill(open, printed).map(({ id }) => id), ["2026-09"]);
  // Money received since the print lowers what can still be taken.
  const partlyPaid = open.map((line) => line.id === "2026-09" ? { ...line, remainingCents: 400_000 } : line);
  assert.equal(limitToPrintedBill(partlyPaid, printed)[0].remainingCents, 400_000);
});

test("only a part-paid charge with a balance up to ৳500 counts as a small leftover", () => {
  assert.equal(isSmallLeftover({ paidCents: 947_000, remainingCents: 3_000 }), true);
  assert.equal(isSmallLeftover({ paidCents: 1, remainingCents: 50_000 }), true);
  assert.equal(isSmallLeftover({ paidCents: 1, remainingCents: 50_001 }), false);
  // Nothing received yet: a whole unpaid charge is chosen by hand, however small.
  assert.equal(isSmallLeftover({ paidCents: 0, remainingCents: 30_000 }), false);
});
