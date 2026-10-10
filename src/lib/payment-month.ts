const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPaymentMonth(value: string | null | undefined): value is string {
  return MONTH_KEY_PATTERN.test(value?.trim() ?? "");
}

export function previousPaymentMonth(month: string) {
  if (!isPaymentMonth(month)) throw new Error("Invalid billing month");
  const [year, monthNumber] = month.split("-").map(Number);
  const previous = new Date(year, monthNumber - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
}

export function paymentMonthDueDate(month: string, dueDay: number) {
  if (!isPaymentMonth(month)) throw new Error("Invalid billing month");
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, dueDay);
}

export function paymentMonthRange(startMonth: string, endMonth: string, maxMonths = 36) {
  if (!isPaymentMonth(startMonth) || !isPaymentMonth(endMonth)) {
    throw new Error("Invalid billing month range");
  }
  if (!Number.isInteger(maxMonths) || maxMonths < 1) {
    throw new Error("Invalid maximum month count");
  }

  const [startYear, startNumber] = startMonth.split("-").map(Number);
  const [endYear, endNumber] = endMonth.split("-").map(Number);
  const startIndex = startYear * 12 + startNumber - 1;
  const endIndex = endYear * 12 + endNumber - 1;
  const count = endIndex - startIndex + 1;
  if (count < 1 || count > maxMonths) throw new Error("Invalid billing month range");

  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

// The month a payment settles is independent from the day the money arrived.
// Keep the payment-date fallback so older callers/forms remain compatible.
export function resolvePaymentMonth(billingMonth: string | null | undefined, paymentDate: string) {
  const month = billingMonth?.trim() || paymentDate.slice(0, 7);
  if (!isPaymentMonth(month)) throw new Error("Invalid billing month");
  return month;
}
