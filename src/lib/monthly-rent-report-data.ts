import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";
import { numericRentRates } from "@/lib/rent-terms";
import { buildMonthlyRentReport } from "@/lib/monthly-rent-report";

export async function getMonthlyRentReport(requestedMonth?: string, propertyId?: string) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = isPaymentMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const [year, number] = month.split("-").map(Number);
  // Use the Dhaka boundary rather than the server's local timezone.
  const nextMonth = new Date(Date.UTC(year, number, 1, -6));
  const [leases, recordedMonths] = await prisma.$transaction([
    prisma.tenantLease.findMany({
      where: {
        ...(propertyId ? { unit: { unitType: { propertyId } } } : {}),
        OR: [{ startDate: { lt: nextMonth } }, { rentPayments: { some: { month } } }],
      },
      select: {
        id: true, status: true, startDate: true, endDate: true, movedOutAt: true,
        monthlyRentAmount: true, serviceChargeType: true, serviceChargeValue: true,
        tenant: { select: { name: true } },
        unit: { select: { label: true, unitType: { select: { property: { select: { name: true, deletedAt: true } } } } } },
        rentRates: { orderBy: { effectiveMonth: "asc" } },
        rentPayments: {
          where: { month },
          select: { dueAmount: true, paidAmount: true, downpaymentAdjustments: { select: { amountAdjusted: true } } },
        },
      },
    }),
    prisma.rentPayment.findMany({ where: { month: { lte: currentMonth } }, distinct: ["month"], select: { month: true } }),
  ]);
  const report = buildMonthlyRentReport(leases.map((lease) => ({
    ...lease,
    tenantName: lease.tenant.name,
    propertyName: lease.unit.unitType.property.name,
    propertyDeleted: lease.unit.unitType.property.deletedAt != null,
    unitLabel: lease.unit.label,
    monthlyRentAmount: Number(lease.monthlyRentAmount),
    serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
    rentRates: numericRentRates(lease.rentRates),
    payment: lease.rentPayments[0] ? {
      dueAmount: Number(lease.rentPayments[0].dueAmount),
      paidAmount: Number(lease.rentPayments[0].paidAmount),
      adjustments: lease.rentPayments[0].downpaymentAdjustments.map((a) => Number(a.amountAdjusted)),
    } : null,
  })), month);
  return { ...report, month, months: [...new Set([month, currentMonth, ...recordedMonths.map((m) => m.month)])].sort().reverse() };
}
