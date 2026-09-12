// A UtilityBill's paidAmount can come from up to two different Transactions
// once payUtilityBill supports splitting a single bill between the tenant's
// own reimbursement and whatever the company wrote off as its own cost (see
// payUtilityBill in actions/utility-bills.ts) — this derives that split, and
// picks a representative payment method, from whatever transactions are
// actually linked to the bill.
export function splitUtilityBillTransactions<M = string | null>(
  transactions: { type: string; amount: number; method: M }[]
) {
  let collectedFromTenant = 0;
  let companyAbsorbedAmount = 0;
  let method: M | null = null;
  for (const t of transactions) {
    if (t.type === "UTILITY_REIMBURSEMENT_FROM_TENANT") {
      collectedFromTenant += t.amount;
      method = method ?? t.method;
    } else if (t.type === "UTILITY_EXPENSE") {
      companyAbsorbedAmount += t.amount;
      method = method ?? t.method;
    }
  }
  return { collectedFromTenant, companyAbsorbedAmount, method };
}
