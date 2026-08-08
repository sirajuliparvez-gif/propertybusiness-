"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Records this month's salary as paid to an employee — mirrors
// recordOwnerRentPayment's "log after the fact" simplicity (always writes
// PAID), plus the linked Transaction. PayrollRecord's unique key is just
// (employeeId, month) with no nullable column, so upsert is safe here.
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
    const payrollRecord = await tx.payrollRecord.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: { amountPaid: amount, status: "PAID", paidAt: paidDate },
      create: {
        employeeId,
        month,
        dueDate: paidDate,
        amountPaid: amount,
        status: "PAID",
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
