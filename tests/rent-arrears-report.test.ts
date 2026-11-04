import assert from "node:assert/strict";
import test from "node:test";
import { buildRentArrearsReport, groupRentArrearsByProperty, resolveArrearsRange, type ArrearsLease } from "@/lib/rent-arrears-report";

const now = new Date(2026, 10, 4);
const lease = (overrides: Partial<ArrearsLease> = {}): ArrearsLease => ({
  id: "lease", tenantName: "Tenant", propertyId: "property", propertyName: "Property", unitLabel: "1",
  status: "ACTIVE", startDate: new Date("2026-01-01"), endDate: null, movedOutAt: null,
  propertyDeleted: false, monthlyRentAmount: 1000, serviceChargeType: null, serviceChargeValue: null,
  rentRates: [], payments: [], ...overrides,
});

test("market groups keep separate property IDs and reconcile their balances to the report total", () => {
  const report = buildRentArrearsReport([
    lease({ id: "a", propertyId: "one", propertyName: "Market", monthlyRentAmount: 1000 }),
    lease({ id: "b", propertyId: "one", propertyName: "Market", monthlyRentAmount: 2000 }),
    lease({ id: "c", propertyId: "two", propertyName: "Market", monthlyRentAmount: 3000 }),
  ], "2026-10", "2026-10", false, now);
  const groups = groupRentArrearsByProperty(report.rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[0].rows[0].id, "b");
  assert.equal(groups[0].totals.remaining, 3000);
  assert.equal(groups.reduce((sum, group) => sum + group.totals.remaining, 0), report.totals.remaining);
});

test("multi-month arrears keep each month's payments and distinguish overdue from current dues", () => {
  const report = buildRentArrearsReport([lease({ payments: [
    { month: "2026-09", dueAmount: 900, paidAmount: 500, adjustments: [] },
    { month: "2026-10", dueAmount: 1000, paidAmount: 700, adjustments: [200] },
  ] })], "2026-09", "2026-11", false, now);
  assert.deepEqual(report.rows[0].months.map((row) => [row.month, row.collected, row.adjusted, row.remaining, row.overdue]), [
    ["2026-09", 500, 0, 400, 400], ["2026-10", 500, 200, 300, 300], ["2026-11", 0, 0, 1000, 0],
  ]);
  assert.deepEqual(report.totals, { due: 2900, collected: 1000, adjusted: 200, settled: 1200, remaining: 1700, credit: 0, overdue: 700 });
});

test("a credit cannot cancel unpaid rent in another month or for another tenant", () => {
  const report = buildRentArrearsReport([
    lease({ payments: [{ month: "2026-10", dueAmount: 1000, paidAmount: 1500, adjustments: [] }] }),
    lease({ id: "other" }),
  ], "2026-10", "2026-11", false, now);
  assert.equal(report.totals.remaining, 3000);
  assert.equal(report.totals.credit, 500);
});

test("settled tenants are optional and visible totals reconcile with the selected rows", () => {
  const leases = [lease(), lease({ id: "paid", payments: [{ month: "2026-10", dueAmount: 1000, paidAmount: 1000, adjustments: [] }] })];
  const owing = buildRentArrearsReport(leases, "2026-10", "2026-10", false, now);
  const all = buildRentArrearsReport(leases, "2026-10", "2026-10", true, now);
  assert.equal(owing.rows.length, 1);
  assert.equal(owing.totals.due, 1000);
  assert.equal(all.rows.length, 2);
  assert.equal(all.totals.due, 2000);
  assert.equal(all.totals.collected, 1000);
  assert.equal(all.owingTenants, 1);
});

test("former tenants retain arrears, but no missing dues are generated after move-out", () => {
  const report = buildRentArrearsReport([lease({ status: "VACATED", movedOutAt: new Date("2026-10-15"), payments: [
    { month: "2026-09", dueAmount: 1000, paidAmount: 100, adjustments: [] },
  ] })], "2026-09", "2026-11", false, now);
  assert.deepEqual(report.rows[0].months.map((row) => row.month), ["2026-09", "2026-10"]);
  assert.equal(report.totals.remaining, 1900);
});

test("rate changes include service charges, recorded bills keep snapshots, and old missing months stay excluded", () => {
  const report = buildRentArrearsReport([lease({ rentRates: [
    { effectiveMonth: "2026-10", monthlyRentAmount: 2000, serviceChargeType: "PERCENTAGE", serviceChargeValue: 10 },
    { effectiveMonth: "2026-11", monthlyRentAmount: 3000, serviceChargeType: "FLAT", serviceChargeValue: 50 },
  ], payments: [{ month: "2026-10", dueAmount: 1900, paidAmount: 900, adjustments: [] }] })], "2026-08", "2026-11", false, now);
  assert.deepEqual(report.rows[0].months.map((row) => [row.month, row.due]), [["2026-10", 1900], ["2026-11", 3050]]);
  assert.equal(report.totals.remaining, 4050);
});

test("deleted properties keep recorded debts without inventing new rent", () => {
  const report = buildRentArrearsReport([lease({ propertyDeleted: true, payments: [
    { month: "2026-09", dueAmount: 1000, paidAmount: 250, adjustments: [] },
  ] })], "2026-09", "2026-11", false, now);
  assert.equal(report.rows[0].months.length, 1);
  assert.equal(report.totals.remaining, 750);
});

test("default ranges include recorded history and normalize invalid, future and reversed input", () => {
  assert.deepEqual(resolveArrearsRange(undefined, undefined, "2026-08", "2026-11"), { from: "2026-08", to: "2026-11", earliest: "2026-08" });
  assert.deepEqual(resolveArrearsRange("2026-13", "2027-01", null, "2026-11"), { from: "2026-10", to: "2026-11", earliest: "2026-10" });
  assert.equal(resolveArrearsRange("2026-11", "2026-10", null, "2026-11").from, "2026-10");
  assert.equal(buildRentArrearsReport([], "2026-10", "2026-11").totals.remaining, 0);
});
