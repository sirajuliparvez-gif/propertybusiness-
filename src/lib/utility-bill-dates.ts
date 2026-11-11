import { prisma } from "@/lib/prisma";

// When tenant money last came in for a bill (null while nothing has been received).
export function latestReceivedAt(transactions: { type: string; date: Date }[]) {
  const times = transactions.filter(({ type }) => type === "UTILITY_REIMBURSEMENT_FROM_TENANT").map(({ date }) => date.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

// A saved print (RentBillPrint.rows) lists the printed bill lines; the utility ones carry the bill id.
export function billIdsInPrint(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => Array.isArray(row?.lines) ? row.lines : [])
    .flatMap((line: { id?: unknown; kind?: unknown }) => line?.kind === "utility" && typeof line.id === "string" ? [line.id] : []);
}

// The latest time each bill was printed on a rent & utility bill.
export async function loadBillPrintDates(bills: { id: string; month: string }[]) {
  const printedAt = new Map<string, Date>();
  const months = [...new Set(bills.map(({ month }) => month))];
  if (!months.length) return printedAt;
  const wanted = new Set(bills.map(({ id }) => id));
  const prints = await prisma.rentBillPrint.findMany({
    where: { month: { in: months } }, select: { rows: true, printedAt: true }, orderBy: { printedAt: "asc" },
  });
  for (const print of prints) {
    for (const id of billIdsInPrint(print.rows)) if (wanted.has(id)) printedAt.set(id, print.printedAt);
  }
  return printedAt;
}
