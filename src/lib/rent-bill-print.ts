import type { TenantProfile } from "@/lib/tenants-data";
import type { InvoicePaymentLine } from "@/lib/invoice-payment";
import { dhakaISO } from "@/lib/dhaka-time";

import { utilityBillTypes } from "@/lib/utility-bill-defaults";

export const rentBillPrintKeys = ["RENT", ...utilityBillTypes] as const;
export type RentBillPrintKey = (typeof rentBillPrintKeys)[number];
export type RentBillPrintRow = {
  key: RentBillPrintKey;
  dueCents: number | null;
  remainingCents: number;
  lines: InvoicePaymentLine[];
  readings: { current: number; previous: number | null; units: number | null }[];
};

export function rentBillPrintRows(tenant: TenantProfile, month: string): RentBillPrintRow[] {
  const rent = tenant.payments.find((payment) => payment.month === month);
  const start = dhakaISO(tenant.startDate);
  return rentBillPrintKeys.map((key) => {
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
}

export function limitToPrintedBill(lines: InvoicePaymentLine[], rows: RentBillPrintRow[]) {
  const printed = new Map(rows.flatMap((row) => row.lines.map((line) => [line.id, line.remainingCents])));
  return lines.flatMap((line) => {
    const remainingCents = Math.min(line.remainingCents, printed.get(line.id) ?? 0);
    return remainingCents > 0 ? [{ ...line, remainingCents }] : [];
  });
}
