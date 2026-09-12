export function formatTaka(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return "৳" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// A fixed timeZone is required here, not optional — without one,
// toLocaleDateString uses whatever timezone the CODE HAPPENS TO BE RUNNING
// IN, which differs between the server (Vercel's functions run in UTC) and
// the client (the visitor's own browser, e.g. Asia/Dhaka, UTC+6). For any
// date whose stored instant falls in the ~6-hour gap between those two
// timezones' midnights, the same Date renders as two different calendar
// days server-side vs client-side — a text mismatch React's hydration
// flags (and, worse, silently discards the server-rendered page and
// re-renders the whole tree client-side to recover, which is real wasted
// work on every affected page, not just a console warning). Pinning both
// to the business's own timezone makes the output identical everywhere
// AND matches what "due on the 10th" actually means to someone in Dhaka.
const BUSINESS_TIMEZONE = "Asia/Dhaka";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  });
}

// "2026-08" -> "August 2026" — used by both the invoice page (server) and
// its month-select dropdown (client), so it lives in a plain module rather
// than being re-exported from either side's own file.
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  });
}
