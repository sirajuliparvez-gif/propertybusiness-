import { isPaymentMonth } from "@/lib/payment-month";
import { isIncomeType, isExpenseType } from "@/lib/finance-types";
import { reportingMonthKey } from "@/lib/reporting-period";

export function dashboardMonthKeys(endMonth: string, count = 12) {
  if (!isPaymentMonth(endMonth) || !Number.isInteger(count) || count < 1 || count > 600) throw new Error("Invalid dashboard period");
  const [year, month] = endMonth.split("-").map(Number);
  const end = year * 12 + month - 1;
  return Array.from({ length: count }, (_, index) => {
    const value = end - count + index + 1;
    return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, "0")}`;
  });
}

export function dashboardFinancialBuckets(transactions: {
  date: Date; type: string; amount: number; rentPaymentMonth?: string | null;
}[], months: string[]) {
  const buckets = new Map(months.map((month) => [month, { income: 0, expense: 0 }]));
  for (const transaction of transactions) {
    const month = reportingMonthKey({ transactionType: transaction.type, transactionDate: transaction.date, rentPaymentMonth: transaction.rentPaymentMonth });
    const bucket = buckets.get(month);
    if (!bucket) continue;
    if (isIncomeType(transaction.type)) bucket.income += transaction.amount;
    else if (isExpenseType(transaction.type)) bucket.expense += transaction.amount;
  }
  return [...buckets].map(([month, totals]) => ({ month, ...totals, net: totals.income - totals.expense }));
}

export function dashboardYearlyBuckets(monthly: { month: string; income: number; expense: number }[], endMonth: string, yearsBack = 3) {
  const year = Number(endMonth.slice(0, 4));
  const buckets = new Map(Array.from({ length: yearsBack }, (_, index) => [String(year - yearsBack + index + 1), { income: 0, expense: 0 }]));
  for (const point of monthly) {
    if (point.month > endMonth) continue;
    const bucket = buckets.get(point.month.slice(0, 4));
    if (!bucket) continue;
    bucket.income += point.income;
    bucket.expense += point.expense;
  }
  return [...buckets].map(([year, totals]) => ({ year, ...totals, net: totals.income - totals.expense }));
}
