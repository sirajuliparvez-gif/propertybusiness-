export function applyRentInstallment({
  dueAmount,
  alreadyPaid,
  paymentAmount,
  adjustedFromDownpayment = false,
}: {
  dueAmount: number;
  alreadyPaid: number;
  paymentAmount: number;
  adjustedFromDownpayment?: boolean;
}) {
  const totalPaid = alreadyPaid + paymentAmount;
  const status =
    totalPaid >= dueAmount
      ? adjustedFromDownpayment
        ? ("ADJUSTED_FROM_DOWNPAYMENT" as const)
        : ("PAID" as const)
      : ("PARTIAL" as const);

  return { totalPaid, status };
}

export function isRentPaymentSettled(dueAmount: number, paidAmount: number) {
  return paidAmount >= dueAmount;
}

export function applyUtilityBillInstallment({
  totalAmount,
  alreadyPaid,
  tenantPaymentAmount,
  companyCoversRest,
}: {
  totalAmount: number;
  alreadyPaid: number;
  tenantPaymentAmount: number;
  companyCoversRest: boolean;
}) {
  const remaining = Math.max(0, totalAmount - alreadyPaid);
  const tenantAmount = Math.max(0, tenantPaymentAmount);
  const billPortion = Math.min(tenantAmount, remaining);
  const profitAmount = Math.max(0, tenantAmount - remaining);
  const companyAmount = companyCoversRest ? remaining - billPortion : 0;
  const newPaidAmount = alreadyPaid + billPortion + companyAmount;
  const status = newPaidAmount >= totalAmount ? ("PAID" as const) : ("PARTIAL" as const);

  return { billPortion, profitAmount, companyAmount, newPaidAmount, status };
}
