import { dhakaISO } from "@/lib/dhaka-time";
import { LEDGER_START_MONTH } from "@/lib/rent-ledger";
import { rentTermsDueAmount, resolveRentTermsForMonth, type RentTerms, type EffectiveRentTerms } from "@/lib/rent-terms";

export type ReportLease = RentTerms & {
  id: string;
  tenantName: string;
  propertyId?: string;
  propertyName: string;
  unitLabel: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  movedOutAt: Date | null;
  propertyDeleted: boolean;
  rentRates: EffectiveRentTerms[];
  payment: { dueAmount: number; paidAmount: number; adjustments: number[] } | null;
};

// Billing-month settlement, including later payments. This is not a cash-flow
// report filtered by receipt date. Recorded bills survive move-out/deletion.
export function buildMonthlyRentReport(leases: ReportLease[], month: string) {
  const rows = leases.flatMap((lease) => {
    const end = lease.movedOutAt ?? lease.endDate;
    const overlaps = dhakaISO(lease.startDate).slice(0, 7) <= month &&
      (lease.status === "ACTIVE" || (end != null && dhakaISO(end).slice(0, 7) >= month));
    if (!lease.payment && (!overlaps || lease.propertyDeleted || month < LEDGER_START_MONTH)) return [];

    const due = lease.payment?.dueAmount ?? rentTermsDueAmount(resolveRentTermsForMonth(lease, lease.rentRates, month));
    const settled = lease.payment?.paidAmount ?? 0;
    const adjusted = (lease.payment?.adjustments ?? []).reduce((sum, amount) => sum + amount, 0);
    return [{
      id: lease.id,
      tenantName: lease.tenantName,
      propertyId: lease.propertyId,
      propertyName: lease.propertyName,
      unitLabel: lease.unitLabel,
      due,
      collected: Math.max(0, settled - adjusted),
      adjusted,
      settled,
      remaining: Math.max(0, due - settled),
      credit: Math.max(0, settled - due),
    }];
  }).sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.unitLabel.localeCompare(b.unitLabel, undefined, { numeric: true }) || a.tenantName.localeCompare(b.tenantName));

  const totals = rows.reduce((sum, row) => ({
    due: sum.due + row.due,
    collected: sum.collected + row.collected,
    adjusted: sum.adjusted + row.adjusted,
    settled: sum.settled + row.settled,
    remaining: sum.remaining + row.remaining,
    credit: sum.credit + row.credit,
  }), { due: 0, collected: 0, adjusted: 0, settled: 0, remaining: 0, credit: 0 });
  return { rows, totals };
}
