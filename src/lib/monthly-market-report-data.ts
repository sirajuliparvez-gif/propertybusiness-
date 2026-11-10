import { dhakaTodayISO } from "@/lib/dhaka-time";
import { EXPENSE_TYPES, INCOME_TYPES } from "@/lib/finance-types";
import { getMonthlyRentReport } from "@/lib/monthly-rent-report-data";
import { buildMonthlyTransactionReport, transactionReportRange } from "@/lib/monthly-transaction-report";
import { isPaymentMonth, previousPaymentMonth } from "@/lib/payment-month";
import { prisma } from "@/lib/prisma";

export async function getMonthlyMarketReport(requestedMonth?: string, propertyId?: string) {
  const currentMonth = dhakaTodayISO().slice(0, 7);
  const month = isPaymentMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const markets = await prisma.property.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, address: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const market = markets.find((item) => item.id === propertyId) ?? null;
  if (!markets.length) return { month, prevMonth: previousPaymentMonth(month), currentMonth, markets, market, report: null };
  const selectedMarkets = market ? [market] : markets;
  const propertyIds = selectedMarkets.map(({ id }) => id);

  const { start, end } = transactionReportRange(month);
  const [rent, transactions] = await Promise.all([
    getMonthlyRentReport(month, propertyIds),
    prisma.transaction.findMany({
      where: {
        propertyId: { in: propertyIds },
        date: { gte: start, lt: end },
        OR: [
          { direction: "INCOMING", type: { in: [...INCOME_TYPES] } },
          { direction: "OUTGOING", type: { in: [...EXPENSE_TYPES] } },
        ],
      },
      select: {
        id: true, propertyId: true, type: true, direction: true, amount: true, date: true, createdAt: true, notes: true,
        unit: { select: { label: true } },
        tenantLease: { select: { id: true, tenant: { select: { name: true } }, unit: { select: { label: true } } } },
        rentPayment: { select: { month: true, tenantLease: { select: { id: true, tenant: { select: { name: true } }, unit: { select: { label: true } } } } } },
        payrollRecord: { select: { employee: { select: { name: true } } } },
        utilityBill: { select: { type: true } },
        guestStay: { select: { guestName: true } },
      },
    }),
  ]);
  const cash = buildMonthlyTransactionReport(transactions.map((entry) => ({ ...entry, amount: Number(entry.amount) })), 0);
  const tenantRows = new Map<string, {
    id: string;
    name: string | null;
    unit: string | null;
    receivedCents: number;
    // Cash received this month, split by the billing month it paid for.
    prevMonthCents: number;
    thisMonthCents: number;
    otherMonthsCents: number;
    bill: { due: number; settled: number; remaining: number } | null;
    receiptMonths: Map<string, number>;
  }>(rent.rows.map((row) => [row.id, {
    id: row.id,
    name: row.tenantName,
    unit: row.unitLabel,
    receivedCents: 0,
    prevMonthCents: 0,
    thisMonthCents: 0,
    otherMonthsCents: 0,
    bill: { due: row.due, settled: row.settled, remaining: row.remaining },
    receiptMonths: new Map(),
  }]));
  const prevMonth = previousPaymentMonth(month);

  const marketRows = new Map(selectedMarkets.map(({ id, name }) => [id, {
    id, name, receivedCents: 0, incomeCents: 0, expenseCents: 0, rentRemaining: 0,
  }]));
  for (const bill of rent.rows) {
    const row = marketRows.get(bill.propertyId ?? "");
    if (row) row.rentRemaining += bill.remaining;
  }

  let rentReceivedCents = 0;
  const otherTransactions = cash.rows.flatMap((entry) => {
    const marketRow = marketRows.get(entry.propertyId ?? "");
    const cents = Math.round(entry.amount * 100);
    if (marketRow) {
      if (entry.direction === "INCOMING") marketRow.incomeCents += cents;
      else marketRow.expenseCents += cents;
      if (entry.type === "RENT_RECEIVED_FROM_TENANT") marketRow.receivedCents += cents;
    }
    if (entry.type !== "RENT_RECEIVED_FROM_TENANT") {
      return [{
        ...entry,
        detail: [
          market ? null : marketRow?.name,
          entry.unit?.label,
          entry.payrollRecord?.employee.name ?? entry.guestStay?.guestName ?? entry.tenantLease?.tenant.name,
          entry.notes,
        ].filter(Boolean).join(" · "),
      }];
    }
    const lease = entry.rentPayment?.tenantLease ?? entry.tenantLease;
    const key = lease?.id ?? `unlinked:${entry.id}`;
    let row = tenantRows.get(key);
    if (!row) {
      row = {
        id: key, name: lease?.tenant.name ?? null, unit: lease?.unit.label ?? entry.unit?.label ?? null,
        receivedCents: 0, prevMonthCents: 0, thisMonthCents: 0, otherMonthsCents: 0,
        bill: null, receiptMonths: new Map(),
      };
      tenantRows.set(key, row);
    }
    row.receivedCents += cents;
    rentReceivedCents += cents;
    const billingMonth = entry.rentPayment?.month;
    if (billingMonth === month) row.thisMonthCents += cents;
    else if (billingMonth === prevMonth) row.prevMonthCents += cents;
    else {
      row.otherMonthsCents += cents;
      if (billingMonth) row.receiptMonths.set(billingMonth, (row.receiptMonths.get(billingMonth) ?? 0) + cents);
    }
    return [];
  });

  return {
    month, prevMonth, currentMonth, markets, market,
    report: {
      totals: cash.totals, rentTotals: rent.totals, rentReceived: rentReceivedCents / 100,
      tenants: [...tenantRows.values()].sort((a, b) => (a.unit ?? "").localeCompare(b.unit ?? "", undefined, { numeric: true }) ||
        (a.name ?? "").localeCompare(b.name ?? "")),
      marketRows: [...marketRows.values()],
      otherTransactions,
    },
  };
}
