import type { Prisma } from "@/generated/prisma/client";
import { dhakaISO } from "@/lib/dhaka-time";

export function tenantUtilityArrearsWhere(
  lease: { id: string; unitId: string; startDate: Date; status: string; movedOutAt: Date | null; endDate: Date | null },
  cutoffMonth: string,
): Prisma.UtilityBillWhereInput {
  const leaseEnd = lease.status === "ACTIVE" ? null : lease.movedOutAt ?? lease.endDate;
  return {
    unitId: lease.unitId,
    month: { lt: cutoffMonth },
    type: { not: "WATER" },
    paidByCompany: false,
    status: { not: "PAID" },
    OR: [{ tenantLeaseId: lease.id }, { tenantLeaseId: null }],
    dueDate: {
      gte: new Date(dhakaISO(lease.startDate)),
      ...(leaseEnd ? { lte: new Date(dhakaISO(leaseEnd)) } : {}),
    },
  };
}
