export type TransactionReportEntry = {
  id: string; date: Date; createdAt: Date; direction: "INCOMING" | "OUTGOING"; amount: number;
};

const cents = (amount: number) => Math.round(amount * 100);

export function openingTransactionBalance(groups: { direction: string; amount: number }[]) {
  return groups.reduce((total, group) => total + (group.direction === "INCOMING" ? cents(group.amount) : -cents(group.amount)), 0) / 100;
}

export function buildMonthlyTransactionReport<T extends TransactionReportEntry>(entries: T[], opening: number) {
  let balance = cents(opening);
  let incoming = 0;
  let outgoing = 0;
  const rows = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map((entry) => {
    const amount = cents(entry.amount);
    if (entry.direction === "INCOMING") { incoming += amount; balance += amount; }
    else { outgoing += amount; balance -= amount; }
    return { ...entry, incoming: entry.direction === "INCOMING" ? entry.amount : 0, outgoing: entry.direction === "OUTGOING" ? entry.amount : 0, balance: balance / 100 };
  });
  return { rows, totals: { opening: cents(opening) / 100, incoming: incoming / 100, outgoing: outgoing / 100, net: (incoming - outgoing) / 100, closing: balance / 100 } };
}

export function transactionReportRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  // Stored instants are bucketed by Bangladesh calendar months, including
  // the six hours before UTC month-start that already belong to Dhaka.
  return { start: new Date(Date.UTC(year, number - 1, 1, -6)), end: new Date(Date.UTC(year, number, 1, -6)) };
}
