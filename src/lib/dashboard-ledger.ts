import { dhakaNow, dhakaMonthKey } from "@/lib/dhaka-time";
import { buildRentLedger, totalOverdue, totalPastDue, isMonthPastDue, RENT_DUE_DAY, SALARY_DUE_DAY, LEDGER_START_MONTH, type ExistingRentPaymentRow } from "@/lib/rent-ledger";
import { collectionRatePercent } from "@/lib/collection-rate";
import { rentTermsDueAmount, resolveRentTermsForMonth, type RentTerms, type EffectiveRentTerms } from "@/lib/rent-terms";

export type DashboardLease = RentTerms & {
  id: string;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  startDate: Date;
  rentRates: EffectiveRentTerms[];
  payments: ExistingRentPaymentRow[];
};

export type DashboardEmployee = {
  joinedAt: Date;
  salaryAmount: number;
  payments: ExistingRentPaymentRow[];
};

// Use the same ledger as the directory pages, including historical rate changes,
// recorded snapshots and the cutover for unrecorded months. No UI-only history
// (payment methods, utility badges or vacant-unit options) is needed here.
// Rent months that were recorded as unpaid or part-paid for tenants who have since moved out.
// A vacated lease is not walked month by month (it owes nothing after it ended, and months nobody
// recorded must not be invented), but rent that was really recorded as still owed stays owed.
export function departedRentDue(rows: ExistingRentPaymentRow[], now = dhakaNow()) {
  let overdue = 0;
  let pastDue = 0;
  for (const row of rows) {
    const gap = Math.max(0, row.dueAmount - row.paidAmount);
    if (gap <= 0) continue;
    overdue += gap;
    if (isMonthPastDue(row.month, RENT_DUE_DAY, now)) pastDue += gap;
  }
  return { overdue, pastDue };
}

export function dashboardLedgerTotals(leases: DashboardLease[], employees: DashboardEmployee[], now = dhakaNow(), departedRent: ExistingRentPaymentRow[] = []) {
  const departed = departedRentDue(departedRent, now);
  let totalPastDueRent = departed.pastDue;
  let totalOverdueRent = departed.overdue;
  for (const lease of leases) {
    const ledger = buildRentLedger(lease.startDate, (month) => rentTermsDueAmount(resolveRentTermsForMonth(lease, lease.rentRates, month)), lease.payments, now, RENT_DUE_DAY);
    totalPastDueRent += totalPastDue(ledger);
    totalOverdueRent += totalOverdue(ledger);
  }
  let totalPastDuePayroll = 0;
  let totalOverduePayroll = 0;
  for (const employee of employees) {
    const ledger = buildRentLedger(employee.joinedAt, employee.salaryAmount, employee.payments, now, SALARY_DUE_DAY);
    totalPastDuePayroll += totalPastDue(ledger);
    totalOverduePayroll += totalOverdue(ledger);
  }
  return { totalPastDueRent, totalOverdueRent, totalPastDuePayroll, totalOverduePayroll };
}

export function dashboardRentCollection(leases: DashboardLease[], month: string, now = dhakaNow()) {
  const currentMonth = dhakaMonthKey(now);
  const payments = leases.flatMap((lease) => {
    const row = lease.payments.find((payment) => payment.month === month);
    if (!row && month < LEDGER_START_MONTH) return [];
    const startMonth = `${lease.startDate.getFullYear()}-${String(lease.startDate.getMonth() + 1).padStart(2, "0")}`;
    if (!row && startMonth > month) return [];
    // Match Rent Collection: recorded monthly bills win over today's terms.
    const due = row?.dueAmount ?? rentTermsDueAmount(resolveRentTermsForMonth(lease, lease.rentRates, currentMonth));
    const paid = row?.paidAmount ?? 0;
    const remaining = Math.max(0, due - paid);
    const pastDue = remaining > 0 && isMonthPastDue(month, RENT_DUE_DAY, now);
    return [{
      id: lease.id, tenantName: lease.tenantName, propertyName: lease.propertyName, unitLabel: lease.unitLabel,
      rentStatus: row?.status ?? "UNPAID" as const,
      rentPastDue: pastDue, pastDueAmount: pastDue ? remaining : 0,
      selectedDueAmount: due, selectedPaidAmount: paid, overdueAmount: remaining,
    }];
  });
  const totalDue = payments.reduce((sum, payment) => sum + payment.selectedDueAmount, 0);
  const totalCollected = payments.reduce((sum, payment) => sum + payment.selectedPaidAmount, 0);
  return {
    payments,
    selectedMonth: month,
    totalDue,
    totalCollected,
    totalRemaining: payments.reduce((sum, payment) => sum + payment.overdueAmount, 0),
    collectionRate: collectionRatePercent(totalCollected, totalDue),
  };
}
