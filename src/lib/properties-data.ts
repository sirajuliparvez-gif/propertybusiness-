import { prisma } from "@/lib/prisma";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { attachElectricityConsumption, latestElectricityReadingByUnit } from "@/lib/electricity-consumption";
import { buildRentLedger, overdueEntries, totalOverdue } from "@/lib/rent-ledger";
import { splitUtilityBillTransactions } from "@/lib/utility-bill-split";
import { fromLedgerStatus } from "@/lib/employees-data";

// Utility bills get their own dedicated feature/flow (see the "ইউটিলিটি বিল"
// nav item) rather than living in this generic property-level expense list —
// this section is scoped to ad-hoc maintenance/other costs only. UTILITY_EXPENSE
// is here too now — only ever created for a bill the company pays itself
// (see payUtilityBill's paidByCompany branch), so it's a real cost like the
// other two, not the tenant-reimbursement pass-through UTILITY_REIMBURSEMENT_
// FROM_TENANT is.
const NON_CORE_EXPENSE_TYPES = ["UTILITY_EXPENSE", "MAINTENANCE_EXPENSE", "OTHER"] as const;

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export async function getPropertiesList() {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  // Ordered ascending once to assign stable "P-001"-style display IDs by
  // creation order, independent of whatever sort the UI displays them in —
  // independent of the main `properties` query below, so run both together
  // instead of paying two round trips back-to-back.
  const [idOrder, properties] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
      owner: { select: { name: true } },
      unitTypes: {
        select: {
          unitCount: true,
          ownerRentAmount: true,
          units: {
            select: {
              ownerRentAmount: true,
              tenantLeases: {
                where: { status: "ACTIVE" },
                select: { monthlyRentAmount: true, serviceChargeType: true, serviceChargeValue: true },
              },
              // All bookings (not status-filtered) — derived in JS below into
              // both "currently occupied" (CHECKED_IN) and "this month's
              // guest revenue" (checkInDate falls in the current month),
              // since Prisma can't select the same relation twice with
              // different filters in one query.
              guestStays: {
                select: { status: true, checkInDate: true, totalAmount: true },
              },
            },
          },
        },
      },
      ownerLeaseAgreements: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { downpaymentAmount: true, fixedMonthlyRentAmount: true },
      },
      employees: {
        where: { status: "ACTIVE" },
        select: { salaryAmount: true },
      },
      transactions: {
        where: { date: { gte: monthStart, lt: monthEnd } },
        select: { amount: true, direction: true, type: true },
      },
    },
    }),
  ]);
  const displayIdByPropertyId = new Map(idOrder.map((p, i) => [p.id, `P-${String(i + 1).padStart(3, "0")}`]));

  return properties.map((p) => {
    const totalUnits = p.unitTypes.reduce((sum, ut) => sum + ut.unitCount, 0);
    const allUnits = p.unitTypes.flatMap((ut) => ut.units);
    const occupiedUnits = allUnits.filter(
      (u) => u.tenantLeases.length > 0 || u.guestStays.some((g) => g.status === "CHECKED_IN")
    ).length;

    const fixedRent = p.ownerLeaseAgreements[0]?.fixedMonthlyRentAmount;
    const monthlyOwnerRent =
      fixedRent != null
        ? Number(fixedRent)
        : p.unitTypes.reduce(
            (sum, ut) =>
              sum +
              ut.units.reduce(
                (unitSum, u) => unitSum + Number(u.ownerRentAmount ?? ut.ownerRentAmount ?? 0),
                0
              ),
            0
          );

    const tenantIncome = allUnits.reduce(
      (sum, u) =>
        sum +
        u.tenantLeases.reduce((s, tl) => {
          const rent = Number(tl.monthlyRentAmount);
          const serviceCharge = computeServiceChargeAmount(
            rent,
            tl.serviceChargeType,
            tl.serviceChargeValue != null ? Number(tl.serviceChargeValue) : null
          );
          return s + rent + serviceCharge;
        }, 0),
      0
    );
    // Hotel revenue "expected this month" = bookings that start this month
    // and actually happened (excludes cancelled/no-show) — the closest
    // analogue to a tenant's recurring monthlyRentAmount, since a booking
    // has no fixed recurring rate to project forward instead.
    const guestStayIncome = allUnits.reduce(
      (sum, u) =>
        sum +
        u.guestStays
          .filter(
            (g) =>
              g.status !== "CANCELLED" &&
              g.status !== "NO_SHOW" &&
              g.checkInDate >= monthStart &&
              g.checkInDate < monthEnd
          )
          .reduce((s, g) => s + Number(g.totalAmount), 0),
      0
    );
    const expectedIncome = tenantIncome + guestStayIncome;
    const collectedIncome = p.transactions
      .filter((t) => t.direction === "INCOMING")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const payrollCost = p.employees.reduce((sum, e) => sum + Number(e.salaryAmount), 0);
    const otherExpense = p.transactions
      .filter((t) => t.direction === "OUTGOING" && (NON_CORE_EXPENSE_TYPES as readonly string[]).includes(t.type))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    // Real, unscheduled income — a tenant paid more than the actual utility
    // bill (see payUtilityBill) — added on top of the rent-schedule-based
    // expectedIncome the same way guestStayIncome already is.
    const utilityProfit = p.transactions
      .filter((t) => t.type === "UTILITY_PROFIT_FROM_TENANT")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = expectedIncome + utilityProfit - monthlyOwnerRent - payrollCost - otherExpense;

    return {
      id: p.id,
      displayId: displayIdByPropertyId.get(p.id) ?? "P-000",
      name: p.name,
      address: p.address,
      type: p.type,
      status: p.status,
      ownerName: p.owner.name,
      totalUnits,
      occupiedUnits,
      monthlyOwnerRent,
      expectedIncome,
      collectedIncome,
      netProfit,
      hasActiveAgreement: p.ownerLeaseAgreements.length > 0,
    };
  });
}

export async function getPropertyOwners() {
  return prisma.propertyOwner.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getAllTenants() {
  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactInfo: true },
  });
}

export async function getPropertyDetail(id: string) {
  const now = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  const [property, idOrder, monthTransactions] = await Promise.all([
    prisma.property.findUnique({
    where: { id, deletedAt: null },
    include: {
      owner: true,
      ownerLeaseAgreements: {
        orderBy: { startDate: "desc" },
        include: {
          documents: { orderBy: { uploadedAt: "desc" } },
          ownerRentPayments: {
            orderBy: { dueDate: "desc" },
            select: {
              id: true,
              unitId: true,
              month: true,
              dueDate: true,
              dueAmount: true,
              paidAmount: true,
              status: true,
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
      unitTypes: {
        orderBy: { createdAt: "asc" },
        include: {
          units: {
            orderBy: { label: "asc" },
            include: {
              // All leases (not just active) — the most recent ended one
              // supplies "last tenant" / "vacant since" info for a vacant unit.
              tenantLeases: {
                orderBy: { startDate: "desc" },
                select: {
                  id: true,
                  status: true,
                  monthlyRentAmount: true,
                  initialDownpaymentAmount: true,
                  currentDownpaymentBalance: true,
                  serviceChargeType: true,
                  serviceChargeValue: true,
                  startDate: true,
                  endDate: true,
                  movedOutAt: true,
                  tenant: { select: { name: true, contactInfo: true } },
                  // Full history, not just the latest month — the active
                  // lease's overdueAmount below needs every row to sum
                  // multi-month arrears correctly (see rent-ledger.ts).
                  rentPayments: {
                    orderBy: { dueDate: "desc" },
                    select: {
                      id: true,
                      month: true,
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
              // All bookings (not just active) — same "full history" shape
              // as tenantLeases above, for the property's own guest-stays section.
              guestStays: {
                orderBy: { checkInDate: "desc" },
                select: {
                  id: true,
                  guestName: true,
                  guestPhone: true,
                  numberOfGuests: true,
                  checkInDate: true,
                  checkOutDate: true,
                  ratePerNight: true,
                  totalAmount: true,
                  depositAmount: true,
                  status: true,
                  transactions: {
                    where: { type: { in: ["GUEST_STAY_PAYMENT_RECEIVED", "GUEST_DEPOSIT_REFUND"] } },
                    orderBy: { date: "desc" },
                    select: { type: true, amount: true, method: true },
                  },
                },
              },
            },
          },
        },
      },
      employees: {
        // All statuses (not just active) — the staff table shows a "former
        // employee" history view, mirroring the tenant vacate-history pattern.
        orderBy: { joinedAt: "asc" },
        include: {
          // Full history, not just the latest month — overdueAmount below
          // needs every row to sum multi-month arrears correctly.
          payrollRecords: {
            orderBy: { dueDate: "desc" },
            select: {
              id: true,
              month: true,
              dueDate: true,
              dueAmount: true,
              status: true,
              amountPaid: true,
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
      utilityBills: {
        orderBy: { dueDate: "desc" },
        select: {
          id: true,
          unitId: true,
          type: true,
          month: true,
          dueDate: true,
          createdAt: true,
          amount: true,
          paidAmount: true,
          status: true,
          paidByCompany: true,
          meterReading: true,
          transactions: {
            orderBy: { date: "desc" },
            select: { type: true, amount: true, method: true },
          },
        },
      },
    },
    }),
    // Independent of the property fetch above (only needs `id`/nothing at
    // all) — run alongside it instead of waiting for that much larger query
    // to finish first.
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.transaction.findMany({
      where: { propertyId: id, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        type: true,
        direction: true,
        amount: true,
        method: true,
        date: true,
        notes: true,
        unitId: true,
      },
    }),
  ]);

  if (!property) return null;

  const displayId = `P-${String(idOrder.findIndex((p) => p.id === id) + 1).padStart(3, "0")}`;

  const activeAgreement = property.ownerLeaseAgreements.find((a) => a.status === "ACTIVE") ?? null;
  const pastAgreements = property.ownerLeaseAgreements.filter((a) => a.status !== "ACTIVE");

  const unitTypes = property.unitTypes.map((ut) => {
    const utSizeValue = ut.sizeValue != null ? Number(ut.sizeValue) : null;
    const utOwnerRentAmount = ut.ownerRentAmount != null ? Number(ut.ownerRentAmount) : null;
    const utOwnerDownpaymentAmount =
      ut.ownerDownpaymentAmount != null ? Number(ut.ownerDownpaymentAmount) : null;
    const utTenantDefaultRentAmount =
      ut.tenantDefaultRentAmount != null ? Number(ut.tenantDefaultRentAmount) : null;
    const utTenantDefaultDownpaymentAmount =
      ut.tenantDefaultDownpaymentAmount != null ? Number(ut.tenantDefaultDownpaymentAmount) : null;
    const utTenantDefaultNightlyRateAmount =
      ut.tenantDefaultNightlyRateAmount != null ? Number(ut.tenantDefaultNightlyRateAmount) : null;

    return {
      id: ut.id,
      label: ut.label,
      sizeValue: utSizeValue,
      sizeUnit: ut.sizeUnit,
      unitCount: ut.unitCount,
      ownerRentAmount: utOwnerRentAmount,
      ownerDownpaymentAmount: utOwnerDownpaymentAmount,
      tenantDefaultRentAmount: utTenantDefaultRentAmount,
      tenantDefaultDownpaymentAmount: utTenantDefaultDownpaymentAmount,
      tenantDefaultNightlyRateAmount: utTenantDefaultNightlyRateAmount,
      units: ut.units.map((u) => {
        const activeLease = u.tenantLeases.find((tl) => tl.status === "ACTIVE") ?? null;
        const mostRecentEndedLease =
          u.tenantLeases.find((tl) => tl.status !== "ACTIVE") ?? null;
        const activeGuestStay = u.guestStays.find((g) => g.status === "CHECKED_IN") ?? null;

        const activeLeaseLedger = activeLease
          ? buildRentLedger(
              activeLease.startDate,
              Number(activeLease.monthlyRentAmount),
              activeLease.rentPayments.map((rp) => ({
                id: rp.id,
                month: rp.month,
                dueDate: rp.dueDate,
                dueAmount: Number(rp.dueAmount),
                paidAmount: Number(rp.paidAmount),
                status: rp.status,
                paidAt: rp.paidAt,
                method: rp.transactions[0]?.method ?? null,
              }))
            )
          : null;

        const currentTenant = activeLease
          ? {
              leaseId: activeLease.id,
              name: activeLease.tenant.name,
              monthlyRentAmount: Number(activeLease.monthlyRentAmount),
              downpaymentAmount: Number(activeLease.initialDownpaymentAmount),
              currentDownpaymentBalance: Number(activeLease.currentDownpaymentBalance),
              startDate: activeLease.startDate,
              endDate: activeLease.endDate,
              // Sum of every month still owing something (real rows AND
              // months nobody ever recorded) — not just the latest month.
              overdueAmount: totalOverdue(activeLeaseLedger!),
              overdueMonthsCount: overdueEntries(activeLeaseLedger!).length,
            }
          : null;

        const lastTenant =
          !activeLease && mostRecentEndedLease
            ? {
                name: mostRecentEndedLease.tenant.name,
                monthlyRentAmount: Number(mostRecentEndedLease.monthlyRentAmount),
                leftOn: mostRecentEndedLease.movedOutAt ?? mostRecentEndedLease.endDate,
              }
            : null;

        const vacantSince = !activeLease ? (lastTenant?.leftOn ?? u.createdAt) : null;

        return {
          id: u.id,
          label: u.label,
          status: u.status,
          occupied: activeLease !== null || activeGuestStay !== null,
          tenantName: activeLease?.tenant.name ?? null,
          currentTenant,
          lastTenant,
          vacantSince,
          sizeValue: u.sizeValue != null ? Number(u.sizeValue) : utSizeValue,
          sizeUnit: u.sizeUnit ?? ut.sizeUnit,
          ownerRentAmount: u.ownerRentAmount != null ? Number(u.ownerRentAmount) : utOwnerRentAmount,
          ownerDownpaymentAmount:
            u.ownerDownpaymentAmount != null
              ? Number(u.ownerDownpaymentAmount)
              : utOwnerDownpaymentAmount,
          tenantDefaultRentAmount:
            u.tenantDefaultRentAmount != null
              ? Number(u.tenantDefaultRentAmount)
              : utTenantDefaultRentAmount,
          tenantDefaultDownpaymentAmount:
            u.tenantDefaultDownpaymentAmount != null
              ? Number(u.tenantDefaultDownpaymentAmount)
              : utTenantDefaultDownpaymentAmount,
          tenantDefaultNightlyRateAmount:
            u.tenantDefaultNightlyRateAmount != null
              ? Number(u.tenantDefaultNightlyRateAmount)
              : utTenantDefaultNightlyRateAmount,
          // Raw (unresolved) per-unit override values — null means "no
          // override, inherits the UnitType default" — as opposed to the
          // fields above, which fall back to the UnitType value and so can't
          // distinguish an explicit override from inheritance. Used only to
          // seed the Edit Unit Type form's per-unit table faithfully.
          overrides: {
            sizeValue: u.sizeValue != null ? Number(u.sizeValue) : null,
            sizeUnit: u.sizeUnit,
            ownerRentAmount: u.ownerRentAmount != null ? Number(u.ownerRentAmount) : null,
            ownerDownpaymentAmount:
              u.ownerDownpaymentAmount != null ? Number(u.ownerDownpaymentAmount) : null,
            tenantDefaultRentAmount:
              u.tenantDefaultRentAmount != null ? Number(u.tenantDefaultRentAmount) : null,
            tenantDefaultDownpaymentAmount:
              u.tenantDefaultDownpaymentAmount != null
                ? Number(u.tenantDefaultDownpaymentAmount)
                : null,
            tenantDefaultNightlyRateAmount:
              u.tenantDefaultNightlyRateAmount != null
                ? Number(u.tenantDefaultNightlyRateAmount)
                : null,
          },
        };
      }),
    };
  });

  const totalUnits = unitTypes.reduce((sum, ut) => sum + ut.unitCount, 0);
  const occupiedUnits = unitTypes.reduce(
    (sum, ut) => sum + ut.units.filter((u) => u.occupied).length,
    0
  );
  const monthlyOwnerRent =
    activeAgreement?.fixedMonthlyRentAmount != null
      ? Number(activeAgreement.fixedMonthlyRentAmount)
      : unitTypes.reduce(
          (sum, ut) => sum + ut.units.reduce((s, u) => s + (u.ownerRentAmount ?? 0), 0),
          0
        );
  // Same dual-mode logic as monthlyOwnerRent, applied to the owner's
  // downpayment/advance instead of the monthly rent.
  const totalOwnerDownpayment =
    activeAgreement?.downpaymentAmount != null
      ? Number(activeAgreement.downpaymentAmount)
      : unitTypes.reduce(
          (sum, ut) => sum + ut.units.reduce((s, u) => s + (u.ownerDownpaymentAmount ?? 0), 0),
          0
        );

  // Latest utility bill status per unit — property.utilityBills is already
  // ordered dueDate desc, so the first hit per unitId is the most recent one.
  // Bills with no unitId (property-wide, e.g. one shared meter) don't map to
  // any single tenant's row, so those stay unrepresented here on purpose.
  const latestUtilityBillStatusByUnitId = new Map<string, "PAID" | "UNPAID" | "PARTIAL">();
  for (const b of property.utilityBills) {
    if (b.unitId && !latestUtilityBillStatusByUnitId.has(b.unitId)) {
      latestUtilityBillStatusByUnitId.set(b.unitId, b.status);
    }
  }

  // Flat tenants list across all units, for the reference-style tenants table.
  // Includes every lease (not just active) so a vacated tenant's record stays
  // visible for history — the table's "former tenant" filter distinguishes
  // them from currently-active ones instead of just dropping them silently.
  const tenants = property.unitTypes.flatMap((ut) =>
    ut.units.flatMap((u) =>
      u.tenantLeases.map((tl) => {
        const asOf = tl.status === "ACTIVE" ? new Date() : (tl.movedOutAt ?? tl.endDate ?? new Date());
        const ledger = buildRentLedger(
          tl.startDate,
          Number(tl.monthlyRentAmount),
          tl.rentPayments.map((rp) => ({
            id: rp.id,
            month: rp.month,
            dueDate: rp.dueDate,
            dueAmount: Number(rp.dueAmount),
            paidAmount: Number(rp.paidAmount),
            status: rp.status,
            paidAt: rp.paidAt,
            method: rp.transactions[0]?.method ?? null,
          })),
          asOf
        );
        const overdue = overdueEntries(ledger);
        const overdueAmount = tl.status === "ACTIVE" ? totalOverdue(ledger) : 0;
        const currentEntry = ledger[ledger.length - 1] ?? null;
        const monthlyRentAmount = Number(tl.monthlyRentAmount);
        const serviceChargeValue = tl.serviceChargeValue != null ? Number(tl.serviceChargeValue) : null;
        return {
          id: tl.id,
          tenantName: tl.tenant.name,
          contactInfo: tl.tenant.contactInfo,
          propertyId: property.id,
          propertyName: property.name,
          unitLabel: u.label,
          monthlyRentAmount,
          currentDownpaymentBalance: Number(tl.currentDownpaymentBalance),
          serviceChargeType: tl.serviceChargeType,
          serviceChargeValue,
          serviceChargeAmount: computeServiceChargeAmount(monthlyRentAmount, tl.serviceChargeType, serviceChargeValue),
          leaseStatus: tl.status,
          rentStatus: tl.status === "ACTIVE" ? (currentEntry?.status ?? null) : null,
          overdueAmount,
          overdueMonths: tl.status === "ACTIVE" ? overdue : [],
          paymentMethod: currentEntry?.method ?? null,
          startDate: tl.startDate,
          leftOn: tl.status !== "ACTIVE" ? (tl.movedOutAt ?? tl.endDate) : null,
          utilityBillStatus: latestUtilityBillStatusByUnitId.get(u.id) ?? null,
        };
      })
    )
  );
  const activeTenants = tenants.filter((t) => t.leaseStatus === "ACTIVE");
  const totalOverdueRent = activeTenants.reduce((sum, t) => sum + t.overdueAmount, 0);

  // Flat guest-stays list, same "full history" shape as `tenants` above.
  const guestStays = property.unitTypes.flatMap((ut) =>
    ut.units.flatMap((u) =>
      u.guestStays.map((g) => {
        const paidAmount = g.transactions
          .filter((t) => t.type === "GUEST_STAY_PAYMENT_RECEIVED")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const totalAmount = Number(g.totalAmount);
        return {
          id: g.id,
          guestName: g.guestName,
          guestPhone: g.guestPhone,
          numberOfGuests: g.numberOfGuests,
          unitLabel: u.label,
          propertyId: property.id,
          propertyName: property.name,
          checkInDate: g.checkInDate,
          checkOutDate: g.checkOutDate,
          ratePerNight: Number(g.ratePerNight),
          totalAmount,
          depositAmount: g.depositAmount != null ? Number(g.depositAmount) : null,
          status: g.status,
          paidAmount,
          remaining: Math.max(0, totalAmount - paidAmount),
          paymentMethod: g.transactions[0]?.method ?? null,
        };
      })
    )
  );

  const monthRangeNow = monthRange(new Date());
  const guestStayIncome = guestStays
    .filter(
      (g) =>
        g.status !== "CANCELLED" &&
        g.status !== "NO_SHOW" &&
        g.checkInDate >= monthRangeNow.monthStart &&
        g.checkInDate < monthRangeNow.monthEnd
    )
    .reduce((sum, g) => sum + g.totalAmount, 0);
  const expectedIncome =
    activeTenants.reduce((sum, t) => sum + t.monthlyRentAmount + t.serviceChargeAmount, 0) + guestStayIncome;

  const staff = property.employees.map((e) => {
    const asOf = e.status === "ACTIVE" ? new Date() : (e.terminatedAt ?? new Date());
    const ledger = buildRentLedger(
      e.joinedAt,
      Number(e.salaryAmount),
      e.payrollRecords.map((pr) => ({
        id: pr.id,
        month: pr.month,
        dueDate: pr.dueDate,
        dueAmount: pr.dueAmount != null ? Number(pr.dueAmount) : Number(pr.amountPaid),
        paidAmount: Number(pr.amountPaid),
        status: pr.status === "PENDING" ? "UNPAID" : pr.status,
        paidAt: pr.paidAt,
        method: pr.transactions[0]?.method ?? null,
      })),
      asOf
    );
    const overdue = overdueEntries(ledger);
    const overdueAmount = e.status === "ACTIVE" ? totalOverdue(ledger) : 0;
    const currentEntry = ledger[ledger.length - 1] ?? null;
    return {
      id: e.id,
      name: e.name,
      role: e.role,
      contactInfo: e.contactInfo,
      joinedAt: e.joinedAt,
      salaryAmount: Number(e.salaryAmount),
      status: e.status,
      terminatedAt: e.terminatedAt,
      payrollStatus: e.status === "ACTIVE" ? (currentEntry ? fromLedgerStatus(currentEntry.status) : null) : null,
      paymentMethod: currentEntry?.method ?? null,
      overdueAmount,
      overdueMonths: e.status === "ACTIVE" ? overdue : [],
    };
  });
  const activeStaff = staff.filter((s) => s.status === "ACTIVE");
  const payrollCost = activeStaff.reduce((sum, s) => sum + s.salaryAmount, 0);
  const totalOverduePayroll = activeStaff.reduce((sum, s) => sum + s.overdueAmount, 0);

  const vacantUnitsList = unitTypes.flatMap((ut) =>
    ut.units
      .filter((u) => !u.occupied && u.status === "ACTIVE")
      .map((u) => ({ ...u, unitTypeLabel: ut.label }))
  );

  const unitLabelById = new Map(
    unitTypes.flatMap((ut) => ut.units.map((u) => [u.id, u.label] as const))
  );
  const allUnits = unitTypes.flatMap((ut) =>
    ut.units.map((u) => ({
      id: u.id,
      label: u.label,
      unitTypeLabel: ut.label,
      ownerRentAmount: u.ownerRentAmount,
      ownerDownpaymentAmount: u.ownerDownpaymentAmount,
      tenantDefaultNightlyRateAmount: u.tenantDefaultNightlyRateAmount,
    }))
  );

  const expenses = monthTransactions
    .filter(
      (t) => t.direction === "OUTGOING" && (NON_CORE_EXPENSE_TYPES as readonly string[]).includes(t.type)
    )
    .map((t) => ({
      id: t.id,
      type: t.type,
      date: t.date,
      notes: t.notes,
      amount: Number(t.amount),
      paymentMethod: t.method,
      unitLabel: t.unitId ? (unitLabelById.get(t.unitId) ?? null) : null,
    }));
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const electricityBillsForConsumption = property.utilityBills.map((b) => ({
    id: b.id,
    type: b.type,
    unitId: b.unitId,
    dueDate: b.dueDate,
    createdAt: b.createdAt,
    meterReading: b.meterReading != null ? Number(b.meterReading) : null,
  }));
  const consumptionByBillId = attachElectricityConsumption(electricityBillsForConsumption);
  // What a brand-new electricity bill entered right now would chain from —
  // fed to the Add Bill dialog so it can show "আগের রিডিং" and a live
  // consumption preview before the user even saves.
  const previousElectricityReadingByUnit = latestElectricityReadingByUnit(
    property.utilityBills.map((b) => ({
      id: b.id,
      type: b.type,
      unitId: b.unitId,
      month: b.month,
      dueDate: b.dueDate,
      createdAt: b.createdAt,
      meterReading: b.meterReading != null ? Number(b.meterReading) : null,
    }))
  );

  const utilityBills = property.utilityBills.map((b) => {
    const split = splitUtilityBillTransactions(
      b.transactions.map((t) => ({ type: t.type, amount: Number(t.amount), method: t.method }))
    );
    return {
      id: b.id,
      type: b.type,
      dueDate: b.dueDate,
      amount: Number(b.amount),
      paidAmount: Number(b.paidAmount),
      status: b.status,
      paidByCompany: b.paidByCompany,
      paymentMethod: split.method,
      collectedFromTenant: split.collectedFromTenant,
      companyAbsorbedAmount: split.companyAbsorbedAmount,
      profitAmount: split.profitAmount,
      unitLabel: b.unitId ? (unitLabelById.get(b.unitId) ?? null) : null,
      propertyId: property.id,
      propertyName: property.name,
      meterReading: b.meterReading != null ? Number(b.meterReading) : null,
      previousMeterReading: consumptionByBillId.get(b.id)?.previousReading ?? null,
      consumptionUnits: consumptionByBillId.get(b.id)?.consumption ?? null,
    };
  });

  const collectedIncome = monthTransactions
    .filter((t) => t.direction === "INCOMING")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Real, unscheduled income — a tenant paid more than the actual utility
  // bill (see payUtilityBill) — added on top of the rent-schedule-based
  // expectedIncome the same way guestStayIncome already is.
  const utilityProfit = monthTransactions
    .filter((t) => t.type === "UTILITY_PROFIT_FROM_TENANT")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const netProfit = expectedIncome + utilityProfit - monthlyOwnerRent - payrollCost - totalExpense;
  const profitMargin = expectedIncome > 0 ? Math.round((netProfit / expectedIncome) * 100) : 0;

  return {
    id: property.id,
    displayId,
    name: property.name,
    address: property.address,
    type: property.type,
    notes: property.notes,
    status: property.status,
    createdAt: property.createdAt,
    owner: property.owner,
    activeAgreement: activeAgreement
      ? {
          id: activeAgreement.id,
          downpaymentAmount:
            activeAgreement.downpaymentAmount != null ? Number(activeAgreement.downpaymentAmount) : null,
          fixedMonthlyRentAmount:
            activeAgreement.fixedMonthlyRentAmount != null
              ? Number(activeAgreement.fixedMonthlyRentAmount)
              : null,
          startDate: activeAgreement.startDate,
          endDate: activeAgreement.endDate,
          notes: activeAgreement.notes,
          status: activeAgreement.status,
          documents: activeAgreement.documents.map((d) => ({
            id: d.id,
            fileUrl: d.fileUrl,
            fileType: d.fileType,
            uploadedAt: d.uploadedAt,
          })),
          rentPayments: activeAgreement.ownerRentPayments.map((p) => ({
            id: p.id,
            unitLabel: p.unitId ? (unitLabelById.get(p.unitId) ?? null) : null,
            month: p.month,
            dueDate: p.dueDate,
            dueAmount: Number(p.dueAmount),
            paidAmount: Number(p.paidAmount),
            status: p.status,
            paidAt: p.paidAt,
            paymentMethod: p.transactions[0]?.method ?? null,
          })),
        }
      : null,
    pastAgreements: pastAgreements.map((a) => ({
      id: a.id,
      downpaymentAmount: a.downpaymentAmount != null ? Number(a.downpaymentAmount) : null,
      startDate: a.startDate,
      endDate: a.endDate,
      status: a.status,
    })),
    unitTypes,
    totalUnits,
    occupiedUnits,
    vacantUnitsList,
    allUnits,
    monthlyOwnerRent,
    totalOwnerDownpayment,
    tenants,
    staff,
    guestStays,
    expenses,
    previousElectricityReadingByUnit: Object.fromEntries(previousElectricityReadingByUnit),
    utilityBills,
    expectedIncome,
    collectedIncome,
    payrollCost,
    totalExpense,
    totalOverdueRent,
    totalOverduePayroll,
    netProfit,
    profitMargin,
    thisMonthIncome: collectedIncome,
    thisMonthExpense: totalExpense,
  };
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getPropertyDetail>>>;
