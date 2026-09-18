// A UtilityBill's paidAmount can come from up to three different
// Transactions once payUtilityBill supports splitting a single bill between
// the tenant's own reimbursement, whatever the company wrote off as its own
// cost, and — when the tenant paid more than the actual bill — the company's
// profit on top (see payUtilityBill in actions/utility-bills.ts). This
// derives that split, and picks a representative payment method, from
// whatever transactions are actually linked to the bill.
export function splitUtilityBillTransactions<M = string | null>(
  transactions: { type: string; amount: number; method: M }[]
) {
  let collectedFromTenant = 0;
  let companyAbsorbedAmount = 0;
  let profitAmount = 0;
  let method: M | null = null;
  for (const t of transactions) {
    if (t.type === "UTILITY_REIMBURSEMENT_FROM_TENANT") {
      collectedFromTenant += t.amount;
      method = method ?? t.method;
    } else if (t.type === "UTILITY_PROFIT_FROM_TENANT") {
      collectedFromTenant += t.amount;
      profitAmount += t.amount;
      method = method ?? t.method;
    } else if (t.type === "UTILITY_EXPENSE") {
      companyAbsorbedAmount += t.amount;
      method = method ?? t.method;
    }
  }
  return { collectedFromTenant, companyAbsorbedAmount, profitAmount, method };
}
