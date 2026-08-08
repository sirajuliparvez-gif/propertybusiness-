import { prisma } from "@/lib/prisma";

// Per-property vacancy summary (cards grouped by property) plus the flat
// per-unit list each card's numbers are built from — a unit counts as vacant
// when it's ACTIVE (available to lease at all) and has no currently-active
// tenant lease, same rule getPropertyDetail() already uses per-property.
export async function getAllVacantUnitsData() {
  const [properties, idOrder] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        type: true,
        unitTypes: {
          select: {
            label: true,
            sizeValue: true,
            sizeUnit: true,
            tenantDefaultRentAmount: true,
            tenantDefaultDownpaymentAmount: true,
            units: {
              where: { status: "ACTIVE" },
              orderBy: { label: "asc" },
              select: {
                id: true,
                label: true,
                createdAt: true,
                sizeValue: true,
                sizeUnit: true,
                tenantDefaultRentAmount: true,
                tenantDefaultDownpaymentAmount: true,
                // All leases (not just active) — the most recent ended one
                // supplies "last tenant" / "vacant since" info for a vacant
                // unit, same pattern getPropertyDetail() already uses.
                tenantLeases: {
                  orderBy: { startDate: "desc" },
                  select: {
                    status: true,
                    movedOutAt: true,
                    endDate: true,
                    monthlyRentAmount: true,
                    tenant: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Stable "P-001"-style display id, ordered by creation — same convention
    // as getPropertiesList().
    prisma.property.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);

  const displayIdByPropertyId = new Map(idOrder.map((p, i) => [p.id, `P-${String(i + 1).padStart(3, "0")}`]));

  const cards = properties.map((p) => {
    const allUnits = p.unitTypes.flatMap((ut) =>
      ut.units.map((u) => ({ u, ut }))
    );
    const totalUnits = allUnits.length;
    const occupiedUnits = allUnits.filter(({ u }) => u.tenantLeases.some((tl) => tl.status === "ACTIVE")).length;

    const vacantUnits = allUnits
      .filter(({ u }) => !u.tenantLeases.some((tl) => tl.status === "ACTIVE"))
      .map(({ u, ut }) => {
        const lastLease = u.tenantLeases.find((tl) => tl.status !== "ACTIVE");
        const lastTenant = lastLease
          ? {
              name: lastLease.tenant.name,
              monthlyRentAmount: Number(lastLease.monthlyRentAmount),
              leftOn: lastLease.movedOutAt ?? lastLease.endDate,
            }
          : null;
        const vacantSince = lastTenant?.leftOn ?? u.createdAt;
        const expectedRent =
          u.tenantDefaultRentAmount != null
            ? Number(u.tenantDefaultRentAmount)
            : ut.tenantDefaultRentAmount != null
              ? Number(ut.tenantDefaultRentAmount)
              : null;
        const expectedDownpayment =
          u.tenantDefaultDownpaymentAmount != null
            ? Number(u.tenantDefaultDownpaymentAmount)
            : ut.tenantDefaultDownpaymentAmount != null
              ? Number(ut.tenantDefaultDownpaymentAmount)
              : null;
        return {
          id: u.id,
          unitLabel: u.label,
          unitTypeLabel: ut.label,
          propertyId: p.id,
          propertyName: p.name,
          sizeValue: u.sizeValue != null ? Number(u.sizeValue) : ut.sizeValue != null ? Number(ut.sizeValue) : null,
          sizeUnit: u.sizeUnit ?? ut.sizeUnit,
          expectedRent,
          expectedDownpayment,
          lastTenant,
          vacantSince,
        };
      })
      .sort((a, b) => a.vacantSince.getTime() - b.vacantSince.getTime());

    const potentialMonthlyLoss = vacantUnits.reduce((sum, u) => sum + (u.expectedRent ?? 0), 0);

    return {
      id: p.id,
      displayId: displayIdByPropertyId.get(p.id) ?? "P-000",
      name: p.name,
      address: p.address,
      type: p.type,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      potentialMonthlyLoss,
    };
  });

  const propertiesWithVacancy = cards.filter((c) => c.vacantUnits.length > 0);

  const allVacantUnits = propertiesWithVacancy.flatMap((c) => c.vacantUnits);
  const totalVacant = allVacantUnits.length;
  const potentialMonthlyLoss = propertiesWithVacancy.reduce((sum, c) => sum + c.potentialMonthlyLoss, 0);
  const oldestVacancy = allVacantUnits.reduce<Date | null>((oldest, u) => {
    if (!oldest || u.vacantSince < oldest) return u.vacantSince;
    return oldest;
  }, null);
  const totalActiveUnits = cards.reduce((sum, c) => sum + c.totalUnits, 0);
  const occupancyRate =
    totalActiveUnits > 0 ? Math.round(((totalActiveUnits - totalVacant) / totalActiveUnits) * 100) : 0;

  return {
    properties: propertiesWithVacancy,
    totalVacant,
    potentialMonthlyLoss,
    oldestVacancy,
    occupancyRate,
  };
}

export type AllVacantUnitsData = Awaited<ReturnType<typeof getAllVacantUnitsData>>;
