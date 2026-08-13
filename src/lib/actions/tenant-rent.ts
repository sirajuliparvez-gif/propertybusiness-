"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { computeServiceChargeAmount } from "@/lib/service-charge";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
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
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const lease = await prisma.tenantLease.findUnique({ where: { id: tenantLeaseId } });
  if (!lease) throw new Error("Tenant lease not found");

  if (mode === "downpaymentAdjustment" && amount > Number(lease.currentDownpaymentBalance)) {
    throw new Error("Adjustment amount exceeds available downpayment balance");
  }

  const dueAmount = Number(lease.monthlyRentAmount);
  const status =
    mode === "downpaymentAdjustment"
      ? amount >= dueAmount
        ? "ADJUSTED_FROM_DOWNPAYMENT"
        : "PARTIAL"
      : amount >= dueAmount
        ? "PAID"
        : "PARTIAL";

  await prisma.$transaction(async (tx) => {
    const rentPayment = await tx.rentPayment.upsert({
      where: { tenantLeaseId_month: { tenantLeaseId, month } },
      update: { dueAmount, paidAmount: amount, status, paidAt: paidDate },
      create: {
        tenantLeaseId,
        month,
        dueDate: paidDate,
        dueAmount,
        paidAmount: amount,
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

      // Optional add-on collected alongside rent (not everyone has one) —
      // recomputed fresh from the current monthlyRentAmount rather than
      // trusting a client-supplied figure, same "never trust the client for
      // money" rule this codebase applies everywhere else. Only bundled for
      // a real cash-ish payment; a downpayment adjustment above only ever
      // covers rent itself.
      const serviceChargeAmount = computeServiceChargeAmount(
        Number(lease.monthlyRentAmount),
        lease.serviceChargeType,
        lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
      );
      if (serviceChargeAmount > 0) {
        await tx.transaction.create({
          data: {
            propertyId,
            type: "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
            direction: "INCOMING",
            amount: serviceChargeAmount,
            method,
            tenantLeaseId,
            date: paidDate,
          },
        });
      }
    }
  });

  // Reachable from both the per-property page and the cross-property global
  // Tenants page — each redirects back to wherever it was submitted from.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
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
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  const lease = await prisma.tenantLease.findUnique({ where: { id: tenantLeaseId } });
  if (!lease) throw new Error("Tenant lease not found");

  const dueAmount = Number(lease.monthlyRentAmount);
  const serviceChargeAmount = computeServiceChargeAmount(
    dueAmount,
    lease.serviceChargeType,
    lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null
  );
  const months = Array.from({ length: monthsCount }, (_, i) => addMonthsToMonthStr(startMonth, i));

  await prisma.$transaction(async (tx) => {
    for (const month of months) {
      const [year, monthIndex] = month.split("-").map(Number);
      const monthDueDate = new Date(year, monthIndex - 1, 1);

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
          amount: dueAmount,
          method,
          tenantLeaseId,
          rentPaymentId: rentPayment.id,
          date: paidDate,
          notes: str(formData, "notes"),
        },
      });

      if (serviceChargeAmount > 0) {
        await tx.transaction.create({
          data: {
            propertyId,
            type: "SERVICE_CHARGE_RECEIVED_FROM_TENANT",
            direction: "INCOMING",
            amount: serviceChargeAmount,
            method,
            tenantLeaseId,
            date: paidDate,
          },
        });
      }
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
