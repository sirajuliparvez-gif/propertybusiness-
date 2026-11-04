import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlySalaryReport, type SalaryReportEmployee } from "@/lib/monthly-salary-report";

function employee(overrides: Partial<SalaryReportEmployee> = {}): SalaryReportEmployee {
  return { id: "staff", name: "Staff member", role: "Caretaker", propertyId: "property", propertyName: "Property",
    joinedAt: new Date("2026-01-01"), terminatedAt: null, status: "ACTIVE", salaryAmount: 12000, payment: null, ...overrides };
}

test("partial salary keeps its recorded due after a raise", () => {
  const { rows, totals } = buildMonthlySalaryReport([employee({ salaryAmount: 15000,
    payment: { dueAmount: 10000, amountPaid: 6000, paidAt: new Date("2026-11-02") } })], "2026-10");
  assert.equal(rows[0].due, 10000);
  assert.equal(rows[0].status, "PARTIAL");
  assert.equal(totals.remaining, 4000);
  assert.equal(totals.unpaidStaff, 1);
  assert.equal(rows[0].paidAt?.toISOString(), "2026-11-02T00:00:00.000Z");
});

test("historical recorded payments remain visible for terminated staff", () => {
  const { rows } = buildMonthlySalaryReport([employee({ status: "TERMINATED", terminatedAt: new Date("2026-08-01"),
    payment: { dueAmount: 5000, amountPaid: 5000, paidAt: new Date("2026-09-10") } })], "2026-09");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PAID");
});

test("unrecorded salaries respect joining, termination, company staff and the ledger cutover", () => {
  const staff = [employee({ id: "company", propertyId: null, propertyName: null }),
    employee({ id: "future", joinedAt: new Date("2026-11-01") }),
    employee({ id: "left", status: "TERMINATED", terminatedAt: new Date("2026-09-30") }),
    employee({ id: "leftDuringMonth", status: "TERMINATED", terminatedAt: new Date("2026-10-20") })];
  const { rows, totals } = buildMonthlySalaryReport(staff, "2026-10");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].propertyId, null);
  assert.equal(totals.due, 24000);
  assert.equal(totals.paid, 0);
  assert.equal(totals.unpaidStaff, 2);
  assert.equal(buildMonthlySalaryReport([employee()], "2026-09").rows.length, 0);
});

test("legacy null snapshots follow the salary ledger fallback", () => {
  const { rows } = buildMonthlySalaryReport([employee({ payment: { dueAmount: null, amountPaid: 8000, paidAt: null } })], "2026-09");
  assert.equal(rows[0].due, 8000);
  assert.equal(rows[0].remaining, 0);
});

test("overpaid staff cannot hide another staff member's unpaid salary", () => {
  const { totals } = buildMonthlySalaryReport([employee({ payment: { dueAmount: 10000, amountPaid: 11000, paidAt: null } }),
    employee({ id: "unpaid", salaryAmount: 5000 })], "2026-10");
  assert.equal(totals.remaining, 5000);
  assert.equal(totals.credit, 1000);
});

test("Dhaka joining boundary and empty salary reports", () => {
  assert.equal(buildMonthlySalaryReport([employee({ joinedAt: new Date("2026-10-31T18:00:00Z") })], "2026-10").rows.length, 0);
  assert.deepEqual(buildMonthlySalaryReport([], "2026-10").totals, { due: 0, paid: 0, remaining: 0, credit: 0, unpaidStaff: 0 });
});
