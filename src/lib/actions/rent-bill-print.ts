"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isDeepStrictEqual } from "node:util";
import { requireCurrentUser } from "@/lib/auth/session";
import { dhakaISO, dhakaTodayISO } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";
import { prisma } from "@/lib/prisma";
import { rentBillPrintRows, type RentBillPrintRowKey } from "@/lib/rent-bill-print";
import { formatRentBillNumber, legacyRentBillNumber } from "@/lib/rent-bill-number";
import { getTenantProfile } from "@/lib/tenants-data";

export async function confirmRentBillPrint(
  tenantLeaseId: string,
  month: string,
  previousRevision: number,
  selected: RentBillPrintRowKey[],
  preview: string,
  arrearsIds: string[] = [],
) {
  await requireCurrentUser();
  if (!isPaymentMonth(month) || month > dhakaTodayISO().slice(0, 7) ||
      !Number.isSafeInteger(previousRevision) || previousRevision < 0) return false;
  const tenant = await getTenantProfile(tenantLeaseId);
  if (!tenant || tenant.leaseStatus !== "ACTIVE") return false;
  if (!Array.isArray(arrearsIds) || arrearsIds.some((id) => typeof id !== "string")) return false;
  const rows = rentBillPrintRows(tenant, month, arrearsIds).filter(({ key }) => selected.includes(key));
  const revision = previousRevision + 1;
  try {
    const previewRows: unknown = JSON.parse(preview);
    if (!rows.length || !isDeepStrictEqual(rows, previewRows)) return false;
    await prisma.$transaction(async (tx) => {
      const latest = await tx.rentBillPrint.findFirst({
        where: { tenantLeaseId, month }, orderBy: { revision: "desc" },
      });
      if (latest?.revision === revision && isDeepStrictEqual(latest.rows, previewRows)) return;
      if ((latest?.revision ?? 0) !== previousRevision) throw new Error("Print revision changed");
      await tx.rentBillPrint.create({ data: { tenantLeaseId, month, revision, rows } });
    }, { isolationLevel: "Serializable" });
  } catch {
    return false;
  }
  const locale = await getLocale();
  revalidatePath(`/${locale}/rent`);
  revalidatePath(`/${locale}/rent/${tenantLeaseId}/invoice`);
  return true;
}

export async function reserveRentBillNumber(tenantLeaseId: string, month: string) {
  await requireCurrentUser();
  if (!isPaymentMonth(month) || month !== month.trim() || month > dhakaTodayISO().slice(0, 7)) return null;

  return prisma.$transaction(async (tx) => {
    const lease = await tx.tenantLease.findUnique({
      where: { id: tenantLeaseId },
      select: { status: true, startDate: true, unit: { select: { unitType: { select: { propertyId: true } } } } },
    });
    if (!lease) return null;
    const propertyId = lease.unit.unitType.propertyId;
    // All number assignments in this market share this lock. Read committed
    // lets a waiting transaction see the assignment made by the previous one.
    const [market] = await tx.$queryRaw<{ billMarketCode: number }[]>`
      SELECT "billMarketCode" FROM "Property" WHERE id = ${propertyId} AND "deletedAt" IS NULL FOR UPDATE
    `;
    if (!market) return null;
    const billKey = { tenantLeaseId, month };
    const assigned = await tx.rentBillNumber.findUnique({
      where: { tenantLeaseId_month: billKey },
      select: { serial: true, property: { select: { billMarketCode: true } } },
    });
    if (assigned) return formatRentBillNumber(assigned.property.billMarketCode, month, assigned.serial);

    const oldPrint = await tx.rentBillPrint.findFirst({ where: billKey, select: { revision: true } });
    if (oldPrint) return legacyRentBillNumber(tenantLeaseId, month);
    if (lease.status !== "ACTIVE" || month < dhakaISO(lease.startDate).slice(0, 7)) return null;

    const counter = await tx.rentBillCounter.upsert({
      where: { propertyId_month: { propertyId, month } },
      create: { propertyId, month, serial: 1 },
      update: { serial: { increment: 1 } },
      select: { serial: true },
    });
    await tx.rentBillNumber.create({ data: { ...billKey, propertyId, serial: counter.serial } });
    return formatRentBillNumber(market.billMarketCode, month, counter.serial);
  }, { isolationLevel: "ReadCommitted" });
}
