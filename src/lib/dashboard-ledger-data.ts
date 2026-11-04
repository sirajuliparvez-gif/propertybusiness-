import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { numericRentRates } from "@/lib/rent-terms";
import { dashboardLedgerTotals, dashboardRentCollection, type DashboardLease, type DashboardEmployee } from "@/lib/dashboard-ledger";

// One request-scoped read shared by outstanding balances, forecasts and the
// mobile rent summary. Active accounts only, with no directory/UI joins.
export const getDashboardLedgerData = cache(async function getDashboardLedgerData() {
  const [leaseRows, employeeRows] = await Promise.all([
    prisma.tenantLease.findMany({
      where: { status: "ACTIVE", unit: { unitType: { property: { deletedAt: null } } } },
      select: {
        id: true, startDate: true, monthlyRentAmount: true, serviceChargeType: true, serviceChargeValue: true,
        tenant: { select: { name: true } },
        unit: { select: { label: true, unitType: { select: { property: { select: { name: true } } } } } },
        rentRates: { orderBy: { effectiveMonth: "asc" } },
        rentPayments: { select: { id: true, month: true, dueDate: true, dueAmount: true, paidAmount: true, status: true, paidAt: true } },
      },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        joinedAt: true, salaryAmount: true,
        payrollRecords: { select: { id: true, month: true, dueDate: true, dueAmount: true, amountPaid: true, status: true, paidAt: true } },
      },
    }),
  ]);
  const leases: DashboardLease[] = leaseRows.map((lease) => ({
    id: lease.id, startDate: lease.startDate, tenantName: lease.tenant.name,
    propertyName: lease.unit.unitType.property.name, unitLabel: lease.unit.label,
    monthlyRentAmount: Number(lease.monthlyRentAmount), serviceChargeType: lease.serviceChargeType,
    serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
    rentRates: numericRentRates(lease.rentRates),
    payments: lease.rentPayments.map((payment) => ({ ...payment, dueAmount: Number(payment.dueAmount), paidAmount: Number(payment.paidAmount) })),
  }));
  const employees: DashboardEmployee[] = employeeRows.map((employee) => ({
    joinedAt: employee.joinedAt, salaryAmount: Number(employee.salaryAmount),
    payments: employee.payrollRecords.map((payment) => ({
      id: payment.id, month: payment.month, dueDate: payment.dueDate, paidAt: payment.paidAt,
      dueAmount: Number(payment.dueAmount ?? payment.amountPaid), paidAmount: Number(payment.amountPaid),
      status: payment.status === "PENDING" ? "UNPAID" : payment.status,
    })),
  }));
  return { leases, totals: dashboardLedgerTotals(leases, employees) };
});

export async function getDashboardRentCollection(month: string) {
  const { leases } = await getDashboardLedgerData();
  return dashboardRentCollection(leases, month, dhakaNow());
}
