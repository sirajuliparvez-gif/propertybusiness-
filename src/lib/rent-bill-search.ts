import { isPaymentMonth } from "@/lib/payment-month";
import { prisma } from "@/lib/prisma";
import { legacyRentBillNumber, parseRentBillSearch } from "@/lib/rent-bill-number";

const resultFields = { tenantLeaseId: true, month: true } as const;

export async function findRentBill(query: string, marketId?: string, selectedMonth?: string) {
  const parsed = parseRentBillSearch(query);
  if (!parsed) return { error: "rentBillSearchInvalid" } as const;
  if (parsed.kind === "full") {
    const bill = await prisma.rentBillNumber.findFirst({
      where: { property: { billMarketCode: parsed.marketCode }, month: parsed.month, serial: parsed.serial },
      select: resultFields,
    });
    return bill ? { bill } : { error: "rentBillSearchNotFound" } as const;
  }
  if (parsed.kind === "serial") {
    const month = selectedMonth?.trim();
    if (!marketId || !isPaymentMonth(month)) return { error: "rentBillSearchChooseScope" } as const;
    const bill = await prisma.rentBillNumber.findUnique({
      where: { propertyId_month_serial: { propertyId: marketId, month, serial: parsed.serial } },
      select: resultFields,
    });
    return bill ? { bill } : { error: "rentBillSearchNotFound" } as const;
  }

  const matches = await prisma.tenantLease.findMany({
    where: {
      id: { endsWith: parsed.suffix, mode: "insensitive" },
      OR: [
        { rentBillPrints: { some: { month: parsed.month } } },
        { rentPayments: { some: { month: parsed.month } } },
        { utilityBills: { some: { month: parsed.month } } },
      ],
    },
    select: { id: true },
    take: 3,
  });
  const exact = matches.filter(({ id }) => legacyRentBillNumber(id, parsed.month) === parsed.value);
  if (exact.length > 1) return { error: "rentBillSearchAmbiguous" } as const;
  return exact[0] ? { bill: { tenantLeaseId: exact[0].id, month: parsed.month } }
    : { error: "rentBillSearchNotFound" } as const;
}
