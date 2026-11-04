import { resolveListMonth, listMonthOptions } from "@/lib/list-month";
import { dhakaISO } from "@/lib/dhaka-time";
import { prisma } from "@/lib/prisma";
import { INCOME_TYPES, EXPENSE_TYPES } from "@/lib/finance-types";
import { isDirectlyEditableTransactionType } from "@/lib/transaction-edit";

export async function getAllTransactionsData(requestedMonth?: string) {
  const scope = resolveListMonth(requestedMonth);
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true,
      type: true,
      direction: true,
      amount: true,
      method: true,
      notes: true,
      date: true,
      propertyId: true,
      property: { select: { name: true } },
      unit: { select: { label: true } },
      tenantLease: { select: { tenant: { select: { id: true, name: true } } } },
      payrollRecord: { select: { employee: { select: { id: true, name: true } } } },
      guestStay: { select: { id: true, guestName: true } },
      rentPaymentId: true,
      payrollRecordId: true,
      utilityBillId: true,
      ownerRentPaymentId: true,
      tenantLeaseId: true,
      guestStayId: true,
    },
  });

  const rows = transactions.map((t) => {
    const isProfitAffecting =
      (INCOME_TYPES as readonly string[]).includes(t.type) ||
      (EXPENSE_TYPES as readonly string[]).includes(t.type);
    return {
      id: t.id,
      type: t.type,
      direction: t.direction,
      amount: Number(t.amount),
      method: t.method,
      notes: t.notes,
      date: t.date,
      propertyId: t.propertyId,
      // Company-level staff payroll (or any future property-less expense)
      // has no property — same fallback label used across the Staff pages.
      propertyName: t.property?.name ?? "কোম্পানি স্টাফ",
      unitLabel: t.unit?.label ?? null,
      relatedName:
        t.tenantLease?.tenant.name ?? t.payrollRecord?.employee.name ?? t.guestStay?.guestName ?? null,
      isProfitAffecting,
      canEditDirectly:
        isDirectlyEditableTransactionType(t.type) &&
        !(
          t.rentPaymentId ||
          t.payrollRecordId ||
          t.utilityBillId ||
          t.ownerRentPaymentId ||
          t.tenantLeaseId ||
          t.guestStayId
        ),
      sourceHref: t.tenantLease?.tenant.id
        ? `/tenants/${t.tenantLease.tenant.id}`
        : t.payrollRecord?.employee.id
          ? `/employees/${t.payrollRecord.employee.id}`
          : t.utilityBillId
            ? "/utility-bills"
            : t.guestStayId
              ? "/guest-stays"
              : t.propertyId
                ? `/properties/${t.propertyId}`
                : null,
    };
  });

  const scopedRows = scope.selectedMonth ? rows.filter((row) => row.date >= scope.start && row.date < scope.end) : rows;
  const totalIncome = scopedRows
    .filter((r) => (INCOME_TYPES as readonly string[]).includes(r.type))
    .reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = scopedRows
    .filter((r) => (EXPENSE_TYPES as readonly string[]).includes(r.type))
    .reduce((sum, r) => sum + r.amount, 0);

  const properties = Array.from(
    new Map(rows.map((r) => [r.propertyId, r.propertyName])),
    ([id, name]) => ({ id, name })
  );

  return {
    transactions: scopedRows,
    selectedMonth: scope.selectedMonth,
    currentMonth: scope.currentMonth,
    availableMonths: listMonthOptions(rows.map((row) => dhakaISO(row.date).slice(0, 7)), scope.currentMonth, scope.selectedMonth),
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    entryCount: scopedRows.length,
    properties,
  };
}

export type AllTransactionsData = Awaited<ReturnType<typeof getAllTransactionsData>>;

export async function getPropertyUnitOptions() {
  const properties = await prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unitTypes: {
        select: {
          label: true,
          units: { select: { id: true, label: true } },
        },
      },
    },
  });

  return properties.map((p) => ({
    id: p.id,
    name: p.name,
    units: p.unitTypes.flatMap((ut) =>
      ut.units.map((u) => ({ id: u.id, label: u.label, unitTypeLabel: ut.label }))
    ),
  }));
}

export type PropertyUnitOptions = Awaited<ReturnType<typeof getPropertyUnitOptions>>;
