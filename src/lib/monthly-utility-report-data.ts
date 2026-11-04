import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";
import { utilityReportAmounts, utilityReportTotals, utilityReportTenant } from "@/lib/monthly-utility-report";

export async function getMonthlyUtilityReport(requestedMonth?: string) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const requested = requestedMonth?.trim();
  const month = isPaymentMonth(requested) && requested <= currentMonth ? requested : currentMonth;
  const [bills, recordedMonths] = await prisma.$transaction([
    prisma.utilityBill.findMany({
      where: { month },
      select: {
        id: true, type: true, amount: true, paidAmount: true, dueDate: true,
        property: { select: { id: true, name: true } },
        unit: { select: {
          label: true,
          tenantLeases: { select: { startDate: true, endDate: true, movedOutAt: true, status: true, tenant: { select: { name: true } } } },
        } },
        tenantLease: { select: { tenant: { select: { name: true } } } },
        transactions: { select: { type: true, amount: true, method: true } },
      },
    }),
    prisma.utilityBill.findMany({ where: { month: { lte: currentMonth } }, distinct: ["month"], select: { month: true } }),
  ]);
  const rows = bills.map((bill) => ({
    id: bill.id, type: bill.type, propertyId: bill.property.id, propertyName: bill.property.name,
    unitLabel: bill.unit?.label ?? null,
    tenantName: utilityReportTenant({
      linkedTenantName: bill.tenantLease?.tenant.name ?? null,
      billDate: bill.dueDate,
      leases: (bill.unit?.tenantLeases ?? []).map((lease) => ({ ...lease, tenantName: lease.tenant.name })),
    }),
    ...utilityReportAmounts({
      amount: Number(bill.amount), paidAmount: Number(bill.paidAmount),
      transactions: bill.transactions.map((entry) => ({ ...entry, amount: Number(entry.amount) })),
    }),
  })).sort((a, b) => a.propertyName.localeCompare(b.propertyName) || (a.unitLabel ?? "").localeCompare(b.unitLabel ?? "", undefined, { numeric: true }) || a.type.localeCompare(b.type));
  return { month, rows, totals: utilityReportTotals(rows), months: [...new Set([currentMonth, month, ...recordedMonths.map((entry) => entry.month)])].sort().reverse() };
}
