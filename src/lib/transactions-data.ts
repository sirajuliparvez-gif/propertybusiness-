import { prisma } from "@/lib/prisma";

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

// Only these types are real operating income/expense — everything else
// (downpayment movements in every direction, utility bill reimbursement,
// guest deposit refund) is a pass-through/balance-sheet item, excluded from
// these totals for the same reason DOWNPAYMENT_REFUND_TO_TENANT was already
// excluded from netProfit: it's money changing hands, not money earned or
// spent. Still shown as a full row in the ledger table — just not summed
// into the KPI numbers. GUEST_STAY_PAYMENT_RECEIVED is real hotel revenue and
// SERVICE_CHARGE_RECEIVED_FROM_TENANT is a real optional fee, so both count
// as income alongside tenant rent. UTILITY_EXPENSE only ever gets created for
// a bill the company pays itself (paidByCompany), so it's a real cost too —
// UTILITY_REIMBURSEMENT_FROM_TENANT (the normal case) stays excluded.
const INCOME_TYPES = [
  "RENT_RECEIVED_FROM_TENANT",
  "GUEST_STAY_PAYMENT_RECEIVED",
  "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
] as const;
const EXPENSE_TYPES = [
  "RENT_PAID_TO_OWNER",
  "PAYROLL_EXPENSE",
  "UTILITY_EXPENSE",
  "MAINTENANCE_EXPENSE",
  "OTHER",
] as const;

export async function getAllTransactionsData() {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

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
      tenantLease: { select: { tenant: { select: { name: true } } } },
      payrollRecord: { select: { employee: { select: { name: true } } } },
      guestStay: { select: { guestName: true } },
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
    };
  });

  const thisMonth = rows.filter((r) => r.date >= monthStart && r.date < monthEnd);
  const totalIncome = thisMonth
    .filter((r) => (INCOME_TYPES as readonly string[]).includes(r.type))
    .reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = thisMonth
    .filter((r) => (EXPENSE_TYPES as readonly string[]).includes(r.type))
    .reduce((sum, r) => sum + r.amount, 0);

  const properties = Array.from(
    new Map(rows.map((r) => [r.propertyId, r.propertyName])),
    ([id, name]) => ({ id, name })
  );

  return {
    transactions: rows,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    entryCount: thisMonth.length,
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
