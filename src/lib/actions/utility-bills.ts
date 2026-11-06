"use server";

import { dhakaISO, dhakaToday } from "@/lib/dhaka-time";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import { prepareTenantUtilityBillRows, readUtilityBillFields, validateTenantUtilityBills, validMeterReadings } from "@/lib/utility-bill-entry";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { applyUtilityBillInstallment } from "@/lib/payment-progress";
import { requireCurrentUser } from "@/lib/auth/session";
import { isValidTransactionDate } from "@/lib/transaction-edit";
import { readUtilityType, serializeUtilityBillDefaults, utilityBillTypes } from "@/lib/utility-bill-defaults";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function getTenantUtilityBillDefaults(tenantLeaseId: string) {
  await requireCurrentUser();
  return serializeUtilityBillDefaults(await prisma.tenantUtilityBillDefault.findMany({ where: { tenantLeaseId } }));
}

export async function saveTenantUtilityBillDefaults(tenantLeaseId: string, formData: FormData) {
  await requireCurrentUser();
  const defaults: Prisma.TenantUtilityBillDefaultCreateManyInput[] = [];
  for (const type of utilityBillTypes) {
    const amount = str(formData, `amount-${type}`);
    if (amount != null && (!/^(\d{1,12}(\.\d{1,2})?|\.\d{1,2})$/.test(amount) || Number(amount) <= 0)) return false;
    const payer = formData.get(`payer-${type}`);
    const paidByCompany = type === "WATER" || payer === "company" ? true : payer === "tenant" ? false : null;
    if (amount != null || (paidByCompany != null && type !== "WATER")) {
      defaults.push({ tenantLeaseId, type, amount, paidByCompany });
    }
  }

  const saved = await prisma.$transaction(async (tx) => {
    const [lease] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "TenantLease" WHERE id = ${tenantLeaseId} AND status = 'ACTIVE' FOR UPDATE
    `;
    if (!lease) return false;
    await tx.tenantUtilityBillDefault.deleteMany({ where: { tenantLeaseId } });
    await tx.tenantUtilityBillDefault.createMany({ data: defaults });
    return true;
  });

  if (saved) {
    revalidatePath("/[locale]/tenants/[id]", "page");
    revalidatePath("/[locale]/utility-bills", "page");
    revalidatePath("/[locale]/properties/[id]", "page");
  }
  return saved;
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
  | "hasPayments"
  | "invalidMeterReading";

export type UtilityBillActionResult = { ok: true } | { ok: false; error: UtilityBillErrorCode };

export async function addUtilityBill(formData: FormData) {
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId");
  const fields = readUtilityBillFields(formData);
  if (!propertyId || !fields || !isValidTransactionDate(fields.dueDate)) throw new Error("Missing required bill fields");
  if (!validMeterReadings(fields.meterReading, fields.previousMeterReadingOverride)) {
    throw new Error("Invalid electricity meter readings");
  }

  const unitId = str(formData, "unitId");
  const lease = unitId ? await prisma.tenantLease.findFirst({
    where: { unitId, status: "ACTIVE", unit: { unitType: { propertyId } } },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
    select: { startDate: true, utilityBillDefaults: true },
  }) : null;
  const defaults = lease && fields.dueDate >= dhakaISO(lease.startDate) ? lease.utilityBillDefaults : [];
  const locked = defaults.find((item) => item.type === fields.type);
  await prisma.utilityBill.create({
    data: {
      ...fields,
      propertyId,
      unitId,
      amount: locked?.amount ?? fields.amount,
      paidByCompany: locked?.paidByCompany ?? fields.paidByCompany,
      month: fields.dueDate.slice(0, 7),
      dueDate: new Date(fields.dueDate),
    },
  });

  // Reachable from both the per-property page and the cross-property global
  // Utility Bills page — each redirects back to wherever it was submitted from.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function getPreviousTenantMeterReading(tenantLeaseId: string, dueDate: string) {
  await requireCurrentUser();
  if (!isValidTransactionDate(dueDate)) return null;
  return findPreviousMeterReading(dueDate, { unit: { tenantLeases: { some: { id: tenantLeaseId } } } });
}

export async function getPreviousPropertyMeterReading(propertyId: string, unitId: string, dueDate: string) {
  await requireCurrentUser();
  if (!propertyId || !isValidTransactionDate(dueDate)) return null;
  return findPreviousMeterReading(dueDate, { propertyId, unitId: unitId || null, property: { deletedAt: null } });
}

async function findPreviousMeterReading(dueDate: string, scope: Prisma.UtilityBillWhereInput) {
  const previousBill = await prisma.utilityBill.findFirst({
    where: {
      type: "ELECTRICITY",
      meterReading: { not: null },
      dueDate: { lte: new Date(dueDate) },
      ...scope,
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    select: { dueDate: true, meterReading: true },
  });
  return previousBill?.meterReading == null ? null : {
    date: dhakaISO(previousBill.dueDate),
    reading: Number(previousBill.meterReading),
  };
}

export async function addTenantUtilityBills(
  tenantLeaseId: string,
  billingMonth: string,
  bills: FormData[],
) {
  await requireCurrentUser();
  const validated = validateTenantUtilityBills(billingMonth, bills);
  if (!validated.ok) return validated;

  const lease = await prisma.tenantLease.findUnique({
    where: { id: tenantLeaseId },
    select: { id: true, status: true, startDate: true, unitId: true, utilityBillDefaults: true, unit: { select: { unitType: { select: { propertyId: true } } } } },
  });
  if (!lease || lease.status !== "ACTIVE") {
    return { ok: false, error: "utilityBillOutsideLease" } as const;
  }
  const rows = prepareTenantUtilityBillRows(lease, lease.unit.unitType.propertyId, billingMonth, validated.bills);
  if (!rows) return { ok: false, error: "utilityBillOutsideLease" } as const;
  await prisma.utilityBill.createMany({ data: rows });

  const locale = await getLocale();
  revalidatePath(`/${locale}/tenants/${tenantLeaseId}`);
  revalidatePath(`/${locale}/tenants/${tenantLeaseId}/invoice`);
  revalidatePath(`/${locale}/rent/${tenantLeaseId}/invoice`);
  revalidatePath(`/${locale}/utility-bills`);
  revalidatePath(`/${locale}/properties/${lease.unit.unitType.propertyId}`);
  return { ok: true } as const;
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
        tenantLeaseId: true,
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
    const { billPortion, profitAmount, companyAmount, newPaidAmount, status: newStatus } =
      applyUtilityBillInstallment({
        totalAmount,
        alreadyPaid,
        tenantPaymentAmount: tenantAmountRaw,
        companyCoversRest,
      });
    if (billPortion <= 0 && companyAmount <= 0 && profitAmount <= 0) return;
    const paidDate = dhakaToday();

    const updated = await tx.utilityBill.updateMany({
      where: { id: billId, paidAmount: bill.paidAmount, status: bill.status },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });
    if (updated.count === 0) return;

    if (billPortion > 0) {
      // The company's policy: every other bill gets assigned to whichever
      // tenant's unit it belongs to, the tenant pays the company, and the
      // company pays the utility company separately (outside this system,
      // per the user). So this records the tenant's reimbursement — not the
      // company's own outgoing expense — and is excluded from netProfit the
      // same way DOWNPAYMENT_REFUND_TO_TENANT already is (pass-through, not
      // real income). Older bills without an explicit lease use the unit’s active lease.
      await tx.transaction.create({
        data: {
          propertyId,
          type: "UTILITY_REIMBURSEMENT_FROM_TENANT",
          direction: "INCOMING",
          amount: billPortion,
          method,
          unitId: bill.unitId,
          tenantLeaseId: bill.tenantLeaseId ?? bill.unit?.tenantLeases[0]?.id ?? null,
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
          tenantLeaseId: bill.tenantLeaseId ?? bill.unit?.tenantLeases[0]?.id ?? null,
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
// translated message). Invoice edits refresh the open print dialog; other edits
// redirect back to their list.
//
// Refusals:
//  - amount dropping below paidAmount — that money is already in the ledger,
//    so a lower amount would understate what was collected;
//  - a unit that isn't part of this bill's property (bills move unit, never
//    property).
export async function updateUtilityBill(
  formData: FormData,
  invoice?: { leaseId: string; month: string; electricityReading?: true },
): Promise<UtilityBillActionResult> {
  await requireCurrentUser();
  const locale = await getLocale();
  const billId = str(formData, "billId");
  const propertyId = str(formData, "propertyId");
  const type = readUtilityType(formData.get("type"));
  const unitId = str(formData, "unitId");
  const amount = str(formData, "amount");
  const dueDate = str(formData, "dueDate");
  if (!billId || !propertyId || !amount || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !dueDate) {
    return { ok: false, error: "missingFields" };
  }
  // Same two company rules as addUtilityBill, re-applied server-side here
  // (stale/tampered form can't make a WATER bill tenant-paid, or smuggle a
  // meter reading onto a gas bill).
  const paidByCompany = type === "WATER" ? true : formData.get("paidByCompany") === "true";
  const meterReadingRaw = type === "ELECTRICITY" ? str(formData, "meterReading") : null;
  const meterReading = meterReadingRaw ? Number(meterReadingRaw) : null;
  const previousRaw = str(formData, "previousMeterReadingOverride");
  const previousMeterReadingOverride = type !== "ELECTRICITY" || previousRaw == null ? null : Number(previousRaw);
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;

  const problem = await prisma.$transaction(async (tx) => {
    const bill = await tx.utilityBill.findUnique({
      where: { id: billId },
      select: {
        unitId: true, propertyId: true, tenantLeaseId: true, month: true, dueDate: true,
        paidAmount: true, previousMeterReadingOverride: true, type: true, paidByCompany: true, amount: true,
      },
    });
    if (!bill || bill.propertyId !== propertyId) return "notFound" as const;
    let updatedAmount = amount;
    let updatedPayer = paidByCompany;
    if (invoice) {
      const lease = await tx.tenantLease.findUnique({
        where: { id: invoice.leaseId, status: "ACTIVE" },
        select: {
          unitId: true, startDate: true,
          utilityBillDefaults: { where: { type: "ELECTRICITY" }, select: { amount: true } },
        },
      });
      if (!lease || !unitId || lease.unitId !== unitId || bill.unitId !== unitId ||
          (bill.tenantLeaseId != null && bill.tenantLeaseId !== invoice.leaseId) ||
          bill.month !== invoice.month || dhakaISO(bill.dueDate) < dhakaISO(lease.startDate)) return "notFound" as const;
      if (!isValidTransactionDate(dueDate) || !dueDate.startsWith(`${invoice.month}-`) ||
          dueDate < dhakaISO(lease.startDate)) return "missingFields" as const;
      if (invoice.electricityReading) {
        if (type !== "ELECTRICITY" || bill.type !== "ELECTRICITY" || dueDate !== dhakaISO(bill.dueDate) ||
            meterReading == null || previousMeterReadingOverride == null) return "invalidMeterReading" as const;
        const fields = readUtilityBillFields(formData);
        if (lease.utilityBillDefaults[0]?.amount != null) {
          updatedAmount = bill.amount.toString();
        } else if (!str(formData, "electricityUnitRate") || !fields) {
          return "invalidMeterReading" as const;
        } else {
          updatedAmount = fields.amount;
        }
        updatedPayer = bill.paidByCompany;
      }
    }
    if (unitId) {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        select: { unitType: { select: { propertyId: true } } },
      });
      if (!unit || unit.unitType.propertyId !== propertyId) return "unitNotInProperty" as const;
    }
    const previous = type !== "ELECTRICITY" || formData.has("previousMeterReadingOverride")
      ? previousMeterReadingOverride
      : bill.previousMeterReadingOverride == null ? null : Number(bill.previousMeterReadingOverride);
    if (!validMeterReadings(meterReading, previous)) return "invalidMeterReading" as const;
    const paidAmount = Number(bill.paidAmount);
    if (Number(updatedAmount) < paidAmount) return "amountBelowPaid" as const;

    await tx.utilityBill.update({
      where: { id: billId },
      data: {
        type,
        unitId,
        ...(unitId !== bill.unitId ? { tenantLeaseId: null } : {}),
        month: dueDate.slice(0, 7),
        dueDate: new Date(dueDate),
        amount: updatedAmount,
        paidByCompany: updatedPayer,
        meterReading,
        previousMeterReadingOverride: previous,
        // Rebuilt from what's settled against the NEW amount — a ৳2000 bill
        // already fully collected, edited down to ৳1000, is PAID rather than
        // an impossible overpaid PARTIAL.
        status: paidAmount >= Number(updatedAmount) ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID",
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

  if (invoice) {
    revalidatePath(`/${locale}/rent/${invoice.leaseId}/invoice`);
    revalidatePath(`/${locale}/tenants/${invoice.leaseId}`);
    revalidatePath(`/${locale}/tenants/${invoice.leaseId}/invoice`);
    revalidatePath(`/${locale}/properties/${propertyId}`);
    revalidatePath(`/${locale}/utility-bills`);
    return { ok: true };
  }
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
