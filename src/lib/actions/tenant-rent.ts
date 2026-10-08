"use server";

import { dhakaNow } from "@/lib/dhaka-time";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { buildRentLedger, overdueEntries, totalOverdue, RENT_DUE_DAY } from "@/lib/rent-ledger";
import { applyRentInstallment } from "@/lib/payment-progress";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function revalidateLocalizedPath(locale: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const localizedPath = normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
  revalidatePath(localizedPath);
}

export type RentPaymentEditErrorCode =
  | "missingFields"
  | "notFound"
  | "notEditable"
  | "invalidAmount"
  | "amountExceedsDue";

export type RentPaymentEditResult =
  | { ok: true }
  | { ok: false; error: RentPaymentEditErrorCode };

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
  const returnTo = str(formData, "returnTo") ?? (tenantLeaseId ? `/tenants/${tenantLeaseId}` : "/rent");
  if (!rentPaymentId || !tenantLeaseId || !amountRaw || !dateRaw) {
    return { ok: false, error: "missingFields" };
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

    const status = amount >= Number(payment.dueAmount) ? "PAID" : "PARTIAL";
    await tx.rentPayment.update({
      where: { id: rentPaymentId },
      data: { paidAmount: amount, paidAt: paidDate, status },
    });
    await tx.transaction.update({
      where: { id: payment.transactions[0].id },
      data: { amount, date: paidDate, method },
    });
    return null;
  });
  if (problem) return { ok: false, error: problem };

  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: returnTo, locale });
  return { ok: true };
}

// Records this month's rent as collected from a tenant — either as a normal
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
  const month = dateStr.slice(0, 7);
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

  const lease = await prisma.tenantLease.findUnique({ where: { id: tenantLeaseId } });
  if (!lease) throw new Error("Tenant lease not found");

  if (mode === "downpaymentAdjustment" && amount > Number(lease.currentDownpaymentBalance)) {
    throw new Error("Adjustment amount exceeds available downpayment balance");
  }

  // "Rent due" is rent + service charge bundled as one figure — one
  // RentPayment row, one collection action, one Transaction, regardless of
  // how it's settled (cash or downpayment adjustment).
  const serviceChargeAmount = computeServiceChargeAmount(
    Number(lease.monthlyRentAmount),
    lease.serviceChargeType,
    lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
  );
  const dueAmount = Number(lease.monthlyRentAmount) + serviceChargeAmount;
  const [monthYear, monthNumber] = month.split("-").map(Number);

  await prisma.$transaction(async (tx) => {
    // A second payment toward the same month ADDS to what's already paid (and
    // a fully settled month refuses more) — overwriting paidAmount while still
    // writing a fresh Transaction double-counted income and left the rent row
    // disagreeing with the ledger of money actually received.
    const existing = await tx.rentPayment.findUnique({
      where: { tenantLeaseId_month: { tenantLeaseId, month } },
      select: { paidAmount: true, dueAmount: true },
    });
    const alreadyPaid = existing ? Number(existing.paidAmount) : 0;
    if (existing && alreadyPaid >= Number(existing.dueAmount)) {
      throw new Error("Rent for this month is already fully paid");
    }
    const { totalPaid, status } = applyRentInstallment({
      dueAmount,
      alreadyPaid,
      paymentAmount: amount,
      adjustedFromDownpayment: mode === "downpaymentAdjustment",
    });

    const rentPayment = await tx.rentPayment.upsert({
      where: { tenantLeaseId_month: { tenantLeaseId, month } },
      update: { dueAmount, paidAmount: totalPaid, status, paidAt: paidDate },
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
  });

  // Reachable from both the per-property page and the cross-property global
  // Tenants page — each redirects back to wherever it was submitted from.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: returnTo, locale });
}

// Settles a tenant's back rent in one go — a lump sum applied oldest-month
// first across however many months are actually overdue (real RentPayment
// rows AND months nobody ever recorded, per rent-ledger.ts), same
// "one Transaction per covered month" pattern recordAdvanceRentPayment
// already uses for the opposite (future) direction. A tenant catching up on
// 3 months doesn't have to be paid off in 3 separate manual entries anymore
// — one amount here fills the oldest debt first, then the next, etc.,
// including a genuine partial on whichever month the money runs out on.
export async function recordOverdueRentPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const tenantLeaseId = formData.get("tenantLeaseId") as string;
  if (!propertyId || !tenantLeaseId) throw new Error("Missing property or lease id");

  const dateStr = str(formData, "date");
  const amountStr = str(formData, "amount");
  if (!dateStr || !amountStr) throw new Error("Missing required payment fields");
  let remaining = Number(amountStr);
  if (!(remaining > 0)) throw new Error("Amount must be greater than zero");
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

  const lease = await prisma.tenantLease.findUnique({ where: { id: tenantLeaseId } });
  if (!lease) throw new Error("Tenant lease not found");

  const existingPayments = await prisma.rentPayment.findMany({
    where: { tenantLeaseId },
    select: { id: true, month: true, dueDate: true, dueAmount: true, paidAmount: true, status: true, paidAt: true },
  });
  const asOf = lease.status === "ACTIVE" ? dhakaNow() : (lease.movedOutAt ?? lease.endDate ?? dhakaNow());
  const overdueServiceChargeAmount = computeServiceChargeAmount(
    Number(lease.monthlyRentAmount),
    lease.serviceChargeType,
    lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
  );
  // "Rent due" is rent + service charge bundled as one figure — see the
  // matching note in recordTenantRentPayment above.
  const ledger = buildRentLedger(
    lease.startDate,
    Number(lease.monthlyRentAmount) + overdueServiceChargeAmount,
    existingPayments.map((rp) => ({
      id: rp.id,
      month: rp.month,
      dueDate: rp.dueDate,
      dueAmount: Number(rp.dueAmount),
      paidAmount: Number(rp.paidAmount),
      status: rp.status,
      paidAt: rp.paidAt,
    })),
    asOf,
    RENT_DUE_DAY
  );
  const overdue = overdueEntries(ledger); // oldest month first
  if (overdue.length === 0) throw new Error("No overdue rent for this tenant");
  if (remaining > totalOverdue(ledger)) {
    throw new Error("Amount exceeds total overdue rent");
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of overdue) {
      if (remaining <= 0) break;
      const payThisMonth = Math.min(remaining, entry.gap);
      const newPaidAmount = entry.paidAmount + payThisMonth;
      const newStatus = newPaidAmount >= entry.dueAmount ? "PAID" : "PARTIAL";

      const rentPayment = entry.rentPaymentId
        ? await tx.rentPayment.update({
            where: { id: entry.rentPaymentId },
            data: { paidAmount: newPaidAmount, status: newStatus, paidAt: paidDate },
          })
        : await tx.rentPayment.create({
            data: {
              tenantLeaseId,
              month: entry.month,
              dueDate: entry.dueDate,
              dueAmount: entry.dueAmount,
              paidAmount: newPaidAmount,
              status: newStatus,
              paidAt: paidDate,
            },
          });

      await tx.transaction.create({
        data: {
          propertyId,
          type: "RENT_RECEIVED_FROM_TENANT",
          direction: "INCOMING",
          amount: payThisMonth,
          method,
          tenantLeaseId,
          rentPaymentId: rentPayment.id,
          date: paidDate,
        },
      });

      remaining -= payThisMonth;
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: returnTo, locale });
}

function addMonthsToMonthStr(monthStr: string, offset: number) {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// A tenant sometimes pays several months of rent in one go (any number of
// months, not just round numbers — 1, 7, 9, whatever they hand over)
// instead of monthly. Reports/dashboards bucket income by
// Transaction.date (cash-basis, see reports-data.ts), not by the month a
// RentPayment logically covers — so a single lump Transaction dated today
// would correctly show the full amount as this month's income, but every
// future month's RentPayment would still read as its own separate row with
// no Transaction of its own. Instead we create one RentPayment PER covered
// month (so each month's due/paid status is individually correct and
// vacancy/overdue logic keeps working), each with its OWN Transaction — all
// dated on the same real payment date, so the full advance amount lands in
// the month it was actually received, matching how every other cash-basis
// figure in this app already behaves. What the company later pays the
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

  const lease = await prisma.tenantLease.findUnique({ where: { id: tenantLeaseId } });
  if (!lease) throw new Error("Tenant lease not found");

  const rentAmount = Number(lease.monthlyRentAmount);
  const serviceChargeAmount = computeServiceChargeAmount(
    rentAmount,
    lease.serviceChargeType,
    lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
  );
  // "Rent due" is rent + service charge bundled as one figure — see the
  // matching note in recordTenantRentPayment above.
  const dueAmount = rentAmount + serviceChargeAmount;
  const months = Array.from({ length: monthsCount }, (_, i) => addMonthsToMonthStr(startMonth, i));

  await prisma.$transaction(async (tx) => {
    for (const month of months) {
      const [year, monthIndex] = month.split("-").map(Number);
      const monthDueDate = new Date(year, monthIndex - 1, RENT_DUE_DAY);

      // Months that are already (partly) paid only take the remaining gap —
      // re-collecting the full amount would double-count the income.
      const existing = await tx.rentPayment.findUnique({
        where: { tenantLeaseId_month: { tenantLeaseId, month } },
        select: { paidAmount: true },
      });
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
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidateLocalizedPath(locale, returnTo);
  redirect({ href: returnTo, locale });
}
