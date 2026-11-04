import { prisma } from "@/lib/prisma";
import { dhakaISO, dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth, paymentMonthRange } from "@/lib/payment-month";
import { utilityReportTenant } from "@/lib/monthly-utility-report";
import { buildMonthlyTransactionReport, openingTransactionBalance, transactionReportRange } from "@/lib/monthly-transaction-report";

export async function getMonthlyTransactionReport(requestedMonth?: string) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const requested = requestedMonth?.trim();
  const month = isPaymentMonth(requested) && requested <= currentMonth ? requested : currentMonth;
  const { start, end } = transactionReportRange(month);
  const [transactions, previous, earliest] = await prisma.$transaction([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        id: true, type: true, direction: true, amount: true, method: true, notes: true, date: true, createdAt: true,
        property: { select: { name: true } }, unit: { select: { label: true } },
        tenantLease: { select: { tenant: { select: { name: true } }, unit: { select: { label: true } } } },
        rentPayment: { select: { tenantLease: { select: { tenant: { select: { name: true } }, unit: { select: { label: true } } } } } },
        payrollRecord: { select: { employee: { select: { name: true } } } },
        guestStay: { select: { guestName: true } },
        utilityBill: { select: {
          dueDate: true, tenantLease: { select: { tenant: { select: { name: true } } } },
          unit: { select: { label: true, tenantLeases: { select: { startDate: true, endDate: true, movedOutAt: true, status: true, tenant: { select: { name: true } } } } } },
        } },
      },
    }),
    prisma.transaction.groupBy({ by: ["direction"], orderBy: { direction: "asc" }, where: { date: { lt: start } }, _sum: { amount: true } }),
    prisma.transaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const opening = openingTransactionBalance(previous.map((group) => ({ direction: group.direction, amount: Number(group._sum?.amount ?? 0) })));
  const report = buildMonthlyTransactionReport(transactions.map((entry) => {
    const rentLease = entry.tenantLease ?? entry.rentPayment?.tenantLease;
    const utility = entry.utilityBill;
    return {
      ...entry, amount: Number(entry.amount), propertyName: entry.property?.name ?? null,
      unitLabel: entry.unit?.label ?? rentLease?.unit.label ?? utility?.unit?.label ?? null,
      relatedName: rentLease?.tenant.name ?? entry.payrollRecord?.employee.name ?? entry.guestStay?.guestName ?? (utility ? utilityReportTenant({
        linkedTenantName: utility.tenantLease?.tenant.name ?? null, billDate: utility.dueDate,
        leases: (utility.unit?.tenantLeases ?? []).map((lease) => ({ ...lease, tenantName: lease.tenant.name })),
      }) : null),
    };
  }), opening);
  const firstMonth = earliest ? dhakaISO(earliest.date).slice(0, 7) : currentMonth;
  const history = firstMonth <= currentMonth ? paymentMonthRange(firstMonth, currentMonth, 600) : [];
  return { ...report, month, months: [...new Set([month, currentMonth, ...history])].sort().reverse() };
}
