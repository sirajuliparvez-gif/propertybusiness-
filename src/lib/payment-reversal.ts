// What a bill, salary month or rent month looks like after one payment against it is taken back.
export type ReversedPaymentState = {
  paid: number;
  // NONE = nothing paid any more, PARTIAL = some paid, PAID = fully paid.
  state: "NONE" | "PARTIAL" | "PAID";
};

const toPaisa = (value: number) => Math.round(value * 100);

export function reversedPaymentState(paidSoFar: number, reversedAmount: number, dueAmount: number): ReversedPaymentState {
  // Work in whole paisa so 0.1 + 0.2 style float noise can never leave a phantom balance.
  const paidPaisa = Math.max(0, toPaisa(paidSoFar) - toPaisa(reversedAmount));
  const duePaisa = toPaisa(dueAmount);
  const state = paidPaisa <= 0 ? "NONE" : paidPaisa >= duePaisa ? "PAID" : "PARTIAL";
  return { paid: paidPaisa / 100, state };
}
