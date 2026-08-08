"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Records that this month's rent was paid to the owner — either a whole-
// property lump sum (unitId omitted) or one specific unit's share (unitId
// set); both forms can coexist across different months for the same
// agreement, per the user's own call. Finds-then-writes manually rather than
// relying on the (agreementId, month, unitId) unique constraint's upsert
// shortcut, because Postgres treats every NULL unitId as distinct — a DB-level
// upsert would never match an existing whole-property (null-unit) row and
// would just keep inserting duplicates instead of correcting the entry.
export async function recordOwnerRentPayment(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const ownerLeaseAgreementId = formData.get("ownerLeaseAgreementId") as string;
  if (!propertyId || !ownerLeaseAgreementId) throw new Error("Missing property or agreement id");

  const dateStr = str(formData, "date");
  const amount = str(formData, "amount");
  const unitId = str(formData, "unitId");
  if (!dateStr || !amount) throw new Error("Missing required payment fields");
  const month = dateStr.slice(0, 7);
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

  await prisma.$transaction(async (tx) => {
    const existing = await tx.ownerRentPayment.findFirst({
      where: { ownerLeaseAgreementId, month, unitId },
    });

    const payment = existing
      ? await tx.ownerRentPayment.update({
          where: { id: existing.id },
          data: { dueAmount: amount, paidAmount: amount, status: "PAID", paidAt: paidDate },
        })
      : await tx.ownerRentPayment.create({
          data: {
            ownerLeaseAgreementId,
            unitId,
            month,
            dueDate: paidDate,
            dueAmount: amount,
            paidAmount: amount,
            status: "PAID",
            paidAt: paidDate,
          },
        });

    await tx.transaction.create({
      data: {
        propertyId,
        type: "RENT_PAID_TO_OWNER",
        direction: "OUTGOING",
        amount,
        method,
        unitId,
        ownerRentPaymentId: payment.id,
        date: paidDate,
      },
    });
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}

// Ending the agreement also settles the downpayment the company originally
// gave the owner — same "refund" concept as vacateTenantLease, mirrored in
// the opposite direction: the owner (not the company) is the one returning
// money. A partial refund is legitimate (owner may deduct damages/dues), so
// the amount is editable rather than always assumed to be the full deposit.
export async function endLeaseAgreement(formData: FormData) {
  const locale = await getLocale();
  const agreementId = formData.get("agreementId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!agreementId || !propertyId) throw new Error("Missing agreement or property id");

  const refundAmountRaw = str(formData, "refundAmount");
  const methodRaw = formData.get("refundMethod");
  const method =
    methodRaw === "CASH" ||
    methodRaw === "BKASH" ||
    methodRaw === "NAGAD" ||
    methodRaw === "BANK" ||
    methodRaw === "OTHER"
      ? methodRaw
      : null;

  await prisma.$transaction(async (tx) => {
    const agreement = await tx.ownerLeaseAgreement.findFirst({
      where: { id: agreementId, status: "ACTIVE" },
      select: { downpaymentAmount: true },
    });
    if (!agreement) return;

    await tx.ownerLeaseAgreement.updateMany({
      where: { id: agreementId, status: "ACTIVE" },
      data: { status: "ENDED", endDate: new Date() },
    });

    const maxRefund = Number(agreement.downpaymentAmount ?? 0);
    const requested = refundAmountRaw ? Number(refundAmountRaw) : 0;
    const refundAmount = Math.min(Math.max(0, requested), maxRefund);
    // Not counted as income — this is the company getting its own deposit
    // back, not revenue. Recorded for ledger/history purposes only.
    if (refundAmount > 0) {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "DOWNPAYMENT_REFUND_FROM_OWNER",
          direction: "INCOMING",
          amount: refundAmount,
          method,
          date: new Date(),
        },
      });
    }
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}

// Ends the current active agreement (if there is one) and starts a new one,
// atomically — the "renew with new terms" flow. oldAgreementId is optional
// since a property could in principle have no active agreement to end.
export async function renewLeaseAgreement(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  const oldAgreementId = str(formData, "oldAgreementId");
  const rentMode = formData.get("rentMode");
  const fixedMonthlyRentAmount = rentMode === "fixed" ? str(formData, "fixedMonthlyRentAmount") : null;
  // Same fixed-vs-per-unit duality as the rent: in per-unit mode the total
  // downpayment is derived from summing each unit's own ownerDownpaymentAmount
  // (edited via EditUnitTypeDialog, unaffected by starting a new agreement),
  // not entered as one lump figure here.
  const downpaymentAmount = rentMode === "fixed" ? str(formData, "downpaymentAmount") : null;
  const downpaymentMethodRaw = formData.get("downpaymentMethod");
  const downpaymentMethod =
    downpaymentMethodRaw === "CASH" ||
    downpaymentMethodRaw === "BKASH" ||
    downpaymentMethodRaw === "NAGAD" ||
    downpaymentMethodRaw === "BANK" ||
    downpaymentMethodRaw === "OTHER"
      ? downpaymentMethodRaw
      : null;
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const notes = str(formData, "notes");
  if (!startDate) throw new Error("Missing required agreement fields");
  if (rentMode === "fixed" && !downpaymentAmount) {
    throw new Error("Downpayment amount is required for fixed rent mode");
  }

  await prisma.$transaction(async (tx) => {
    if (oldAgreementId) {
      await tx.ownerLeaseAgreement.updateMany({
        where: { id: oldAgreementId, status: "ACTIVE" },
        data: { status: "ENDED", endDate: new Date(startDate) },
      });
    }
    await tx.ownerLeaseAgreement.create({
      data: {
        propertyId,
        downpaymentAmount,
        fixedMonthlyRentAmount,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        notes,
        status: "ACTIVE",
      },
    });

    // New agreement, new deposit — not an operating expense, same reasoning
    // as createProperty's own DOWNPAYMENT_PAID_TO_OWNER entry.
    if (downpaymentAmount) {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "DOWNPAYMENT_PAID_TO_OWNER",
          direction: "OUTGOING",
          amount: downpaymentAmount,
          method: downpaymentMethod,
          date: new Date(startDate),
        },
      });
    }
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}
