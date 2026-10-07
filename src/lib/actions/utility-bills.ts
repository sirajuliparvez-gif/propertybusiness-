"use server";

import { dhakaToday } from "@/lib/dhaka-time";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Every reason an edit/delete can be refused, as a stable key the client
// translates — the dialogs stay open and show the message instead of the
// action throwing (which would blow up the whole page). Success is the
// other branch: the action redirects back to `returnTo` and never returns.
export type UtilityBillErrorCode =
  | "missingFields"
  | "notFound"
  | "unitNotInProperty"
  | "amountBelowPaid"
  | "hasPayments";

export type UtilityBillActionResult = { ok: true } | { ok: false; error: UtilityBillErrorCode };

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
  // Water is company policy: always the company's own cost, never billed to
  // a tenant — enforced here too (not just the disabled checkbox client-side)
  // in case of a stale/tampered form.
  const paidByCompany = type === "WATER" ? true : formData.get("paidByCompany") === "true";
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
        type: true,
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

    // Water is company policy: never collected from the tenant, no matter
    // what the form sent — enforced server-side too, not just by disabling
    // the input client-side, in case of a stale/tampered form.
    const tenantAmountRaw =
      bill.type === "WATER"
        ? 0
        : tenantAmountStr != null
          ? Number(tenantAmountStr)
          : bill.paidByCompany
            ? 0
            : remaining;
    const tenantAmountInput = Math.max(0, tenantAmountRaw);
    // The portion that actually settles the bill is capped at what's left;
    // anything the tenant pays beyond that is real company profit (e.g. a
    // flat/rounded rate charged regardless of the exact meter share), not
    // more reimbursement than the bill itself.
    const billPortion = Math.min(tenantAmountInput, remaining);
    const profitAmount = Math.max(0, tenantAmountInput - remaining);
    const companyAmount = companyCoversRest ? remaining - billPortion : 0;
    if (billPortion <= 0 && companyAmount <= 0 && profitAmount <= 0) return;

    const newPaidAmount = alreadyPaid + billPortion + companyAmount;
    const newStatus = newPaidAmount >= totalAmount ? "PAID" : "PARTIAL";
    const paidDate = dhakaToday();

    await tx.utilityBill.update({
      where: { id: billId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    if (billPortion > 0) {
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
          amount: billPortion,
          method,
          unitId: bill.unitId,
          tenantLeaseId: bill.unit?.tenantLeases[0]?.id ?? null,
          utilityBillId: billId,
          date: paidDate,
        },
      });
    }
    if (profitAmount > 0) {
      // Tenant paid more than the actual bill — a real gain for the company,
      // unlike the reimbursement above, so it counts toward netProfit.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_PROFIT_FROM_TENANT",
          direction: "INCOMING",
          amount: profitAmount,
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

// Edits a bill in place — type, unit, amount, due date, who pays it and the
// meter reading — without disturbing the payments already recorded against
// it. Every way it can be refused comes back as a code (the dialog shows the
// translated message); a successful edit redirects back to `returnTo` like
// every other action in this file.
//
// Refusals:
//  - amount dropping below paidAmount — that money is already in the ledger,
//    so a lower amount would understate what was collected;
//  - a unit that isn't part of this bill's property (bills move unit, never
//    property).
export async function updateUtilityBill(formData: FormData): Promise<UtilityBillActionResult> {
  const locale = await getLocale();
  const billId = str(formData, "billId");
  const propertyId = str(formData, "propertyId");
  const typeRaw = formData.get("type");
  const type =
    typeRaw === "GAS" || typeRaw === "ELECTRICITY" || typeRaw === "WATER" || typeRaw === "OTHER"
      ? typeRaw
      : "OTHER";
  const unitId = str(formData, "unitId");
  const amount = str(formData, "amount");
  const dueDate = str(formData, "dueDate");
  if (!billId || !propertyId || !amount || !dueDate) return { ok: false, error: "missingFields" };
  // Same two company rules as addUtilityBill, re-applied server-side here
  // (stale/tampered form can't make a WATER bill tenant-paid, or smuggle a
  // meter reading onto a gas bill).
  const paidByCompany = type === "WATER" ? true : formData.get("paidByCompany") === "true";
  const meterReadingRaw = type === "ELECTRICITY" ? str(formData, "meterReading") : null;
  const meterReading = meterReadingRaw ? Number(meterReadingRaw) : null;
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;

  const problem = await prisma.$transaction(async (tx) => {
    const bill = await tx.utilityBill.findUnique({
      where: { id: billId },
      select: { unitId: true, paidAmount: true },
    });
    if (!bill) return "notFound" as const;
    if (unitId) {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        select: { unitType: { select: { propertyId: true } } },
      });
      if (!unit || unit.unitType.propertyId !== propertyId) return "unitNotInProperty" as const;
    }
    const paidAmount = Number(bill.paidAmount);
    if (Number(amount) < paidAmount) return "amountBelowPaid" as const;

    await tx.utilityBill.update({
      where: { id: billId },
      data: {
        type,
        unitId,
        month: dueDate.slice(0, 7),
        dueDate: new Date(dueDate),
        amount,
        paidByCompany,
        meterReading,
        // Rebuilt from what's settled against the NEW amount — a ৳2000 bill
        // already fully collected, edited down to ৳1000, is PAID rather than
        // an impossible overpaid PARTIAL.
        status: paidAmount >= Number(amount) ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID",
      },
    });
    // The bill moved unit: its ledger rows move with it, otherwise unit and
    // transaction views would disagree about where this money sits (the
    // reimbursement follows whichever tenant is active on the new unit).
    if (unitId !== bill.unitId) {
      const lease = unitId
        ? await tx.tenantLease.findFirst({
            where: { unitId, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
        : null;
      await tx.transaction.updateMany({
        where: { utilityBillId: billId },
        data: { unitId: unitId ?? null, tenantLeaseId: lease?.id ?? null },
      });
    }
    return null;
  });
  if (problem) return { ok: false, error: problem };

  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
  // Unreachable — redirect() throws — but TypeScript can't see that through
  // next-intl's destructured navigation object, so the success path closes
  // here to keep the action's declared return type honest.
  return { ok: true };
}

// Deleting is only ever the correction of a bill nobody has paid for yet.
// Once money is recorded against it the row must stay as the history of
// that money — refused with a code (the dialog shows how much has already
// been collected) rather than deleted or thrown.
export async function deleteUtilityBill(formData: FormData): Promise<UtilityBillActionResult> {
  const locale = await getLocale();
  const billId = str(formData, "billId");
  const propertyId = str(formData, "propertyId");
  if (!billId || !propertyId) return { ok: false, error: "missingFields" };
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;

  const problem = await prisma.$transaction(async (tx) => {
    const bill = await tx.utilityBill.findUnique({
      where: { id: billId },
      select: {
        paidAmount: true,
        transactions: { select: { id: true }, take: 1 },
        documents: { select: { id: true } },
      },
    });
    if (!bill) return "notFound" as const;
    if (Number(bill.paidAmount) > 0 || bill.transactions.length > 0) return "hasPayments" as const;
    // Attached file rows go with the bill — left alone they'd point at
    // nothing (the uploaded file itself stays in storage either way).
    if (bill.documents.length > 0) {
      await tx.document.deleteMany({ where: { utilityBillId: billId } });
    }
    await tx.utilityBill.delete({ where: { id: billId } });
    return null;
  });
  if (problem) return { ok: false, error: problem };

  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
  // Unreachable — redirect() throws — but TypeScript can't see that through
  // next-intl's destructured navigation object, so the success path closes
  // here to keep the action's declared return type honest.
  return { ok: true };
}
