import assert from "node:assert/strict";
import test from "node:test";
import { utilityReportAmounts, utilityReportTotals, utilityReportTenant } from "@/lib/monthly-utility-report";

const transaction = (type: string, amount: number) => ({ type, amount, method: "CASH" });

test("tenant overpayment is collection and profit, never extra bill settlement", () => {
  const row = utilityReportAmounts({ amount: 1000, paidAmount: 1000, transactions: [
    transaction("UTILITY_REIMBURSEMENT_FROM_TENANT", 1000), transaction("UTILITY_PROFIT_FROM_TENANT", 50),
  ] });
  assert.equal(row.collected, 1050);
  assert.equal(row.profit, 50);
  assert.equal(row.settled, 1000);
  assert.equal(row.remaining, 0);
  assert.equal(row.unclassified, 0);
  assert.equal(row.status, "PAID");
});

test("split settlement keeps company shortfall separate from tenant collection", () => {
  const row = utilityReportAmounts({ amount: 1000, paidAmount: 1000, transactions: [
    transaction("UTILITY_REIMBURSEMENT_FROM_TENANT", 990), transaction("UTILITY_EXPENSE", 10),
  ] });
  assert.equal(row.collected, 990);
  assert.equal(row.company, 10);
  assert.equal(row.profit, 0);
  assert.equal(row.unclassified, 0);
});

test("partial installments leave the correct bill balance and status", () => {
  const row = utilityReportAmounts({ amount: 1000, paidAmount: 700, transactions: [
    transaction("UTILITY_REIMBURSEMENT_FROM_TENANT", 200), transaction("UTILITY_REIMBURSEMENT_FROM_TENANT", 500),
  ] });
  assert.equal(row.collected, 700);
  assert.equal(row.remaining, 300);
  assert.equal(row.status, "PARTIAL");
});

test("unlinked historical settlements are flagged rather than invented as collections", () => {
  const row = utilityReportAmounts({ amount: 1000, paidAmount: 1000, transactions: [] });
  assert.equal(row.collected, 0);
  assert.equal(row.company, 0);
  assert.equal(row.unclassified, 1000);
  assert.equal(row.remaining, 0);
});

test("unpaid, company-paid and empty monthly reports reconcile independently", () => {
  const unpaid = utilityReportAmounts({ amount: 700, paidAmount: 0, transactions: [] });
  const company = utilityReportAmounts({ amount: 500, paidAmount: 500, transactions: [transaction("UTILITY_EXPENSE", 500)] });
  assert.equal(unpaid.status, "UNPAID");
  assert.equal(company.status, "PAID");
  assert.deepEqual(utilityReportTotals([unpaid, company]), { billed: 1200, settled: 500, collected: 0, company: 500, profit: 0, remaining: 700, unclassified: 0 });
  assert.equal(utilityReportTotals([]).billed, 0);
});

const formerLease = { tenantName: "Former tenant", startDate: new Date("2026-01-01"), endDate: null, movedOutAt: new Date("2026-09-30"), status: "VACATED" };
const newLease = { tenantName: "New tenant", startDate: new Date("2026-10-01"), endDate: null, movedOutAt: null, status: "ACTIVE" };

test("utility bills keep their explicitly linked tenant even after a move-out", () => {
  assert.equal(utilityReportTenant({ linkedTenantName: "Recorded tenant", billDate: new Date("2026-10-10"), leases: [newLease] }), "Recorded tenant");
});

test("legacy utility bills resolve the historical occupant instead of the current tenant", () => {
  assert.equal(utilityReportTenant({ linkedTenantName: null, billDate: new Date("2026-09-10"), leases: [newLease, formerLease] }), "Former tenant");
  assert.equal(utilityReportTenant({ linkedTenantName: null, billDate: new Date("2026-10-10"), leases: [newLease, formerLease] }), "New tenant");
});

test("missing or ambiguous occupancy never invents a tenant name", () => {
  assert.equal(utilityReportTenant({ linkedTenantName: null, billDate: new Date("2025-12-10"), leases: [newLease, formerLease] }), null);
  assert.equal(utilityReportTenant({ linkedTenantName: null, billDate: new Date("2026-09-10"), leases: [formerLease, { ...formerLease, tenantName: "Other tenant" }] }), null);
});
