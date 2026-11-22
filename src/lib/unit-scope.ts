import type { Prisma } from "@/generated/prisma/client";

// Units that can be let: active units of properties that have not been deleted.
// The dashboard and the Vacant Units page both count vacancy from this one scope,
// so an inactive unit (or one in a deleted property) is neither "vacant" nor in the total.
export const lettableUnitWhere = {
  status: "ACTIVE",
  unitType: { property: { deletedAt: null } },
} satisfies Prisma.UnitWhereInput;

export const vacantUnitWhere = {
  ...lettableUnitWhere,
  tenantLeases: { none: { status: "ACTIVE" } },
} satisfies Prisma.UnitWhereInput;

export const occupiedUnitWhere = {
  ...lettableUnitWhere,
  tenantLeases: { some: { status: "ACTIVE" } },
} satisfies Prisma.UnitWhereInput;
