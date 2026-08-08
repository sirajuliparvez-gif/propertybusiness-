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
