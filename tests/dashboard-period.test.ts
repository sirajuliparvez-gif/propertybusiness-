import assert from "node:assert/strict";
import test from "node:test";
import { dashboardMonthKeys, dashboardFinancialBuckets, dashboardYearlyBuckets } from "@/lib/dashboard-period";
import { reportingMonthKey } from "@/lib/reporting-period";

const transaction = (type: string, amount: number, date: string, rentPaymentMonth?: string) => ({ type, amount, date: new Date(date), rentPaymentMonth });

test("shared chart history preserves monthly and year-to-selected-month totals", () => {
  const points = dashboardFinancialBuckets([
    transaction("RENT_RECEIVED_FROM_TENANT", 1000, "2026-10-03", "2026-09"),
    transaction("MAINTENANCE_EXPENSE", 100, "2025-12-12"),
    transaction("UTILITY_PROFIT_FROM_TENANT", 30, "2026-10-05"),
  ], dashboardMonthKeys("2026-09", 33));
  assert.equal(points.slice(-12)[0].month, "2025-10");
  assert.deepEqual(dashboardYearlyBuckets(points, "2026-09"), [
    { year: "2024", income: 0, expense: 0, net: 0 },
    { year: "2025", income: 0, expense: 100, net: -100 },
    { year: "2026", income: 1000, expense: 0, net: 1000 },
  ]);
});

test("dashboard trend ends on the selected month across year boundaries", () => {
  const keys = dashboardMonthKeys("2026-01");
  assert.equal(keys.length, 12);
  assert.equal(keys[0], "2025-02");
  assert.equal(keys[11], "2026-01");
  assert.throws(() => dashboardMonthKeys("2026-13"), /Invalid dashboard period/);
});

test("selected period retains late rent receipts without showing later months", () => {
  const points = dashboardFinancialBuckets([
    transaction("RENT_RECEIVED_FROM_TENANT", 1000, "2026-10-03", "2026-09"),
    transaction("MAINTENANCE_EXPENSE", 100, "2026-09-12"),
    transaction("UTILITY_PROFIT_FROM_TENANT", 30, "2026-10-05"),
  ], ["2026-08", "2026-09"]);
  assert.deepEqual(points, [
    { month: "2026-08", income: 0, expense: 0, net: 0 },
    { month: "2026-09", income: 1000, expense: 100, net: 900 },
  ]);
});

test("dashboard operating totals exclude advances and utility reimbursements", () => {
  const [point] = dashboardFinancialBuckets([
    transaction("DOWNPAYMENT_RECEIVED_FROM_TENANT", 5000, "2026-09-01"),
    transaction("UTILITY_REIMBURSEMENT_FROM_TENANT", 300, "2026-09-02"),
    transaction("UTILITY_PROFIT_FROM_TENANT", 20, "2026-09-02"),
    transaction("PAYROLL_EXPENSE", 200, "2026-09-03"),
  ], ["2026-09"]);
  assert.equal(point.income, 20);
  assert.equal(point.expense, 200);
  assert.equal(point.net, -180);
});

test("year-to-selected-month window does not include future months of that year", () => {
  const keys = dashboardMonthKeys("2026-09", 33);
  assert.equal(keys[0], "2024-01");
  assert.equal(keys[keys.length - 1], "2026-09");
  assert.ok(!keys.includes("2026-10"));
});

test("non-rent financial entries use Dhaka's calendar at month boundaries", () => {
  assert.equal(reportingMonthKey({ transactionType: "PAYROLL_EXPENSE", transactionDate: new Date("2026-09-30T18:00:00Z") }), "2026-10");
  assert.equal(reportingMonthKey({ transactionType: "PAYROLL_EXPENSE", transactionDate: new Date("2026-09-30T17:59:59Z") }), "2026-09");
});
