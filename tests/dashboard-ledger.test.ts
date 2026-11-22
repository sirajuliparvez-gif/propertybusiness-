import assert from "node:assert/strict";
import test from "node:test";
import { dashboardLedgerTotals, dashboardRentCollection, departedRentDue, type DashboardLease } from "@/lib/dashboard-ledger";

const lease = (overrides: Partial<DashboardLease> = {}): DashboardLease => ({
  id: "lease", tenantName: "Tenant", propertyName: "Property", unitLabel: "1",
  startDate: new Date(2026, 8, 1), monthlyRentAmount: 1000,
  serviceChargeType: "FLAT", serviceChargeValue: 50, rentRates: [], payments: [], ...overrides,
});

test("dashboard collection keeps recorded snapshots after rent changes and counts partial balances separately", () => {
  const result = dashboardRentCollection([
    lease({ payments: [{ id: "p", month: "2026-09", dueAmount: 900, paidAmount: 600, status: "PARTIAL", dueDate: new Date(2026, 8, 10), paidAt: null }] }),
    lease({ id: "other", payments: [{ id: "q", month: "2026-09", dueAmount: 100, paidAmount: 200, status: "PAID", dueDate: new Date(2026, 8, 10), paidAt: null }] }),
  ], "2026-09", new Date(2026, 10, 4));
  assert.equal(result.totalDue, 1000);
  assert.equal(result.totalCollected, 800);
  assert.equal(result.totalRemaining, 300);
  assert.equal(result.collectionRate, 80);
  assert.equal(result.payments[0].pastDueAmount, 300);
});

test("dashboard collection preserves the cutover and excludes leases that have not started", () => {
  assert.equal(dashboardRentCollection([lease()], "2026-09").payments.length, 0);
  const result = dashboardRentCollection([
    lease(), lease({ id: "future", startDate: new Date(2026, 11, 1) }),
  ], "2026-10", new Date(2026, 10, 4));
  assert.equal(result.payments.length, 1);
  assert.equal(result.totalDue, 1050);
  assert.equal(result.totalRemaining, 1050);
});

test("dashboard ledger totals retain historical rent rates and salary snapshots", () => {
  const result = dashboardLedgerTotals([
    lease({ rentRates: [
      { effectiveMonth: "2026-10", monthlyRentAmount: 1200, serviceChargeType: "PERCENTAGE", serviceChargeValue: 10 },
      { effectiveMonth: "2026-11", monthlyRentAmount: 2000, serviceChargeType: null, serviceChargeValue: null },
    ] }),
  ], [{ joinedAt: new Date(2026, 9, 1), salaryAmount: 2000, payments: [
    { id: "salary", month: "2026-10", dueAmount: 1000, paidAmount: 600, status: "PARTIAL", dueDate: new Date(2026, 9, 15), paidAt: null },
  ] }], new Date(2026, 10, 4));
  assert.equal(result.totalOverdueRent, 3320);
  assert.equal(result.totalOverduePayroll, 2400);
});


test("rent still recorded as owed by a tenant who moved out stays in the outstanding totals", () => {
  const now = new Date(2026, 10, 20);
  const owed = [
    { id: "a", month: "2026-10", dueAmount: 19000, paidAmount: 4000, status: "PARTIAL" as const, dueDate: new Date(2026, 9, 10), paidAt: null },
    { id: "b", month: "2026-11", dueAmount: 5000, paidAmount: 0, status: "UNPAID" as const, dueDate: new Date(2026, 10, 10), paidAt: null },
    { id: "c", month: "2026-09", dueAmount: 800, paidAmount: 800, status: "PAID" as const, dueDate: new Date(2026, 8, 10), paidAt: null },
  ];
  assert.deepEqual(departedRentDue(owed, now), { overdue: 20000, pastDue: 20000 });
  assert.deepEqual(departedRentDue([], now), { overdue: 0, pastDue: 0 });
  // Before the 10th the current month is owed but not yet past due.
  assert.deepEqual(departedRentDue(owed, new Date(2026, 10, 5)), { overdue: 20000, pastDue: 15000 });
  const totals = dashboardLedgerTotals([], [], now, owed);
  assert.equal(totals.totalOverdueRent, 20000);
  assert.equal(totals.totalPastDueRent, 20000);
  const withActive = dashboardLedgerTotals([lease()], [], now, owed);
  assert.ok(withActive.totalOverdueRent > 20000);
});

test("dashboard collection rate is collected money over due money", () => {
  const unpaid = dashboardRentCollection([lease(), lease({ id: "free", monthlyRentAmount: 0, serviceChargeType: null, serviceChargeValue: null })], "2026-10", new Date(2026, 10, 4));
  assert.equal(unpaid.totalCollected, 0);
  assert.equal(unpaid.collectionRate, 0);
});
