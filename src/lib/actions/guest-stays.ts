"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function parseMethod(formData: FormData, key: string) {
  const raw = formData.get(key);
  return raw === "CASH" || raw === "BKASH" || raw === "NAGAD" || raw === "BANK" || raw === "OTHER" ? raw : null;
}

// New bookings always start RESERVED — check-in is its own explicit action
// (front desk marks it when the guest actually walks in), never inferred
// just because the check-in date has arrived.
export async function createGuestStay(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const unitId = formData.get("unitId") as string;
  if (!propertyId || !unitId) throw new Error("Missing property or unit id");

  const guestName = str(formData, "guestName");
  const checkInDate = str(formData, "checkInDate");
  const ratePerNight = str(formData, "ratePerNight");
  const totalAmount = str(formData, "totalAmount");
  if (!guestName || !checkInDate || !ratePerNight || !totalAmount) {
    throw new Error("Missing required booking fields");
  }

  const guestIdTypeRaw = formData.get("guestIdType");
  const guestIdType =
    guestIdTypeRaw === "NID" || guestIdTypeRaw === "PASSPORT" || guestIdTypeRaw === "OTHER" ? guestIdTypeRaw : null;
  const numberOfGuestsRaw = str(formData, "numberOfGuests");
  const checkOutDate = str(formData, "checkOutDate");
  const depositAmount = str(formData, "depositAmount");
  const idDocumentUrl = str(formData, "idDocumentUrl");
  const idDocumentFileType = str(formData, "idDocumentFileType");

  await prisma.$transaction(async (tx) => {
    const stay = await tx.guestStay.create({
      data: {
        unitId,
        guestName,
        guestPhone: str(formData, "guestPhone"),
        guestAddress: str(formData, "guestAddress"),
        guestIdType,
        guestIdNumber: str(formData, "guestIdNumber"),
        numberOfGuests: numberOfGuestsRaw ? Number(numberOfGuestsRaw) : 1,
        checkInDate: new Date(checkInDate),
        checkOutDate: checkOutDate ? new Date(checkOutDate) : undefined,
        ratePerNight,
        totalAmount,
        depositAmount,
        notes: str(formData, "notes"),
      },
    });

    if (idDocumentUrl) {
      await tx.document.create({
        data: {
          ownerType: "GUEST_STAY",
          guestStayId: stay.id,
          fileUrl: idDocumentUrl,
          fileType: idDocumentFileType,
        },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? "/guest-stays";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function updateGuestStay(formData: FormData) {
  const locale = await getLocale();
  const guestStayId = formData.get("guestStayId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!guestStayId) throw new Error("Missing booking id");

  const guestName = str(formData, "guestName");
  const checkInDate = str(formData, "checkInDate");
  const ratePerNight = str(formData, "ratePerNight");
  const totalAmount = str(formData, "totalAmount");
  if (!guestName || !checkInDate || !ratePerNight || !totalAmount) {
    throw new Error("Missing required booking fields");
  }

  const guestIdTypeRaw = formData.get("guestIdType");
  const guestIdType =
    guestIdTypeRaw === "NID" || guestIdTypeRaw === "PASSPORT" || guestIdTypeRaw === "OTHER" ? guestIdTypeRaw : null;
  const numberOfGuestsRaw = str(formData, "numberOfGuests");
  const checkOutDate = str(formData, "checkOutDate");

  await prisma.guestStay.update({
    where: { id: guestStayId },
    data: {
      guestName,
      guestPhone: str(formData, "guestPhone"),
      guestAddress: str(formData, "guestAddress"),
      guestIdType,
      guestIdNumber: str(formData, "guestIdNumber"),
      numberOfGuests: numberOfGuestsRaw ? Number(numberOfGuestsRaw) : 1,
      checkInDate: new Date(checkInDate),
      checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
      ratePerNight,
      totalAmount,
      depositAmount: str(formData, "depositAmount"),
      notes: str(formData, "notes"),
    },
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Plain status flips — check-in, cancel, no-show all just move the state
// machine forward with no side effects on money.
export async function updateGuestStayStatus(formData: FormData) {
  const locale = await getLocale();
  const guestStayId = formData.get("guestStayId") as string;
  const propertyId = formData.get("propertyId") as string;
  const status = formData.get("status") as string;
  if (!guestStayId || !status) throw new Error("Missing booking id or status");
  if (!["CHECKED_IN", "CANCELLED", "NO_SHOW"].includes(status)) {
    throw new Error("Invalid status transition");
  }

  await prisma.guestStay.update({
    where: { id: guestStayId },
    data: { status: status as "CHECKED_IN" | "CANCELLED" | "NO_SHOW" },
  });

  const returnTo = str(formData, "returnTo") ?? "/guest-stays";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Checking out also settles any incidental/damage deposit still held — same
// refund shape as vacateTenantLease/endLeaseAgreement: a real Transaction
// (GUEST_DEPOSIT_REFUND, OUTGOING) that's excluded from netProfit, since
// returning the guest's own deposit isn't a company cost. Partial refund is
// legitimate (damage deduction), so the amount is editable.
export async function checkOutGuestStay(formData: FormData) {
  const locale = await getLocale();
  const guestStayId = formData.get("guestStayId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!guestStayId || !propertyId) throw new Error("Missing booking or property id");

  const refundAmountRaw = str(formData, "refundAmount");
  const method = parseMethod(formData, "refundMethod");

  await prisma.$transaction(async (tx) => {
    const stay = await tx.guestStay.findFirst({
      where: { id: guestStayId, status: "CHECKED_IN" },
      select: { depositAmount: true },
    });
    if (!stay) return;

    await tx.guestStay.updateMany({
      where: { id: guestStayId, status: "CHECKED_IN" },
      data: { status: "CHECKED_OUT", checkOutDate: new Date() },
    });

    const maxRefund = Number(stay.depositAmount ?? 0);
    const requested = refundAmountRaw ? Number(refundAmountRaw) : 0;
    const refundAmount = Math.min(Math.max(0, requested), maxRefund);
    if (refundAmount > 0) {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "GUEST_DEPOSIT_REFUND",
          direction: "OUTGOING",
          amount: refundAmount,
          method,
          guestStayId,
          date: new Date(),
        },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? "/guest-stays";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Records money actually received for the stay — separate, repeatable action
// (booking → collect now or later, same "add then pay" shape as utility
// bills), rather than bundled into createGuestStay.
export async function recordGuestStayPayment(formData: FormData) {
  const locale = await getLocale();
  const guestStayId = formData.get("guestStayId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!guestStayId || !propertyId) throw new Error("Missing booking or property id");

  const amount = str(formData, "amount");
  if (!amount) throw new Error("Missing amount");
  const method = parseMethod(formData, "method");
  const dateStr = str(formData, "date");

  await prisma.transaction.create({
    data: {
      propertyId,
      type: "GUEST_STAY_PAYMENT_RECEIVED",
      direction: "INCOMING",
      amount,
      method,
      guestStayId,
      date: dateStr ? new Date(dateStr) : new Date(),
    },
  });

  const returnTo = str(formData, "returnTo") ?? "/guest-stays";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
