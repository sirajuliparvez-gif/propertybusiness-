export const DIRECTLY_EDITABLE_TRANSACTION_TYPES = [
  "MAINTENANCE_EXPENSE",
  "OTHER",
] as const;

export type DirectlyEditableTransactionType =
  (typeof DIRECTLY_EDITABLE_TRANSACTION_TYPES)[number];

export function isDirectlyEditableTransactionType(
  type: string
): type is DirectlyEditableTransactionType {
  return (DIRECTLY_EDITABLE_TRANSACTION_TYPES as readonly string[]).includes(type);
}

export function isValidTransactionDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

