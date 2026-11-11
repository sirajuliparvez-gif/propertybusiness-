import { strict as assert } from "node:assert";
import test from "node:test";
import { attachElectricityConsumption, electricityAmountAtRate } from "@/lib/electricity-consumption";

test("a manual previous reading applies only to its own electricity bill", () => {
  const bill = (month: string, meterReading: number, previousMeterReadingOverride?: number) => ({
    id: month, type: "ELECTRICITY", unitId: "shop-1",
    dueDate: new Date(`2026-${month}-10`), createdAt: new Date(`2026-${month}-10`),
    meterReading, previousMeterReadingOverride,
  });
  const readings = attachElectricityConsumption([bill("03", 60), bill("01", 200), bill("02", 40, 0)]);
  assert.deepEqual(readings.get("01"), { previousReading: null, consumption: null });
  assert.deepEqual(readings.get("02"), { previousReading: 0, consumption: 40 });
  assert.deepEqual(readings.get("03"), { previousReading: 40, consumption: 20 });
});

test("a positive unit price calculates the bill and requires usable readings", () => {
  assert.equal(electricityAmountAtRate(10, "8.50"), "85.00");
  assert.equal(electricityAmountAtRate(37, "8.50"), "314.50");
  assert.equal(electricityAmountAtRate(null, "8.50"), "");
  assert.equal(electricityAmountAtRate(-10, "8.50"), "");
  assert.equal(electricityAmountAtRate(10, "0"), "");
});

test("each named meter on a unit chains its own readings", () => {
  const bill = (id: string, month: string, meterReading: number, meterLabel: string | null) => ({
    id, type: "ELECTRICITY", unitId: "shop-1", meterLabel,
    dueDate: new Date(`2026-${month}-10`), createdAt: new Date(`2026-${month}-10`), meterReading,
  });
  const readings = attachElectricityConsumption([
    bill("a1", "01", 100, null), bill("b1", "01", 5000, "Meter 2"),
    bill("a2", "02", 130, null), bill("b2", "02", 5200, "Meter 2"),
  ]);
  assert.deepEqual(readings.get("a2"), { previousReading: 100, consumption: 30 });
  assert.deepEqual(readings.get("b1"), { previousReading: null, consumption: null });
  assert.deepEqual(readings.get("b2"), { previousReading: 5000, consumption: 200 });
});

test("a bill without a meter name chains exactly as before", () => {
  const bill = (id: string, month: string, meterReading: number) => ({
    id, type: "ELECTRICITY", unitId: "shop-1",
    dueDate: new Date(`2026-${month}-10`), createdAt: new Date(`2026-${month}-10`), meterReading,
  });
  const readings = attachElectricityConsumption([bill("1", "01", 10), bill("2", "02", 25)]);
  assert.deepEqual(readings.get("2"), { previousReading: 10, consumption: 15 });
});
