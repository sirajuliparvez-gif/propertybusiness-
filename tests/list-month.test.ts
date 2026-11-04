import assert from "node:assert/strict";
import test from "node:test";
import { resolveListMonth, listMonthOptions } from "@/lib/list-month";

const today = new Date(2026, 10, 4);

test("all-month views and invalid/future input never become a stale month filter", () => {
  for (const input of [undefined, "ALL", "2026-13", "2026-12", "invalid"]) {
    assert.equal(resolveListMonth(input, today).selectedMonth, null);
  }
});

test("selected months normalize and scope actual timestamps to the Dhaka calendar", () => {
  const scope = resolveListMonth(" 2026-10 ", today);
  assert.equal(scope.selectedMonth, "2026-10");
  assert.equal(scope.start.toISOString(), "2026-09-30T18:00:00.000Z");
  assert.equal(scope.end.toISOString(), "2026-10-31T18:00:00.000Z");
});

test("month pickers preserve a selected empty period, include current month and discard future records", () => {
  assert.deepEqual(listMonthOptions(["2026-09", "2026-09", "2026-12", "bad"], "2026-11", "2026-08"), ["2026-11", "2026-09", "2026-08"]);
});
