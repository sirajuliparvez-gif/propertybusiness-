import { prisma } from "@/lib/prisma";
import { attachElectricityConsumption, latestElectricityReadingByUnit } from "@/lib/electricity-consumption";

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function getPropertiesWithBills() {
  return prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unitTypes: {
        select: {
          label: true,
          units: { select: { id: true, label: true } },
        },
      },
      utilityBills: {
        orderBy: { dueDate: "desc" },
        select: {
          id: true,
          unitId: true,
          type: true,
          month: true,
          dueDate: true,
          amount: true,
          status: true,
          paidByCompany: true,
          meterReading: true,
          transactions: {
            orderBy: { date: "desc" },
            take: 1,
            select: { method: true },
          },
        },
      },
    },
  });
}

export async function getAllUtilityBillsData() {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  const [properties, paidThisMonthAgg] = await Promise.all([
    getPropertiesWithBills(),
    // Total settled this month regardless of who bore the cost — company's
    // own UTILITY_EXPENSE (paidByCompany bills) plus tenant reimbursements.
    prisma.transaction.aggregate({
      where: {
        type: { in: ["UTILITY_EXPENSE", "UTILITY_REIMBURSEMENT_FROM_TENANT"] },
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const propertyUnitOptions = properties.map((p) => ({
    id: p.id,
    name: p.name,
    units: p.unitTypes.flatMap((ut) =>
      ut.units.map((u) => ({ id: u.id, label: u.label, unitTypeLabel: ut.label }))
    ),
    previousElectricityReadingByUnit: Object.fromEntries(
      latestElectricityReadingByUnit(
        p.utilityBills.map((b) => ({
          id: b.id,
          type: b.type,
          unitId: b.unitId,
          month: b.month,
          dueDate: b.dueDate,
          meterReading: b.meterReading != null ? Number(b.meterReading) : null,
        }))
      )
    ),
  }));

  const bills = properties
    .flatMap((p) => {
      const unitLabelById = new Map(
        p.unitTypes.flatMap((ut) => ut.units.map((u) => [u.id, u.label] as const))
      );
      const consumptionByBillId = attachElectricityConsumption(
        p.utilityBills.map((b) => ({
          id: b.id,
          type: b.type,
          unitId: b.unitId,
          dueDate: b.dueDate,
          meterReading: b.meterReading != null ? Number(b.meterReading) : null,
        }))
      );
      return p.utilityBills.map((b) => ({
        id: b.id,
        type: b.type,
        dueDate: b.dueDate,
        amount: Number(b.amount),
        status: b.status,
        paidByCompany: b.paidByCompany,
        paymentMethod: b.transactions[0]?.method ?? null,
        unitLabel: b.unitId ? (unitLabelById.get(b.unitId) ?? null) : null,
        propertyId: p.id,
        propertyName: p.name,
        meterReading: b.meterReading != null ? Number(b.meterReading) : null,
        previousMeterReading: consumptionByBillId.get(b.id)?.previousReading ?? null,
        consumptionUnits: consumptionByBillId.get(b.id)?.consumption ?? null,
      }));
    })
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  const totalUnpaid = bills
    .filter((b) => b.status === "UNPAID")
    .reduce((sum, b) => sum + b.amount, 0);
  const unpaidCount = bills.filter((b) => b.status === "UNPAID").length;
  const paidThisMonth = Number(paidThisMonthAgg._sum.amount ?? 0);
  const paidCount = bills.filter((b) => b.status === "PAID").length;
  const paymentRate = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;

  return {
    bills,
    properties: propertyUnitOptions,
    totalUnpaid,
    unpaidCount,
    paidThisMonth,
    paymentRate,
  };
}

export type AllUtilityBillsData = Awaited<ReturnType<typeof getAllUtilityBillsData>>;
