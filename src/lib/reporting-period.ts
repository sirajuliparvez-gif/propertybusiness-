import { dhakaISO } from "@/lib/dhaka-time";

export function reportingMonthKey({
  transactionType,
  transactionDate,
  rentPaymentMonth,
}: {
  transactionType: string;
  transactionDate: Date;
  rentPaymentMonth?: string | null;
}) {
  if (transactionType === "RENT_RECEIVED_FROM_TENANT" && /^\d{4}-\d{2}$/.test(rentPaymentMonth ?? "")) {
    return rentPaymentMonth!;
  }

  return dhakaISO(transactionDate).slice(0, 7);
}
