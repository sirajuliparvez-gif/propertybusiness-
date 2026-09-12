import { prisma } from "@/lib/prisma";
import { buildRentLedger, overdueEntries, totalOverdue } from "@/lib/rent-ledger";

// PayrollStatus has PENDING where RentPaymentStatus has UNPAID (same
// meaning) — normalize so buildRentLedger (written against the rent
// vocabulary) can be reused for salary as-is, and back again for anything
// read out of the ledger and shown/stored as a genuine PayrollStatus.
function toLedgerStatus(status: "PAID" | "PENDING" | "PARTIAL") {
  return status === "PENDING" ? "UNPAID" : status;
}
export function fromLedgerStatus(
  status: "PAID" | "UNPAID" | "PARTIAL" | "ADJUSTED_FROM_DOWNPAYMENT"
): "PAID" | "PENDING" | "PARTIAL" {
  if (status === "UNPAID") return "PENDING";
  if (status === "ADJUSTED_FROM_DOWNPAYMENT") return "PAID";
  return status;
}

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

// Shared by the global staff list (Add Employee's property select) and the
// profile page's Edit dialog (reassigning an employee to a different property).
export async function getActiveProperties() {
  return prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getAllStaffData() {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  const [employees, properties, paidThisMonthAgg] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { joinedAt: "desc" },
      include: {
        property: { select: { id: true, name: true } },
        // Full history, not just the latest month — overdueAmount below
        // needs every row to sum multi-month arrears correctly (a salary
        // nobody ever recorded is still owed, see rent-ledger.ts).
        payrollRecords: {
          orderBy: { dueDate: "desc" },
          select: {
            id: true,
            month: true,
            dueDate: true,
            dueAmount: true,
            status: true,
            amountPaid: true,
            paidAt: true,
            transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true } },
          },
        },
      },
    }),
    getActiveProperties(),
    prisma.transaction.aggregate({
      where: {
        type: "PAYROLL_EXPENSE",
        direction: "OUTGOING",
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const staff = employees.map((e) => {
    const asOf = e.status === "ACTIVE" ? new Date() : (e.terminatedAt ?? new Date());
    const ledger = buildRentLedger(
      e.joinedAt,
      Number(e.salaryAmount),
      e.payrollRecords.map((pr) => ({
        id: pr.id,
        month: pr.month,
        dueDate: pr.dueDate,
        dueAmount: pr.dueAmount != null ? Number(pr.dueAmount) : Number(pr.amountPaid),
        paidAmount: Number(pr.amountPaid),
        status: toLedgerStatus(pr.status),
        paidAt: pr.paidAt,
        method: pr.transactions[0]?.method ?? null,
      })),
      asOf
    );
    const overdue = overdueEntries(ledger);
    const overdueAmount = e.status === "ACTIVE" ? totalOverdue(ledger) : 0;
    const currentEntry = ledger[ledger.length - 1] ?? null;
    return {
      id: e.id,
      name: e.name,
      role: e.role,
      contactInfo: e.contactInfo,
      propertyId: e.property?.id ?? null,
      propertyName: e.property?.name ?? null,
      joinedAt: e.joinedAt,
      terminatedAt: e.terminatedAt,
      salaryAmount: Number(e.salaryAmount),
      status: e.status,
      payrollStatus: e.status === "ACTIVE" ? (currentEntry ? fromLedgerStatus(currentEntry.status) : null) : null,
      paymentMethod: currentEntry?.method ?? null,
      overdueAmount,
      overdueMonths: e.status === "ACTIVE" ? overdue : [],
    };
  });

  const activeStaff = staff.filter((s) => s.status === "ACTIVE");
  const totalMonthlyPayroll = activeStaff.reduce((sum, s) => sum + s.salaryAmount, 0);
  const totalOverduePayroll = activeStaff.reduce((sum, s) => sum + s.overdueAmount, 0);
  const paidThisMonth = Number(paidThisMonthAgg._sum.amount ?? 0);
  const settledThisMonthCount = activeStaff.filter((s) => s.payrollStatus === "PAID").length;
  const payrollSettledRate =
    activeStaff.length > 0 ? Math.round((settledThisMonthCount / activeStaff.length) * 100) : 0;

  return {
    staff,
    totalActiveStaff: activeStaff.length,
    totalMonthlyPayroll,
    paidThisMonth,
    totalOverduePayroll,
    payrollSettledRate,
    properties,
  };
}

export type AllStaffData = Awaited<ReturnType<typeof getAllStaffData>>;

// Full profile for a single employee — mirrors getTenantProfile's shape,
// including the same ledger-based totalDue/remaining (every month from
// joinedAt through now, synthesizing an unpaid one for any month nobody
// ever recorded — see rent-ledger.ts).
export async function getEmployeeProfile(employeeId: string) {
  const [employee, idOrder] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        property: { select: { id: true, name: true } },
        payrollRecords: {
          orderBy: { dueDate: "desc" },
          include: {
            transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true } },
          },
        },
      },
    }),
    // Stable "S-1001"-style display id, ordered by joinedAt — same convention
    // as Tenant's "T-1001" and Property's "P-001" display ids.
    prisma.employee.findMany({ orderBy: { joinedAt: "asc" }, select: { id: true } }),
  ]);
  if (!employee) return null;

  const displayId = `S-${1000 + idOrder.findIndex((e) => e.id === employee.id) + 1}`;

  // Terminated staff stop owing salary the day they left — build the ledger
  // only through then, not all the way to today.
  const ledgerAsOf =
    employee.status === "ACTIVE" ? new Date() : (employee.terminatedAt ?? new Date());
  const ledger = buildRentLedger(
    employee.joinedAt,
    Number(employee.salaryAmount),
    employee.payrollRecords.map((pr) => ({
      id: pr.id,
      month: pr.month,
      dueDate: pr.dueDate,
      dueAmount: pr.dueAmount != null ? Number(pr.dueAmount) : Number(pr.amountPaid),
      paidAmount: Number(pr.amountPaid),
      status: toLedgerStatus(pr.status),
      paidAt: pr.paidAt,
      method: pr.transactions[0]?.method ?? null,
    })),
    ledgerAsOf
  );
  // Newest first, matching the payment-history table's existing convention.
  const payments = [...ledger].reverse().map((entry) => ({
    id: entry.rentPaymentId ?? `virtual-${entry.month}`,
    month: entry.month,
    dueDate: entry.dueDate,
    amountPaid: entry.paidAmount,
    dueAmount: entry.dueAmount,
    status: fromLedgerStatus(entry.status),
    paidAt: entry.paidAt,
    method: entry.method ?? null,
    isVirtual: entry.rentPaymentId === null,
  }));
  const overdueMonths = overdueEntries(ledger);

  const totalDue = ledger.reduce((sum, e) => sum + e.dueAmount, 0);
  const totalPaid = ledger.reduce((sum, e) => sum + e.paidAmount, 0);
  const remaining = totalOverdue(ledger);

  // Recent-6-months window, same rationale as the tenant profile: recent
  // payment habits matter more than the full history for these stats.
  const tracked = payments.slice(0, 6);
  const settled = tracked.filter((p) => p.paidAt != null);
  const onTimeCount = settled.filter((p) => p.paidAt! <= p.dueDate).length;
  const onTimeRate = settled.length > 0 ? Math.round((onTimeCount / settled.length) * 100) : null;
  const avgPaymentDay =
    settled.length > 0
      ? Math.round(settled.reduce((sum, p) => sum + p.paidAt!.getDate(), 0) / settled.length)
      : null;

  const methodCounts = new Map<string, number>();
  settled.forEach((p) => {
    if (p.method) methodCounts.set(p.method, (methodCounts.get(p.method) ?? 0) + 1);
  });
  let preferredMethod: string | null = null;
  let preferredMethodCount = 0;
  methodCounts.forEach((count, method) => {
    if (count > preferredMethodCount) {
      preferredMethodCount = count;
      preferredMethod = method;
    }
  });

  const now = new Date();
  const tenureEnd = employee.terminatedAt ?? now;
  const durationMonths = Math.max(
    0,
    (tenureEnd.getFullYear() - employee.joinedAt.getFullYear()) * 12 +
      (tenureEnd.getMonth() - employee.joinedAt.getMonth())
  );

  return {
    id: employee.id,
    displayId,
    name: employee.name,
    role: employee.role,
    contactInfo: employee.contactInfo,
    nidNumber: employee.nidNumber,
    notes: employee.notes,
    status: employee.status,
    propertyId: employee.property?.id ?? null,
    propertyName: employee.property?.name ?? null,
    salaryAmount: Number(employee.salaryAmount),
    joinedAt: employee.joinedAt,
    terminatedAt: employee.terminatedAt,
    durationMonths,
    payments,
    overdueMonths,
    trackedMonths: tracked.length,
    totalDue,
    totalPaid,
    remaining,
    onTimeRate,
    avgPaymentDay,
    preferredMethod,
    payrollStatus:
      employee.status === "ACTIVE"
        ? ledger.length > 0
          ? fromLedgerStatus(ledger[ledger.length - 1].status)
          : null
        : null,
  };
}

export type EmployeeProfile = NonNullable<Awaited<ReturnType<typeof getEmployeeProfile>>>;
