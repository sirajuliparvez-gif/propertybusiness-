import { strict as assert } from "node:assert";
import test from "node:test";
import { billIdsInPrint, latestReceivedAt } from "@/lib/utility-bill-dates";

test("received date is the latest tenant payment, ignoring company-side entries", () => {
  const at = (day: string) => new Date(`2026-11-${day}T00:00:00Z`);
  assert.equal(latestReceivedAt([]), null);
  assert.deepEqual(latestReceivedAt([
    { type: "UTILITY_REIMBURSEMENT_FROM_TENANT", date: at("05") },
    { type: "UTILITY_REIMBURSEMENT_FROM_TENANT", date: at("09") },
    { type: "UTILITY_EXPENSE", date: at("20") },
  ]), at("09"));
  assert.equal(latestReceivedAt([{ type: "UTILITY_EXPENSE", date: at("20") }]), null);
});

test("a saved print yields the utility bill ids it listed", () => {
  const rows = [
    { key: "RENT", lines: [{ id: "2026-10", kind: "rent" }] },
    { key: "ELECTRICITY", lines: [{ id: "b1", kind: "utility" }, { id: "b2", kind: "utility" }] },
    { key: "GAS", lines: [] },
  ];
  assert.deepEqual(billIdsInPrint(rows), ["b1", "b2"]);
  assert.deepEqual(billIdsInPrint(null), []);
  assert.deepEqual(billIdsInPrint([{ key: "X" }]), []);
});
