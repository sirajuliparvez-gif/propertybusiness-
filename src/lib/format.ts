export function formatTaka(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return "৳" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

// "2026-08" -> "August 2026" — used by both the invoice page (server) and
// its month-select dropdown (client), so it lives in a plain module rather
// than being re-exported from either side's own file.
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
