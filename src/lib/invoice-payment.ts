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

export type ReceiptCheckLine = {
  id: string;
  utilityType: "ELECTRICITY" | "GAS" | "WATER" | "OTHER" | null;
  dueDate: string | null;
  expectedCents: number;
  paidCents: number;
};

export function reconcileInvoiceAllocation(lines: InvoicePaymentLine[], amountCents: number, input: unknown) {
  if (!Array.isArray(input)) return null;
  const limits = new Map(lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const planned: (InvoicePaymentLine & { paidCents: number })[] = [];
  let total = 0;
  for (const entry of input) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [id, paidCents] = entry;
    const line = limits.get(id);
    if (!line || seen.has(id) || !Number.isSafeInteger(paidCents) || paidCents < 0 || paidCents > line.remainingCents) return null;
    seen.add(id);
    total += paidCents;
    if (paidCents > 0) planned.push({ ...line, paidCents });
  }
  return total === amountCents ? planned : null;
}
