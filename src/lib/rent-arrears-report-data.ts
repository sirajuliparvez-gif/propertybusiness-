import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { numericRentRates } from "@/lib/rent-terms";
import { buildRentArrearsReport, resolveArrearsRange } from "@/lib/rent-arrears-report";

export async function getRentArrearsReport(requested: { from?: string; to?: string; property?: string; tenant?: string; show?: string }) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const earliest = await prisma.rentPayment.aggregate({ _min: { month: true }, where: { month: { lte: currentMonth } } });
  const range = resolveArrearsRange(requested.from, requested.to, earliest._min.month, currentMonth);
  const [year, number] = range.to.split("-").map(Number);
  const leases = await prisma.tenantLease.findMany({
    where: { OR: [
      { startDate: { lt: new Date(Date.UTC(year, number, 1, -6)) } },
      { rentPayments: { some: { month: { gte: range.from, lte: range.to } } } },
    ] },
    select: {
      id: true, status: true, startDate: true, endDate: true, movedOutAt: true,
      monthlyRentAmount: true, serviceChargeType: true, serviceChargeValue: true,
      tenant: { select: { name: true } },
      unit: { select: { label: true, unitType: { select: { property: { select: { id: true, name: true, deletedAt: true } } } } } },
      rentRates: { orderBy: { effectiveMonth: "asc" } },
      rentPayments: {
        where: { month: { gte: range.from, lte: range.to } },
        select: { month: true, dueAmount: true, paidAmount: true, downpaymentAdjustments: { select: { amountAdjusted: true } } },
      },
    },
  });
  const options = leases.map((lease) => ({ id: lease.id, name: lease.tenant.name, unit: lease.unit.label, propertyId: lease.unit.unitType.property.id, propertyName: lease.unit.unitType.property.name }))
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.name.localeCompare(b.name));
  const properties = [...new Map(options.map((option) => [option.propertyId, { id: option.propertyId, name: option.propertyName }])).values()];
  const property = properties.some((option) => option.id === requested.property) ? requested.property! : "";
  const tenantOptions = options.filter((option) => !property || option.propertyId === property);
  const tenant = tenantOptions.some((option) => option.id === requested.tenant) ? requested.tenant! : "";
  const includeSettled = requested.show === "all";
  const report = buildRentArrearsReport(leases.filter((lease) => (!property || lease.unit.unitType.property.id === property) && (!tenant || lease.id === tenant)).map((lease) => ({
    ...lease, tenantName: lease.tenant.name, propertyId: lease.unit.unitType.property.id, propertyName: lease.unit.unitType.property.name,
    propertyDeleted: lease.unit.unitType.property.deletedAt != null, unitLabel: lease.unit.label,
    monthlyRentAmount: Number(lease.monthlyRentAmount), serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
    rentRates: numericRentRates(lease.rentRates), payments: lease.rentPayments.map((payment) => ({
      month: payment.month, dueAmount: Number(payment.dueAmount), paidAmount: Number(payment.paidAmount),
      adjustments: payment.downpaymentAdjustments.map((adjustment) => Number(adjustment.amountAdjusted)),
    })),
  })), range.from, range.to, includeSettled, now);
  return { ...report, ...range, currentMonth, properties, tenantOptions, property, tenant, includeSettled };
}
