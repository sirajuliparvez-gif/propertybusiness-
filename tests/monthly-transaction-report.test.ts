import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyTransactionReport, openingTransactionBalance, transactionReportRange, type TransactionReportEntry } from "@/lib/monthly-transaction-report";

function entry(overrides: Partial<TransactionReportEntry> = {}): TransactionReportEntry {
  return { id: "entry", date: new Date("2026-10-05"), createdAt: new Date("2026-10-05T10:00:00Z"), direction: "INCOMING", amount: 1000, ...overrides };
}

test("opening and closing balances include every incoming and outgoing movement", () => {
  const opening = openingTransactionBalance([{ direction: "INCOMING", amount: 15000 }, { direction: "OUTGOING", amount: 5000 }]);
  const { rows, totals } = buildMonthlyTransactionReport([
    { ...entry({ id: "advance", amount: 4000 }), type: "DOWNPAYMENT_RECEIVED_FROM_TENANT" },
    { ...entry({ id: "refund", amount: 1500, direction: "OUTGOING", createdAt: new Date("2026-10-05T11:00:00Z") }), type: "DOWNPAYMENT_REFUND_TO_TENANT" },
    { ...entry({ id: "withdrawal", amount: 500, direction: "OUTGOING", createdAt: new Date("2026-10-05T12:00:00Z") }), type: "OWNER_WITHDRAWAL" },
  ], opening);
  assert.deepEqual(totals, { opening: 10000, incoming: 4000, outgoing: 2000, net: 2000, closing: 12000 });
  assert.deepEqual(rows.map((row) => row.balance), [14000, 12500, 12000]);
});

test("running balances follow transaction date, creation time, then stable id", () => {
  const first = entry({ id: "a", amount: 10 });
  const second = entry({ id: "b", amount: 20 });
  const later = entry({ id: "c", amount: 5, direction: "OUTGOING", date: new Date("2026-10-06") });
  const input = [later, second, first];
  const { rows } = buildMonthlyTransactionReport(input, 0);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b", "c"]);
  assert.deepEqual(rows.map((row) => row.balance), [10, 30, 25]);
  assert.equal(input[0].id, "c");
});

test("minor currency units do not accumulate floating point drift", () => {
  const { totals } = buildMonthlyTransactionReport([
    entry({ id: "one", amount: 0.1 }), entry({ id: "two", amount: 0.2 }),
    entry({ id: "three", amount: 0.3, direction: "OUTGOING" }),
  ], 0);
  assert.equal(totals.incoming, 0.3);
  assert.equal(totals.closing, 0);
});

test("empty months carry opening balance forward without invented movements", () => {
  assert.deepEqual(buildMonthlyTransactionReport([], 2500).totals, { opening: 2500, incoming: 0, outgoing: 0, net: 0, closing: 2500 });
});

test("negative recorded ledger balances are retained for reconciliation", () => {
  assert.equal(buildMonthlyTransactionReport([entry({ direction: "OUTGOING", amount: 600 })], 100).totals.closing, -500);
});

test("Bangladesh month boundaries include local midnight before UTC month-start", () => {
  const { start, end } = transactionReportRange("2026-10");
  assert.equal(start.toISOString(), "2026-09-30T18:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-31T18:00:00.000Z");
  assert.ok(new Date("2026-09-30T18:00:00Z") >= start);
  assert.ok(new Date("2026-10-31T17:59:59Z") < end);
});

test("transaction date range handles leap February and year rollover", () => {
  assert.equal(transactionReportRange("2024-02").end.toISOString(), "2024-02-29T18:00:00.000Z");
  assert.equal(transactionReportRange("2026-12").end.toISOString(), "2026-12-31T18:00:00.000Z");
});
