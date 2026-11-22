import assert from "node:assert/strict";
import test from "node:test";
import { isValidUnitCount, unitCountNeedsConfirmation, MAX_UNITS_PER_FORM } from "@/lib/unit-limits";

test("unit count must be a whole number from 1 to the maximum", () => {
  assert.equal(isValidUnitCount(1), true);
  assert.equal(isValidUnitCount(MAX_UNITS_PER_FORM), true);
  for (const bad of [0, -1, 1.5, MAX_UNITS_PER_FORM + 1, 408, NaN, Infinity]) assert.equal(isValidUnitCount(bad), false, String(bad));
});

test("a large but allowed unit count asks for confirmation first", () => {
  assert.equal(unitCountNeedsConfirmation(20), false);
  assert.equal(unitCountNeedsConfirmation(21), true);
  assert.equal(unitCountNeedsConfirmation(MAX_UNITS_PER_FORM), true);
  assert.equal(unitCountNeedsConfirmation(MAX_UNITS_PER_FORM + 1), false);
});
