import { dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth, paymentMonthRange } from "@/lib/payment-month";
import { LEDGER_START_MONTH, RENT_DUE_DAY, isMonthPastDue } from "@/lib/rent-ledger";
import { buildMonthlyRentReport, type ReportLease } from "@/lib/monthly-rent-report";

export type ArrearsLease = Omit<ReportLease, "payment"> & {
  propertyId: string;
  payments: (NonNullable<ReportLease["payment"]> & { month: string })[];
};

export function resolveArrearsRange(from: string | undefined, to: string | undefined, earliestRecorded: string | null, currentMonth: string) {
  const earliest = isPaymentMonth(earliestRecorded) && earliestRecorded < LEDGER_START_MONTH ? earliestRecorded : LEDGER_START_MONTH;
  const start = isPaymentMonth(from) && from >= earliest && from <= currentMonth ? from : earliest;
  const end = isPaymentMonth(to) && to >= earliest && to <= currentMonth ? to : currentMonth;
  return { from: start > end ? end : start, to: end, earliest };
}

const emptyTotals = () => ({ due: 0, collected: 0, adjusted: 0, settled: 0, remaining: 0, credit: 0, overdue: 0 });

// Reuse monthly reporting rules so snapshots, adjustments, move-outs and
// historical rent rates agree with each month's existing printed report.
export function buildRentArrearsReport(leases: ArrearsLease[], from: string, to: string, includeSettled = false, now = dhakaNow()) {
  const months = paymentMonthRange(from, to, 600);
  const leaseById = new Map(leases.map((lease) => [lease.id, lease]));
  const prepared = leases.map((lease) => ({ lease, byMonth: new Map(lease.payments.map((payment) => [payment.month, payment])) }));
  const tenants = new Map<string, {
    id: string; tenantName: string; propertyId: string; propertyName: string; unitLabel: string; status: string;
    months: (ReturnType<typeof buildMonthlyRentReport>["rows"][number] & { month: string; overdue: number })[];
    totals: ReturnType<typeof emptyTotals>;
  }>();
  for (const month of months) {
    const report = buildMonthlyRentReport(prepared.map(({ lease, byMonth }) => ({ ...lease, payment: byMonth.get(month) ?? null })), month);
    for (const row of report.rows) {
      const tenant = tenants.get(row.id) ?? {
        id: row.id, tenantName: row.tenantName, propertyName: row.propertyName, unitLabel: row.unitLabel,
        propertyId: leaseById.get(row.id)!.propertyId,
        status: leaseById.get(row.id)!.status, months: [], totals: emptyTotals(),
      };
      const overdue = isMonthPastDue(month, RENT_DUE_DAY, now) ? row.remaining : 0;
      tenant.months.push({ ...row, month, overdue });
      for (const key of ["due", "collected", "adjusted", "settled", "remaining", "credit"] as const) tenant.totals[key] += row[key];
      tenant.totals.overdue += overdue;
      tenants.set(row.id, tenant);
    }
  }
  const rows = [...tenants.values()].filter((tenant) => includeSettled || tenant.totals.remaining > 0)
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.unitLabel.localeCompare(b.unitLabel, undefined, { numeric: true }) || a.tenantName.localeCompare(b.tenantName));
  const totals = rows.reduce((sum, row) => {
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += row.totals[key];
    return sum;
  }, emptyTotals());
  return { rows, totals, months, owingTenants: rows.filter((row) => row.totals.remaining > 0).length };
}

export function groupRentArrearsByProperty(rows: ReturnType<typeof buildRentArrearsReport>["rows"]) {
  const groups = new Map<string, { id: string; name: string; rows: typeof rows; totals: ReturnType<typeof emptyTotals> }>();
  for (const row of rows) {
    const group = groups.get(row.propertyId) ?? { id: row.propertyId, name: row.propertyName, rows: [], totals: emptyTotals() };
    group.rows.push(row);
    for (const key of Object.keys(group.totals) as (keyof typeof group.totals)[]) group.totals[key] += row.totals[key];
    groups.set(row.propertyId, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map((group) => ({
    ...group, rows: group.rows.sort((a, b) => b.totals.remaining - a.totals.remaining || a.unitLabel.localeCompare(b.unitLabel, undefined, { numeric: true })),
  }));
}
