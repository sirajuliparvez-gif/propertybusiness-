const PAYMENT_METHOD_LABEL_KEYS: Record<string, string> = {
  CASH: "paymentMethodCash",
  BKASH: "paymentMethodBkash",
  NAGAD: "paymentMethodNagad",
  BANK: "paymentMethodBank",
  OTHER: "paymentMethodOther",
};

export function paymentMethodLabel(t: (key: string) => string, method: string | null | undefined) {
  if (!method) return t("noPaymentRecord");
  return t(PAYMENT_METHOD_LABEL_KEYS[method] ?? "paymentMethodOther");
}
