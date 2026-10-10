const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// The month a payment settles is independent from the day the money arrived.
// Keep the payment-date fallback so older callers/forms remain compatible.
export function resolvePaymentMonth(billingMonth: string | null | undefined, paymentDate: string) {
  const month = billingMonth?.trim() || paymentDate.slice(0, 7);
  if (!MONTH_KEY_PATTERN.test(month)) throw new Error("Invalid billing month");
  return month;
}
