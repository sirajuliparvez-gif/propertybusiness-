"use server";

import { randomUUID } from "node:crypto";
import { dhakaISO, dhakaNow, dhakaTodayISO } from "@/lib/dhaka-time";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { allocateRentPayment, buildRentLedger, overdueEntries, LEDGER_START_MONTH, RENT_DUE_DAY } from "@/lib/rent-ledger";
import { applyRentInstallment, isRentPaymentSettled } from "@/lib/payment-progress";
import {
  isPaymentMonth,
  paymentMonthDueDate,
  paymentMonthRange,
  previousPaymentMonth,
  resolvePaymentMonth,
} from "@/lib/payment-month";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import { buildRentArrearsReport } from "@/lib/rent-arrears-report";
import { requireCurrentUser } from "@/lib/auth/session";
import { isValidTransactionDate } from "@/lib/transaction-edit";
import { withRentActionFeedback } from "@/lib/rent-action-feedback";
import { allocateInvoicePayment, invoicePaymentSnapshot, reconcileInvoiceAllocation, type InvoicePaymentLine, type ReceiptCheckLine } from "@/lib/invoice-payment";
import { tenantUtilityArrearsWhere } from "@/lib/tenant-utility-arrears";
import { limitToPrintedBill, type RentBillPrintRow } from "@/lib/rent-bill-print";
import { hasMonthlyTenantUtilityBill, prepareTenantUtilityBillRows, validateTenantUtilityBills } from "@/lib/utility-bill-entry";
import { numericRentRates, rentTermsDueAmount, resolveRentTermsForMonth } from "@/lib/rent-terms";

function leaseFallbackTerms(lease: {
  monthlyRentAmount: unknown;
  serviceChargeType: "FLAT" | "PERCENTAGE" | null;
  serviceChargeValue: unknown;
}) {
  return {
    monthlyRentAmount: Number(lease.monthlyRentAmount),
    serviceChargeType: lease.serviceChargeType,
    serviceChargeValue: lease.serviceChargeValue == null ? null : Number(lease.serviceChargeValue),
  };
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function revalidateLocalizedPath(locale: string, path: string) {
  for (const localizedPath of localizedMutationPaths(locale, path)) {
    revalidatePath(localizedPath);
  }
}

export type RentPaymentEditErrorCode =
  | "missingFields"
  | "notFound"
  | "notEditable"
  | "invalidAmount"
  | "amountExceedsDue"
  | "invalidBillingMonth"
  | "monthAlreadyExists";

export type RentPaymentEditResult =
  | { ok: true }
  | { ok: false; error: RentPaymentEditErrorCode };

export type RentPaymentDeleteErrorCode = "missingFields" | "notFound" | "notEditable";

export type RentPaymentDeleteResult =
  | { ok: true }
  | { ok: false; error: RentPaymentDeleteErrorCode };

export type RentArrearsCreateErrorCode =
  | "missingFields"
  | "invalidRange"
  | "currentOrFutureMonth"
  | "beforeLeaseStart"
  | "notFound";

export type RentArrearsCreateResult =
  | { ok: true }
  | { ok: false; error: RentArrearsCreateErrorCode };

export type HistoricalRentCorrectionErrorCode =
  | "missingFields"
  | "invalidMonth"
  | "beforeLeaseStart"
  | "futureMonth"
  | "invalidAmount"
  | "notFound"
  | "settledMonths";

export type HistoricalRentCorrectionResult =
  | { ok: true }
  | { ok: false; error: HistoricalRentCorrectionErrorCode };

// Repairs a rent that was accidentally configured as zero (or otherwise
// incorrectly) from a historical month. Missing past-month rows are created,
// while existing untouched UNPAID rows are recalculated. Any month that has
// money or an adjustment recorded is protected and makes the whole operation
// fail atomically so payment history can never be silently rewritten.
export async function correctHistoricalRent(formData: FormData): Promise<HistoricalRentCorrectionResult> {
  const locale = await getLocale();
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const effectiveMonth = str(formData, "effectiveMonth");
  const monthlyRentRaw = str(formData, "monthlyRentAmount");
  const returnTo = str(formData, "returnTo") ?? (tenantLeaseId ? `/tenants/${tenantLeaseId}` : "/tenants");
  if (!tenantLeaseId || !effectiveMonth || !monthlyRentRaw) return { ok: false, error: "missingFields" };
  if (!isPaymentMonth(effectiveMonth)) return { ok: false, error: "invalidMonth" };

  const currentMonth = dhakaTodayISO().slice(0, 7);
  if (effectiveMonth > currentMonth) return { ok: false, error: "futureMonth" };
  const monthlyRentAmount = Number(monthlyRentRaw);
  if (!Number.isFinite(monthlyRentAmount) || monthlyRentAmount <= 0) {
    return { ok: false, error: "invalidAmount" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const lease = await tx.tenantLease.findUnique({
      where: { id: tenantLeaseId },
      include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
    });
    if (!lease) return { error: "notFound" as const };

    const leaseStartMonth = dhakaISO(lease.startDate).slice(0, 7);
    if (effectiveMonth < leaseStartMonth) return { error: "beforeLeaseStart" as const };

    const fallbackTerms = leaseFallbackTerms(lease);
    const rates = numericRentRates(lease.rentRates);
    const existingTerms = resolveRentTermsForMonth(fallbackTerms, rates, effectiveMonth);
    const correctedTerms = { ...existingTerms, monthlyRentAmount };
    const correctedDueAmount = rentTermsDueAmount(correctedTerms);
    const nextRate = lease.rentRates.find((rate) => rate.effectiveMonth > effectiveMonth);
    const affectedEndMonth = nextRate
      ? previousPaymentMonth(nextRate.effectiveMonth)
      : currentMonth;

    const affectedPayments = await tx.rentPayment.findMany({
      where: {
        tenantLeaseId,
        month: { gte: effectiveMonth, lte: affectedEndMonth },
      },
      select: {
        status: true,
        paidAmount: true,
        transactions: { select: { id: true }, take: 1 },
        downpaymentAdjustments: { select: { id: true }, take: 1 },
      },
    });
    const hasProtectedPayment = affectedPayments.some(
      (payment) =>
        payment.status !== "UNPAID" ||
        Number(payment.paidAmount) > 0 ||
        payment.transactions.length > 0 ||
        payment.downpaymentAdjustments.length > 0
    );
    if (hasProtectedPayment) return { error: "settledMonths" as const };

    const hasEarlierRate = lease.rentRates.some((rate) => rate.effectiveMonth < effectiveMonth);
    if (effectiveMonth > leaseStartMonth && !hasEarlierRate) {
      await tx.tenantRentRate.upsert({
        where: { tenantLeaseId_effectiveMonth: { tenantLeaseId, effectiveMonth: leaseStartMonth } },
        update: {},
        create: {
          tenantLeaseId,
          effectiveMonth: leaseStartMonth,
          monthlyRentAmount: lease.monthlyRentAmount,
          serviceChargeType: lease.serviceChargeType,
          serviceChargeValue: lease.serviceChargeValue,
        },
      });
    }

    await tx.tenantRentRate.upsert({
      where: { tenantLeaseId_effectiveMonth: { tenantLeaseId, effectiveMonth } },
      update: {
        monthlyRentAmount: monthlyRentRaw,
        serviceChargeType: correctedTerms.serviceChargeType,
        serviceChargeValue: correctedTerms.serviceChargeValue,
      },
      create: {
        tenantLeaseId,
        effectiveMonth,
        monthlyRentAmount: monthlyRentRaw,
        serviceChargeType: correctedTerms.serviceChargeType,
        serviceChargeValue: correctedTerms.serviceChargeValue,
      },
    });

    await tx.rentPayment.updateMany({
      where: {
        tenantLeaseId,
        month: { gte: effectiveMonth, lte: affectedEndMonth },
      },
      data: { dueAmount: correctedDueAmount },
    });

    const lastHistoricalMonth = previousPaymentMonth(currentMonth);
    const historicalEndMonth = affectedEndMonth < lastHistoricalMonth ? affectedEndMonth : lastHistoricalMonth;
    const historicalMonths =
      effectiveMonth <= historicalEndMonth
        ? paymentMonthRange(effectiveMonth, historicalEndMonth, 240)
        : [];
    if (historicalMonths.length > 0) {
      const existingRows = await tx.rentPayment.findMany({
        where: { tenantLeaseId, month: { in: historicalMonths } },
        select: { month: true },
      });
      const existingMonths = new Set(existingRows.map((payment) => payment.month));
      await tx.rentPayment.createMany({
        data: historicalMonths
          .filter((month) => !existingMonths.has(month))
          .map((month) => ({
            tenantLeaseId,
            month,
            dueDate: paymentMonthDueDate(month, RENT_DUE_DAY),
            dueAmount: correctedDueAmount,
            paidAmount: 0,
            status: "UNPAID" as const,
            paidAt: null,
          })),
        skipDuplicates: true,
      });
    }

    if (!nextRate) {
      await tx.tenantLease.update({
        where: { id: tenantLeaseId },
        data: { monthlyRentAmount: monthlyRentRaw },
      });
    }

    return { correctedDueAmount };
  });

  if ("error" in result && result.error) return { ok: false, error: result.error };
  revalidateLocalizedPath(locale, returnTo);
  redirect({
    href: withRentActionFeedback(returnTo, "historicalRentCorrected", {
      month: effectiveMonth,
      amount: monthlyRentAmount,
    }),
    locale,
  });
  return { ok: true };
}

// Adds explicit UNPAID rows for historical months that predate the ledger
// cutover. Existing rows are never changed, so a paid/partial month cannot be
// accidentally reset. Once created, the normal overdue-payment flow can take
// one lump sum and apply it oldest-first across the selected months.
export async function createHistoricalRentArrears(formData: FormData): Promise<RentArrearsCreateResult> {
  const locale = await getLocale();
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const startMonth = str(formData, "startMonth");
  const endMonth = str(formData, "endMonth");
  const returnTo = str(formData, "returnTo") ?? (tenantLeaseId ? `/tenants/${tenantLeaseId}` : "/tenants");
  if (!tenantLeaseId || !startMonth || !endMonth) return { ok: false, error: "missingFields" };

  let months: string[];
  try {
    months = paymentMonthRange(startMonth, endMonth, 36);
  } catch {
    return { ok: false, error: "invalidRange" };
  }

  const currentMonth = dhakaTodayISO().slice(0, 7);
  if (endMonth >= currentMonth) return { ok: false, error: "currentOrFutureMonth" };

  const lease = await prisma.tenantLease.findUnique({
    where: { id: tenantLeaseId },
    include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
  });
  if (!lease) return { ok: false, error: "notFound" };
  const leaseStartMonth = dhakaISO(lease.startDate).slice(0, 7);
  if (startMonth < leaseStartMonth) return { ok: false, error: "beforeLeaseStart" };

  const existing = await prisma.rentPayment.findMany({
    where: { tenantLeaseId, month: { in: months } },
    select: { month: true },
  });
  const existingMonths = new Set(existing.map((payment) => payment.month));
  const missingMonths = months.filter((month) => !existingMonths.has(month));
  if (missingMonths.length === 0) {
    revalidateLocalizedPath(locale, returnTo);
    redirect({ href: withRentActionFeedback(returnTo, "arrearsAlreadyExists"), locale });
    return { ok: true };
  }

  const rates = numericRentRates(lease.rentRates);
  await prisma.rentPayment.createMany({
    data: missingMonths.map((month) => ({
      tenantLeaseId,
      month,
      dueDate: paymentMonthDueDate(month, RENT_DUE_DAY),
      dueAmount: rentTermsDueAmount(resolveRentTermsForMonth(leaseFallbackTerms(lease), rates, month)),
      paidAmount: 0,
      status: "UNPAID" as const,
      paidAt: null,
    })),
    skipDuplicates: true,
  });

  revalidateLocalizedPath(locale, returnTo);
  revalidateLocalizedPath(locale, "/rent");
  redirect({
    href: withRentActionFeedback(returnTo, "arrearsAdded", {
      count: missingMonths.length,
      amount: missingMonths.reduce(
        (sum, month) => sum + rentTermsDueAmount(resolveRentTermsForMonth(leaseFallbackTerms(lease), rates, month)),
        0
      ),
    }),
    locale,
  });
  return { ok: true };
}

// Corrects one directly-recorded rent payment while keeping its monthly due
// row and cash-flow transaction in sync. Installments and downpayment
// adjustments have multiple audit entries, so they are deliberately refused
// here instead of silently rewriting only part of their history.
export async function updateTenantRentPayment(formData: FormData): Promise<RentPaymentEditResult> {
  const locale = await getLocale();
  const rentPaymentId = str(formData, "rentPaymentId");
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const amountRaw = str(formData, "amount");
  const dateRaw = str(formData, "date");
  const billingMonth = str(formData, "billingMonth");
  const returnTo = str(formData, "returnTo") ?? (tenantLeaseId ? `/tenants/${tenantLeaseId}` : "/rent");
  if (!rentPaymentId || !tenantLeaseId || !amountRaw || !dateRaw || !billingMonth) {
    return { ok: false, error: "missingFields" };
  }
  if (!isPaymentMonth(billingMonth) || billingMonth > dhakaTodayISO().slice(0, 7)) {
    return { ok: false, error: "invalidBillingMonth" };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalidAmount" };

  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "BANK_CHECK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;
  const paidDate = new Date(dateRaw);

  const problem = await prisma.$transaction(async (tx) => {
    const payment = await tx.rentPayment.findFirst({
      where: { id: rentPaymentId, tenantLeaseId },
      select: {
        month: true,
        dueAmount: true,
        transactions: { select: { id: true } },
        downpaymentAdjustments: { select: { id: true }, take: 1 },
      },
    });
    if (!payment) return "notFound" as const;
    if (payment.transactions.length !== 1 || payment.downpaymentAdjustments.length > 0) {
      return "notEditable" as const;
    }
    if (amount > Number(payment.dueAmount)) return "amountExceedsDue" as const;
    if (billingMonth !== payment.month) {
      const targetMonthPayment = await tx.rentPayment.findUnique({
        where: { tenantLeaseId_month: { tenantLeaseId, month: billingMonth } },
        select: { id: true },
      });
      if (targetMonthPayment) return "monthAlreadyExists" as const;
    }

    const status = amount >= Number(payment.dueAmount) ? "PAID" : "PARTIAL";
    await tx.rentPayment.update({
      where: { id: rentPaymentId },
      data: {
        month: billingMonth,
        dueDate: paymentMonthDueDate(billingMonth, RENT_DUE_DAY),
        paidAmount: amount,
        paidAt: paidDate,
        status,
      },
    });
    await tx.transaction.update({
      where: { id: payment.transactions[0].id },
      data: { amount, date: paidDate, method },
    });
    return null;
  });
  if (problem) return { ok: false, error: problem };

  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: withRentActionFeedback(returnTo, "updated", { month: billingMonth, amount }), locale });
  return { ok: true };
}

// Removes one mistaken, directly-recorded payment together with its matching
// cash-flow entry. Installments and downpayment adjustments retain their audit
// history and cannot be deleted from the tenant payment-history row.
export async function deleteTenantRentPayment(formData: FormData): Promise<RentPaymentDeleteResult> {
  const locale = await getLocale();
  const rentPaymentId = str(formData, "rentPaymentId");
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const returnTo = str(formData, "returnTo") ?? (tenantLeaseId ? `/tenants/${tenantLeaseId}` : "/rent");
  if (!rentPaymentId || !tenantLeaseId) return { ok: false, error: "missingFields" };

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.rentPayment.findFirst({
      where: { id: rentPaymentId, tenantLeaseId },
      select: {
        month: true,
        transactions: { select: { id: true } },
        downpaymentAdjustments: { select: { id: true }, take: 1 },
      },
    });
    if (!payment) return "notFound" as const;
    if (payment.transactions.length !== 1 || payment.downpaymentAdjustments.length > 0) {
      return "notEditable" as const;
    }

    await tx.transaction.delete({ where: { id: payment.transactions[0].id } });
    await tx.rentPayment.delete({ where: { id: rentPaymentId } });
    return { month: payment.month };
  });
  if (typeof result === "string") return { ok: false, error: result };

  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: withRentActionFeedback(returnTo, "deleted", { month: result.month }), locale });
  return { ok: true };
}

// Records rent for the explicitly selected billing month — either as a normal
// cash/mobile-banking payment (creates an INCOMING Transaction), or as an
// adjustment against the tenant's own downpayment/advance balance (creates a
// DownpaymentAdjustment ledger row and decrements TenantLease.currentDownpaymentBalance
// instead, since no new money actually moved). Both modes write to the same
// RentPayment row for the month via upsert — RentPayment's unique key is just
// (tenantLeaseId, month), no nullable column involved, so upsert is safe here
// (unlike OwnerRentPayment's unitId-nullable case elsewhere in this codebase).
export async function recordTenantRentPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const tenantLeaseId = formData.get("tenantLeaseId") as string;
  if (!propertyId || !tenantLeaseId) throw new Error("Missing property or lease id");

  const dateStr = str(formData, "date");
  const amountStr = str(formData, "amount");
  if (!dateStr || !amountStr) throw new Error("Missing required payment fields");
  const amount = Number(amountStr);
  const month = resolvePaymentMonth(str(formData, "billingMonth"), dateStr);
  const paidDate = new Date(dateStr);
  const mode = formData.get("mode") === "downpaymentAdjustment" ? "downpaymentAdjustment" : "cash";

  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "BANK_CHECK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const lease = await prisma.tenantLease.findUnique({
    where: { id: tenantLeaseId },
    include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
  });
  if (!lease) throw new Error("Tenant lease not found");

  if (mode === "downpaymentAdjustment" && amount > Number(lease.currentDownpaymentBalance)) {
    throw new Error("Adjustment amount exceeds available downpayment balance");
  }

  // "Rent due" is rent + service charge bundled as one figure — one
  // RentPayment row, one collection action, one Transaction, regardless of
  // how it's settled (cash or downpayment adjustment).
  const rates = numericRentRates(lease.rentRates);
  const dueAmount = rentTermsDueAmount(resolveRentTermsForMonth(leaseFallbackTerms(lease), rates, month));
  const [monthYear, monthNumber] = month.split("-").map(Number);

  const recorded = await prisma.$transaction(async (tx) => {
    // A second payment toward the same month ADDS to what's already paid (and
    // a fully settled month refuses more) — overwriting paidAmount while still
    // writing a fresh Transaction double-counted income and left the rent row
    // disagreeing with the ledger of money actually received.
    const existing = await tx.rentPayment.findUnique({
      where: { tenantLeaseId_month: { tenantLeaseId, month } },
      select: { paidAmount: true, dueAmount: true },
    });
    const alreadyPaid = existing ? Number(existing.paidAmount) : 0;
    // A stale/double-submitted form must not crash after the first request
    // already committed the payment. Treat it as an idempotent no-op; no
    // second Transaction or downpayment adjustment is written.
    if (existing && isRentPaymentSettled(Number(existing.dueAmount), alreadyPaid)) return false;
    const monthDueAmount = existing ? Number(existing.dueAmount) : dueAmount;
    const { totalPaid, status } = applyRentInstallment({
      dueAmount: monthDueAmount,
      alreadyPaid,
      paymentAmount: amount,
      adjustedFromDownpayment: mode === "downpaymentAdjustment",
    });

    const rentPayment = await tx.rentPayment.upsert({
      where: { tenantLeaseId_month: { tenantLeaseId, month } },
      update: { paidAmount: totalPaid, status, paidAt: paidDate },
      create: {
        tenantLeaseId,
        month,
        // The month's real deadline, not the day the money arrived — otherwise
        // "paid on time" is true by construction for every payment.
        dueDate: new Date(monthYear, monthNumber - 1, RENT_DUE_DAY),
        dueAmount,
        paidAmount: totalPaid,
        status,
        paidAt: paidDate,
      },
    });

    if (mode === "downpaymentAdjustment") {
      await tx.downpaymentAdjustment.create({
        data: {
          tenantLeaseId,
          rentPaymentId: rentPayment.id,
          amountAdjusted: amount,
          reason: str(formData, "notes"),
        },
      });
      await tx.tenantLease.update({
        where: { id: tenantLeaseId },
        data: { currentDownpaymentBalance: { decrement: amount } },
      });
    } else {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "RENT_RECEIVED_FROM_TENANT",
          direction: "INCOMING",
          amount,
          method,
          tenantLeaseId,
          rentPaymentId: rentPayment.id,
          date: paidDate,
        },
      });
    }
    return true;
  }, { isolationLevel: "Serializable" });

  // Reachable from both the per-property page and the cross-property global
  // Tenants page — each redirects back to wherever it was submitted from.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidateLocalizedPath(locale, returnTo);
  redirect({
    href: withRentActionFeedback(returnTo, recorded ? "recorded" : "alreadyPaid", { month, amount }),
    locale,
  });
}

// Settles a tenant's back rent in one go — a lump sum applied oldest-month
// first across however many months are actually overdue (real RentPayment
// rows AND months nobody ever recorded, per rent-ledger.ts), same
// "one Transaction per covered month" pattern recordAdvanceRentPayment
// already uses for the opposite (future) direction. A tenant catching up on
// 3 months doesn't have to be paid off in 3 separate manual entries anymore
// — one amount here fills the oldest debt first, then the next, etc.,
// including a genuine partial on whichever month the money runs out on.
export async function getTenantUtilityArrears(tenantLeaseId: string, includeCurrentMonth = false) {
  await requireCurrentUser();
  const lease = await prisma.tenantLease.findUnique({
    where: { id: tenantLeaseId },
    select: { id: true, unitId: true, startDate: true, status: true, movedOutAt: true, endDate: true },
  });
  if (!lease) return [];
  const currentMonth = dhakaTodayISO().slice(0, 7);
  const cutoff = includeCurrentMonth ? addMonthsToMonthStr(currentMonth, 1) : currentMonth;
  const bills = await prisma.utilityBill.findMany({
    where: tenantUtilityArrearsWhere(lease, cutoff),
    orderBy: [{ month: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    select: { id: true, type: true, month: true, dueDate: true, amount: true, paidAmount: true },
  });
  return bills.map(({ amount, paidAmount, ...bill }) => ({
    ...bill, remaining: Number(amount.minus(paidAmount)),
  })).filter((bill) => bill.remaining > 0);
}

export async function recordOverdueRentPayment(formData: FormData) {
  const locale = await getLocale();
  const user = await requireCurrentUser();
  const propertyId = str(formData, "propertyId");
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const dateStr = str(formData, "date");
  const paymentAmount = Number(str(formData, "amount"));
  const utilityPayments = new Map<string, number>();
  for (const [key, value] of formData) {
    if (!key.startsWith("utilityPayment:") || value === "") continue;
    const billId = key.slice("utilityPayment:".length);
    const amount = typeof value === "string" ? Number(value) : NaN;
    if (!billId || !Number.isFinite(amount) || amount < 0 || utilityPayments.has(billId)) {
      return { ok: false as const, reason: "invalid" as const };
    }
    if (amount > 0) utilityPayments.set(billId, amount);
  }
  const today = dhakaTodayISO();
  if (!propertyId || !tenantLeaseId || !dateStr || !isValidTransactionDate(dateStr) ||
      dateStr > today || !Number.isFinite(paymentAmount) || paymentAmount < 0 || (paymentAmount === 0 && !utilityPayments.size)) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const from = str(formData, "arrearsFrom");
  const to = str(formData, "arrearsTo");
  const period = isPaymentMonth(from) && isPaymentMonth(to) && from <= to && to <= today.slice(0, 7)
    ? { from, to }
    : null;
  if ((from || to) && !period) return { ok: false as const, reason: "invalid" as const };

  const invoiceMonth = str(formData, "invoiceMonth");
  const invoiceChoice = str(formData, "invoiceChoice");
  const reconciliation = invoiceChoice === "reconcile";
  const printRevision = Number(str(formData, "printRevision"));
  const allocationInput = str(formData, "receiptAllocation");
  let manualAllocation: unknown;
  if (allocationInput != null) {
    try {
      manualAllocation = JSON.parse(allocationInput);
    } catch {
      return { ok: false as const, reason: "invalid" as const };
    }
  }
  const receivedCents = Math.round(paymentAmount * 100);
  if (reconciliation && (!invoiceMonth || !Number.isSafeInteger(printRevision) || printRevision < 0 || receivedCents > 2_147_483_647)) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (invoiceMonth && (!isPaymentMonth(invoiceMonth) || invoiceMonth > today.slice(0, 7) || period ||
      utilityPayments.size || !["all", "rent", "partial", "reconcile"].includes(invoiceChoice ?? "") ||
      !Number.isSafeInteger(Math.round(paymentAmount * 100)) ||
      !/^\d+(\.\d{1,2})?$/.test(str(formData, "amount") ?? ""))) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const paidDate = new Date(dateStr);
  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "BANK_CHECK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const paymentReceiptId = randomUUID();
  const expected = str(formData, "rentAllocation");
  let saved: boolean;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const lease = await tx.tenantLease.findUnique({
        where: { id: tenantLeaseId },
        include: {
          rentRates: { orderBy: { effectiveMonth: "asc" } },
          tenant: { select: { name: true } },
          unit: { select: { label: true, unitType: { select: { property: { select: { id: true, name: true, deletedAt: true } } } } } },
          rentPayments: { where: period ? { month: { gte: period.from, lte: period.to } } : undefined },
        },
      });
      if (!lease || lease.unit.unitType.property.id !== propertyId) return false;

      const rates = numericRentRates(lease.rentRates);
      const terms = leaseFallbackTerms(lease);
      const payments = lease.rentPayments.map((payment) => ({
        ...payment, dueAmount: Number(payment.dueAmount), paidAmount: Number(payment.paidAmount),
      }));
      const byMonth = new Map(payments.map((payment) => [payment.month, payment]));
      const property = lease.unit.unitType.property;
      // Match the monthly bill: earlier rent is collected from the arrears workflow.
      const invoiceEntries = invoiceMonth ? payments
        .filter((payment) => payment.month === invoiceMonth)
        .map(({ month, dueAmount, paidAmount }) => ({ month, dueAmount, paidAmount, gap: Math.max(0, dueAmount - paidAmount) })) : [];
      if (invoiceMonth && (lease.status !== "ACTIVE" || property.deletedAt)) return false;
      if (invoiceMonth && !byMonth.has(invoiceMonth) && invoiceMonth >= LEDGER_START_MONTH &&
          invoiceMonth >= dhakaISO(lease.startDate).slice(0, 7)) {
        const dueAmount = rentTermsDueAmount(resolveRentTermsForMonth(terms, rates, invoiceMonth));
        invoiceEntries.push({ month: invoiceMonth, gap: dueAmount, dueAmount, paidAmount: 0 });
      }
      const entries = invoiceMonth ? invoiceEntries : period
        ? (buildRentArrearsReport([{
            ...lease, ...terms, propertyId, propertyName: property.name,
            propertyDeleted: property.deletedAt != null, tenantName: lease.tenant.name,
            unitLabel: lease.unit.label, rentRates: rates,
            payments: payments.map((payment) => ({ ...payment, adjustments: [] })),
          }], period.from, period.to).rows[0]?.months ?? []).map((row) => ({
            month: row.month, gap: row.remaining, dueAmount: row.due, paidAmount: row.settled,
          }))
        : overdueEntries(buildRentLedger(
            lease.startDate,
            (month) => rentTermsDueAmount(resolveRentTermsForMonth(terms, rates, month)),
            payments,
            lease.status === "ACTIVE" ? dhakaNow() : (lease.movedOutAt ?? lease.endDate ?? dhakaNow()),
            RENT_DUE_DAY,
          ));
      const utilityWhere = tenantUtilityArrearsWhere(lease, today.slice(0, 7));
      const utilitySelect = { id: true, month: true, amount: true, paidAmount: true, type: true, dueDate: true } as const;
      const invoiceBills = invoiceMonth ? await tx.utilityBill.findMany({
        where: { ...utilityWhere, propertyId, month: reconciliation ? invoiceMonth : { lte: invoiceMonth } },
        select: utilitySelect,
      }) : [];
      let allocations: ReturnType<typeof allocateRentPayment>;
      let expectedCents = 0;
      let receiptLines: ReceiptCheckLine[] = [];
      if (invoiceMonth) {
        let lines: InvoicePaymentLine[] = [
          ...entries.map(({ month, gap }) => ({ id: month, month, kind: "rent" as const, remainingCents: Math.round(gap * 100) })),
          ...invoiceBills.map((bill) => ({
            id: bill.id, month: bill.month, kind: "utility" as const,
            remainingCents: Math.round(Number(bill.amount.minus(bill.paidAmount)) * 100),
          })),
        ].filter(({ remainingCents }) => remainingCents > 0);
        if (reconciliation) {
          const printed = await tx.rentBillPrint.findFirst({
            where: { tenantLeaseId, month: invoiceMonth }, orderBy: { revision: "desc" },
          });
          if ((printed?.revision ?? 0) !== printRevision) return false;
          if (printed) lines = limitToPrintedBill(lines, printed.rows as RentBillPrintRow[]);
        }
        if (str(formData, "invoiceSnapshot") !== invoicePaymentSnapshot(lines)) return false;
        const eligible = invoiceChoice === "rent" ? lines.filter((line) => line.kind === "rent" && line.month === invoiceMonth) : lines;
        const limit = eligible.reduce((sum, line) => sum + line.remainingCents, 0);
        expectedCents = limit;
        if (reconciliation ? limit <= 0 || limit > 2_147_483_647
          : receivedCents > limit || (invoiceChoice !== "partial" && receivedCents !== limit)) return false;
        const appliedCents = Math.min(receivedCents, limit);
        const planned = reconciliation && manualAllocation !== undefined
          ? reconcileInvoiceAllocation(eligible, appliedCents, manualAllocation)
          : allocateInvoicePayment(eligible, appliedCents);
        if (!planned) return false;
        if (reconciliation) {
          const paidById = new Map(planned.map((line) => [line.id, line.paidCents]));
          const billsById = new Map(invoiceBills.map((bill) => [bill.id, bill]));
          receiptLines = eligible.map((line) => ({
            id: line.id, utilityType: billsById.get(line.id)?.type ?? null,
            dueDate: billsById.has(line.id) ? dhakaISO(billsById.get(line.id)!.dueDate) : null,
            expectedCents: line.remainingCents, paidCents: paidById.get(line.id) ?? 0,
          }));
        }
        allocations = planned.filter(({ kind }) => kind === "rent").map(({ month, remainingCents, paidCents }) => ({
          month, gap: remainingCents / 100, amount: paidCents / 100,
        }));
        for (const { id, kind, paidCents } of planned) {
          if (kind === "utility") utilityPayments.set(id, paidCents / 100);
        }
      } else {
        const total = entries.reduce((sum, entry) => sum + entry.gap, 0);
        if (paymentAmount > total) return false;
        allocations = allocateRentPayment(entries, paymentAmount);
        if (paymentAmount > 0 && (!allocations.length || expected !== JSON.stringify(allocations))) return false;
      }

      const utilityBills = invoiceMonth ? invoiceBills.filter((bill) => utilityPayments.has(bill.id))
        : utilityPayments.size ? await tx.utilityBill.findMany({
            where: { ...utilityWhere, propertyId, id: { in: [...utilityPayments.keys()] } },
            select: utilitySelect,
          }) : [];
      if (utilityBills.length !== utilityPayments.size || utilityBills.some((bill) =>
        !invoiceMonth && bill.amount.minus(bill.paidAmount).lt(utilityPayments.get(bill.id)!)
      )) return false;

      const entriesByMonth = new Map(entries.map((entry) => [entry.month, entry]));
      for (const allocation of allocations) {
        const entry = entriesByMonth.get(allocation.month)!;
        const existing = byMonth.get(entry.month);
        const settled = Math.round(allocation.amount * 100) === Math.round(entry.gap * 100);
        const paidAmount = settled ? entry.dueAmount : entry.paidAmount + allocation.amount;
        const status = settled ? "PAID" : "PARTIAL";
        const rentPayment = existing
          ? await tx.rentPayment.update({
              where: { id: existing.id },
              data: { paidAmount, status, paidAt: paidDate },
            })
          : await tx.rentPayment.create({
              data: {
                tenantLeaseId, month: entry.month, dueDate: paymentMonthDueDate(entry.month, RENT_DUE_DAY),
                dueAmount: entry.dueAmount, paidAmount, status, paidAt: paidDate,
              },
            });
        await tx.transaction.create({
          data: {
            propertyId, type: "RENT_RECEIVED_FROM_TENANT", direction: "INCOMING",
            amount: allocation.amount, method, tenantLeaseId, rentPaymentId: rentPayment.id,
            date: paidDate, recordedByUserId: user.id, paymentReceiptId,
          },
        });
      }
      for (const bill of utilityBills) {
        const amount = utilityPayments.get(bill.id)!;
        const gap = bill.amount.minus(bill.paidAmount);
        const settlesInvoiceBill = invoiceMonth && Math.round(Number(gap) * 100) === Math.round(amount * 100);
        const paidAmount = settlesInvoiceBill ? bill.amount : bill.paidAmount.plus(amount);
        await tx.utilityBill.update({
          where: { id: bill.id },
          data: { paidAmount, status: paidAmount.eq(bill.amount) ? "PAID" : "PARTIAL" },
        });
        await tx.transaction.create({
          data: {
            propertyId, unitId: lease.unitId, tenantLeaseId, utilityBillId: bill.id,
            type: "UTILITY_REIMBURSEMENT_FROM_TENANT", direction: "INCOMING",
            amount, method, date: paidDate, recordedByUserId: user.id, paymentReceiptId,
          },
        });
      }
      if (reconciliation && invoiceMonth) {
        const extra = Math.max(0, receivedCents - expectedCents) / 100;
        if (extra > 0) {
          await tx.tenantLease.update({
            where: { id: tenantLeaseId },
            data: { currentDownpaymentBalance: lease.currentDownpaymentBalance?.plus(extra) ?? extra },
          });
          await tx.transaction.create({
            data: {
              propertyId, unitId: lease.unitId, tenantLeaseId, amount: extra, method,
              type: "DOWNPAYMENT_RECEIVED_FROM_TENANT", direction: "INCOMING",
              date: paidDate, recordedByUserId: user.id, paymentReceiptId,
            },
          });
        }
        await tx.rentBillReceiptCheck.create({
          data: {
            receiptId: paymentReceiptId, tenantLeaseId, month: invoiceMonth,
            printRevision: printRevision || null, expectedCents, receivedCents, lines: receiptLines,
          },
        });
      }
      return true;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    // A concurrent payment may have changed or created a bill after the read.
    if (!(error instanceof Error && "code" in error && (error.code === "P2034" || error.code === "P2002"))) throw error;
    saved = false;
  }
  if (!saved) return { ok: false as const, reason: "changed" as const };

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  const returnUrl = new URL(returnTo, "http://local");
  const returnPath = returnUrl.pathname;
  for (const path of new Set([
    ...localizedMutationPaths(locale, returnPath),
    ...["/rent/arrears", "/rent/report", "/transactions", "/utility-bills", `/tenants/${tenantLeaseId}`, `/tenants/${tenantLeaseId}/invoice`].map((path) => `/${locale}${path}`),
  ])) revalidatePath(path);
  const utilityTotal = [...utilityPayments.values()].reduce((sum, amount) => sum + amount, 0);
  if (invoiceMonth) {
    const fromRentInvoice = returnPath === `/rent/${tenantLeaseId}/invoice`;
    const scoped = fromRentInvoice && returnUrl.searchParams.get("tenant") === "1";
    const embedded = fromRentInvoice && returnUrl.searchParams.get("embed") === "1";
    redirect({
      href: `/tenants/${tenantLeaseId}/receipts/${paymentReceiptId}?from=${fromRentInvoice ? "rent-invoice" : "invoice"}&month=${invoiceMonth}${scoped ? "&tenant=1" : ""}${embedded ? "&embed=1" : ""}`,
      locale,
    });
  }
  const result = utilityPayments.size ? "overdueWithUtilities" : "overdue";
  redirect({ href: withRentActionFeedback(returnTo, result, { amount: paymentAmount + utilityTotal }), locale });
}

function addMonthsToMonthStr(monthStr: string, offset: number) {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const multiMonthLeaseInclude = {
  rentRates: true,
  rentPayments: { select: { id: true, month: true, dueAmount: true, paidAmount: true } },
  unit: { select: { unitType: { select: { property: { select: { id: true, deletedAt: true } } } } } },
} as const;

type MultiMonthLease = NonNullable<Awaited<ReturnType<typeof findMultiMonthLease>>>;

function findMultiMonthLease(id: string) {
  return prisma.tenantLease.findUnique({ where: { id }, include: multiMonthLeaseInclude });
}

function multiMonthBalances(lease: MultiMonthLease, currentMonth: string) {
  const start = dhakaISO(lease.startDate).slice(0, 7);
  const firstTracked = start > LEDGER_START_MONTH ? start : LEDGER_START_MONTH;
  const lastAdvance = addMonthsToMonthStr(currentMonth, 36);
  const endDate = lease.movedOutAt ?? lease.endDate;
  const lastEligible = lease.status === "ACTIVE"
    ? lastAdvance
    : endDate ? dhakaISO(endDate).slice(0, 7) : currentMonth;
  const last = lastEligible < lastAdvance ? lastEligible : lastAdvance;
  const recorded = new Map(lease.rentPayments.map((payment) => [payment.month, payment]));
  const months = new Set([
    ...(firstTracked <= last ? paymentMonthRange(firstTracked, last, 600) : []),
    ...recorded.keys(),
  ]);
  const rates = numericRentRates(lease.rentRates);
  const terms = leaseFallbackTerms(lease);
  return [...months].sort().flatMap((month) => {
    if (!isPaymentMonth(month) || month < start || month > last) return [];
    const payment = recorded.get(month);
    const due = payment ? Number(payment.dueAmount) : rentTermsDueAmount(resolveRentTermsForMonth(terms, rates, month));
    const dueCents = Math.round(due * 100);
    const paidCents = Math.round(Number(payment?.paidAmount ?? 0) * 100);
    const remainingCents = dueCents - paidCents;
    return remainingCents > 0 ? [{ month, payment, dueCents, remainingCents }] : [];
  });
}

export async function getMultiMonthRentOptions(tenantLeaseId: string) {
  await requireCurrentUser();
  const lease = await findMultiMonthLease(tenantLeaseId);
  if (!lease || lease.unit.unitType.property.deletedAt) return [];
  return multiMonthBalances(lease, dhakaTodayISO().slice(0, 7)).map(({ month, remainingCents }) => ({ month, remainingCents }));
}

function readCollectionPayments(input: string | null, key: "month" | "id") {
  let rows: unknown;
  try {
    rows = JSON.parse(input ?? "null");
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const payments = new Map<string, { amountCents: number; remainingCents: number }>();
  for (const row of rows) {
    const id = row?.[key];
    if (typeof id !== "string" || !id || (key === "month" && !isPaymentMonth(id)) || payments.has(id) ||
        typeof row.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(row.amount) ||
        !Number.isSafeInteger(row.remainingCents)) return null;
    const amountCents = Math.round(Number(row.amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > row.remainingCents) return null;
    payments.set(id, { amountCents, remainingCents: row.remainingCents });
  }
  return payments;
}

export async function recordMultiMonthRentPayment(formData: FormData, newBills: FormData[] = []) {
  const user = await requireCurrentUser();
  const propertyId = str(formData, "propertyId");
  const tenantLeaseId = str(formData, "tenantLeaseId");
  const date = str(formData, "date");
  const today = dhakaTodayISO();
  const invalid = { ok: false, reason: "invalid" } as const;
  const changed = { ok: false, reason: "changed" } as const;
  const duplicate = { ok: false, reason: "utility", error: "utilityBillDuplicateMonth" } as const;
  if (!propertyId || !tenantLeaseId || !date || !isValidTransactionDate(date) || date > today) return invalid;

  const methodRaw = str(formData, "method");
  const method =
    methodRaw === "CASH" || methodRaw === "BKASH" || methodRaw === "NAGAD" ||
    methodRaw === "BANK" || methodRaw === "BANK_CHECK" || methodRaw === "OTHER" ? methodRaw : null;

  const requested = readCollectionPayments(str(formData, "multiMonthPayments"), "month");
  const utilities = readCollectionPayments(str(formData, "multiMonthUtilities") ?? "[]", "id");
  const billingMonth = str(formData, "billingMonth");
  if (!requested || !utilities || requested.size > 36 || newBills.length > 36) return invalid;
  if (newBills.length && !isPaymentMonth(billingMonth)) return invalid;
  const validated = newBills.length ? validateTenantUtilityBills(billingMonth!, newBills) : null;
  if (validated && !validated.ok) return { ok: false, reason: "utility", error: validated.error } as const;
  const newUtilityPayments = newBills.map((bill) => {
    const value = str(bill, "received");
    return value == null ? 0 : /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : NaN;
  });
  if (newUtilityPayments.some((cents) => !Number.isSafeInteger(cents)) ||
      (!requested.size && !utilities.size && !newUtilityPayments.some((cents) => cents > 0))) return invalid;

  const paidDate = new Date(date);
  const paymentReceiptId = randomUUID();
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const lease = await tx.tenantLease.findUnique({
        where: { id: tenantLeaseId }, include: { ...multiMonthLeaseInclude, utilityBillDefaults: !!validated },
      });
      if (!lease || lease.unit.unitType.property.id !== propertyId || lease.unit.unitType.property.deletedAt) return false;
      const billRows = validated ? prepareTenantUtilityBillRows(lease, propertyId, billingMonth!, validated.bills) : [];
      if (!billRows || billRows.some((bill, index) => {
        const received = newUtilityPayments[index];
        return received > 0 && (bill.paidByCompany || received / 100 > Number(bill.amount));
      })) return false;
      if (billRows.length && await hasMonthlyTenantUtilityBill(tx, lease, billingMonth!, billRows.map(({ type }) => type))) {
        return duplicate;
      }
      const selected = multiMonthBalances(lease, today.slice(0, 7)).flatMap((balance) => {
        const request = requested.get(balance.month);
        return request && request.remainingCents === balance.remainingCents
          ? [{ ...balance, amountCents: request.amountCents }]
          : [];
      });
      const utilityBills = utilities.size ? await tx.utilityBill.findMany({
        where: {
          ...tenantUtilityArrearsWhere(lease, addMonthsToMonthStr(today.slice(0, 7), 1)),
          propertyId,
          id: { in: [...utilities.keys()] },
        },
        select: { id: true, amount: true, paidAmount: true },
      }) : [];
      // Recheck each selected balance before writing any part of the payment.
      if (selected.length !== requested.size || utilityBills.length !== utilities.size ||
          utilityBills.some((bill) =>
            Math.round(Number(bill.amount.minus(bill.paidAmount)) * 100) !== utilities.get(bill.id)?.remainingCents
          )) return false;
      for (const { month, payment, amountCents, remainingCents, dueCents } of selected) {
        const amount = amountCents / 100;
        const status = amountCents === remainingCents ? "PAID" : "PARTIAL";
        const rentPayment = payment
          ? await tx.rentPayment.update({
              where: { id: payment.id },
              data: { paidAmount: { increment: amount }, paidAt: paidDate, status },
            })
          : await tx.rentPayment.create({
              data: {
                tenantLeaseId, month, dueDate: paymentMonthDueDate(month, RENT_DUE_DAY),
                dueAmount: dueCents / 100, paidAmount: amount, paidAt: paidDate, status,
              },
            });
        await tx.transaction.create({
          data: {
            propertyId, tenantLeaseId, rentPaymentId: rentPayment.id, amount, method,
            type: "RENT_RECEIVED_FROM_TENANT", direction: "INCOMING", date: paidDate, recordedByUserId: user.id, paymentReceiptId,
          },
        });
      }
      for (const bill of utilityBills) {
        const { amountCents, remainingCents } = utilities.get(bill.id)!;
        const amount = amountCents / 100;
        const settled = amountCents === remainingCents;
        await tx.utilityBill.update({
          where: { id: bill.id },
          data: {
            paidAmount: settled ? bill.amount : bill.paidAmount.plus(amount),
            status: settled ? "PAID" : "PARTIAL",
          },
        });
        await tx.transaction.create({
          data: {
            propertyId, unitId: lease.unitId, tenantLeaseId, utilityBillId: bill.id, amount, method,
            type: "UTILITY_REIMBURSEMENT_FROM_TENANT", direction: "INCOMING", date: paidDate, recordedByUserId: user.id, paymentReceiptId,
          },
        });
      }
      for (const [index, row] of billRows.entries()) {
        const paidCents = newUtilityPayments[index];
        const paidAmount = paidCents / 100;
        const bill = await tx.utilityBill.create({
          data: {
            ...row,
            paidAmount,
            status: !paidCents ? "UNPAID" : paidAmount === Number(row.amount) ? "PAID" : "PARTIAL",
          },
        });
        if (paidCents) {
          await tx.transaction.create({
            data: {
              propertyId, unitId: lease.unitId, tenantLeaseId, utilityBillId: bill.id, amount: paidAmount, method,
              type: "UTILITY_REIMBURSEMENT_FROM_TENANT", direction: "INCOMING", date: paidDate,
              recordedByUserId: user.id, paymentReceiptId,
            },
          });
        }
      }
      return true;
    }, { isolationLevel: "Serializable" });
    if (saved === duplicate) return duplicate;
    if (!saved) return changed;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "P2034" || error.code === "P2002")) return changed;
    throw error;
  }

  const locale = await getLocale();
  const returnTo = str(formData, "returnTo") ?? "/rent";
  for (const path of new Set([
    new URL(returnTo, "http://local").pathname,
    "/dashboard", "/rent", "/rent/arrears", "/rent/report", "/reports/market", "/transactions", "/tenants", "/utility-bills",
    `/properties/${propertyId}`, `/tenants/${tenantLeaseId}`, `/tenants/${tenantLeaseId}/invoice`, `/tenants/${tenantLeaseId}/history`,
  ])) revalidateLocalizedPath(locale, path);
  const returnUrl = new URL(returnTo, "http://local");
  const embeddedInvoice = returnUrl.pathname === `/rent/${tenantLeaseId}/invoice` && returnUrl.searchParams.get("embed") === "1";
  if (returnUrl.pathname === "/rent" || embeddedInvoice) {
    const month = returnUrl.searchParams.get("month");
    const scopedToTenant = returnUrl.searchParams.get("tenant") === (embeddedInvoice ? "1" : tenantLeaseId);
    redirect({
      href: `/tenants/${tenantLeaseId}/receipts/${paymentReceiptId}?from=${embeddedInvoice ? "rent-invoice" : "rent"}${isPaymentMonth(month) ? `&month=${month}` : ""}${scopedToTenant ? "&tenant=1" : ""}${embeddedInvoice ? "&embed=1" : ""}`,
      locale,
    });
  }
  const totalCents = [...requested.values(), ...utilities.values()].reduce((sum, row) => sum + row.amountCents, 0)
    + newUtilityPayments.reduce((sum, cents) => sum + cents, 0);
  const feedback = utilities.size || newBills.length || str(formData, "collectionMode") === "single" ? "invoicePaid" : "multiMonth";
  redirect({ href: withRentActionFeedback(returnTo, feedback, { count: requested.size, amount: totalCents / 100 }), locale });
}

// A tenant sometimes pays several months of rent in one go (any number of
// months, not just round numbers — 1, 7, 9, whatever they hand over)
// instead of monthly. We create one RentPayment PER covered month so each
// month's due/paid status and report bucket stay individually correct. Each
// also has its own Transaction dated on the real payment date: the dashboard
// remains cash-basis while reports attribute tenant rent to RentPayment.month.
// What the company later pays the
// property owner (OwnerRentPayment) is a fully independent monthly ledger
// already decoupled from this — lump-sum-in, monthly-out (or vice versa)
// just falls out naturally with no extra code.
export async function recordAdvanceRentPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const tenantLeaseId = formData.get("tenantLeaseId") as string;
  if (!propertyId || !tenantLeaseId) throw new Error("Missing property or lease id");

  const startMonth = str(formData, "startMonth");
  const monthsCountStr = str(formData, "monthsCount");
  const dateStr = str(formData, "date");
  if (!startMonth || !monthsCountStr || !dateStr) throw new Error("Missing required advance payment fields");

  const monthsCount = Number(monthsCountStr);
  if (!Number.isInteger(monthsCount) || monthsCount < 1 || monthsCount > 36) {
    throw new Error("Invalid advance rent duration");
  }
  const paidDate = new Date(dateStr);

  const methodRaw = formData.get("method");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "BANK_CHECK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const lease = await prisma.tenantLease.findUnique({
    where: { id: tenantLeaseId },
    include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
  });
  if (!lease) throw new Error("Tenant lease not found");

  const advanceRates = numericRentRates(lease.rentRates);
  const months = Array.from({ length: monthsCount }, (_, i) => addMonthsToMonthStr(startMonth, i));

  const recordedAmount = await prisma.$transaction(async (tx) => {
    let totalRecorded = 0;
    for (const month of months) {
      const configuredDueAmount = rentTermsDueAmount(
        resolveRentTermsForMonth(leaseFallbackTerms(lease), advanceRates, month)
      );
      const [year, monthIndex] = month.split("-").map(Number);
      const monthDueDate = new Date(year, monthIndex - 1, RENT_DUE_DAY);

      // Months that are already (partly) paid only take the remaining gap —
      // re-collecting the full amount would double-count the income.
      const existing = await tx.rentPayment.findUnique({
        where: { tenantLeaseId_month: { tenantLeaseId, month } },
        select: { paidAmount: true, dueAmount: true },
      });
      const dueAmount = existing ? Number(existing.dueAmount) : configuredDueAmount;
      const payNow = dueAmount - (existing ? Number(existing.paidAmount) : 0);
      if (payNow <= 0) continue;

      const rentPayment = await tx.rentPayment.upsert({
        where: { tenantLeaseId_month: { tenantLeaseId, month } },
        update: { dueAmount, paidAmount: dueAmount, status: "PAID", paidAt: paidDate },
        create: {
          tenantLeaseId,
          month,
          dueDate: monthDueDate,
          dueAmount,
          paidAmount: dueAmount,
          status: "PAID",
          paidAt: paidDate,
        },
      });

      await tx.transaction.create({
        data: {
          propertyId,
          type: "RENT_RECEIVED_FROM_TENANT",
          direction: "INCOMING",
          amount: payNow,
          method,
          tenantLeaseId,
          rentPaymentId: rentPayment.id,
          date: paidDate,
          notes: str(formData, "notes"),
        },
      });
      totalRecorded += payNow;
    }
    return totalRecorded;
  }, { isolationLevel: "Serializable" });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidateLocalizedPath(locale, returnTo);
  redirect({
    href: withRentActionFeedback(returnTo, "advance", { amount: recordedAmount, count: monthsCount }),
    locale,
  });
}
