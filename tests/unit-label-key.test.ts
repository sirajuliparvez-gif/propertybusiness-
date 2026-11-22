import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUnitLabel, unitLabelKey } from "@/lib/unit-label-key";

test("a unit number matches the same number in Bengali or English digits", () => {
  assert.equal(unitLabelKey("৪০৮"), unitLabelKey("408"));
  assert.equal(unitLabelKey(" ৪০৮ "), "408");
  assert.notEqual(unitLabelKey("৪০৮"), unitLabelKey("৪০৯"));
});

test("unit labels ignore case and spacing but keep real differences", () => {
  assert.equal(unitLabelKey("A 1"), unitLabelKey("a1"));
  assert.equal(unitLabelKey("Unit  12"), unitLabelKey("unit 12"));
  assert.notEqual(unitLabelKey("1-2"), unitLabelKey("12"));
  assert.equal(normalizeUnitLabel("  Unit   7 "), "Unit 7");
  assert.equal(unitLabelKey("১৯-২০-২১"), "19-20-21");
});
