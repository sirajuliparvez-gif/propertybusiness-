// Fills the gap between "a RentPayment row exists" and "rent is actually
// due" — see round-with-the-user notes: this app only ever creates a
// RentPayment row when someone actively records a payment (recordTenantRentPayment)
// or imports one (importRentPayments); a month nobody ever touched simply has
// no row at all. Left alone, that means a tenant who's gone unpaid for
// several months in a row silently disappears from every "overdue" figure
// (portfolio totals, the Rent Collection table, the unit card) even though
// the tenant's own profile page's totalDue/totalPaid did try to sum "every
// row" — which still undercounts for the exact same reason.
//
// buildRentLedger reconstructs the FULL month-by-month picture for a lease —
// every month from its start through `asOf`, merging in whatever RentPayment
// rows actually exist and synthesizing an UNPAID one (dueAmount = the
// lease's current monthlyRentAmount, paidAmount 0) for any month that has
// none. This becomes the single source of truth for "how much is really
// overdue" everywhere in the app, instead of each screen computing its own
// (incompatible) partial answer.
// Generic over the payment-method type (a Prisma enum in every real caller)
// so the ledger can round-trip it without widening to plain `string` — a
// caller passing PaymentMethod | null gets PaymentMethod | null back out.
export type ExistingRentPaymentRow<M = string | null> = {
  id: string;
  month: string; // "YYYY-MM"
  dueDate: Date;
  dueAmount: number;
  paidAmount: number;
  status: "PAID" | "UNPAID" | "PARTIAL" | "ADJUSTED_FROM_DOWNPAYMENT";
  paidAt: Date | null;
  method?: M;
};

export type RentLedgerEntry<M = string | null> = {
  month: string;
  dueDate: Date;
  dueAmount: number;
  paidAmount: number;
  status: "PAID" | "UNPAID" | "PARTIAL" | "ADJUSTED_FROM_DOWNPAYMENT";
  gap: number; // max(0, dueAmount - paidAmount)
  rentPaymentId: string | null; // null means this month has no real row yet
  paidAt: Date | null;
  method: M | null;
};

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthsToKey(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKeyOf(d);
}

function compareMonthKeys(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Safety cap so a bad/garbage startDate (or a lease decades old) can never
// spin the loop below into something unreasonable — 50 years of months is
// already far beyond any real lease this app will ever see.
const MAX_MONTHS = 600;

export function buildRentLedger<M = string | null>(
  leaseStartDate: Date,
  monthlyRentAmount: number,
  existingPayments: ExistingRentPaymentRow<M>[],
  asOf: Date = new Date()
): RentLedgerEntry<M>[] {
  const startKey = monthKeyOf(leaseStartDate);
  const endKey = monthKeyOf(asOf);
  const byMonth = new Map(existingPayments.map((p) => [p.month, p]));

  const entries: RentLedgerEntry<M>[] = [];
  let cursor = startKey;
  let guard = 0;
  // A lease that starts in the future relative to `asOf` (shouldn't normally
  // happen, but importable/edited data can be messy) — nothing owed yet.
  if (compareMonthKeys(startKey, endKey) > 0) return entries;

  while (guard < MAX_MONTHS) {
    guard++;
    const existing = byMonth.get(cursor);
    if (existing) {
      entries.push({
        month: cursor,
        dueDate: existing.dueDate,
        dueAmount: existing.dueAmount,
        paidAmount: existing.paidAmount,
        status: existing.status,
        gap: Math.max(0, existing.dueAmount - existing.paidAmount),
        rentPaymentId: existing.id,
        paidAt: existing.paidAt,
        method: existing.method ?? null,
      });
    } else {
      const [y, m] = cursor.split("-").map(Number);
      entries.push({
        month: cursor,
        dueDate: new Date(y, m - 1, 1),
        dueAmount: monthlyRentAmount,
        paidAmount: 0,
        status: "UNPAID",
        gap: Math.max(0, monthlyRentAmount),
        rentPaymentId: null,
        paidAt: null,
        method: null,
      });
    }
    if (cursor === endKey) break;
    cursor = addMonthsToKey(cursor, 1);
  }
  return entries;
}

// Total currently owed across every month in the ledger (real rows AND
// synthesized never-recorded ones) — this is the number every "overdue"
// stat/badge in the app should show, replacing each screen's own
// latest-month-only approximation.
export function totalOverdue<M>(entries: RentLedgerEntry<M>[]) {
  return entries.reduce((sum, e) => sum + e.gap, 0);
}

// The subset actually worth showing/acting on — every month still owing
// something, oldest first (the order you'd want to settle them in).
export function overdueEntries<M>(entries: RentLedgerEntry<M>[]) {
  return entries.filter((e) => e.gap > 0);
}
