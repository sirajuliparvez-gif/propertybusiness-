import { cache } from "react";
import { prisma } from "@/lib/prisma";

const DAYS_AHEAD = 7; // "expiring/due soon" window

function daysFromNow(days: number) {
  const d = new Date();
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
  const now = new Date();
  const today = new Date();

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
    // Rent due soon or overdue
    prisma.rentPayment.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lte: daysFromNow(DAYS_AHEAD) },
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
    // Utility bills due soon or overdue
    prisma.utilityBill.findMany({
      where: {
        status: "UNPAID",
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
    // Payroll due soon or pending
    prisma.payrollRecord.findMany({
      where: { status: "PENDING", dueDate: { lte: daysFromNow(DAYS_AHEAD) } },
      orderBy: { dueDate: "asc" },
      take: 20,
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

  return {
    rentDue: rentDue.map((r) => ({
      id: r.id,
      tenantName: r.tenantLease.tenant.name,
      propertyName: r.tenantLease.unit.unitType.property.name,
      unitLabel: r.tenantLease.unit.label,
      amount: Number(r.dueAmount) - Number(r.paidAmount),
      dueDate: r.dueDate,
      overdue: r.dueDate < now,
    })),
    utilityDue: utilityDue.map((u) => ({
      id: u.id,
      propertyName: u.property.name,
      tenantName: u.tenantLease?.tenant.name ?? null,
      type: u.type,
      amount: Number(u.amount),
      dueDate: u.dueDate,
      overdue: u.dueDate < now,
    })),
    downpaymentExhausted: downpaymentExhausted.map((t) => ({
      id: t.id,
      tenantName: t.tenant.name,
      propertyName: t.unit.unitType.property.name,
      unitLabel: t.unit.label,
      balance: Number(t.currentDownpaymentBalance),
    })),
    payrollDue: payrollDue.map((p) => ({
      id: p.id,
      employeeName: p.employee.name,
      // Company-level staff (no property) — same fallback label used across
      // the Staff pages, so this reads consistently everywhere.
      propertyName: p.employee.property?.name ?? "কোম্পানি স্টাফ",
      amount: Number(p.amountPaid),
      dueDate: p.dueDate,
      overdue: p.dueDate < now,
    })),
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
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start } },
    select: { date: true, amount: true, direction: true },
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
    if (tx.direction === "INCOMING") bucket.income += Number(tx.amount);
    else bucket.expense += Number(tx.amount);
  }

  return Array.from(buckets.entries()).map(([month, v]) => ({
    month,
    income: v.income,
    expense: v.expense,
    net: v.income - v.expense,
  }));
}

export async function getYearlyFinancials(yearsBack = 3) {
  const now = new Date();
  const start = new Date(now.getFullYear() - (yearsBack - 1), 0, 1);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start } },
    select: { date: true, amount: true, direction: true },
  });

  const buckets = new Map<number, { income: number; expense: number }>();
  for (let i = 0; i < yearsBack; i++) {
    buckets.set(now.getFullYear() - (yearsBack - 1) + i, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const bucket = buckets.get(tx.date.getFullYear());
    if (!bucket) continue;
    if (tx.direction === "INCOMING") bucket.income += Number(tx.amount);
    else bucket.expense += Number(tx.amount);
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
      if (tx.direction === "INCOMING") {
        income += amount;
      } else {
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
  const now = new Date();

  const [rentAgg, utilityAgg, payrollAgg] = await Promise.all([
    prisma.rentPayment.aggregate({
      _sum: { dueAmount: true, paidAmount: true },
      where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } },
    }),
    prisma.utilityBill.aggregate({
      _sum: { amount: true },
      where: { status: "UNPAID", dueDate: { lt: now } },
    }),
    prisma.payrollRecord.aggregate({
      _sum: { amountPaid: true },
      where: { status: "PENDING", dueDate: { lt: now } },
    }),
  ]);

  const rent = Number(rentAgg._sum.dueAmount ?? 0) - Number(rentAgg._sum.paidAmount ?? 0);
  const utility = Number(utilityAgg._sum.amount ?? 0);
  const payroll = Number(payrollAgg._sum.amountPaid ?? 0);

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
  const now = new Date();
  const horizon = daysFromNow(30);

  const [rentDue, utilityDue, payrollDue, ownerRentDue] = await Promise.all([
    prisma.rentPayment.aggregate({
      _sum: { dueAmount: true, paidAmount: true },
      where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lte: horizon } },
    }),
    prisma.utilityBill.aggregate({
      _sum: { amount: true },
      where: { status: "UNPAID", dueDate: { lte: horizon } },
    }),
    prisma.payrollRecord.aggregate({
      _sum: { amountPaid: true },
      where: { status: "PENDING", dueDate: { lte: horizon } },
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

  const incoming =
    Number(rentDue._sum.dueAmount ?? 0) - Number(rentDue._sum.paidAmount ?? 0);
  const outgoingUtility = Number(utilityDue._sum.amount ?? 0);
  const outgoingPayroll = Number(payrollDue._sum.amountPaid ?? 0);
  const outgoingOwnerRent = ownerRentDue.reduce((sum, property) => {
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
