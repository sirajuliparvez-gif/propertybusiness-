import { dhakaISO } from "@/lib/dhaka-time";
import { LEDGER_START_MONTH } from "@/lib/rent-ledger";

export type SalaryReportEmployee = {
  id: string; name: string; role: string;
  propertyId: string | null; propertyName: string | null;
  joinedAt: Date; terminatedAt: Date | null; status: string; salaryAmount: number;
  payment: { dueAmount: number | null; amountPaid: number; paidAt: Date | null } | null;
};

export function buildMonthlySalaryReport(employees: SalaryReportEmployee[], month: string) {
  const rows = employees.flatMap((employee) => {
    const employed = dhakaISO(employee.joinedAt).slice(0, 7) <= month &&
      (employee.status === "ACTIVE" || (employee.terminatedAt != null && dhakaISO(employee.terminatedAt).slice(0, 7) >= month));
    if (!employee.payment && (!employed || month < LEDGER_START_MONTH)) return [];
    // Match the salary ledger's legacy fallback; a later raise must never
    // overwrite the amount due on an existing payroll record.
    const due = employee.payment ? (employee.payment.dueAmount ?? employee.payment.amountPaid) : employee.salaryAmount;
    const paid = employee.payment?.amountPaid ?? 0;
    const remaining = Math.max(0, due - paid);
    return [{
      id: employee.id, name: employee.name, role: employee.role,
      propertyId: employee.propertyId, propertyName: employee.propertyName,
      due, paid, remaining, credit: Math.max(0, paid - due), paidAt: employee.payment?.paidAt ?? null,
      status: remaining === 0 ? "PAID" as const : paid > 0 ? "PARTIAL" as const : "PENDING" as const,
    }];
  }).sort((a, b) => (a.propertyName ?? "").localeCompare(b.propertyName ?? "") || a.name.localeCompare(b.name));
  const totals = rows.reduce((sum, row) => ({
    due: sum.due + row.due, paid: sum.paid + row.paid,
    remaining: sum.remaining + row.remaining, credit: sum.credit + row.credit,
    unpaidStaff: sum.unpaidStaff + (row.remaining > 0 ? 1 : 0),
  }), { due: 0, paid: 0, remaining: 0, credit: 0, unpaidStaff: 0 });
  return { rows, totals };
}
