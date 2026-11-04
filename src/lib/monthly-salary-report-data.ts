import { prisma } from "@/lib/prisma";
import { dhakaNow } from "@/lib/dhaka-time";
import { isPaymentMonth, paymentMonthRange } from "@/lib/payment-month";
import { LEDGER_START_MONTH } from "@/lib/rent-ledger";
import { buildMonthlySalaryReport } from "@/lib/monthly-salary-report";

export async function getMonthlySalaryReport(requestedMonth?: string) {
  const now = dhakaNow();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const requested = requestedMonth?.trim();
  const month = isPaymentMonth(requested) && requested <= currentMonth ? requested : currentMonth;
  const [year, number] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, number, 1, -6));
  const [employees, recordedMonths] = await prisma.$transaction([
    prisma.employee.findMany({
      where: { OR: [{ joinedAt: { lt: nextMonth } }, { payrollRecords: { some: { month } } }] },
      select: {
        id: true, name: true, role: true, status: true, joinedAt: true, terminatedAt: true, salaryAmount: true,
        property: { select: { id: true, name: true } },
        payrollRecords: { where: { month }, select: { dueAmount: true, amountPaid: true, paidAt: true } },
      },
    }),
    prisma.payrollRecord.findMany({ where: { month: { lte: currentMonth } }, distinct: ["month"], select: { month: true } }),
  ]);
  const report = buildMonthlySalaryReport(employees.map((employee) => ({
    ...employee, propertyId: employee.property?.id ?? null, propertyName: employee.property?.name ?? null,
    salaryAmount: Number(employee.salaryAmount),
    payment: employee.payrollRecords[0] ? {
      dueAmount: employee.payrollRecords[0].dueAmount == null ? null : Number(employee.payrollRecords[0].dueAmount),
      amountPaid: Number(employee.payrollRecords[0].amountPaid), paidAt: employee.payrollRecords[0].paidAt,
    } : null,
  })), month);
  const trackedMonths = currentMonth >= LEDGER_START_MONTH ? paymentMonthRange(LEDGER_START_MONTH, currentMonth, 600) : [];
  return { ...report, month, months: [...new Set([month, currentMonth, ...trackedMonths, ...recordedMonths.map((entry) => entry.month)])].sort().reverse() };
}
