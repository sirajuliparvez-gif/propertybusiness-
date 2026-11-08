// Keep the same receipt number when retrying an identical unsent/uncertain
// request. Editing the request starts a new attempt.
export type ReceiptAttempt = { payload: string; id: string };
export function receiptAttempt(data: FormData, previous: ReceiptAttempt | null, extra: FormData[] = []): ReceiptAttempt {
  const entries = (form: FormData) => [...form.entries()].filter(([key]) => key !== "receiptRequestId" && !key.startsWith("$ACTION_")).sort(([a], [b]) => a.localeCompare(b));
  const payload = JSON.stringify([entries(data), extra.map(entries)]);
  return previous?.payload === payload ? previous : { payload, id: crypto.randomUUID() };
}
export function validReceiptRequestId(value: string | null) {
  return value == null || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}
