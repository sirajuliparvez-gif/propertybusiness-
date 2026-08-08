"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function updateUnitStatus(formData: FormData) {
  const locale = await getLocale();
  const unitId = formData.get("unitId") as string;
  const propertyId = formData.get("propertyId") as string;
  const status = formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (!unitId || !propertyId) throw new Error("Missing unit or property id");

  await prisma.unit.update({ where: { id: unitId }, data: { status } });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}

// Vacating a tenant also settles their remaining downpayment/advance balance
// — in reality the company owes that money back once the tenant leaves. This
// records the refund as a real OUTGOING Transaction (DOWNPAYMENT_REFUND_TO_TENANT
// — a distinct type from MAINTENANCE_EXPENSE/OTHER/UTILITY_EXPENSE, so it never
// gets swept into the Expenses card or netProfit: returning a deposit isn't an
// operating cost, it's discharging a liability that was never "ours") and
// decrements the balance by exactly what was refunded — a partial refund
// (e.g. after deducting damages) is legitimate, so the amount is editable in
// the UI rather than always assumed to be the full balance.
export async function vacateTenantLease(formData: FormData) {
  const locale = await getLocale();
  const leaseId = formData.get("leaseId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!leaseId || !propertyId) throw new Error("Missing lease or property id");

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
    const lease = await tx.tenantLease.findFirst({
      where: { id: leaseId, status: "ACTIVE" },
      select: { currentDownpaymentBalance: true },
    });
    // Already vacated / stale reference — silent no-op, the redirect below
    // still refreshes the page to whatever the current true state is.
    if (!lease) return;

    await tx.tenantLease.updateMany({
      where: { id: leaseId, status: "ACTIVE" },
      data: { status: "VACATED", movedOutAt: new Date() },
    });

    const requested = refundAmountRaw ? Number(refundAmountRaw) : 0;
    const refundAmount = Math.min(Math.max(0, requested), Number(lease.currentDownpaymentBalance));
    if (refundAmount > 0) {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "DOWNPAYMENT_REFUND_TO_TENANT",
          direction: "OUTGOING",
          amount: refundAmount,
          method,
          tenantLeaseId: leaseId,
          date: new Date(),
        },
      });
      await tx.tenantLease.update({
        where: { id: leaseId },
        data: { currentDownpaymentBalance: { decrement: refundAmount } },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function addTenantToUnit(formData: FormData) {
  const locale = await getLocale();
  const unitId = formData.get("unitId") as string;
  const propertyId = formData.get("propertyId") as string;
  if (!unitId || !propertyId) throw new Error("Missing unit or property id");

  const tenantMode = formData.get("tenantMode") as string;
  const existingTenantId = str(formData, "tenantId");

  const monthlyRentAmount = str(formData, "monthlyRentAmount");
  const initialDownpaymentAmount = str(formData, "initialDownpaymentAmount");
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

  const serviceChargeTypeRaw = formData.get("serviceChargeType");
  const serviceChargeType =
    serviceChargeTypeRaw === "FLAT" || serviceChargeTypeRaw === "PERCENTAGE" ? serviceChargeTypeRaw : null;
  const serviceChargeValue = serviceChargeType ? str(formData, "serviceChargeValue") : null;

  if (!monthlyRentAmount || !initialDownpaymentAmount || !startDate) {
    throw new Error("Missing required lease fields");
  }
  if (tenantMode === "new" && !str(formData, "newTenantName")) {
    throw new Error("Tenant name is required");
  }
  if (tenantMode === "existing" && !existingTenantId) {
    throw new Error("Tenant selection is required");
  }

  // NID/photo attach to the TENANT record — only meaningful when actually
  // creating one here, not when reusing an existing tenant for a new lease.
  const nidDocumentUrl = tenantMode === "new" ? str(formData, "nidDocumentUrl") : null;
  const nidDocumentFileType = str(formData, "nidDocumentFileType");
  const tenantPhotoUrl = tenantMode === "new" ? str(formData, "tenantPhotoUrl") : null;
  const tenantPhotoFileType = str(formData, "tenantPhotoFileType");
  // The agreement copy attaches to the LEASE itself, so it applies either way.
  const agreementDocumentUrl = str(formData, "agreementDocumentUrl");
  const agreementDocumentFileType = str(formData, "agreementDocumentFileType");

  await prisma.$transaction(async (tx) => {
    let tenantId = existingTenantId;
    if (tenantMode === "new") {
      const tenantType = formData.get("newTenantType") === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL";
      const tenant = await tx.tenant.create({
        data: {
          name: str(formData, "newTenantName")!,
          contactInfo: str(formData, "newTenantContact"),
          type: tenantType,
          nidNumber: tenantType === "INDIVIDUAL" ? str(formData, "newTenantNid") : null,
          businessRegistrationNumber:
            tenantType === "BUSINESS" ? str(formData, "newTenantRegistration") : null,
          occupation: str(formData, "newTenantOccupation"),
        },
      });
      tenantId = tenant.id;

      if (nidDocumentUrl) {
        await tx.document.create({
          data: {
            ownerType: "TENANT",
            tenantId,
            fileUrl: nidDocumentUrl,
            fileType: nidDocumentFileType,
            label: "NID_CARD",
          },
        });
      }
      if (tenantPhotoUrl) {
        await tx.document.create({
          data: {
            ownerType: "TENANT",
            tenantId,
            fileUrl: tenantPhotoUrl,
            fileType: tenantPhotoFileType,
            label: "TENANT_PHOTO",
          },
        });
      }
    }
    if (!tenantId) throw new Error("Tenant required");

    const lease = await tx.tenantLease.create({
      data: {
        unitId,
        tenantId,
        initialDownpaymentAmount,
        currentDownpaymentBalance: initialDownpaymentAmount,
        monthlyRentAmount,
        serviceChargeType,
        serviceChargeValue,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        notes,
      },
    });

    // Not income — this is the tenant's own deposit, held on the company's
    // behalf (a liability, refunded later via DOWNPAYMENT_REFUND_TO_TENANT).
    // Recorded for ledger/history purposes only.
    if (Number(initialDownpaymentAmount) > 0) {
      await tx.transaction.create({
        data: {
          propertyId,
          type: "DOWNPAYMENT_RECEIVED_FROM_TENANT",
          direction: "INCOMING",
          amount: initialDownpaymentAmount,
          method: downpaymentMethod,
          tenantLeaseId: lease.id,
          date: new Date(startDate),
        },
      });
    }

    if (agreementDocumentUrl) {
      await tx.document.create({
        data: {
          ownerType: "TENANT_LEASE",
          tenantLeaseId: lease.id,
          fileUrl: agreementDocumentUrl,
          fileType: agreementDocumentFileType,
          label: "AGREEMENT_COPY",
        },
      });
    }
  });

  // Reachable from both a unit's own popup (per-property page) and the
  // cross-property global Add Tenant dialog on /tenants — each redirects
  // back to wherever it was submitted from, same as the other global-page
  // actions in this codebase.
  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
