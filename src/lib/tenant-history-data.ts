import { prisma } from "@/lib/prisma";
import { dhakaISO, dhakaTodayISO } from "@/lib/dhaka-time";
import { numericRentRates } from "@/lib/rent-terms";
import { buildMonthlyRentReport } from "@/lib/monthly-rent-report";
import { LEDGER_START_MONTH } from "@/lib/rent-ledger";
import { paymentMonthRange } from "@/lib/payment-month";
import { matchingUtilityLease } from "@/lib/monthly-utility-report";

export async function getTenantHistory(leaseId: string) {
  const selected = await prisma.tenantLease.findUnique({ where: { id: leaseId }, select: { tenantId: true } });
  if (!selected) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: selected.tenantId },
    include: {
      documents: { orderBy: { uploadedAt: "desc" } },
      leases: {
        orderBy: [{ startDate: "desc" }, { id: "asc" }],
        include: {
          unit: { select: { label: true, unitType: { select: { property: { select: { name: true, deletedAt: true } } } } } },
          documents: { orderBy: { uploadedAt: "desc" } },
          rentRates: { orderBy: { effectiveMonth: "asc" } },
          rentPayments: { include: { downpaymentAdjustments: { select: { amountAdjusted: true } } } },
          downpaymentAdjustments: { include: { rentPayment: { select: { month: true } } } },
        },
      },
    },
  });
  if (!tenant) return null;

  const leaseIds = tenant.leases.map(({ id }) => id);
  const unitIds = [...new Set(tenant.leases.map(({ unitId }) => unitId))];
  const bills = await prisma.utilityBill.findMany({
    where: { OR: [
      { tenantLeaseId: { in: leaseIds } },
      { tenantLeaseId: null, unitId: { in: unitIds } },
    ] },
    orderBy: [{ month: "desc" }, { dueDate: "desc" }],
    include: {
      unit: { select: { tenantLeases: { select: { id: true, startDate: true, endDate: true, movedOutAt: true, status: true } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  const billsByLease = new Map<string, typeof bills>();
  const billLeaseIds = new Map<string, string>();
  for (const bill of bills) {
    const id = bill.tenantLeaseId ?? matchingUtilityLease(bill.dueDate, bill.unit?.tenantLeases ?? [])?.id;
    if (!id || !leaseIds.includes(id)) continue;
    const rows = billsByLease.get(id) ?? [];
    rows.push(bill);
    billsByLease.set(id, rows);
    billLeaseIds.set(bill.id, id);
  }

  const transactions = await prisma.transaction.findMany({
    where: { OR: [
      { tenantLeaseId: { in: leaseIds } },
      { tenantLeaseId: null, rentPayment: { tenantLeaseId: { in: leaseIds } } },
      { tenantLeaseId: null, utilityBillId: { in: [...billLeaseIds.keys()] } },
    ] },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      rentPayment: { select: { month: true, tenantLeaseId: true } },
      utilityBill: { select: { month: true } },
      recordedBy: { select: { name: true } },
    },
  });
  const transactionsByLease = new Map<string, typeof transactions>();
  for (const entry of transactions) {
    const id = entry.tenantLeaseId ?? entry.rentPayment?.tenantLeaseId ?? billLeaseIds.get(entry.utilityBillId ?? "");
    if (!id) continue;
    const rows = transactionsByLease.get(id) ?? [];
    rows.push(entry);
    transactionsByLease.set(id, rows);
  }

  const currentMonth = dhakaTodayISO().slice(0, 7);
  const leases = tenant.leases.map((lease) => {
    const property = lease.unit.unitType.property;
    const rentRates = numericRentRates(lease.rentRates);
    const recorded = new Map(lease.rentPayments.map((payment) => [payment.month, {
      dueAmount: Number(payment.dueAmount),
      paidAmount: Number(payment.paidAmount),
      adjustments: payment.downpaymentAdjustments.map(({ amountAdjusted }) => Number(amountAdjusted)),
    }]));
    const start = dhakaISO(lease.startDate).slice(0, 7);
    const endDate = lease.movedOutAt ?? lease.endDate;
    const end = lease.status === "ACTIVE" ? currentMonth : endDate ? dhakaISO(endDate).slice(0, 7) : "";
    const firstTrackedMonth = start > LEDGER_START_MONTH ? start : LEDGER_START_MONTH;
    const lastTrackedMonth = end > currentMonth ? currentMonth : end;
    const tracked = firstTrackedMonth <= lastTrackedMonth
      ? paymentMonthRange(firstTrackedMonth, lastTrackedMonth, 600)
      : [];
    const months = [...new Set([...tracked, ...recorded.keys()])].sort().reverse();
    const rentRows = months.flatMap((month) => {
      const report = buildMonthlyRentReport([{
        ...lease,
        tenantName: tenant.name,
        propertyName: property.name,
        unitLabel: lease.unit.label,
        propertyDeleted: property.deletedAt != null,
        monthlyRentAmount: Number(lease.monthlyRentAmount),
        serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
        rentRates,
        payment: recorded.get(month) ?? null,
      }], month);
      return report.rows.map((row) => ({ ...row, month }));
    });
    return {
      id: lease.id,
      propertyName: property.name,
      unitLabel: lease.unit.label,
      status: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate,
      movedOutAt: lease.movedOutAt,
      notes: lease.notes,
      initialDownpayment: Number(lease.initialDownpaymentAmount),
      downpaymentBalance: Number(lease.currentDownpaymentBalance),
      rentRows,
      rentRates,
      documents: lease.documents,
      adjustments: lease.downpaymentAdjustments,
      bills: billsByLease.get(lease.id) ?? [],
      transactions: transactionsByLease.get(lease.id) ?? [],
    };
  });
  return { name: tenant.name, documents: tenant.documents, currentMonth, leases };
}
