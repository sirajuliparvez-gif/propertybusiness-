import { dhakaNow } from "@/lib/dhaka-time";
import { prisma } from "@/lib/prisma";
import { attachElectricityConsumption, latestElectricityReadingByUnit } from "@/lib/electricity-consumption";
import { splitUtilityBillTransactions } from "@/lib/utility-bill-split";

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
          units: {
            select: {
              id: true,
              label: true,
              // Who the unit's bills are billed to right now.
              tenantLeases: {
                where: { status: "ACTIVE" },
                take: 1,
                select: { id: true, tenant: { select: { name: true } } },
              },
            },
          },
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
          createdAt: true,
          amount: true,
          paidAmount: true,
          status: true,
          paidByCompany: true,
          meterReading: true,
          // Both possible transactions (tenant reimbursement + company
          // write-off) — a partially/split-paid bill can have one of each.
          transactions: {
            orderBy: { date: "desc" },
            select: { type: true, amount: true, method: true },
          },
        },
      },
    },
  });
}

export async function getAllUtilityBillsData() {
  const now = dhakaNow();
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
      ut.units.map((u) => ({
        id: u.id,
        label: u.label,
        unitTypeLabel: ut.label,
        tenantName: u.tenantLeases[0]?.tenant.name ?? null,
      }))
    ),
    previousElectricityReadingByUnit: Object.fromEntries(
      latestElectricityReadingByUnit(
        p.utilityBills.map((b) => ({
          id: b.id,
          type: b.type,
          unitId: b.unitId,
          month: b.month,
          dueDate: b.dueDate,
          createdAt: b.createdAt,
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
      const tenantNameByUnitId = new Map(
        p.unitTypes.flatMap((ut) => ut.units.map((u) => [u.id, u.tenantLeases[0]?.tenant.name ?? null] as const))
      );
      const leaseIdByUnitId = new Map(
        p.unitTypes.flatMap((ut) => ut.units.map((u) => [u.id, u.tenantLeases[0]?.id ?? null] as const))
      );
      const consumptionByBillId = attachElectricityConsumption(
        p.utilityBills.map((b) => ({
          id: b.id,
          type: b.type,
          unitId: b.unitId,
          dueDate: b.dueDate,
          createdAt: b.createdAt,
          meterReading: b.meterReading != null ? Number(b.meterReading) : null,
        }))
      );
      return p.utilityBills.map((b) => {
        const split = splitUtilityBillTransactions(
          b.transactions.map((t) => ({ type: t.type, amount: Number(t.amount), method: t.method }))
        );
        return {
          id: b.id,
          type: b.type,
          dueDate: b.dueDate,
          amount: Number(b.amount),
          paidAmount: Number(b.paidAmount),
          status: b.status,
          paidByCompany: b.paidByCompany,
          paymentMethod: split.method,
          collectedFromTenant: split.collectedFromTenant,
          companyAbsorbedAmount: split.companyAbsorbedAmount,
          profitAmount: split.profitAmount,
          unitLabel: b.unitId ? (unitLabelById.get(b.unitId) ?? null) : null,
          unitId: b.unitId,
          tenantName: b.unitId ? (tenantNameByUnitId.get(b.unitId) ?? null) : null,
          tenantLeaseId: b.unitId ? (leaseIdByUnitId.get(b.unitId) ?? null) : null,
          month: b.month,
          propertyId: p.id,
          propertyName: p.name,
          meterReading: b.meterReading != null ? Number(b.meterReading) : null,
          previousMeterReading: consumptionByBillId.get(b.id)?.previousReading ?? null,
          consumptionUnits: consumptionByBillId.get(b.id)?.consumption ?? null,
        };
      });
    })
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  const totalUnpaid = bills
    .filter((b) => b.status !== "PAID")
    .reduce((sum, b) => sum + Math.max(0, b.amount - b.paidAmount), 0);
  const unpaidCount = bills.filter((b) => b.status !== "PAID").length;
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

// Everything one printable utility-bill invoice needs: the bill, where it
// belongs, who the active tenant of that unit is, what has been settled so
// far and when, and (electricity only) the meter-reading chain.
export async function getUtilityBillInvoice(billId: string) {
  const bill = await prisma.utilityBill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      type: true,
      month: true,
      dueDate: true,
      createdAt: true,
      amount: true,
      paidAmount: true,
      status: true,
      paidByCompany: true,
      meterReading: true,
      unitId: true,
      property: { select: { id: true, name: true } },
      // The lease this bill was raised against — the tenant who actually owes
      // it. Preferred over the unit's current ACTIVE lease below, which may
      // already belong to a different tenant if this one moved out.
      tenantLease: { select: { tenant: { select: { name: true, contactInfo: true } } } },
      unit: {
        select: {
          label: true,
          unitType: { select: { label: true } },
          tenantLeases: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { id: true, tenant: { select: { name: true, contactInfo: true } } },
          },
        },
      },
      transactions: {
        orderBy: { date: "desc" },
        select: { type: true, amount: true, method: true, date: true },
      },
    },
  });
  if (!bill) return null;

  let previousMeterReading: number | null = null;
  let consumptionUnits: number | null = null;
  if (bill.type === "ELECTRICITY") {
    const chain = await prisma.utilityBill.findMany({
      where: { type: "ELECTRICITY", propertyId: bill.property.id, unitId: bill.unitId },
      select: { id: true, type: true, unitId: true, dueDate: true, createdAt: true, meterReading: true },
    });
    const consumption = attachElectricityConsumption(
      chain.map((b) => ({ ...b, meterReading: b.meterReading != null ? Number(b.meterReading) : null }))
    ).get(bill.id);
    previousMeterReading = consumption?.previousReading ?? null;
    consumptionUnits = consumption?.consumption ?? null;
  }

  const split = splitUtilityBillTransactions(
    bill.transactions.map((t) => ({ type: t.type, amount: Number(t.amount), method: t.method }))
  );
  // Tenant the bill belongs to: the lease it was raised against when recorded
  // that way, else whichever lease is on the unit now (bills created before a
  // tenant moved in carry no tenantLeaseId).
  const lease = bill.tenantLease ?? bill.unit?.tenantLeases[0] ?? null;

  return {
    id: bill.id,
    type: bill.type,
    month: bill.month,
    dueDate: bill.dueDate,
    amount: Number(bill.amount),
    paidAmount: Number(bill.paidAmount),
    status: bill.status,
    paidByCompany: bill.paidByCompany,
    paidAt: bill.transactions[0]?.date ?? null,
    paymentMethod: split.method,
    collectedFromTenant: split.collectedFromTenant,
    companyAbsorbedAmount: split.companyAbsorbedAmount,
    propertyName: bill.property.name,
    unitLabel: bill.unit?.label ?? null,
    unitId: bill.unitId,
    unitTypeLabel: bill.unit?.unitType.label ?? null,
    tenantName: lease?.tenant.name ?? null,
    tenantContact: lease?.tenant.contactInfo ?? null,
    meterReading: bill.meterReading != null ? Number(bill.meterReading) : null,
    previousMeterReading,
    consumptionUnits,
  };
}
