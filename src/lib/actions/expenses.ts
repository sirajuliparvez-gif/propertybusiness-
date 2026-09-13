"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// propertyId is null for a company-wide/office expense (rent isn't tied to
// any single property's P&L) — same nullable convention as company-staff
// Employee.propertyId. Reports already fold a null-propertyId
// MAINTENANCE_EXPENSE/OTHER transaction into the synthetic company row
// (reports-data.ts's COMPANY_KEY), so no reporting changes were needed.
export async function addExpense(formData: FormData) {
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId");

  const type = formData.get("type") === "OTHER" ? "OTHER" : "MAINTENANCE_EXPENSE";
  const amount = str(formData, "amount");
  const date = str(formData, "date");
  const notes = str(formData, "notes");
  const unitId = propertyId ? str(formData, "unitId") : null;
  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  // notes is required here (enforced client-side too) — with only two broad
  // categories (repair/other), it's the one place a specific reason for the
  // expense actually gets recorded, so an expense with no reason at all
  // isn't useful to anyone reviewing the ledger later.
  if (!amount || !date || !notes) throw new Error("Missing required expense fields");

  await prisma.transaction.create({
    data: {
      propertyId,
      type,
      direction: "OUTGOING",
      amount,
      date: new Date(date),
      notes,
      unitId,
      method,
    },
  });

  const returnTo = str(formData, "returnTo") ?? (propertyId ? `/properties/${propertyId}` : "/transactions");
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
