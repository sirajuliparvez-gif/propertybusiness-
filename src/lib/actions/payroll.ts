"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { buildRentLedger, overdueEntries, totalOverdue } from "@/lib/rent-ledger";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Records this month's salary as paid to an employee. dueAmount snapshots
// the employee's current salaryAmount the first time this month's record is
// touched (so a later raise doesn't retroactively change what an old month
// owed — same reasoning as RentPayment.dueAmount). Status now genuinely
// reflects amount vs. due instead of always writing PAID, so an employee
// paid less than their full salary correctly shows PARTIAL rather than a
// false "settled".
export async function recordPayrollPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId"); // null for company staff
  const employeeId = formData.get("employeeId") as string;
  if (!employeeId) throw new Error("Missing employee id");

  const dateStr = str(formData, "date");
  const amountStr = str(formData, "amount");
  if (!dateStr || !amountStr) throw new Error("Missing required payment fields");
  const amount = Number(amountStr);
  const month = dateStr.slice(0, 7);
  const paidDate = new Date(dateStr);

  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { salaryAmount: true } });
    if (!employee) throw new Error("Employee not found");
    const dueAmount = Number(employee.salaryAmount);
    const status = amount >= dueAmount ? "PAID" : "PARTIAL";

    const payrollRecord = await tx.payrollRecord.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: { dueAmount, amountPaid: amount, status, paidAt: paidDate },
      create: {
        employeeId,
        month,
        dueDate: paidDate,
        dueAmount,
        amountPaid: amount,
        status,
        paidAt: paidDate,
      },
    });

    await tx.transaction.create({
      data: {
        propertyId,
        type: "PAYROLL_EXPENSE",
        direction: "OUTGOING",
        amount,
        method,
        payrollRecordId: payrollRecord.id,
        date: paidDate,
      },
    });
  });

  const returnTo = str(formData, "returnTo") ?? (propertyId ? `/properties/${propertyId}` : "/employees");
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Settles back salary in one go — a lump sum applied oldest-month first
// across however many months are actually overdue (real PayrollRecord rows
// AND months nobody ever recorded, per rent-ledger.ts — reused here as-is,
// its "monthly recurring due" logic is identical for salary and rent).
// Mirrors recordOverdueRentPayment exactly.
export async function recordOverduePayrollPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId"); // null for company staff
  const employeeId = formData.get("employeeId") as string;
  if (!employeeId) throw new Error("Missing employee id");

  const dateStr = str(formData, "date");
  const amountStr = str(formData, "amount");
  if (!dateStr || !amountStr) throw new Error("Missing required payment fields");
  let remaining = Number(amountStr);
  if (!(remaining > 0)) throw new Error("Amount must be greater than zero");
  const paidDate = new Date(dateStr);

  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const existingPayments = await prisma.payrollRecord.findMany({
    where: { employeeId },
    select: { id: true, month: true, dueDate: true, dueAmount: true, amountPaid: true, status: true, paidAt: true },
  });
  const asOf = employee.status === "ACTIVE" ? new Date() : (employee.terminatedAt ?? new Date());
  const ledger = buildRentLedger(
    employee.joinedAt,
    Number(employee.salaryAmount),
    existingPayments.map((pr) => ({
      id: pr.id,
      month: pr.month,
      dueDate: pr.dueDate,
      dueAmount: pr.dueAmount != null ? Number(pr.dueAmount) : Number(pr.amountPaid),
      paidAmount: Number(pr.amountPaid),
      status: pr.status === "PENDING" ? "UNPAID" : pr.status,
      paidAt: pr.paidAt,
    })),
    asOf
  );
  const overdue = overdueEntries(ledger); // oldest month first
  if (overdue.length === 0) throw new Error("No overdue salary for this employee");
  if (remaining > totalOverdue(ledger)) {
    throw new Error("Amount exceeds total overdue salary");
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of overdue) {
      if (remaining <= 0) break;
      const payThisMonth = Math.min(remaining, entry.gap);
      const newPaidAmount = entry.paidAmount + payThisMonth;
      const newStatus = newPaidAmount >= entry.dueAmount ? "PAID" : "PARTIAL";

      const payrollRecord = entry.rentPaymentId
        ? await tx.payrollRecord.update({
            where: { id: entry.rentPaymentId },
            data: { amountPaid: newPaidAmount, status: newStatus, paidAt: paidDate },
          })
        : await tx.payrollRecord.create({
            data: {
              employeeId,
              month: entry.month,
              dueDate: entry.dueDate,
              dueAmount: entry.dueAmount,
              amountPaid: newPaidAmount,
              status: newStatus,
              paidAt: paidDate,
            },
          });

      await tx.transaction.create({
        data: {
          propertyId,
          type: "PAYROLL_EXPENSE",
          direction: "OUTGOING",
          amount: payThisMonth,
          method,
          payrollRecordId: payrollRecord.id,
          date: paidDate,
        },
      });

      remaining -= payThisMonth;
    }
  });

  const returnTo = str(formData, "returnTo") ?? (propertyId ? `/properties/${propertyId}` : "/employees");
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
