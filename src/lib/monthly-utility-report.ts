import { dhakaISO } from "@/lib/dhaka-time";
import { splitUtilityBillTransactions } from "@/lib/utility-bill-split";

export function utilityReportAmounts(bill: {
  amount: number;
  paidAmount: number;
  transactions: { type: string; amount: number; method: string | null }[];
}) {
  const split = splitUtilityBillTransactions(bill.transactions);
  const remaining = Math.max(0, bill.amount - bill.paidAmount);
  return {
    billed: bill.amount,
    settled: bill.paidAmount,
    collected: split.collectedFromTenant,
    company: split.companyAbsorbedAmount,
    profit: split.profitAmount,
    remaining,
    // Legacy/imported settlements may not have linked transaction history.
    // Do not silently attribute that money to a tenant or to company costs.
    unclassified: Math.max(0, bill.paidAmount - (split.collectedFromTenant - split.profitAmount + split.companyAbsorbedAmount)),
    status: remaining === 0 ? "PAID" : bill.paidAmount > 0 ? "PARTIAL" : "UNPAID",
  };
}

export function utilityReportTotals(rows: ReturnType<typeof utilityReportAmounts>[]) {
  return rows.reduce((sum, row) => ({
    billed: sum.billed + row.billed, settled: sum.settled + row.settled,
    collected: sum.collected + row.collected, company: sum.company + row.company,
    profit: sum.profit + row.profit, remaining: sum.remaining + row.remaining,
    unclassified: sum.unclassified + row.unclassified,
  }), { billed: 0, settled: 0, collected: 0, company: 0, profit: 0, remaining: 0, unclassified: 0 });
}

// Prefer the recorded bill owner. Legacy bills can use a uniquely matching
// historical lease; never substitute today's occupant for a former tenant.
export function utilityReportTenant({ linkedTenantName, billDate, leases }: {
  linkedTenantName: string | null;
  billDate: Date;
  leases: { tenantName: string; startDate: Date; endDate: Date | null; movedOutAt: Date | null; status: string }[];
}) {
  if (linkedTenantName) return linkedTenantName;
  const day = dhakaISO(billDate);
  const matches = leases.filter((lease) => {
    const end = lease.movedOutAt ?? lease.endDate;
    return dhakaISO(lease.startDate) <= day &&
      (lease.status === "ACTIVE" || (end != null && dhakaISO(end) >= day));
  });
  return matches.length === 1 ? matches[0].tenantName : null;
}
