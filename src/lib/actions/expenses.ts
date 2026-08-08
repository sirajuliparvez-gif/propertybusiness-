"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function addExpense(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  const type = formData.get("type") === "OTHER" ? "OTHER" : "MAINTENANCE_EXPENSE";
  const amount = str(formData, "amount");
  const date = str(formData, "date");
  const notes = str(formData, "notes");
  const unitId = str(formData, "unitId");
  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  if (!amount || !date) throw new Error("Missing required expense fields");

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

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}
