"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isDeepStrictEqual } from "node:util";
import { requireCurrentUser } from "@/lib/auth/session";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { isPaymentMonth } from "@/lib/payment-month";
import { prisma } from "@/lib/prisma";
import { rentBillPrintRows, type RentBillPrintKey } from "@/lib/rent-bill-print";
import { getTenantProfile } from "@/lib/tenants-data";

export async function confirmRentBillPrint(
  tenantLeaseId: string,
  month: string,
  previousRevision: number,
  selected: RentBillPrintKey[],
  preview: string,
) {
  await requireCurrentUser();
  if (!isPaymentMonth(month) || month > dhakaTodayISO().slice(0, 7) ||
      !Number.isSafeInteger(previousRevision) || previousRevision < 0) return false;
  const tenant = await getTenantProfile(tenantLeaseId);
  if (!tenant || tenant.leaseStatus !== "ACTIVE") return false;
  const rows = rentBillPrintRows(tenant, month).filter(({ key }) => selected.includes(key));
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
