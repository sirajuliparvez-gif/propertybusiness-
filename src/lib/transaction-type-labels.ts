export const transactionTypeLabels: Record<string, string> = {
  RENT_RECEIVED_FROM_TENANT: "transactionTypeRentReceived", RENT_PAID_TO_OWNER: "transactionTypeRentPaidToOwner",
  DOWNPAYMENT_PAID_TO_OWNER: "transactionTypeDownpaymentPaidToOwner", DOWNPAYMENT_RECEIVED_FROM_TENANT: "transactionTypeDownpaymentReceivedFromTenant",
  DOWNPAYMENT_REFUND_TO_TENANT: "transactionTypeDownpaymentRefundToTenant", DOWNPAYMENT_REFUND_FROM_OWNER: "transactionTypeDownpaymentRefundFromOwner",
  UTILITY_REIMBURSEMENT_FROM_TENANT: "transactionTypeUtilityReimbursement", UTILITY_PROFIT_FROM_TENANT: "transactionTypeUtilityProfit",
  SERVICE_CHARGE_RECEIVED_FROM_TENANT: "transactionTypeServiceCharge", GUEST_STAY_PAYMENT_RECEIVED: "transactionTypeGuestStayPayment",
  GUEST_DEPOSIT_REFUND: "transactionTypeGuestDepositRefund", PAYROLL_EXPENSE: "transactionTypePayrollExpense",
  UTILITY_EXPENSE: "transactionTypeUtilityExpense", MAINTENANCE_EXPENSE: "expenseTypeMaintenance", OTHER: "expenseTypeOther", OWNER_WITHDRAWAL: "transactionTypeOwnerWithdrawal",
};
