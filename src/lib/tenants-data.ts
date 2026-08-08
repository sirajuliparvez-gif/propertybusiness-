import { prisma } from "@/lib/prisma";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { attachElectricityConsumption, latestElectricityReadingByUnit } from "@/lib/electricity-consumption";

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export async function getAllTenantsData() {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  const [properties, collected] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        utilityBills: {
          orderBy: { dueDate: "desc" },
          select: { unitId: true, status: true },
        },
        unitTypes: {
          select: {
            label: true,
            tenantDefaultRentAmount: true,
            tenantDefaultDownpaymentAmount: true,
            units: {
              orderBy: { label: "asc" },
              select: {
                id: true,
                label: true,
                status: true,
                tenantDefaultRentAmount: true,
                tenantDefaultDownpaymentAmount: true,
                tenantLeases: {
                  orderBy: { startDate: "desc" },
                  select: {
                    id: true,
                    status: true,
                    monthlyRentAmount: true,
                    currentDownpaymentBalance: true,
                    serviceChargeType: true,
                    serviceChargeValue: true,
                    startDate: true,
                    movedOutAt: true,
                    endDate: true,
                    tenant: { select: { name: true, contactInfo: true } },
                    rentPayments: {
                      orderBy: { dueDate: "desc" },
                      take: 1,
                      select: {
                        status: true,
                        dueAmount: true,
                        paidAmount: true,
                        dueDate: true,
                        paidAt: true,
                        transactions: {
                          orderBy: { date: "desc" },
                          take: 1,
                          select: { method: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    // "Collected this month" is real cash movement only — mirrors the
    // per-property page's collectedIncome, which also excludes downpayment
    // adjustments (no Transaction is ever created for those, by design).
    prisma.transaction.aggregate({
      where: {
        type: "RENT_RECEIVED_FROM_TENANT",
        direction: "INCOMING",
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const tenants = properties.flatMap((p) => {
    // Same "first hit per unitId wins" logic as properties-data.ts's
    // per-property version — utilityBills is already ordered dueDate desc.
    const latestUtilityBillStatusByUnitId = new Map<string, "PAID" | "UNPAID">();
    for (const b of p.utilityBills) {
      if (b.unitId && !latestUtilityBillStatusByUnitId.has(b.unitId)) {
        latestUtilityBillStatusByUnitId.set(b.unitId, b.status);
      }
    }

    return p.unitTypes.flatMap((ut) =>
      ut.units.flatMap((u) =>
        u.tenantLeases.map((tl) => {
          const latestPayment = tl.rentPayments[0];
          const isOverdue = latestPayment?.status === "UNPAID" || latestPayment?.status === "PARTIAL";
          const overdueAmount =
            tl.status === "ACTIVE" && isOverdue
              ? Number(latestPayment.dueAmount) - Number(latestPayment.paidAmount)
              : 0;
          const serviceChargeAmount = computeServiceChargeAmount(
            Number(tl.monthlyRentAmount),
            tl.serviceChargeType,
            tl.serviceChargeValue != null ? Number(tl.serviceChargeValue) : null
          );
          return {
            id: tl.id,
            tenantName: tl.tenant.name,
            contactInfo: tl.tenant.contactInfo,
            propertyId: p.id,
            propertyName: p.name,
            unitLabel: u.label,
            monthlyRentAmount: Number(tl.monthlyRentAmount),
            currentDownpaymentBalance: Number(tl.currentDownpaymentBalance),
            serviceChargeType: tl.serviceChargeType,
            serviceChargeValue: tl.serviceChargeValue != null ? Number(tl.serviceChargeValue) : null,
            serviceChargeAmount,
            leaseStatus: tl.status,
            rentStatus: tl.status === "ACTIVE" ? (latestPayment?.status ?? null) : null,
            overdueAmount,
            utilityBillStatus: latestUtilityBillStatusByUnitId.get(u.id) ?? null,
            paymentMethod: latestPayment?.transactions[0]?.method ?? null,
            currentDueDate: latestPayment?.dueDate ?? null,
            currentPaidAt: latestPayment?.paidAt ?? null,
            startDate: tl.startDate,
            leftOn: tl.status !== "ACTIVE" ? (tl.movedOutAt ?? tl.endDate) : null,
          };
        })
      )
    );
  });

  // Vacant units grouped by property, for the global Add Tenant dialog's
  // cascading Property → Unit picker — a unit counts as vacant when it's
  // ACTIVE and has no currently-active lease.
  const propertiesWithVacantUnits = properties
    .map((p) => ({
      id: p.id,
      name: p.name,
      units: p.unitTypes.flatMap((ut) =>
        ut.units
          .filter((u) => u.status === "ACTIVE" && !u.tenantLeases.some((tl) => tl.status === "ACTIVE"))
          .map((u) => ({
            id: u.id,
            label: u.label,
            unitTypeLabel: ut.label,
            tenantDefaultRentAmount:
              u.tenantDefaultRentAmount != null
                ? Number(u.tenantDefaultRentAmount)
                : ut.tenantDefaultRentAmount != null
                  ? Number(ut.tenantDefaultRentAmount)
                  : null,
            tenantDefaultDownpaymentAmount:
              u.tenantDefaultDownpaymentAmount != null
                ? Number(u.tenantDefaultDownpaymentAmount)
                : ut.tenantDefaultDownpaymentAmount != null
                  ? Number(ut.tenantDefaultDownpaymentAmount)
                  : null,
          }))
      ),
    }))
    .filter((p) => p.units.length > 0);

  const activeTenants = tenants.filter((t) => t.leaseStatus === "ACTIVE");
  const expectedIncome = activeTenants.reduce(
    (sum, t) => sum + t.monthlyRentAmount + t.serviceChargeAmount,
    0
  );
  const totalOverdueRent = activeTenants.reduce((sum, t) => sum + t.overdueAmount, 0);
  const collectedThisMonth = Number(collected._sum.amount ?? 0);
  const settledThisMonthCount = activeTenants.filter(
    (t) => t.rentStatus === "PAID" || t.rentStatus === "ADJUSTED_FROM_DOWNPAYMENT"
  ).length;
  const collectionRate =
    activeTenants.length > 0 ? Math.round((settledThisMonthCount / activeTenants.length) * 100) : 0;

  return {
    tenants,
    totalActiveTenants: activeTenants.length,
    expectedIncome,
    collectedThisMonth,
    totalOverdueRent,
    collectionRate,
    propertiesWithVacantUnits,
  };
}

export type AllTenantsData = Awaited<ReturnType<typeof getAllTenantsData>>;

// The "ভাড়া আদায়" (Rent Collection) page's own view of the exact same
// underlying data getAllTenantsData() already computes — a focused worklist
// of this month's rent status per active lease, rather than the Tenants
// page's full directory. Former/vacated leases don't owe current rent, so
// they're excluded here (they still appear on the Tenants page).
export async function getRentCollectionData() {
  const data = await getAllTenantsData();
  const payments = data.tenants.filter((t) => t.leaseStatus === "ACTIVE");
  return {
    payments,
    totalDue: data.expectedIncome,
    totalCollected: data.collectedThisMonth,
    totalRemaining: data.totalOverdueRent,
    collectionRate: data.collectionRate,
  };
}

export type RentCollectionData = Awaited<ReturnType<typeof getRentCollectionData>>;

// Full profile for a single tenancy (one TenantLease, not "this person across
// every property they've ever rented" — a tenant who moves to a different
// unit later gets a fresh profile page for that new lease, same as how a
// vacated lease's page stays a frozen historical record).
export async function getTenantProfile(leaseId: string) {
  const [lease, tenantIdOrder] = await Promise.all([
    prisma.tenantLease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: {
          include: { documents: { orderBy: { uploadedAt: "desc" } } },
        },
        unit: {
          select: {
            label: true,
            unitType: {
              select: {
                label: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
        rentPayments: {
          orderBy: { dueDate: "desc" },
          include: {
            transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true } },
          },
        },
        documents: { orderBy: { uploadedAt: "desc" } },
        downpaymentAdjustments: {
          orderBy: { createdAt: "desc" },
          include: { rentPayment: { select: { month: true } } },
        },
      },
    }),
    // Stable "T-1001"-style display id, ordered by Tenant.createdAt — same
    // convention as Property's "P-001" ids in properties-data.ts.
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  if (!lease) return null;

  const displayId = `T-${1000 + tenantIdOrder.findIndex((t) => t.id === lease.tenantId) + 1}`;

  // Utility bills scoped to this tenant's own unit only — a property-wide
  // bill (unitId null) isn't this tenant's individually, so it's excluded
  // here even though it'd show on the property's own utility bills section.
  const unitUtilityBills = await prisma.utilityBill.findMany({
    where: { unitId: lease.unitId },
    orderBy: { dueDate: "desc" },
    select: {
      id: true,
      type: true,
      month: true,
      dueDate: true,
      amount: true,
      status: true,
      paidByCompany: true,
      meterReading: true,
      transactions: { orderBy: { date: "desc" }, take: 1, select: { method: true } },
    },
  });
  const unitConsumptionByBillId = attachElectricityConsumption(
    unitUtilityBills.map((b) => ({
      id: b.id,
      type: b.type,
      unitId: lease.unitId,
      dueDate: b.dueDate,
      meterReading: b.meterReading != null ? Number(b.meterReading) : null,
    }))
  );
  const previousElectricityReadingByUnit = Object.fromEntries(
    latestElectricityReadingByUnit(
      unitUtilityBills.map((b) => ({
        id: b.id,
        type: b.type,
        unitId: lease.unitId,
        month: b.month,
        dueDate: b.dueDate,
        meterReading: b.meterReading != null ? Number(b.meterReading) : null,
      }))
    )
  );

  const payments = lease.rentPayments.map((rp) => ({
    id: rp.id,
    month: rp.month,
    dueDate: rp.dueDate,
    dueAmount: Number(rp.dueAmount),
    paidAmount: Number(rp.paidAmount),
    status: rp.status,
    paidAt: rp.paidAt,
    method: rp.transactions[0]?.method ?? null,
  }));

  const totalDue = payments.reduce((sum, p) => sum + p.dueAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const remaining = Math.max(0, totalDue - totalPaid);

  // "Tracked" stats (on-time rate, average payment day, preferred method)
  // are scoped to the most recent 6 months only — a tenant's payment habits
  // years ago matter less than their recent pattern, and this also mirrors
  // the payment-history table's own display window.
  const tracked = payments.slice(0, 6);
  const settled = tracked.filter((p) => p.paidAt != null);
  const onTimeCount = settled.filter((p) => p.paidAt! <= p.dueDate).length;
  const onTimeRate = settled.length > 0 ? Math.round((onTimeCount / settled.length) * 100) : null;
  const avgPaymentDay =
    settled.length > 0
      ? Math.round(settled.reduce((sum, p) => sum + p.paidAt!.getDate(), 0) / settled.length)
      : null;

  const methodCounts = new Map<string, number>();
  settled.forEach((p) => {
    if (p.method) methodCounts.set(p.method, (methodCounts.get(p.method) ?? 0) + 1);
  });
  let preferredMethod: string | null = null;
  let preferredMethodCount = 0;
  methodCounts.forEach((count, method) => {
    if (count > preferredMethodCount) {
      preferredMethodCount = count;
      preferredMethod = method;
    }
  });

  const now = new Date();
  const durationMonths = Math.max(
    0,
    (now.getFullYear() - lease.startDate.getFullYear()) * 12 + (now.getMonth() - lease.startDate.getMonth())
  );

  return {
    id: lease.id,
    tenantId: lease.tenantId,
    displayId,
    tenantName: lease.tenant.name,
    occupation: lease.tenant.occupation,
    contactInfo: lease.tenant.contactInfo,
    tenantType: lease.tenant.type,
    nidNumber: lease.tenant.nidNumber,
    businessRegistrationNumber: lease.tenant.businessRegistrationNumber,
    leaseStatus: lease.status,
    propertyId: lease.unit.unitType.property.id,
    propertyName: lease.unit.unitType.property.name,
    unitId: lease.unitId,
    unitTypeLabel: lease.unit.unitType.label,
    unitLabel: lease.unit.label,
    startDate: lease.startDate,
    endDate: lease.endDate,
    movedOutAt: lease.movedOutAt,
    durationMonths,
    monthlyRentAmount: Number(lease.monthlyRentAmount),
    initialDownpaymentAmount: Number(lease.initialDownpaymentAmount),
    currentDownpaymentBalance: Number(lease.currentDownpaymentBalance),
    serviceChargeType: lease.serviceChargeType,
    serviceChargeValue: lease.serviceChargeValue != null ? Number(lease.serviceChargeValue) : null,
    notes: lease.notes,
    payments,
    trackedMonths: tracked.length,
    totalDue,
    totalPaid,
    remaining,
    onTimeRate,
    avgPaymentDay,
    preferredMethod,
    rentStatus: lease.status === "ACTIVE" ? (payments[0]?.status ?? null) : null,
    // Tenant-level docs (NID/photo) and lease-level docs (agreement copy)
    // kept as separate arrays so the profile page can label them distinctly.
    tenantDocuments: lease.tenant.documents.map((d) => ({
      id: d.id,
      fileUrl: d.fileUrl,
      fileType: d.fileType,
      label: d.label,
      uploadedAt: d.uploadedAt,
    })),
    leaseDocuments: lease.documents.map((d) => ({
      id: d.id,
      fileUrl: d.fileUrl,
      fileType: d.fileType,
      label: d.label,
      uploadedAt: d.uploadedAt,
    })),
    utilityBills: unitUtilityBills.map((b) => ({
      id: b.id,
      type: b.type,
      dueDate: b.dueDate,
      amount: Number(b.amount),
      status: b.status,
      paidByCompany: b.paidByCompany,
      paymentMethod: b.transactions[0]?.method ?? null,
      unitLabel: lease.unit.label,
      propertyId: lease.unit.unitType.property.id,
      meterReading: b.meterReading != null ? Number(b.meterReading) : null,
      previousMeterReading: unitConsumptionByBillId.get(b.id)?.previousReading ?? null,
      consumptionUnits: unitConsumptionByBillId.get(b.id)?.consumption ?? null,
    })),
    previousElectricityReadingByUnit,
    // Every time rent was settled by drawing down the deposit instead of a
    // real cash payment (round 16's "adjust from downpayment" mode) — this
    // is the ledger that explains initialDownpaymentAmount → currentDownpaymentBalance.
    downpaymentAdjustments: lease.downpaymentAdjustments.map((a) => ({
      id: a.id,
      amountAdjusted: Number(a.amountAdjusted),
      reason: a.reason,
      createdAt: a.createdAt,
      month: a.rentPayment.month,
    })),
    totalAdjustedFromDownpayment: lease.downpaymentAdjustments.reduce(
      (sum, a) => sum + Number(a.amountAdjusted),
      0
    ),
  };
}

export type TenantProfile = NonNullable<Awaited<ReturnType<typeof getTenantProfile>>>;
