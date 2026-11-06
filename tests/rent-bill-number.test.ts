import assert from "node:assert/strict";
import test from "node:test";
import { formatRentBillNumber, legacyRentBillNumber, parseRentBillSearch } from "@/lib/rent-bill-number";

test("bill numbers distinguish the same serial across markets and months", () => {
  assert.equal(formatRentBillNumber(1, "2026-11", 42), "R-M01-202611-0042");
  assert.equal(formatRentBillNumber(2, "2026-11", 42), "R-M02-202611-0042");
  assert.equal(formatRentBillNumber(1, "2026-10", 42), "R-M01-202610-0042");
  assert.deepEqual(parseRentBillSearch(" r-m০১-২০২৬১১-০০৪২ "), {
    kind: "full", marketCode: 1, month: "2026-11", serial: 42,
  });
  assert.deepEqual(parseRentBillSearch("০০৪২"), { kind: "serial", serial: 42 });
});

test("search keeps the original format for older printed bills and rejects invalid inputs", () => {
  const legacy = legacyRentBillNumber("qa-full-lease-5", "2026-11");
  assert.deepEqual(parseRentBillSearch(legacy), {
    kind: "legacy", month: "2026-11", suffix: "LL-LEASE-5", value: legacy,
  });
  for (const value of ["0", "2147483648", "R-M01-202613-0001", "R-M00-202611-0001", "R-M01-202611-0"]) {
    assert.equal(parseRentBillSearch(value), null);
  }
});
