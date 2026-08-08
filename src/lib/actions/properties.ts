"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

type UnitOverrideRow = {
  id?: string;
  label: string;
  sizeValue: string;
  sizeUnit: string;
  ownerRent: string;
  ownerDownpayment: string;
  tenantRent: string;
  tenantDownpayment: string;
  nightlyRate: string;
  tenantLeaseId?: string;
};

// Reads the per-unit override table (UnitOverridesTable) submitted as JSON.
// The row array is the source of truth for how many units get created —
// the table's own Add/Remove-row buttons can change this independent of the
// "unitCount" number field (which the client keeps in sync via a callback,
// but this must not re-validate against it here). Falls back to uniform
// "Unit N" labels with no overrides if the field is missing or malformed,
// so a plain create still works even if a client bug drops the field.
function parseUnitOverrides(
  formData: FormData,
  key: string,
  fallbackUnitCount: number,
  startIndex: number
) {
  const raw = formData.get(key);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as UnitOverrideRow[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row, i) => ({
          id: row.id,
          label: row.label?.trim() || `Unit ${startIndex + i + 1}`,
          sizeValue: row.sizeValue?.trim() ? row.sizeValue.trim() : null,
          sizeUnit: row.sizeUnit?.trim() ? row.sizeUnit.trim() : null,
          ownerRentAmount: row.ownerRent?.trim() ? row.ownerRent.trim() : null,
          ownerDownpaymentAmount: row.ownerDownpayment?.trim() ? row.ownerDownpayment.trim() : null,
          tenantDefaultRentAmount: row.tenantRent?.trim() ? row.tenantRent.trim() : null,
          tenantDefaultDownpaymentAmount: row.tenantDownpayment?.trim()
            ? row.tenantDownpayment.trim()
            : null,
          tenantDefaultNightlyRateAmount: row.nightlyRate?.trim() ? row.nightlyRate.trim() : null,
          tenantLeaseId: row.tenantLeaseId?.trim() ? row.tenantLeaseId.trim() : null,
        }));
      }
    } catch {
      // fall through to default generation
    }
  }
  return Array.from({ length: fallbackUnitCount }, (_, i) => ({
    id: undefined as string | undefined,
    label: `Unit ${startIndex + i + 1}`,
    sizeValue: null as string | null,
    sizeUnit: null as string | null,
    ownerRentAmount: null as string | null,
    ownerDownpaymentAmount: null as string | null,
    tenantDefaultRentAmount: null as string | null,
    tenantDefaultDownpaymentAmount: null as string | null,
    tenantDefaultNightlyRateAmount: null as string | null,
    tenantLeaseId: null as string | null,
  }));
}

export async function createProperty(formData: FormData) {
  const locale = await getLocale();

  const ownerMode = formData.get("ownerMode") as string;
  const existingOwnerId = str(formData, "ownerId");

  const name = str(formData, "name");
  const address = str(formData, "address");
  const type = str(formData, "type");
  const notes = str(formData, "notes");

  const unitTypeLabel = str(formData, "unitTypeLabel");
  const sizeValue = str(formData, "sizeValue");
  const sizeUnit = str(formData, "sizeUnit") ?? "sqft";
  const unitCount = Number(formData.get("unitCount"));
  const ownerRentAmount = str(formData, "ownerRentAmount");
  const ownerDownpaymentAmount = str(formData, "ownerDownpaymentAmount");
  const tenantDefaultRentAmount = str(formData, "tenantDefaultRentAmount");
  const tenantDefaultDownpaymentAmount = str(formData, "tenantDefaultDownpaymentAmount");
  const tenantDefaultNightlyRateAmount = str(formData, "tenantDefaultNightlyRateAmount");

  const rentMode = formData.get("rentMode") === "fixed" ? "fixed" : "perUnit";
  const fixedMonthlyRentAmount = str(formData, "fixedMonthlyRentAmount");
  // Downpayment/advance to the owner follows the SAME fixed-vs-per-unit mode
  // as the monthly rent — a lump sum for the whole property (agreement-level)
  // or broken down per unit type/unit, mirroring ownerRentAmount exactly.
  const downpaymentAmount = str(formData, "downpaymentAmount");
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
  const agreementNotes = str(formData, "agreementNotes");
  const documentUrl = str(formData, "documentUrl");
  const documentFileType = str(formData, "documentFileType");

  if (!name || !unitTypeLabel || !unitCount || unitCount < 1 || !startDate) {
    throw new Error("Missing required fields");
  }
  if (rentMode === "perUnit" && !ownerRentAmount) {
    throw new Error("Owner rent amount is required for per-unit rent mode");
  }
  if (rentMode === "fixed" && !fixedMonthlyRentAmount) {
    throw new Error("Fixed monthly rent amount is required for fixed rent mode");
  }
  if (rentMode === "fixed" && !downpaymentAmount) {
    throw new Error("Downpayment amount is required for fixed rent mode");
  }
  if (ownerMode === "new" && !str(formData, "newOwnerName")) {
    throw new Error("Owner name is required");
  }
  if (ownerMode === "existing" && !existingOwnerId) {
    throw new Error("Owner selection is required");
  }

  const property = await prisma.$transaction(async (tx) => {
    let ownerId = existingOwnerId;
    if (ownerMode === "new") {
      const owner = await tx.propertyOwner.create({
        data: {
          name: str(formData, "newOwnerName")!,
          contactInfo: str(formData, "newOwnerContact"),
          address: str(formData, "newOwnerAddress"),
        },
      });
      ownerId = owner.id;
    }
    if (!ownerId) throw new Error("Owner required");

    const created = await tx.property.create({
      data: { ownerId, name, address, type, notes },
    });

    const unitType = await tx.unitType.create({
      data: {
        propertyId: created.id,
        label: unitTypeLabel,
        sizeValue: sizeValue ?? undefined,
        sizeUnit,
        unitCount,
        ownerRentAmount: rentMode === "perUnit" ? ownerRentAmount : undefined,
        ownerDownpaymentAmount: rentMode === "perUnit" ? ownerDownpaymentAmount : undefined,
        tenantDefaultRentAmount: tenantDefaultRentAmount ?? undefined,
        tenantDefaultDownpaymentAmount: tenantDefaultDownpaymentAmount ?? undefined,
        tenantDefaultNightlyRateAmount: tenantDefaultNightlyRateAmount ?? undefined,
      },
    });

    const unitRows = parseUnitOverrides(formData, "unitOverridesJson", unitCount, 0);
    await tx.unit.createMany({
      data: unitRows.map((row) => ({
        unitTypeId: unitType.id,
        label: row.label,
        sizeValue: row.sizeValue ?? undefined,
        sizeUnit: row.sizeUnit ?? undefined,
        ownerRentAmount: row.ownerRentAmount ?? undefined,
        ownerDownpaymentAmount: row.ownerDownpaymentAmount ?? undefined,
        tenantDefaultRentAmount: row.tenantDefaultRentAmount ?? undefined,
        tenantDefaultDownpaymentAmount: row.tenantDefaultDownpaymentAmount ?? undefined,
        tenantDefaultNightlyRateAmount: row.tenantDefaultNightlyRateAmount ?? undefined,
      })),
    });

    const agreement = await tx.ownerLeaseAgreement.create({
      data: {
        propertyId: created.id,
        downpaymentAmount: rentMode === "fixed" ? downpaymentAmount : undefined,
        fixedMonthlyRentAmount: rentMode === "fixed" ? fixedMonthlyRentAmount : undefined,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        notes: agreementNotes,
      },
    });

    // Not an operating expense — this is a refundable security deposit held
    // by the owner (an asset for the company), same reasoning as why
    // DOWNPAYMENT_REFUND_TO_TENANT is excluded from the expense aggregate.
    // Recorded for ledger/history purposes only.
    if (rentMode === "fixed" && downpaymentAmount) {
      await tx.transaction.create({
        data: {
          propertyId: created.id,
          type: "DOWNPAYMENT_PAID_TO_OWNER",
          direction: "OUTGOING",
          amount: downpaymentAmount,
          method: downpaymentMethod,
          date: new Date(startDate),
        },
      });
    }

    if (documentUrl) {
      await tx.document.create({
        data: {
          ownerType: "OWNER_LEASE_AGREEMENT",
          ownerLeaseAgreementId: agreement.id,
          fileUrl: documentUrl,
          fileType: documentFileType,
        },
      });
    }

    return created;
  });

  revalidatePath("/properties");
  redirect({ href: `/properties/${property.id}`, locale });
}

export async function updateProperty(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  const ownerMode = formData.get("ownerMode") as string;
  const existingOwnerId = str(formData, "ownerId");
  const name = str(formData, "name");
  const address = str(formData, "address");
  const type = str(formData, "type");
  const notes = str(formData, "notes");
  const status = (formData.get("status") as string) === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const agreementId = str(formData, "agreementId");
  const rentMode = formData.get("rentMode") === "fixed" ? "fixed" : "perUnit";
  const fixedMonthlyRentAmount = str(formData, "fixedMonthlyRentAmount");
  const downpaymentAmount = str(formData, "downpaymentAmount");
  const startDate = str(formData, "startDate");
  const endDate = str(formData, "endDate");
  const agreementNotes = str(formData, "agreementNotes");
  const documentUrl = str(formData, "documentUrl");
  const documentFileType = str(formData, "documentFileType");

  if (!name) throw new Error("Name is required");

  await prisma.$transaction(async (tx) => {
    let ownerId = existingOwnerId;
    if (ownerMode === "new") {
      const ownerName = str(formData, "newOwnerName");
      if (!ownerName) throw new Error("Owner name is required");
      const owner = await tx.propertyOwner.create({
        data: {
          name: ownerName,
          contactInfo: str(formData, "newOwnerContact"),
          address: str(formData, "newOwnerAddress"),
        },
      });
      ownerId = owner.id;
    }
    if (!ownerId) throw new Error("Owner required");

    await tx.property.update({
      where: { id: propertyId },
      data: { ownerId, name, address, type, notes, status },
    });

    if (agreementId && startDate) {
      await tx.ownerLeaseAgreement.update({
        where: { id: agreementId },
        data: {
          // null out in per-unit mode — the total is derived from summing
          // each unit's ownerDownpaymentAmount instead of one lump figure.
          downpaymentAmount: rentMode === "fixed" ? downpaymentAmount : null,
          fixedMonthlyRentAmount: rentMode === "fixed" ? fixedMonthlyRentAmount : null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          notes: agreementNotes,
        },
      });

      if (documentUrl) {
        await tx.document.create({
          data: {
            ownerType: "OWNER_LEASE_AGREEMENT",
            ownerLeaseAgreementId: agreementId,
            fileUrl: documentUrl,
            fileType: documentFileType,
          },
        });
      }
    }
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}

export async function deleteProperty(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  await prisma.property.update({
    where: { id: propertyId },
    data: { status: "INACTIVE", deletedAt: new Date() },
  });

  revalidatePath("/properties");
  redirect({ href: "/properties", locale });
}

export async function addUnitType(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  if (!propertyId) throw new Error("Missing property id");

  const label = str(formData, "unitTypeLabel");
  const sizeValue = str(formData, "sizeValue");
  const sizeUnit = str(formData, "sizeUnit") ?? "sqft";
  const unitCount = Number(formData.get("unitCount"));
  const ownerRentAmount = str(formData, "ownerRentAmount");
  const ownerDownpaymentAmount = str(formData, "ownerDownpaymentAmount");
  const tenantDefaultRentAmount = str(formData, "tenantDefaultRentAmount");
  const tenantDefaultDownpaymentAmount = str(formData, "tenantDefaultDownpaymentAmount");
  const tenantDefaultNightlyRateAmount = str(formData, "tenantDefaultNightlyRateAmount");

  if (!label || !unitCount || unitCount < 1) {
    throw new Error("Missing required fields");
  }

  await prisma.$transaction(async (tx) => {
    const unitType = await tx.unitType.create({
      data: {
        propertyId,
        label,
        sizeValue: sizeValue ?? undefined,
        sizeUnit,
        unitCount,
        ownerRentAmount: ownerRentAmount ?? undefined,
        ownerDownpaymentAmount: ownerDownpaymentAmount ?? undefined,
        tenantDefaultRentAmount: tenantDefaultRentAmount ?? undefined,
        tenantDefaultDownpaymentAmount: tenantDefaultDownpaymentAmount ?? undefined,
        tenantDefaultNightlyRateAmount: tenantDefaultNightlyRateAmount ?? undefined,
      },
    });

    const existingUnitCount = await tx.unit.count({ where: { unitType: { propertyId } } });
    const unitRows = parseUnitOverrides(formData, "unitOverridesJson", unitCount, existingUnitCount);

    await tx.unit.createMany({
      data: unitRows.map((row) => ({
        unitTypeId: unitType.id,
        label: row.label,
        sizeValue: row.sizeValue ?? undefined,
        sizeUnit: row.sizeUnit ?? undefined,
        ownerRentAmount: row.ownerRentAmount ?? undefined,
        ownerDownpaymentAmount: row.ownerDownpaymentAmount ?? undefined,
        tenantDefaultRentAmount: row.tenantDefaultRentAmount ?? undefined,
        tenantDefaultDownpaymentAmount: row.tenantDefaultDownpaymentAmount ?? undefined,
        tenantDefaultNightlyRateAmount: row.tenantDefaultNightlyRateAmount ?? undefined,
      })),
    });
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}

// Edits an existing UnitType (label/size/defaults) and its Units' per-unit
// overrides. Rows carrying an `id` are already-persisted Units and only ever
// get updated; rows without one are brand-new units created in this same
// edit. Existing units are never deleted here — the row-level delete button
// is disabled client-side for them (UnitOverridesTable), since removing a
// Unit could orphan real TenantLease/UtilityBill/Transaction history; use the
// unit's own Active/Inactive toggle to retire it instead.
export async function updateUnitType(formData: FormData) {
  const locale = await getLocale();
  const propertyId = formData.get("propertyId") as string;
  const unitTypeId = formData.get("unitTypeId") as string;
  if (!propertyId || !unitTypeId) throw new Error("Missing property or unit type id");

  const label = str(formData, "unitTypeLabel");
  const sizeValue = str(formData, "sizeValue");
  const sizeUnit = str(formData, "sizeUnit") ?? "sqft";
  const ownerRentAmount = str(formData, "ownerRentAmount");
  const ownerDownpaymentAmount = str(formData, "ownerDownpaymentAmount");
  const tenantDefaultRentAmount = str(formData, "tenantDefaultRentAmount");
  const tenantDefaultDownpaymentAmount = str(formData, "tenantDefaultDownpaymentAmount");
  const tenantDefaultNightlyRateAmount = str(formData, "tenantDefaultNightlyRateAmount");
  if (!label) throw new Error("Missing required fields");

  const totalUnitCount = Number(formData.get("existingTotalUnitCount")) || 0;
  const unitRows = parseUnitOverrides(formData, "unitOverridesJson", 0, totalUnitCount);
  if (unitRows.length === 0) throw new Error("At least one unit is required");

  await prisma.$transaction(async (tx) => {
    await tx.unitType.update({
      where: { id: unitTypeId },
      data: {
        label,
        sizeValue: sizeValue ?? undefined,
        sizeUnit,
        unitCount: unitRows.length,
        ownerRentAmount: ownerRentAmount ?? undefined,
        ownerDownpaymentAmount: ownerDownpaymentAmount ?? undefined,
        tenantDefaultRentAmount: tenantDefaultRentAmount ?? undefined,
        tenantDefaultDownpaymentAmount: tenantDefaultDownpaymentAmount ?? undefined,
        tenantDefaultNightlyRateAmount: tenantDefaultNightlyRateAmount ?? undefined,
      },
    });

    for (const row of unitRows) {
      const data = {
        label: row.label,
        sizeValue: row.sizeValue ?? undefined,
        sizeUnit: row.sizeUnit ?? undefined,
        ownerRentAmount: row.ownerRentAmount ?? undefined,
        ownerDownpaymentAmount: row.ownerDownpaymentAmount ?? undefined,
        tenantDefaultRentAmount: row.tenantDefaultRentAmount ?? undefined,
        // A unit with a current tenant has this same input repurposed to edit
        // that tenant's live lease balance instead (below) — never write it
        // as the unit's future-tenant default in that case, or the two
        // concepts would get conflated on the next vacancy.
        tenantDefaultDownpaymentAmount: row.tenantLeaseId
          ? undefined
          : (row.tenantDefaultDownpaymentAmount ?? undefined),
        tenantDefaultNightlyRateAmount: row.tenantDefaultNightlyRateAmount ?? undefined,
      };
      if (row.id) {
        await tx.unit.update({ where: { id: row.id }, data });
      } else {
        await tx.unit.create({ data: { ...data, unitTypeId } });
      }

      if (row.tenantLeaseId && row.tenantDefaultDownpaymentAmount != null) {
        await tx.tenantLease.updateMany({
          where: { id: row.tenantLeaseId, status: "ACTIVE" },
          data: { currentDownpaymentBalance: row.tenantDefaultDownpaymentAmount },
        });
      }
    }
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect({ href: `/properties/${propertyId}`, locale });
}
