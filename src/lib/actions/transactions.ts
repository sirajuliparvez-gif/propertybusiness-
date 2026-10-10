"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import {
  isDirectlyEditableTransactionType,
  isValidTransactionDate,
} from "@/lib/transaction-edit";

const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "BANK", "BANK_CHECK", "OTHER"] as const;

export type TransactionEditErrorCode =
  | "missingFields"
  | "invalidAmount"
  | "invalidDate"
  | "notFound"
  | "notEditable";

export type TransactionEditResult =
  | { ok: true }
  | { ok: false; error: TransactionEditErrorCode };

export type TransactionDeleteErrorCode = "missingFields" | "notFound" | "notEditable";

export type TransactionDeleteResult =
  | { ok: true }
  | { ok: false; error: TransactionDeleteErrorCode };

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function updateManualTransaction(
  formData: FormData
): Promise<TransactionEditResult> {
  const locale = await getLocale();
  const transactionId = str(formData, "transactionId");
  const amountRaw = str(formData, "amount");
  const dateRaw = str(formData, "date");
  const notes = str(formData, "notes");

  if (!transactionId || !amountRaw || !dateRaw || !notes) {
    return { ok: false, error: "missingFields" };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalidAmount" };
  }
  if (!isValidTransactionDate(dateRaw)) {
    return { ok: false, error: "invalidDate" };
  }

  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      type: true,
      propertyId: true,
      rentPaymentId: true,
      payrollRecordId: true,
      utilityBillId: true,
      ownerRentPaymentId: true,
      tenantLeaseId: true,
      guestStayId: true,
    },
  });
  if (!existing) return { ok: false, error: "notFound" };

  const hasSourceRecord = Boolean(
    existing.rentPaymentId ||
      existing.payrollRecordId ||
      existing.utilityBillId ||
      existing.ownerRentPaymentId ||
      existing.tenantLeaseId ||
      existing.guestStayId
  );
  if (!isDirectlyEditableTransactionType(existing.type) || hasSourceRecord) {
    return { ok: false, error: "notEditable" };
  }

  const methodRaw = str(formData, "method");
  const method = PAYMENT_METHODS.find((candidate) => candidate === methodRaw) ?? null;

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { amount: amountRaw, date: new Date(dateRaw), method, notes },
  });

  for (const path of localizedMutationPaths(locale, "/transactions")) {
    revalidatePath(path);
  }
  if (existing.propertyId) {
    revalidatePath(`/${locale}/properties/${existing.propertyId}`);
  }

  return { ok: true };
}

export async function deleteManualTransaction(
  formData: FormData
): Promise<TransactionDeleteResult> {
  const locale = await getLocale();
  const transactionId = str(formData, "transactionId");
  if (!transactionId) return { ok: false, error: "missingFields" };

  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      type: true,
      propertyId: true,
      rentPaymentId: true,
      payrollRecordId: true,
      utilityBillId: true,
      ownerRentPaymentId: true,
      tenantLeaseId: true,
      guestStayId: true,
    },
  });
  if (!existing) return { ok: false, error: "notFound" };

  const hasSourceRecord = Boolean(
    existing.rentPaymentId ||
      existing.payrollRecordId ||
      existing.utilityBillId ||
      existing.ownerRentPaymentId ||
      existing.tenantLeaseId ||
      existing.guestStayId
  );
  if (!isDirectlyEditableTransactionType(existing.type) || hasSourceRecord) {
    return { ok: false, error: "notEditable" };
  }

  await prisma.transaction.delete({ where: { id: transactionId } });

  for (const path of localizedMutationPaths(locale, "/transactions")) {
    revalidatePath(path);
  }
  if (existing.propertyId) {
    revalidatePath(`/${locale}/properties/${existing.propertyId}`);
  }

  return { ok: true };
}

