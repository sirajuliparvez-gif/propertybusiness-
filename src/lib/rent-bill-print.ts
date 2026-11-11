import type { UtilityType } from "@/generated/prisma/client";
import type { TenantProfile } from "@/lib/tenants-data";
import type { InvoicePaymentLine } from "@/lib/invoice-payment";
import { dhakaISO } from "@/lib/dhaka-time";

import { utilityBillTypes } from "@/lib/utility-bill-defaults";

export const rentBillPrintKeys = ["RENT", ...utilityBillTypes] as const;
export type RentBillPrintKey = (typeof rentBillPrintKeys)[number];
// "ARREARS" is the extra row of chosen unpaid dues from earlier months.
export type RentBillPrintRowKey = RentBillPrintKey | "ARREARS";
export type RentBillPrintRow = {
  key: RentBillPrintRowKey;
  dueCents: number | null;
  remainingCents: number;
  lines: InvoicePaymentLine[];
  readings: { meter?: string | null; current: number; previous: number | null; units: number | null }[];
  // What the ARREARS row is made of, for printing.
  details?: ArrearsCandidate[];
};

// One unpaid earlier-month charge the person preparing the bill may add to it.
export type ArrearsCandidate = {
  id: string;
  month: string;
  kind: "rent" | "utility";
  type?: UtilityType;
  meterLabel?: string | null;
  remainingCents: number;
  // What the charge was and what has already been received, so a small leftover can be recognised as such.
  dueCents: number;
  paidCents: number;
};

// A charge with part of it already received and a balance of at most ৳500: the usual "small change" that is
// collected with the next bill, so it is added to the bill by default.
export const SMALL_LEFTOVER_MAX_CENTS = 50_000;
export function isSmallLeftover(due: Pick<ArrearsCandidate, "paidCents" | "remainingCents">) {
  return due.paidCents > 0 && due.remainingCents > 0 && due.remainingCents <= SMALL_LEFTOVER_MAX_CENTS;
}

// Unpaid rent and utility bills of months before `month` (the bill is not obliged to include them).
export function arrearsCandidates(tenant: TenantProfile, month: string): ArrearsCandidate[] {
  const start = dhakaISO(tenant.startDate);
  const rent = tenant.overdueMonths.filter((entry) => entry.month < month && entry.gap > 0).map((entry) => ({
    id: entry.month, month: entry.month, kind: "rent" as const, remainingCents: Math.round(entry.gap * 100),
    dueCents: Math.round(entry.dueAmount * 100), paidCents: Math.round(entry.paidAmount * 100),
  }));
  const utilities = tenant.utilityBills.filter((bill) =>
    bill.month < month && bill.status !== "PAID" && !bill.paidByCompany && bill.type !== "WATER" && dhakaISO(bill.dueDate) >= start,
  ).map((bill) => ({
    id: bill.id, month: bill.month, kind: "utility" as const, type: bill.type, meterLabel: bill.meterLabel ?? null,
    remainingCents: Math.round((bill.amount - bill.paidAmount) * 100),
    dueCents: Math.round(bill.amount * 100), paidCents: Math.round(bill.paidAmount * 100),
  }));
  return [...rent, ...utilities].filter(({ remainingCents }) => remainingCents > 0)
    .sort((a, b) => a.month.localeCompare(b.month) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

// The bill's "previous dues" row for the chosen candidates (null when none is chosen).
export function arrearsRow(candidates: ArrearsCandidate[], chosenIds: readonly string[]): RentBillPrintRow | null {
  const chosen = candidates.filter(({ id }) => chosenIds.includes(id));
  if (!chosen.length) return null;
  const total = chosen.reduce((sum, { remainingCents }) => sum + remainingCents, 0);
  return {
    key: "ARREARS", dueCents: total, remainingCents: total, readings: [], details: chosen,
    lines: chosen.map(({ id, month, kind, remainingCents }) => ({ id, month, kind, remainingCents })),
  };
}

export function rentBillPrintRows(tenant: TenantProfile, month: string, arrearsIds: readonly string[] = []): RentBillPrintRow[] {
  const rent = tenant.payments.find((payment) => payment.month === month);
  const start = dhakaISO(tenant.startDate);
  const base = rentBillPrintKeys.map((key): RentBillPrintRow => {
    if (key === "RENT") {
      const dueCents = rent ? Math.round(rent.dueAmount * 100) : null;
      const remainingCents = rent ? Math.max(0, Math.round((rent.dueAmount - rent.paidAmount) * 100)) : 0;
      return {
        key, dueCents, remainingCents, readings: [],
        lines: remainingCents > 0 ? [{ id: month, month, kind: "rent", remainingCents }] : [],
      };
    }

    const bills = tenant.utilityBills.filter((bill) =>
      bill.month === month && bill.type === key && dhakaISO(bill.dueDate) >= start);
    const billable = bills.filter((bill) => !bill.paidByCompany && key !== "WATER");
    const lines = billable.flatMap((bill) => {
      const remainingCents = bill.status === "PAID" ? 0 : Math.round((bill.amount - bill.paidAmount) * 100);
      return remainingCents > 0 ? [{ id: bill.id, month, kind: "utility" as const, remainingCents }] : [];
    });
    return {
      key, lines,
      dueCents: bills.length ? billable.reduce((sum, bill) => sum + Math.round(bill.amount * 100), 0) : null,
      remainingCents: lines.reduce((sum, line) => sum + line.remainingCents, 0),
      readings: bills.flatMap((bill) => bill.meterReading == null ? [] : [{
        meter: bill.meterLabel, current: bill.meterReading, previous: bill.previousMeterReading, units: bill.consumptionUnits,
      }]),
    };
  });
  const arrears = arrearsRow(arrearsCandidates(tenant, month), arrearsIds);
  return arrears ? [...base, arrears] : base;
}

export function limitToPrintedBill(lines: InvoicePaymentLine[], rows: RentBillPrintRow[]) {
  const printed = new Map(rows.flatMap((row) => row.lines.map((line) => [line.id, line.remainingCents])));
  return lines.flatMap((line) => {
    const remainingCents = Math.min(line.remainingCents, printed.get(line.id) ?? 0);
    return remainingCents > 0 ? [{ ...line, remainingCents }] : [];
  });
}
