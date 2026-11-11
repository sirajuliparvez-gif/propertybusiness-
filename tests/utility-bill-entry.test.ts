import { strict as assert } from "node:assert";
import test from "node:test";
import { readMeterLabel, validateTenantUtilityBills } from "@/lib/utility-bill-entry";

function bill(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ type: "ELECTRICITY", amount: "100", dueDate: "2026-03-10", ...fields })) data.set(key, value);
  return data;
}

test("two electricity bills in a month are allowed only for different meters", () => {
  assert.equal(validateTenantUtilityBills("2026-03", [bill({}), bill({ meterLabel: "Meter 2" })]).ok, true);
  assert.deepEqual(validateTenantUtilityBills("2026-03", [bill({}), bill({})]), { ok: false, error: "utilityBillDuplicateMonth" });
  assert.deepEqual(
    validateTenantUtilityBills("2026-03", [bill({ meterLabel: "Meter 2" }), bill({ meterLabel: " Meter 2 " })]),
    { ok: false, error: "utilityBillDuplicateMonth" },
  );
});

test("only electricity bills carry a meter name", () => {
  assert.equal(readMeterLabel("ELECTRICITY", "  Meter 2 "), "Meter 2");
  assert.equal(readMeterLabel("ELECTRICITY", "   "), null);
  assert.equal(readMeterLabel("GAS", "Meter 2"), null);
});
