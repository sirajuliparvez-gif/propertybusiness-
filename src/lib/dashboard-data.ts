import { dhakaNow } from "@/lib/dhaka-time";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isIncomeType, isExpenseType } from "@/lib/finance-types";
import { getAllTenantsData } from "@/lib/tenants-data";
import { getAllStaffData } from "@/lib/employees-data";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { isMonthPastDue, RENT_DUE_DAY, SALARY_DUE_DAY } from "@/lib/rent-ledger";

const DAYS_AHEAD = 7; // "expiring/due soon" window

function daysFromNow(days: number) {
  const d = dhakaNow();
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Wrapped in React's per-request cache() since both the root layout (for the
// notification bell) and the dashboard page independently need this data —
// cache() dedupes identical calls within the same request into one DB round trip.
export const getActionRequiredData = cache(async function getActionRequiredData() {
  const now = dhakaNow();
  const today = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rentPastDueNow = isMonthPastDue(currentMonth, RENT_DUE_DAY, now);
  const salaryPastDueNow = isMonthPastDue(currentMonth, SALARY_DUE_DAY, now);
  const todayStart = startOfDay(now);

  const [
    rentDue,
    utilityDue,
    downpaymentExhausted,
    payrollDue,
    vacantUnits,
    agreementsExpiring,
    tenantLeaseExpiring,
    missingTenantNid,
    tenantLeasesMissingAgreement,
    ownerAgreementsMissingDocument,
    guestCheckIns,
    guestCheckOuts,
  ] = await Promise.all([
    // Recorded rent months still owing something and already past the 10th
    // (months nobody recorded at all come from the lease-based query below).
    prisma.rentPayment.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        month: rentPastDueNow ? { lte: currentMonth } : { lt: currentMonth },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
      include: {
        tenantLease: {
          include: {
            tenant: { select: { name: true } },
            unit: {
              include: { unitType: { include: { property: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    // Utility bills due soon or overdue (partly paid ones still owe the rest)
    prisma.utilityBill.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lte: daysFromNow(DAYS_AHEAD) },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
      include: {
        property: { select: { name: true } },
        tenantLease: { include: { tenant: { select: { name: true } } } },
      },
    }),
    // Downpayment balance exhausted (<=0) on active leases
    prisma.tenantLease.findMany({
      where: { status: "ACTIVE", currentDownpaymentBalance: { lte: 0 } },
      take: 20,
      include: {
        tenant: { select: { name: true } },
        unit: {
          include: { unitType: { include: { property: { select: { name: true } } } } },
        },
      },
    }),
    // Recorded salary months still owing something and already past the 15th. Fully
    // unpaid staff come from the employee-based query below: a PayrollRecord row
    // only exists once a payment has been recorded.
    prisma.payrollRecord.findMany({
      where: {
        status: { in: ["PARTIAL", "PENDING"] },
        month: salaryPastDueNow ? { lte: currentMonth } : { lt: currentMonth },
        employee: { status: "ACTIVE" },
      },
      take: 100,
      include: { employee: { include: { property: { select: { name: true } } } } },
    }),
    // Vacant units (no active tenant lease)
    prisma.unit.findMany({
      where: { tenantLeases: { none: { status: "ACTIVE" } } },
      take: 20,
      include: { unitType: { include: { property: { select: { name: true } } } } },
    }),
    // Owner lease agreements expiring soon
    prisma.ownerLeaseAgreement.findMany({
      where: {
        status: "ACTIVE",
        endDate: { not: null, lte: daysFromNow(30) },
      },
      orderBy: { endDate: "asc" },
      take: 20,
      include: { property: { select: { name: true } } },
    }),
    // Tenant leases ending soon (renew or find a new tenant)
    prisma.tenantLease.findMany({
      where: {
        status: "ACTIVE",
        endDate: { not: null, lte: daysFromNow(30) },
      },
      orderBy: { endDate: "asc" },
      take: 20,
      include: {
        tenant: { select: { name: true } },
        unit: { include: { unitType: { include: { property: { select: { name: true } } } } } },
      },
    }),
    // Individual tenants missing NID (KYC incomplete)
    prisma.tenant.findMany({
      where: { type: "INDIVIDUAL", nidNumber: null },
      take: 20,
      select: { id: true, name: true },
    }),
    // Active tenant leases with no uploaded agreement document
    prisma.tenantLease.findMany({
      where: { status: "ACTIVE", documents: { none: {} } },
      take: 20,
      include: {
        tenant: { select: { name: true } },
        unit: { include: { unitType: { include: { property: { select: { name: true } } } } } },
      },
    }),
    // Active owner lease agreements with no uploaded document
    prisma.ownerLeaseAgreement.findMany({
      where: { status: "ACTIVE", documents: { none: {} } },
      take: 20,
      include: { property: { select: { name: true } } },
    }),
    // Hotel guests checking in today
    prisma.guestStay.findMany({
      where: {
        status: "RESERVED",
        checkInDate: { gte: startOfDay(today), lte: endOfDay(today) },
      },
      take: 20,
      include: {
        unit: { include: { unitType: { include: { property: { select: { name: true } } } } } },
      },
    }),
    // Hotel guests checking out today
    prisma.guestStay.findMany({
      where: {
        status: "CHECKED_IN",
        checkOutDate: { gte: startOfDay(today), lte: endOfDay(today) },
      },
      take: 20,
      include: {
        unit: { include: { unitType: { include: { property: { select: { name: true } } } } } },
      },
    }),
  ]);

  // Second batch: what the first queries cannot see (rent months with no row at
  // all, staff nobody has paid yet) plus true totals, because each list above is
  // capped at 20 rows and the tab badges must show the real number.
  const unrecordedRentWhere = {
    status: "ACTIVE" as const,
    monthlyRentAmount: { gt: 0 },
    rentPayments: { none: { month: currentMonth } },
  };
  const utilityWhere = {
    status: { in: ["UNPAID" as const, "PARTIAL" as const] },
    dueDate: { lte: daysFromNow(DAYS_AHEAD) },
  };
  const [
    unrecordedRent,
    unrecordedRentCount,
    rowRentCount,
    unpaidEmployees,
    utilityCount,
    vacantCount,
    tenantExpiringCount,
    agreementExpiringCount,
    nidCount,
    tenantDocCount,
    ownerDocCount,
  ] = await Promise.all([
    rentPastDueNow
      ? prisma.tenantLease.findMany({
          where: unrecordedRentWhere,
          take: 20,
          include: {
            tenant: { select: { name: true } },
            unit: { include: { unitType: { include: { property: { select: { name: true } } } } } },
          },
        })
      : Promise.resolve([]),
    rentPastDueNow ? prisma.tenantLease.count({ where: unrecordedRentWhere }) : Promise.resolve(0),
    prisma.rentPayment.count({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        month: rentPastDueNow ? { lte: currentMonth } : { lt: currentMonth },
      },
    }),
    salaryPastDueNow
      ? prisma.employee.findMany({
          where: { status: "ACTIVE", payrollRecords: { none: { month: currentMonth } } },
          take: 100,
          include: { property: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.utilityBill.count({ where: utilityWhere }),
    prisma.unit.count({ where: { tenantLeases: { none: { status: "ACTIVE" } } } }),
    prisma.tenantLease.count({ where: { status: "ACTIVE", endDate: { not: null, lte: daysFromNow(30) } } }),
    prisma.ownerLeaseAgreement.count({
      where: { status: "ACTIVE", endDate: { not: null, lte: daysFromNow(30) } },
    }),
    prisma.tenant.count({ where: { type: "INDIVIDUAL", nidNumber: null } }),
    prisma.tenantLease.count({ where: { status: "ACTIVE", documents: { none: {} } } }),
    prisma.ownerLeaseAgreement.count({ where: { status: "ACTIVE", documents: { none: {} } } }),
  ]);

  return {
    counts: {
      rentDue: rowRentCount + unrecordedRentCount,
      utilityDue: utilityCount,
      payrollDue: payrollDue.length + unpaidEmployees.length,
      vacantUnits: vacantCount,
      agreementsExpiring: agreementExpiringCount,
      tenantLeaseExpiring: tenantExpiringCount,
      missingDocuments: nidCount + tenantDocCount + ownerDocCount,
    },
    rentDue: [
      ...rentDue.map((r) => ({
      id: r.id,
      tenantName: r.tenantLease.tenant.name,
      propertyName: r.tenantLease.unit.unitType.property.name,
      unitLabel: r.tenantLease.unit.label,
      amount: Number(r.dueAmount) - Number(r.paidAmount),
      dueDate: r.dueDate,
      overdue: isMonthPastDue(r.month, RENT_DUE_DAY, now),
    })),
      ...unrecordedRent.map((l) => {
        const rent = Number(l.monthlyRentAmount);
        return {
          id: `lease-${l.id}`,
          tenantName: l.tenant.name,
          propertyName: l.unit.unitType.property.name,
          unitLabel: l.unit.label,
          amount:
            rent +
            computeServiceChargeAmount(
              rent,
              l.serviceChargeType,
              l.serviceChargeValue != null ? Number(l.serviceChargeValue) : null
            ),
          dueDate: new Date(now.getFullYear(), now.getMonth(), RENT_DUE_DAY),
          overdue: true,
        };
      }),
    ],
    utilityDue: utilityDue.map((u) => ({
      id: u.id,
      propertyName: u.property.name,
      tenantName: u.tenantLease?.tenant.name ?? null,
      type: u.type,
      amount: Number(u.amount) - Number(u.paidAmount),
      dueDate: u.dueDate,
      // A bill dated today is not late until tomorrow.
      overdue: u.dueDate < todayStart,
    })),
    downpaymentExhausted: downpaymentExhausted.map((t) => ({
      id: t.id,
      tenantName: t.tenant.name,
      propertyName: t.unit.unitType.property.name,
      unitLabel: t.unit.label,
      balance: Number(t.currentDownpaymentBalance),
    })),
    payrollDue: [
      ...payrollDue.map((p) => ({
        id: p.id,
        employeeName: p.employee.name,
        // Company-level staff (no property) — same fallback label used across
        // the Staff pages, so this reads consistently everywhere.
        propertyName: p.employee.property?.name ?? "কোম্পানি স্টাফ",
        amount: Number(p.dueAmount ?? p.employee.salaryAmount) - Number(p.amountPaid),
        dueDate: p.dueDate,
        overdue: true,
      })),
      ...unpaidEmployees.map((e) => ({
        id: `emp-${e.id}`,
        employeeName: e.name,
        propertyName: e.property?.name ?? "কোম্পানি স্টাফ",
        amount: Number(e.salaryAmount),
        dueDate: new Date(now.getFullYear(), now.getMonth(), SALARY_DUE_DAY),
        overdue: true,
      })),
    ],
    vacantUnits: vacantUnits.map((u) => ({
      id: u.id,
      unitLabel: u.label,
      propertyName: u.unitType.property.name,
      unitTypeLabel: u.unitType.label,
    })),
    agreementsExpiring: agreementsExpiring.map((a) => ({
      id: a.id,
      propertyName: a.property.name,
      endDate: a.endDate!,
    })),
    tenantLeaseExpiring: tenantLeaseExpiring.map((l) => ({
      id: l.id,
      tenantName: l.tenant.name,
      propertyName: l.unit.unitType.property.name,
      unitLabel: l.unit.label,
      endDate: l.endDate!,
    })),
    missingDocuments: [
      ...missingTenantNid.map((t) => ({
        id: `tenant-nid-${t.id}`,
        label: t.name,
        reason: "missingNid" as const,
      })),
      ...tenantLeasesMissingAgreement.map((l) => ({
        id: `lease-doc-${l.id}`,
        label: `${l.tenant.name} · ${l.unit.unitType.property.name}`,
        reason: "missingTenantAgreement" as const,
      })),
      ...ownerAgreementsMissingDocument.map((a) => ({
        id: `owner-doc-${a.id}`,
        label: a.property.name,
        reason: "missingOwnerAgreement" as const,
      })),
    ],
    guestCheckIns: guestCheckIns.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      propertyName: g.unit.unitType.property.name,
      unitLabel: g.unit.label,
    })),
    guestCheckOuts: guestCheckOuts.map((g) => ({
      id: g.id,
      guestName: g.guestName,
      propertyName: g.unit.unitType.property.name,
      unitLabel: g.unit.label,
    })),
  };
});

export type ActionRequiredData = Awaited<ReturnType<typeof getActionRequiredData>>;

// ---- Financial analytics ----

const TRANSACTION_TYPE_TO_CATEGORY: Record<string, string> = {
  RENT_PAID_TO_OWNER: "ownerRent",
  DOWNPAYMENT_PAID_TO_OWNER: "ownerRent",
  PAYROLL_EXPENSE: "payroll",
  UTILITY_EXPENSE: "utility",
  MAINTENANCE_EXPENSE: "maintenance",
  DOWNPAYMENT_REFUND_TO_TENANT: "refund",
  GUEST_DEPOSIT_REFUND: "refund",
  OTHER: "other",
};

export async function getMonthlyFinancials(monthsBack = 12) {
  const now = dhakaNow();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start } },
    select: { date: true, amount: true, type: true },
  });

  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (isIncomeType(tx.type)) bucket.income += Number(tx.amount);
    else if (isExpenseType(tx.type)) bucket.expense += Number(tx.amount);
  }

  return Array.from(buckets.entries()).map(([month, v]) => ({
    month,
    income: v.income,
    expense: v.expense,
    net: v.income - v.expense,
  }));
}

export async function getYearlyFinancials(yearsBack = 3) {
  const now = dhakaNow();
  const start = new Date(now.getFullYear() - (yearsBack - 1), 0, 1);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start } },
    select: { date: true, amount: true, type: true },
  });

  const buckets = new Map<number, { income: number; expense: number }>();
  for (let i = 0; i < yearsBack; i++) {
    buckets.set(now.getFullYear() - (yearsBack - 1) + i, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const bucket = buckets.get(tx.date.getFullYear());
    if (!bucket) continue;
    if (isIncomeType(tx.type)) bucket.income += Number(tx.amount);
    else if (isExpenseType(tx.type)) bucket.expense += Number(tx.amount);
  }

  return Array.from(buckets.entries()).map(([year, v]) => ({
    year: String(year),
    income: v.income,
    expense: v.expense,
    net: v.income - v.expense,
  }));
}

export async function getPropertyPerformance() {
  const properties = await prisma.property.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      transactions: {
        select: { type: true, direction: true, amount: true },
      },
    },
  });

  const performance = properties.map((p) => {
    let income = 0;
    let expense = 0;
    const expenseByCategory: Record<string, number> = {};

    for (const tx of p.transactions) {
      const amount = Number(tx.amount);
      if (isIncomeType(tx.type)) {
        income += amount;
      } else if (isExpenseType(tx.type)) {
        expense += amount;
        const category = TRANSACTION_TYPE_TO_CATEGORY[tx.type] ?? "other";
        expenseByCategory[category] = (expenseByCategory[category] ?? 0) + amount;
      }
    }

    const topExpenseCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];

    return {
      id: p.id,
      name: p.name,
      income,
      expense,
      net: income - expense,
      topExpenseCategory: topExpenseCategory
        ? { category: topExpenseCategory[0], amount: topExpenseCategory[1] }
        : null,
      expenseByCategory,
    };
  });

  return performance.sort((a, b) => b.net - a.net);
}

// ---- Total outstanding (arrears already past due, across categories) ----

export async function getTotalOutstanding() {
  // Every component comes from the same source the matching page uses, so the
  // dashboard total can never disagree with the Rent, Utility Bills and Staff
  // pages: rent past the 10th (ledger-based), every bill still owing, and the
  // salary that is still unpaid.
  const [tenantsData, staffData, utilityAgg] = await Promise.all([
    getAllTenantsData(),
    getAllStaffData(),
    prisma.utilityBill.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
    }),
  ]);

  const rent = tenantsData.totalPastDueRent;
  const utility = Number(utilityAgg._sum.amount ?? 0) - Number(utilityAgg._sum.paidAmount ?? 0);
  const payroll = staffData.totalPastDuePayroll;

  return { total: rent + utility + payroll, rent, utility, payroll };
}

// ---- Occupancy ----

export async function getOccupancyStats() {
  const [totalUnits, occupiedUnits, checkedInGuests] = await Promise.all([
    prisma.unit.count(),
    prisma.unit.count({ where: { tenantLeases: { some: { status: "ACTIVE" } } } }),
    prisma.guestStay.count({ where: { status: "CHECKED_IN" } }),
  ]);

  return {
    totalUnits,
    occupiedUnits,
    occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    checkedInGuests,
  };
}

// ---- Cash flow forecast (next 30 days) ----

export async function getCashFlowForecast() {
  const now = dhakaNow();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [tenantsData, staffData, companyBillAgg, ownerRentPaid, ownerRentDue] = await Promise.all([
    getAllTenantsData(),
    getAllStaffData(),
    // Only bills the company bears itself are a real outflow — tenant-billed
    // ones are reimbursed, a pass-through that nets to zero (see finance-types).
    prisma.utilityBill.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { status: { in: ["UNPAID", "PARTIAL"] }, paidByCompany: true },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "RENT_PAID_TO_OWNER", date: { gte: monthStart, lt: monthEnd } },
    }),
    // Approximate owner rent obligation for the period, per active Property —
    // prefers the active agreement's fixedMonthlyRentAmount (whole-property
    // lease) over summing per-UnitType owner rent when both could apply.
    prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: {
        unitTypes: {
          select: {
            ownerRentAmount: true,
            units: { select: { ownerRentAmount: true } },
          },
        },
        ownerLeaseAgreements: {
          where: { status: "ACTIVE" },
          take: 1,
          select: { fixedMonthlyRentAmount: true },
        },
      },
    }),
  ]);

  // Rent still to collect, from the ledger (recorded and unrecorded months alike).
  const incoming = tenantsData.totalOverdueRent;
  const outgoingUtility =
    Number(companyBillAgg._sum.amount ?? 0) - Number(companyBillAgg._sum.paidAmount ?? 0);
  const outgoingPayroll = staffData.totalOverduePayroll;
  const ownerRentTotal = ownerRentDue.reduce((sum, property) => {
    const fixedRent = property.ownerLeaseAgreements[0]?.fixedMonthlyRentAmount;
    if (fixedRent != null) return sum + Number(fixedRent);
    return (
      sum +
      property.unitTypes.reduce(
        (s, ut) =>
          s +
          ut.units.reduce(
            (us, u) => us + Number(u.ownerRentAmount ?? ut.ownerRentAmount ?? 0),
            0
          ),
        0
      )
    );
  }, 0);
  // Owner rent already paid this month is no longer a future outflow.
  const outgoingOwnerRent = Math.max(0, ownerRentTotal - Number(ownerRentPaid._sum.amount ?? 0));
  const outgoing = outgoingUtility + outgoingPayroll + outgoingOwnerRent;

  return {
    incoming,
    outgoing,
    net: incoming - outgoing,
    breakdown: {
      rentIncoming: incoming,
      utilityOutgoing: outgoingUtility,
      payrollOutgoing: outgoingPayroll,
      ownerRentOutgoing: outgoingOwnerRent,
    },
  };
}

// ---- Global search ----

export async function searchEverything(query: string) {
  if (!query || query.trim().length < 2) {
    return { properties: [], tenants: [] };
  }
  const q = query.trim();

  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ name: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }],
      },
      take: 8,
      select: { id: true, name: true, address: true },
    }),
    prisma.tenant.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { contactInfo: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, name: true, contactInfo: true },
    }),
  ]);

  return { properties, tenants };
}

// ---- Notification bell (topbar) ----
// Flattens the same ActionRequiredData used on the dashboard into one
// urgency-sorted list — single source of truth for both the in-app bell
// and (eventually) the Telegram notifications built from the same data.

export type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  tone: "destructive" | "warning";
  href: string;
};

export function toNotificationList(data: ActionRequiredData): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const r of data.rentDue) {
    items.push({
      id: `rent-${r.id}`,
      title: `${r.tenantName} · ${r.propertyName}`,
      subtitle: r.overdue ? "Rent overdue" : "Rent due soon",
      tone: r.overdue ? "destructive" : "warning",
      href: "/rent",
    });
  }
  for (const u of data.utilityDue) {
    items.push({
      id: `utility-${u.id}`,
      title: u.propertyName,
      subtitle: u.overdue ? "Utility bill overdue" : "Utility bill due soon",
      tone: u.overdue ? "destructive" : "warning",
      href: "/utility-bills",
    });
  }
  for (const d of data.downpaymentExhausted) {
    items.push({
      id: `dp-${d.id}`,
      title: `${d.tenantName} · ${d.propertyName}`,
      subtitle: "Advance balance exhausted",
      tone: "destructive",
      href: "/tenants",
    });
  }
  for (const p of data.payrollDue) {
    items.push({
      id: `payroll-${p.id}`,
      title: `${p.employeeName} · ${p.propertyName}`,
      subtitle: p.overdue ? "Payroll overdue" : "Payroll due soon",
      tone: p.overdue ? "destructive" : "warning",
      href: "/employees",
    });
  }
  for (const a of data.agreementsExpiring) {
    items.push({
      id: `oa-${a.id}`,
      title: a.propertyName,
      subtitle: "Owner agreement expiring",
      tone: "warning",
      href: "/properties",
    });
  }
  for (const l of data.tenantLeaseExpiring) {
    items.push({
      id: `tl-${l.id}`,
      title: `${l.tenantName} · ${l.propertyName}`,
      subtitle: "Tenant lease ending",
      tone: "warning",
      href: "/tenants",
    });
  }
  for (const m of data.missingDocuments) {
    items.push({
      id: m.id,
      title: m.label,
      subtitle: "Missing document",
      tone: "destructive",
      href: "/tenants",
    });
  }
  for (const g of data.guestCheckIns) {
    items.push({
      id: `in-${g.id}`,
      title: `${g.guestName} · ${g.propertyName}`,
      subtitle: "Checking in today",
      tone: "warning",
      href: "/guest-stays",
    });
  }
  for (const g of data.guestCheckOuts) {
    items.push({
      id: `out-${g.id}`,
      title: `${g.guestName} · ${g.propertyName}`,
      subtitle: "Checking out today",
      tone: "warning",
      href: "/guest-stays",
    });
  }

  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "destructive" ? -1 : 1));
}
