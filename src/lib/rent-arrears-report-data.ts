import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { numericRentRates } from "@/lib/rent-terms";
import { previousPaymentMonth } from "@/lib/payment-month";
import { buildRentArrearsReport, resolveArrearsRange } from "@/lib/rent-arrears-report";

function normalizeSearch(value: string) {
  return value.normalize("NFC").toLowerCase().replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

export async function getRentArrearsReport(requested: { from?: string; to?: string; property?: string; tenant?: string; show?: string; q?: string }) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Arrears are past months only; the current month belongs to Rent Collection.
  const lastMonth = previousPaymentMonth(currentMonth);
  const earliest = await prisma.rentPayment.aggregate({ _min: { month: true }, where: { month: { lte: lastMonth } } });
  const range = resolveArrearsRange(requested.from, requested.to, earliest._min.month, lastMonth);
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
  const query = typeof requested.q === "string" ? requested.q.trim().slice(0, 120) : "";
  const searchWords = query ? normalizeSearch(query).split(/\s+/) : [];
  const matchingLeases = new Set(tenantOptions.filter((option) =>
    (!tenant || option.id === tenant) &&
    searchWords.every((word) => normalizeSearch(`${option.name} ${option.unit}`).includes(word))
  ).map((option) => option.id));
  const report = buildRentArrearsReport(leases.filter((lease) => matchingLeases.has(lease.id)).map((lease) => ({
    ...lease, tenantName: lease.tenant.name, propertyId: lease.unit.unitType.property.id, propertyName: lease.unit.unitType.property.name,
    propertyDeleted: lease.unit.unitType.property.deletedAt != null, unitLabel: lease.unit.label,
    monthlyRentAmount: Number(lease.monthlyRentAmount), serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
    rentRates: numericRentRates(lease.rentRates), payments: lease.rentPayments.map((payment) => ({
      month: payment.month, dueAmount: Number(payment.dueAmount), paidAmount: Number(payment.paidAmount),
      adjustments: payment.downpaymentAdjustments.map((adjustment) => Number(adjustment.amountAdjusted)),
    })),
  })), range.from, range.to, includeSettled, now);
  return { ...report, ...range, currentMonth, lastMonth, properties, tenantOptions, property, tenant, includeSettled, query };
}
