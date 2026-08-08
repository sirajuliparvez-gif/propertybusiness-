"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Edits an existing tenancy's info in one go: the Tenant record (name,
// contact, occupation, NID/business registration) and the TenantLease record
// (rent, downpayment — both the historical initial figure AND the current
// balance are directly editable here, same "manual correction" capability
// round 18 already established for an occupied unit's downpayment from the
// Edit Unit Type dialog, just reached from the tenant's own profile page this
// time). Also accepts the same three optional document uploads as creating a
// tenant (NID photo, tenant photo, agreement copy) — these always ADD a new
// Document row, never replace an existing one, so a tenant can accumulate
// multiple NID/agreement copies over time rather than losing history.
export async function updateTenantLease(formData: FormData) {
  const locale = await getLocale();
  const leaseId = formData.get("leaseId") as string;
  const tenantId = formData.get("tenantId") as string;
  if (!leaseId || !tenantId) throw new Error("Missing lease or tenant id");

  const name = str(formData, "name");
  if (!name) throw new Error("Tenant name is required");
  const contactInfo = str(formData, "contactInfo");
  const occupation = str(formData, "occupation");
  const tenantType = formData.get("tenantType") === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL";
  const nidNumber = tenantType === "INDIVIDUAL" ? str(formData, "nidNumber") : null;
  const businessRegistrationNumber =
    tenantType === "BUSINESS" ? str(formData, "businessRegistrationNumber") : null;

  const monthlyRentAmount = str(formData, "monthlyRentAmount");
  const initialDownpaymentAmount = str(formData, "initialDownpaymentAmount");
  const currentDownpaymentBalance = str(formData, "currentDownpaymentBalance");
  const notes = str(formData, "notes");
  if (!monthlyRentAmount || !initialDownpaymentAmount || !currentDownpaymentBalance) {
    throw new Error("Missing required lease fields");
  }

  const serviceChargeTypeRaw = formData.get("serviceChargeType");
  const serviceChargeType =
    serviceChargeTypeRaw === "FLAT" || serviceChargeTypeRaw === "PERCENTAGE" ? serviceChargeTypeRaw : null;
  const serviceChargeValue = serviceChargeType ? str(formData, "serviceChargeValue") : null;

  const nidDocumentUrl = str(formData, "nidDocumentUrl");
  const nidDocumentFileType = str(formData, "nidDocumentFileType");
  const tenantPhotoUrl = str(formData, "tenantPhotoUrl");
  const tenantPhotoFileType = str(formData, "tenantPhotoFileType");
  const agreementDocumentUrl = str(formData, "agreementDocumentUrl");
  const agreementDocumentFileType = str(formData, "agreementDocumentFileType");

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        contactInfo,
        occupation,
        type: tenantType,
        nidNumber,
        businessRegistrationNumber,
      },
    });

    await tx.tenantLease.update({
      where: { id: leaseId },
      data: {
        monthlyRentAmount,
        initialDownpaymentAmount,
        currentDownpaymentBalance,
        serviceChargeType,
        serviceChargeValue,
        notes,
      },
    });

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
    if (agreementDocumentUrl) {
      await tx.document.create({
        data: {
          ownerType: "TENANT_LEASE",
          tenantLeaseId: leaseId,
          fileUrl: agreementDocumentUrl,
          fileType: agreementDocumentFileType,
          label: "AGREEMENT_COPY",
        },
      });
    }
  });

  const returnTo = str(formData, "returnTo") ?? `/tenants/${leaseId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
