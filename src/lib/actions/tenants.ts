"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { dhakaISO, dhakaTodayISO } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";
import { earliestRentChangeMonth } from "@/lib/rent-terms";
import { requireCurrentUser } from "@/lib/auth/session";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import type { Prisma } from "@/generated/prisma/client";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

type LeaseWithRates = Prisma.TenantLeaseGetPayload<{ include: { rentRates: true } }>;

async function saveScheduledRentTerms(
  tx: Prisma.TransactionClient,
  lease: LeaseWithRates,
  effectiveMonth: string,
  terms: Pick<Prisma.TenantRentRateUncheckedCreateInput, "monthlyRentAmount" | "serviceChargeType" | "serviceChargeValue">,
) {
  if (lease.rentRates.length === 0) {
    const baselineMonth = dhakaISO(lease.startDate).slice(0, 7);
    await tx.tenantRentRate.upsert({
      where: { tenantLeaseId_effectiveMonth: { tenantLeaseId: lease.id, effectiveMonth: baselineMonth } },
      update: {},
      create: {
        tenantLeaseId: lease.id,
        effectiveMonth: baselineMonth,
        monthlyRentAmount: lease.monthlyRentAmount,
        serviceChargeType: lease.serviceChargeType,
        serviceChargeValue: lease.serviceChargeValue,
      },
    });
  }
  await tx.tenantRentRate.upsert({
    where: { tenantLeaseId_effectiveMonth: { tenantLeaseId: lease.id, effectiveMonth } },
    update: terms,
    create: { tenantLeaseId: lease.id, effectiveMonth, ...terms },
  });
}

export async function changeTenantRent(formData: FormData) {
  await requireCurrentUser();
  const leaseId = str(formData, "leaseId");
  const amount = str(formData, "monthlyRentAmount");
  const month = str(formData, "rentEffectiveMonth");
  if (!leaseId || amount == null || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !isPaymentMonth(month)) {
    return { ok: false as const, error: "invalid" as const };
  }

  const result = await prisma.$transaction(async (tx) => {
    const lease = await tx.tenantLease.findUnique({
      where: { id: leaseId },
      include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
    });
    if (!lease || lease.status !== "ACTIVE") return { ok: false as const, error: "inactive" as const };
    if (month < earliestRentChangeMonth(dhakaTodayISO(), lease.rentRates.at(-1)?.effectiveMonth)) {
      return { ok: false as const, error: "month" as const };
    }
    await saveScheduledRentTerms(tx, lease, month, {
      monthlyRentAmount: amount,
      serviceChargeType: lease.serviceChargeType,
      serviceChargeValue: lease.serviceChargeValue,
    });
    await tx.tenantLease.update({ where: { id: leaseId }, data: { monthlyRentAmount: amount } });
    return { ok: true as const };
  }, { isolationLevel: "Serializable" });

  if (result.ok) {
    const locale = await getLocale();
    for (const path of localizedMutationPaths(locale, `/tenants/${leaseId}`)) revalidatePath(path);
    revalidatePath(`/${locale}/tenants`);
    revalidatePath(`/${locale}/rent/arrears`);
  }
  return result;
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
  // initialDownpaymentAmount/currentDownpaymentBalance are optional — some
  // tenants aren't asked for an advance at all; monthlyRentAmount stays required.
  if (!monthlyRentAmount) {
    throw new Error("Missing required lease fields");
  }

  const serviceChargeTypeRaw = formData.get("serviceChargeType");
  const serviceChargeType =
    serviceChargeTypeRaw === "FLAT" || serviceChargeTypeRaw === "PERCENTAGE" ? serviceChargeTypeRaw : null;
  const serviceChargeValue = serviceChargeType ? str(formData, "serviceChargeValue") : null;
  const rentEffectiveMonth = str(formData, "rentEffectiveMonth");

  const existingLease = await prisma.tenantLease.findUnique({
    where: { id: leaseId },
    include: { rentRates: { orderBy: { effectiveMonth: "asc" } } },
  });
  if (!existingLease) throw new Error("Tenant lease not found");

  const termsChanged =
    Number(existingLease.monthlyRentAmount) !== Number(monthlyRentAmount) ||
    existingLease.serviceChargeType !== serviceChargeType ||
    Number(existingLease.serviceChargeValue ?? 0) !== Number(serviceChargeValue ?? 0);
  if (termsChanged && (!isPaymentMonth(rentEffectiveMonth) ||
      rentEffectiveMonth < earliestRentChangeMonth(dhakaTodayISO(), existingLease.rentRates.at(-1)?.effectiveMonth))) {
    throw new Error("Rent changes must start from the next available billing month");
  }

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

    if (termsChanged && rentEffectiveMonth) {
      await saveScheduledRentTerms(tx, existingLease, rentEffectiveMonth, {
        monthlyRentAmount, serviceChargeType, serviceChargeValue,
      });
    }

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
