// The one definition of "real operating income / expense" shared by the
// dashboard, transactions, reports and charts — so the same month can never
// show different totals on different pages.
//
// Only these types are real income/expense. Everything else (downpayment
// movements in every direction, utility bill reimbursement, guest deposit
// refund) is a pass-through/balance-sheet item: money changing hands, not
// money earned or spent. Those still appear as full rows in the ledger table,
// just not in the KPI sums. GUEST_STAY_PAYMENT_RECEIVED is real hotel revenue,
// SERVICE_CHARGE_RECEIVED_FROM_TENANT a real optional fee, and
// UTILITY_PROFIT_FROM_TENANT (tenant paid more than the actual bill) real
// income. UTILITY_EXPENSE is only created for a bill the company pays itself,
// so it's a real cost — the plain tenant reimbursement stays excluded.
export const INCOME_TYPES = [
  "RENT_RECEIVED_FROM_TENANT",
  "GUEST_STAY_PAYMENT_RECEIVED",
  "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
  "UTILITY_PROFIT_FROM_TENANT",
] as const;

export const EXPENSE_TYPES = [
  "RENT_PAID_TO_OWNER",
  "PAYROLL_EXPENSE",
  "UTILITY_EXPENSE",
  "MAINTENANCE_EXPENSE",
  "OTHER",
] as const;

export function isIncomeType(type: string) {
  return (INCOME_TYPES as readonly string[]).includes(type);
}

export function isExpenseType(type: string) {
  return (EXPENSE_TYPES as readonly string[]).includes(type);
}
