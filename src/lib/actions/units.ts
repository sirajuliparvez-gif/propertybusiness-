"use server";

import { dhakaToday } from "@/lib/dhaka-time";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

import { requireCurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { parseMoneyAmount } from "@/lib/money-input";
import { localizedMutationPaths } from "@/lib/localized-revalidation";
import { MAX_UNIT_LABEL_LENGTH, normalizeUnitLabel, unitLabelKey } from "@/lib/unit-label-key";
function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function updateUnitStatus(formData: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const unitId = formData.get("unitId") as string;
  const propertyId = formData.get("propertyId") as string;
  const status = formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (!unitId || !propertyId) throw new Error("Missing unit or property id");

  const before = await prisma.unit.findUnique({ where: { id: unitId }, select: { label: true, status: true } });
  await prisma.unit.update({ where: { id: unitId }, data: { status } });
  await recordAudit(user, {
    action: "unit.status",
    entity: "Unit",
    entityId: unitId,
    propertyId,
    summary: `Unit ${before?.label ?? unitId}: ${before?.status ?? "?"} -> ${status}`,
    details: { before: before?.status ?? null, after: status },
  });

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
  const user = await requireCurrentUser();
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

  // Set inside the transaction below; the cast stops TypeScript from narrowing it to null.
  let vacated = null as { refunded: number; depositBefore: number } | null;
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
      data: { status: "VACATED", movedOutAt: dhakaToday() },
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
          date: dhakaToday(),
        },
      });
      await tx.tenantLease.update({
        where: { id: leaseId },
        data: { currentDownpaymentBalance: { decrement: refundAmount } },
      });
    }
    vacated = { refunded: refundAmount, depositBefore: Number(lease.currentDownpaymentBalance) };
  });
  if (vacated) {
    await recordAudit(user, {
      action: "lease.vacate",
      entity: "TenantLease",
      entityId: leaseId,
      propertyId,
      summary: `Move-out, deposit refunded ৳${vacated.refunded} of ৳${vacated.depositBefore}`,
      details: vacated,
    });
  }

  const returnTo = str(formData, "returnTo") ?? `/properties/${propertyId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function addTenantToUnit(formData: FormData) {
  await requireCurrentUser();
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

  // initialDownpaymentAmount is optional — some tenants aren't asked for an
  // advance at all; monthlyRentAmount and startDate stay required.
  if (!monthlyRentAmount || !startDate) {
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
    // The unit must belong to the property in the form, and must not already have an active tenant —
    // a double click or a stale page would otherwise create a second lease and a second deposit entry.
    const unit = await tx.unit.findFirst({ where: { id: unitId, unitType: { propertyId } }, select: { id: true } });
    if (!unit) throw new Error("Unit not found in this property");
    const occupied = await tx.tenantLease.findFirst({ where: { unitId, status: "ACTIVE" }, select: { id: true } });
    if (occupied) throw new Error("This unit already has an active tenant");

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
    if (initialDownpaymentAmount && Number(initialDownpaymentAmount) > 0) {
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

// Units of one property, flat and labelled, for the edit-bill dialog's unit
// picker — a read-only action, fetched when that dialog opens (the cross-
// property Utility Bills page has no unit list of its own to pass in).
export async function listPropertyUnits(propertyId: string) {
  await requireCurrentUser();
  if (!propertyId) return [];
  const unitTypes = await prisma.unitType.findMany({
    where: { propertyId },
    orderBy: { label: "asc" },
    select: {
      label: true,
      // Inactive units included: a bill can legitimately sit on one, and
      // omitting it would leave the picker unable to show its current value.
      units: {
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          // Whoever currently rents the shop — pickers show its business
          // name next to the shop number.
          tenantLeases: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { tenant: { select: { name: true } } },
          },
        },
      },
    },
  });
  return unitTypes.flatMap((ut) =>
    ut.units.map((u) => ({
      id: u.id,
      label: u.label,
      unitTypeLabel: ut.label,
      tenantName: u.tenantLeases[0]?.tenant.name ?? null,
    }))
  );
}


export type AddUnitErrorCode = "missingLabel" | "labelTooLong" | "invalidRent" | "notFound" | "duplicateLabel";
export type AddUnitResult = { ok: true; label: string } | { ok: false; error: AddUnitErrorCode };

// Adds ONE unit to an existing unit type: only its number/name is needed, and it takes the
// type's size and rent unless a rent is given. A number that already exists in the property
// (in Bengali or English digits) is refused instead of creating a second one.
export async function addUnitToType(formData: FormData): Promise<AddUnitResult> {
  await requireCurrentUser();
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId");
  const unitTypeId = str(formData, "unitTypeId");
  const label = normalizeUnitLabel(String(formData.get("label") ?? ""));
  const rentRaw = str(formData, "tenantDefaultRentAmount");

  if (!propertyId || !unitTypeId) return { ok: false, error: "notFound" };
  if (!label) return { ok: false, error: "missingLabel" };
  if (label.length > MAX_UNIT_LABEL_LENGTH) return { ok: false, error: "labelTooLong" };
  const rent = rentRaw == null ? null : parseMoneyAmount(rentRaw);
  if (rentRaw != null && !rent) return { ok: false, error: "invalidRent" };

  const result = await prisma.$transaction(async (tx): Promise<AddUnitResult> => {
    const unitType = await tx.unitType.findFirst({
      where: { id: unitTypeId, propertyId, property: { deletedAt: null } },
      select: { id: true },
    });
    if (!unitType) return { ok: false, error: "notFound" };

    const existing = await tx.unit.findMany({ where: { unitType: { propertyId } }, select: { label: true } });
    const key = unitLabelKey(label);
    if (existing.some((unit) => unitLabelKey(unit.label) === key)) return { ok: false, error: "duplicateLabel" };

    await tx.unit.create({
      data: { unitTypeId, label, tenantDefaultRentAmount: rent ?? undefined },
    });
    await tx.unitType.update({
      where: { id: unitTypeId },
      data: { unitCount: await tx.unit.count({ where: { unitTypeId } }) },
    });
    return { ok: true, label };
  });

  if (result.ok) {
    for (const path of [...localizedMutationPaths(locale, `/properties/${propertyId}`), `/${locale}/vacant-units`]) {
      revalidatePath(path);
    }
  }
  return result;
}


export type ReactivateLeaseErrorCode = "missingFields" | "notFound" | "unitOccupied";
export type ReactivateLeaseResult = { ok: true } | { ok: false; error: ReactivateLeaseErrorCode };

// Undoes a move-out done by mistake: the lease is active again and the unit is occupied again.
// The deposit refund that was recorded at move-out stays in the books and the deposit balance
// stays as it was after the refund — if money really went back to the tenant, that is true.
export async function reactivateTenantLease(formData: FormData): Promise<ReactivateLeaseResult> {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const leaseId = str(formData, "leaseId");
  const propertyId = str(formData, "propertyId");
  if (!leaseId || !propertyId) return { ok: false, error: "missingFields" };

  const result = await prisma.$transaction(async (tx): Promise<ReactivateLeaseResult & { tenantId?: string }> => {
    const lease = await tx.tenantLease.findFirst({
      where: { id: leaseId, status: "VACATED", unit: { unitType: { propertyId } } },
      select: { unitId: true, tenantId: true },
    });
    if (!lease) return { ok: false, error: "notFound" };
    const occupied = await tx.tenantLease.findFirst({ where: { unitId: lease.unitId, status: "ACTIVE" }, select: { id: true } });
    if (occupied) return { ok: false, error: "unitOccupied" };

    await tx.tenantLease.update({ where: { id: leaseId }, data: { status: "ACTIVE", movedOutAt: null } });
    // A unit that was switched to inactive after the move-out cannot hold an active tenant.
    await tx.unit.update({ where: { id: lease.unitId }, data: { status: "ACTIVE" } });
    return { ok: true, tenantId: lease.tenantId };
  });

  if (!result.ok) return result;
  await recordAudit(user, {
    action: "lease.reactivate",
    entity: "TenantLease",
    entityId: leaseId,
    propertyId,
    summary: "Move-out undone, lease active again",
    details: { tenantId: result.tenantId },
  });
  for (const path of [...localizedMutationPaths(locale, `/properties/${propertyId}`), `/${locale}/vacant-units`, `/${locale}/tenants`, `/${locale}/tenants/${result.tenantId}`]) {
    revalidatePath(path);
  }
  return { ok: true };
}
