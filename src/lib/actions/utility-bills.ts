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

// Settles a bill, possibly only partially, possibly split between the
// tenant's own reimbursement and the company writing off the rest as its own
// cost — e.g. a ৳1000 bill where the tenant pays ৳990 and the company
// absorbs the ৳10 shortfall as a penalty/loss, rather than the old all-one-
// or-all-the-other choice. `tenantAmount` is how much is being collected
// from the tenant THIS call (can be 0, can be partial — more can be
// collected later while the bill sits PARTIAL); `companyCoversRest` closes
// out whatever's left after that as a real UTILITY_EXPENSE right now. Both
// default from the bill's own paidByCompany flag when omitted, so the old
// one-click "pay the whole thing" flow still works unchanged.
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
  const tenantAmountStr = str(formData, "tenantAmount");
  const companyCoversRest = formData.get("companyCoversRest") === "true";

  await prisma.$transaction(async (tx) => {
    const bill = await tx.utilityBill.findUnique({
      where: { id: billId },
      select: {
        amount: true,
        paidAmount: true,
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
    // Bill already fully paid or gone (stale reference) — silent no-op, the
    // redirect below still refreshes the page to the current true state.
    if (!bill || bill.status === "PAID") return;

    const totalAmount = Number(bill.amount);
    const alreadyPaid = Number(bill.paidAmount);
    const remaining = Math.max(0, totalAmount - alreadyPaid);

    const tenantAmountRaw = tenantAmountStr != null ? Number(tenantAmountStr) : bill.paidByCompany ? 0 : remaining;
    const tenantAmount = Math.min(Math.max(0, tenantAmountRaw), remaining);
    const companyAmount = companyCoversRest ? remaining - tenantAmount : 0;
    if (tenantAmount <= 0 && companyAmount <= 0) return;

    const newPaidAmount = alreadyPaid + tenantAmount + companyAmount;
    const newStatus = newPaidAmount >= totalAmount ? "PAID" : "PARTIAL";
    const paidDate = new Date();

    await tx.utilityBill.update({
      where: { id: billId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    if (tenantAmount > 0) {
      // The company's policy: every other bill gets assigned to whichever
      // tenant's unit it belongs to, the tenant pays the company, and the
      // company pays the utility company separately (outside this system,
      // per the user). So this records the tenant's reimbursement — not the
      // company's own outgoing expense — and is excluded from netProfit the
      // same way DOWNPAYMENT_REFUND_TO_TENANT already is (pass-through, not
      // real income). tenantLeaseId is auto-derived from the unit's current
      // active lease, since the bill is only ever assigned by unit.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_REIMBURSEMENT_FROM_TENANT",
          direction: "INCOMING",
          amount: tenantAmount,
          method,
          unitId: bill.unitId,
          tenantLeaseId: bill.unit?.tenantLeases[0]?.id ?? null,
          utilityBillId: billId,
          date: paidDate,
        },
      });
    }
    if (companyAmount > 0) {
      // Company absorbs this portion itself (e.g. a full water bill, or the
      // shortfall a tenant didn't cover) — a real cost, not a pass-through,
      // so it counts toward netProfit.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_EXPENSE",
          direction: "OUTGOING",
          amount: companyAmount,
          method,
          unitId: bill.unitId,
          utilityBillId: billId,
          date: paidDate,
        },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
