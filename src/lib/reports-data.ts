import { prisma } from "@/lib/prisma";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Same classification as transactions-data.ts, split one level further here —
// owner rent and payroll each get their own waterfall line (mirroring how
// prominently this app already treats them elsewhere), while utility/
// maintenance/other stay merged into one "other expense" bucket, matching
// properties-data.ts's own NON_CORE_EXPENSE_TYPES grouping. Guest-stay
// revenue and service charge both count as income alongside tenant rent —
// all real operating revenue. UTILITY_EXPENSE only ever gets created for a
// company-paid bill (see payUtilityBill's paidByCompany branch), so it's a
// real cost here too.
const INCOME_TYPES = [
  "RENT_RECEIVED_FROM_TENANT",
  "GUEST_STAY_PAYMENT_RECEIVED",
  "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
] as const;
const OWNER_RENT_TYPE = "RENT_PAID_TO_OWNER";
const PAYROLL_TYPE = "PAYROLL_EXPENSE";
const OTHER_EXPENSE_TYPES = ["UTILITY_EXPENSE", "MAINTENANCE_EXPENSE", "OTHER"] as const;

const MONTHS_BACK = 6;
// Sentinel key for transactions with no propertyId (company-level staff
// payroll — see Employee.propertyId) — grouped as their own synthetic "row"
// in the per-property breakdown instead of silently vanishing.
// NOT exported: this module pulls in the Prisma client, which can't be
// imported into "use client" components — reports-view.tsx keeps its own
// copy of this exact literal instead of sharing an import across that boundary.
const COMPANY_KEY = "__company__";

type Bucket = {
  income: number;
  ownerRent: number;
  payroll: number;
  maintenance: number;
  other: number;
};

function emptyBucket(): Bucket {
  return { income: 0, ownerRent: 0, payroll: 0, maintenance: 0, other: 0 };
}

function deriveMonth(b: Bucket) {
  const otherExpense = b.maintenance + b.other;
  const grossProfit = b.income - b.ownerRent;
  const netProfit = grossProfit - b.payroll - otherExpense;
  const margin = b.income > 0 ? Math.round((netProfit / b.income) * 1000) / 10 : 0;
  return { ...b, otherExpense, grossProfit, netProfit, margin };
}

export async function getReportsData() {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [transactions, properties] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: rangeStart, lt: rangeEnd } },
      select: {
        type: true,
        amount: true,
        date: true,
        propertyId: true,
        property: { select: { name: true, type: true } },
      },
    }),
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  // Fixed 6-month key sequence (oldest → newest) so a month with zero
  // transactions still shows as a real zero bar, not a gap.
  const monthKeys = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1 - i), 1);
    return { key: monthKey(d), date: d };
  });

  const byMonth = new Map<string, Bucket>(monthKeys.map((m) => [m.key, emptyBucket()]));
  // propertyId -> monthKey -> Bucket
  const byPropertyMonth = new Map<string, Map<string, Bucket>>();

  for (const t of transactions) {
    const key = monthKey(t.date);
    const bucket = byMonth.get(key);
    if (!bucket) continue; // outside the 6-month window (shouldn't happen given the query filter)
    const amount = Number(t.amount);

    if ((INCOME_TYPES as readonly string[]).includes(t.type)) bucket.income += amount;
    else if (t.type === OWNER_RENT_TYPE) bucket.ownerRent += amount;
    else if (t.type === PAYROLL_TYPE) bucket.payroll += amount;
    else if ((OTHER_EXPENSE_TYPES as readonly string[]).includes(t.type)) {
      if (t.type === "MAINTENANCE_EXPENSE") bucket.maintenance += amount;
      else bucket.other += amount;
    } else {
      continue; // pass-through types (downpayment/utility reimbursement) never enter the P&L
    }

    const propertyKey = t.propertyId ?? COMPANY_KEY;
    if (!byPropertyMonth.has(propertyKey)) byPropertyMonth.set(propertyKey, new Map());
    const perProperty = byPropertyMonth.get(propertyKey)!;
    if (!perProperty.has(key)) perProperty.set(key, emptyBucket());
    const pBucket = perProperty.get(key)!;
    if ((INCOME_TYPES as readonly string[]).includes(t.type)) pBucket.income += amount;
    else if (t.type === OWNER_RENT_TYPE) pBucket.ownerRent += amount;
    else if (t.type === PAYROLL_TYPE) pBucket.payroll += amount;
    else if (t.type === "MAINTENANCE_EXPENSE") pBucket.maintenance += amount;
    else if ((OTHER_EXPENSE_TYPES as readonly string[]).includes(t.type)) pBucket.other += amount;
  }

  const months = monthKeys.map(({ key, date }) => ({
    month: key,
    date,
    ...deriveMonth(byMonth.get(key)!),
  }));

  // Per-property P&L, one full breakdown per month key, so the client can
  // switch the selected period without another round-trip.
  const propertyPLByMonth = new Map<string, ReturnType<typeof buildPropertyRows>>();
  function buildPropertyRows(key: string) {
    const rows = properties.map((p) => {
      const bucket = byPropertyMonth.get(p.id)?.get(key) ?? emptyBucket();
      return { propertyId: p.id, propertyName: p.name, propertyType: p.type, ...deriveMonth(bucket) };
    });
    // Company-level staff (no property) get their own synthetic row instead
    // of silently vanishing from the breakdown — only shown for a month that
    // actually has one, not padded in as an always-present zero row.
    const companyBucket = byPropertyMonth.get(COMPANY_KEY)?.get(key);
    if (companyBucket) {
      rows.push({
        propertyId: COMPANY_KEY,
        // Client renders a translated label for this row keyed off propertyId
        // === COMPANY_KEY instead of this raw name — kept human-readable here
        // only as a safety fallback, never actually displayed as-is.
        propertyName: "Company staff / admin expense",
        propertyType: null,
        ...deriveMonth(companyBucket),
      });
    }
    return rows.sort((a, b) => b.netProfit - a.netProfit);
  }
  for (const { key } of monthKeys) propertyPLByMonth.set(key, buildPropertyRows(key));

  return {
    months,
    propertyPLByMonth: Object.fromEntries(propertyPLByMonth),
    defaultMonth: monthKeys[monthKeys.length - 1].key,
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReportsData>>;
