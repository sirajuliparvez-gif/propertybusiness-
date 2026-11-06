import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { dhakaISO } from "@/lib/dhaka-time";
import { isValidTransactionDate } from "@/lib/transaction-edit";
import type { Prisma, UtilityType } from "@/generated/prisma/client";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function readUtilityBillFields(formData: FormData) {
  const typeRaw = formData.get("type");
  const type =
    typeRaw === "GAS" || typeRaw === "ELECTRICITY" || typeRaw === "WATER" || typeRaw === "OTHER"
      ? typeRaw
      : "OTHER";
  let amount = str(formData, "amount");
  const dueDate = str(formData, "dueDate");
  if (!amount || !dueDate) return null;
  // Water is company policy: always the company's own cost, never billed to
  // a tenant — enforced here too (not just the disabled checkbox client-side)
  // in case of a stale/tampered form.
  const paidByCompany = type === "WATER" ? true : formData.get("paidByCompany") === "true";
  // Only meaningful for electricity — the field is hidden for every other
  // type client-side, but guard here too in case of a stale/tampered form.
  const meterReadingRaw = type === "ELECTRICITY" ? str(formData, "meterReading") : null;
  const meterReading = meterReadingRaw ? Number(meterReadingRaw) : null;

  const previousRaw = type === "ELECTRICITY" ? str(formData, "previousMeterReadingOverride") : null;
  const previousMeterReadingOverride = previousRaw == null ? null : Number(previousRaw);
  const unitRate = type === "ELECTRICITY" ? str(formData, "electricityUnitRate") : null;
  if (unitRate != null) {
    const units = meterReading == null || previousMeterReadingOverride == null ? null : meterReading - previousMeterReadingOverride;
    amount = electricityAmountAtRate(units, unitRate);
    if (!amount) return null;
  }
  return { type, amount, dueDate, paidByCompany, meterReading, previousMeterReadingOverride } as const;
}

export function validMeterReadings(current: number | null, previous: number | null) {
  if (current != null && (!Number.isFinite(current) || current < 0)) return false;
  if (previous == null) return true;
  return Number.isFinite(previous) && previous >= 0 && (current == null || current >= previous);
}

export function validateTenantUtilityBills(billingMonth: string, bills: FormData[]) {
  const fields = bills.map(readUtilityBillFields);
  if (!fields.length || !fields.every((bill) =>
    bill != null && isValidTransactionDate(bill.dueDate) && bill.dueDate.slice(0, 7) === billingMonth
  )) {
    return { ok: false, error: "utilityBillInvalidDate" } as const;
  }

  const validatedBills = [];
  for (const bill of fields) {
    if (!bill || !Number.isFinite(Number(bill.amount)) || Number(bill.amount) <= 0 ||
      !validMeterReadings(bill.meterReading, bill.previousMeterReadingOverride)) {
      return { ok: false, error: "utilityBillInvalidAmount" } as const;
    }
    validatedBills.push(bill);
  }

  return { ok: true, bills: validatedBills } as const;
}

export function prepareTenantUtilityBillRows(
  lease: {
    id: string;
    status: string;
    startDate: Date;
    unitId: string;
    utilityBillDefaults: { type: UtilityType; paidByCompany: boolean | null; amount: Prisma.Decimal | null }[];
  },
  propertyId: string,
  billingMonth: string,
  bills: NonNullable<ReturnType<typeof readUtilityBillFields>>[],
) {
  const leaseStart = dhakaISO(lease.startDate);
  if (lease.status !== "ACTIVE" || bills.some((bill) => bill.dueDate < leaseStart)) return null;
  return bills.map((bill) => {
    const locked = lease.utilityBillDefaults.find((item) => item.type === bill.type);
    return {
      ...bill,
      propertyId,
      unitId: lease.unitId,
      tenantLeaseId: lease.id,
      amount: locked?.amount ?? bill.amount,
      paidByCompany: locked?.paidByCompany ?? bill.paidByCompany,
      month: billingMonth,
      dueDate: new Date(bill.dueDate),
    };
  });
}
