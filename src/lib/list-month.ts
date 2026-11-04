import { dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";

export function resolveListMonth(requestedMonth?: string, currentDate = dhakaNow()) {
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const requested = requestedMonth?.trim();
  const selectedMonth = isPaymentMonth(requested) && requested <= currentMonth ? requested : null;
  const [year, number] = (selectedMonth ?? currentMonth).split("-").map(Number);
  return { currentMonth, selectedMonth, start: new Date(Date.UTC(year, number - 1, 1, -6)), end: new Date(Date.UTC(year, number, 1, -6)) };
}

export function listMonthOptions(months: string[], currentMonth: string, selectedMonth: string | null) {
  return [...new Set([currentMonth, ...(selectedMonth ? [selectedMonth] : []), ...months.filter((month) => isPaymentMonth(month) && month <= currentMonth)])].sort().reverse();
}
