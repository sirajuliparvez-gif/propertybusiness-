"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import { reversedPaymentState } from "@/lib/payment-reversal";

export type PaymentReversalErrorCode = "missingFields" | "notFound" | "notReversible";
export type PaymentReversalResult = { ok: true } | { ok: false; error: PaymentReversalErrorCode };

const UTILITY_PAYMENT_TYPES = ["UTILITY_REIMBURSEMENT_FROM_TENANT", "UTILITY_PROFIT_FROM_TENANT", "UTILITY_EXPENSE"] as const;

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function refresh(paths: string[]) {
  const locale = await getLocale();
  for (const path of new Set(paths.flatMap((p) => localizedMutationPaths(locale, p)))) revalidatePath(path);
}

// Takes one mistaken salary payment back: the cash-flow entry is deleted and the month's
// "paid so far" goes down by that amount, so the salary shows as owed again.
export async function reverseSalaryPayment(formData: FormData): Promise<PaymentReversalResult> {
  await requireAdmin();
  const transactionId = str(formData, "transactionId");
  if (!transactionId) return { ok: false, error: "missingFields" };

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { type: true, amount: true, payrollRecordId: true },
    });
    if (!payment) return "notFound" as const;
    if (payment.type !== "PAYROLL_EXPENSE" || !payment.payrollRecordId) return "notReversible" as const;

    const record = await tx.payrollRecord.findUnique({
      where: { id: payment.payrollRecordId },
      select: { id: true, amountPaid: true, dueAmount: true },
    });
    if (!record) return "notFound" as const;

    const next = reversedPaymentState(
      Number(record.amountPaid),
      Number(payment.amount),
      Number(record.dueAmount ?? record.amountPaid)
    );
    const latestOther = await tx.transaction.findFirst({
      where: { payrollRecordId: record.id, NOT: { id: transactionId } },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    await tx.payrollRecord.update({
      where: { id: record.id },
      data: {
        amountPaid: next.paid,
        status: next.state === "PAID" ? "PAID" : next.state === "PARTIAL" ? "PARTIAL" : "PENDING",
        paidAt: next.state === "NONE" ? null : (latestOther?.date ?? null),
      },
    });
    await tx.transaction.delete({ where: { id: transactionId } });
    return "ok" as const;
  }, { isolationLevel: "Serializable" });

  if (result !== "ok") return { ok: false, error: result };
  await refresh(["/transactions", "/employees"]);
  return { ok: true };
}

// Takes one mistaken utility payment back (the tenant's share, the company's share or the
// extra paid over the bill). The bill's "paid so far" goes down by the part that counted
// toward the bill, so it shows as owed again. Payments that came in through a printed rent
// bill receipt are left alone, because that receipt records them too.
export async function reverseUtilityPayment(formData: FormData): Promise<PaymentReversalResult> {
  await requireAdmin();
  const transactionId = str(formData, "transactionId");
  if (!transactionId) return { ok: false, error: "missingFields" };

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { type: true, amount: true, utilityBillId: true, paymentReceiptId: true },
    });
    if (!payment) return "notFound" as const;
    if (!(UTILITY_PAYMENT_TYPES as readonly string[]).includes(payment.type) || !payment.utilityBillId) {
      return "notReversible" as const;
    }
    if (payment.paymentReceiptId) {
      const receipt = await tx.rentBillReceiptCheck.findUnique({ where: { receiptId: payment.paymentReceiptId }, select: { receiptId: true } });
      if (receipt) return "notReversible" as const;
    }

    // Extra money paid over the bill never counted toward its paid amount.
    if (payment.type !== "UTILITY_PROFIT_FROM_TENANT") {
      const bill = await tx.utilityBill.findUnique({
        where: { id: payment.utilityBillId },
        select: { amount: true, paidAmount: true },
      });
      if (!bill) return "notFound" as const;
      const next = reversedPaymentState(Number(bill.paidAmount), Number(payment.amount), Number(bill.amount));
      await tx.utilityBill.update({
        where: { id: payment.utilityBillId },
        data: { paidAmount: next.paid, status: next.state === "PAID" ? "PAID" : next.state === "PARTIAL" ? "PARTIAL" : "UNPAID" },
      });
    }
    await tx.transaction.delete({ where: { id: transactionId } });
    return "ok" as const;
  }, { isolationLevel: "Serializable" });

  if (result !== "ok") return { ok: false, error: result };
  await refresh(["/transactions", "/utility-bills", "/utility-bills/arrears"]);
  return { ok: true };
}
