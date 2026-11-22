import assert from "node:assert/strict";
import test from "node:test";
import { collectionRatePercent } from "@/lib/collection-rate";
import { dhakaMonthKey } from "@/lib/dhaka-time";
import { computeServiceChargeAmount } from "@/lib/service-charge";

test("collection rate is collected over due, rounded down, never above 100", () => {
  assert.equal(collectionRatePercent(0, 2044550), 0);
  assert.equal(collectionRatePercent(680500, 2044550), 33);
  assert.equal(collectionRatePercent(1999, 2000), 99);
  assert.equal(collectionRatePercent(2000, 2000), 100);
  assert.equal(collectionRatePercent(2500, 2000), 100);
  assert.equal(collectionRatePercent(100, 0), 0);
  assert.equal(collectionRatePercent(-5, 100), 0);
  assert.equal(collectionRatePercent(Number.NaN, 100), 0);
});

test("the month key of a Dhaka wall-clock date does not shift forward on the last evening of a month", () => {
  assert.equal(dhakaMonthKey(new Date(2026, 10, 30, 20, 0)), "2026-11");
  assert.equal(dhakaMonthKey(new Date(2026, 10, 30, 23, 59)), "2026-11");
  assert.equal(dhakaMonthKey(new Date(2026, 11, 1, 0, 5)), "2026-12");
  assert.equal(dhakaMonthKey(new Date(2027, 0, 15, 12, 0)), "2027-01");
});

test("a percentage service charge is rounded to whole paisa so rent can be paid off exactly", () => {
  assert.equal(computeServiceChargeAmount(34429.89, "PERCENTAGE", 10), 3442.99);
  assert.equal(computeServiceChargeAmount(10000, "PERCENTAGE", 5), 500);
  assert.equal(computeServiceChargeAmount(10000, "FLAT", 250), 250);
  assert.equal(computeServiceChargeAmount(10000, null, 5), 0);
  assert.equal(computeServiceChargeAmount(10000, "PERCENTAGE", null), 0);
});
