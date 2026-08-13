"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// The company owner/admin taking cash out of the office, or asking the
// company to pay a third party on their behalf — always propertyId null
// (never tied to a single property's P&L) and always TransactionType
// OWNER_WITHDRAWAL, which is deliberately excluded from every P&L
// classification list (reports-data.ts, transactions-data.ts) so it reduces
// cash flow but never reported net profit, same pass-through treatment as
// the DOWNPAYMENT_* types.
export async function recordOwnerWithdrawal(formData: FormData) {
  const locale = await getLocale();

  const amount = str(formData, "amount");
  const date = str(formData, "date");
  const recipientName = str(formData, "recipientName");
  const notes = str(formData, "notes");
  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  if (!amount || !date || !recipientName) throw new Error("Missing required withdrawal fields");

  await prisma.transaction.create({
    data: {
      propertyId: null,
      type: "OWNER_WITHDRAWAL",
      direction: "OUTGOING",
      amount,
      date: new Date(date),
      notes: notes ? `${recipientName} — ${notes}` : recipientName,
      method,
    },
  });

  const returnTo = str(formData, "returnTo") ?? "/transactions";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
