import { isValidTransactionDate } from "@/lib/transaction-edit";
import { dhakaTodayISO } from "@/lib/dhaka-time";

// Largest single amount any form may record (৳10 crore). It is far above any real
// rent, deposit or salary, but stops a stray extra digit from reaching the books.
export const MAX_MONEY_AMOUNT = 100_000_000;

// A taka amount typed into a form: a positive number with at most two decimals
// and below the cap. Returns the normalised string to store, or null when the
// value must be refused (empty, negative, zero, NaN, too many decimals, too big).
export function parseMoneyAmount(raw: string | null | undefined): string | null {
  const typed = (raw ?? "").trim();
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(typed)) return null;
  const text = typed.startsWith(".") ? `0${typed}` : typed;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_MONEY_AMOUNT) return null;
  return text;
}

// An <input type="date"> value that is a real calendar day and not after today
// in Bangladesh.
export function isPastOrTodayDate(value: string | null | undefined, today: string = dhakaTodayISO()): boolean {
  return typeof value === "string" && isValidTransactionDate(value) && value <= today;
}
