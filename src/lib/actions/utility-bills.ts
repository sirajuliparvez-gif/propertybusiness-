"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function addUtilityBill(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  const typeRaw = formData.get("type");
  const type =
    typeRaw === "GAS" || typeRaw === "ELECTRICITY" || typeRaw === "WATER" || typeRaw === "OTHER"
      ? typeRaw
      : "OTHER";
  const unitId = str(formData, "unitId");
  const amount = str(formData, "amount");
  const dueDate = str(formData, "dueDate");
  if (!amount || !dueDate) throw new Error("Missing required bill fields");
  const paidByCompany = formData.get("paidByCompany") === "true";
  // Only meaningful for electricity — the field is hidden for every other
  // type client-side, but guard here too in case of a stale/tampered form.
  const meterReadingRaw = type === "ELECTRICITY" ? str(formData, "meterReading") : null;
  const meterReading = meterReadingRaw ? Number(meterReadingRaw) : null;

  await prisma.utilityBill.create({
    data: {
      propertyId,
      unitId,
      type,
      month: dueDate.slice(0, 7),
      dueDate: new Date(dueDate),
      amount,
      paidByCompany,
      meterReading,
    },
  });

  // Reachable from both the per-property page and the cross-property global
  // Utility Bills page — each redirects back to wherever it was submitted from.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function payUtilityBill(formData: FormData) {
  const locale = await getLocale();
  const billId = formData.get("billId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!billId || !propertyId) throw new Error("Missing bill or property id");

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
    const bill = await tx.utilityBill.findUnique({
      where: { id: billId },
      select: {
        amount: true,
        unitId: true,
        status: true,
        paidByCompany: true,
        unit: {
          select: {
            tenantLeases: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    // Bill already paid or gone (stale reference) — silent no-op, the
    // redirect below still refreshes the page to the current true state.
    if (!bill || bill.status !== "UNPAID") return;

    await tx.utilityBill.update({ where: { id: billId }, data: { status: "PAID" } });

    if (bill.paidByCompany) {
      // Company absorbs this one itself (e.g. water bill, per company policy)
      // — a real cost, not a pass-through, so it counts toward netProfit.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_EXPENSE",
          direction: "OUTGOING",
          amount: bill.amount,
          method,
          unitId: bill.unitId,
          utilityBillId: billId,
          date: new Date(),
        },
      });
    } else {
      // The company's policy: every other bill gets assigned to whichever
      // tenant's unit it belongs to, the tenant pays the company, and the
      // company pays the utility company separately (outside this system,
      // per the user). So clicking this button records the tenant's
      // reimbursement — not the company's own outgoing expense — and is
      // excluded from netProfit the same way DOWNPAYMENT_REFUND_TO_TENANT
      // already is (pass-through, not real income). tenantLeaseId is
      // auto-derived from the unit's current active lease, since the bill is
      // only ever assigned by unit.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_REIMBURSEMENT_FROM_TENANT",
          direction: "INCOMING",
          amount: bill.amount,
          method,
          unitId: bill.unitId,
          tenantLeaseId: bill.unit?.tenantLeases[0]?.id ?? null,
          utilityBillId: billId,
          date: new Date(),
        },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
