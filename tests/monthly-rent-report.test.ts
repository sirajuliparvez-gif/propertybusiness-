import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyRentReport, type ReportLease } from "@/lib/monthly-rent-report";

function lease(overrides: Partial<ReportLease> = {}): ReportLease {
  return { id: "lease", tenantName: "Tenant", propertyName: "Property", unitLabel: "1", status: "ACTIVE",
    startDate: new Date("2026-01-01"), endDate: null, movedOutAt: null, propertyDeleted: false,
    monthlyRentAmount: 12000, serviceChargeType: null, serviceChargeValue: null, rentRates: [], payment: null, ...overrides };
}

test("mixed partial payment separates every advance adjustment from money collected", () => {
  const { totals } = buildMonthlyRentReport([lease({ payment: { dueAmount: 12000, paidAmount: 9000, adjustments: [1000, 2000] } })], "2026-10");
  assert.deepEqual(totals, { due: 12000, collected: 6000, adjusted: 3000, settled: 9000, remaining: 3000, credit: 0 });
});

test("former tenants and deleted properties retain explicitly recorded monthly bills", () => {
  const { rows } = buildMonthlyRentReport([lease({ status: "VACATED", movedOutAt: new Date("2026-09-30"), propertyDeleted: true,
    payment: { dueAmount: 5000, paidAmount: 5000, adjustments: [] } })], "2026-10");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].collected, 5000);
});

test("unrecorded dues respect occupancy and use historical rates including service charges", () => {
  const { rows } = buildMonthlyRentReport([
    lease({ id: "occupied", status: "VACATED", movedOutAt: new Date("2026-11-01"), rentRates: [
      { effectiveMonth: "2026-01", monthlyRentAmount: 8000, serviceChargeType: "PERCENTAGE", serviceChargeValue: 10 },
      { effectiveMonth: "2026-11", monthlyRentAmount: 15000, serviceChargeType: null, serviceChargeValue: null },
    ] }),
    lease({ id: "future", startDate: new Date("2026-11-01") }),
    lease({ id: "left", status: "VACATED", movedOutAt: new Date("2026-09-30") }),
    lease({ id: "deleted", propertyDeleted: true }),
  ], "2026-10");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].due, 8800);
  assert.equal(rows[0].remaining, 8800);
});

test("recorded due amount survives later rent changes and overpayment cannot hide another tenant's arrears", () => {
  const { totals } = buildMonthlyRentReport([
    lease({ payment: { dueAmount: 5000, paidAmount: 6000, adjustments: [] } }),
    lease({ id: "unpaid", monthlyRentAmount: 3000 }),
  ], "2026-10");
  assert.equal(totals.due, 8000);
  assert.equal(totals.remaining, 3000);
  assert.equal(totals.credit, 1000);
});

test("no synthetic dues before ledger cutover, but historical recorded bills remain", () => {
  assert.equal(buildMonthlyRentReport([lease()], "2026-09").rows.length, 0);
  assert.equal(buildMonthlyRentReport([lease({ payment: { dueAmount: 4000, paidAmount: 2500, adjustments: [] } })], "2026-09").totals.collected, 2500);
  assert.equal(buildMonthlyRentReport([], "2026-10").totals.due, 0);
});

test("month boundaries follow Dhaka when a tenant joins at local midnight", () => {
  const { rows } = buildMonthlyRentReport([lease({ startDate: new Date("2026-10-31T18:00:00Z") })], "2026-10");
  assert.equal(rows.length, 0);
});
