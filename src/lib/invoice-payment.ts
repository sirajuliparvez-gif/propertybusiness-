export type InvoicePaymentLine = {
  id: string;
  month: string;
  kind: "rent" | "utility";
  remainingCents: number;
};

export function orderInvoicePaymentLines<T extends InvoicePaymentLine>(lines: T[]) {
  return [...lines].sort((a, b) =>
    a.month.localeCompare(b.month) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
  );
}

export function invoicePaymentSnapshot(lines: InvoicePaymentLine[]) {
  return JSON.stringify(orderInvoicePaymentLines(lines).map(({ id, month, kind, remainingCents }) =>
    [id, month, kind, remainingCents]
  ));
}

export function allocateInvoicePayment(lines: InvoicePaymentLine[], amountCents: number) {
  let remaining = amountCents;
  return orderInvoicePaymentLines(lines).flatMap((line) => {
    const paidCents = Math.min(remaining, line.remainingCents);
    remaining -= paidCents;
    return paidCents > 0 ? [{ ...line, paidCents }] : [];
  });
}
