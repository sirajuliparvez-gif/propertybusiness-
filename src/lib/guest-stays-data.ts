import { prisma } from "@/lib/prisma";

function monthRange(now: Date) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getAllGuestStaysData() {
  const now = new Date();
  const today = new Date();
  const { monthStart, monthEnd } = monthRange(now);

  const [stays, properties, revenueAgg] = await Promise.all([
    prisma.guestStay.findMany({
      orderBy: { checkInDate: "desc" },
      include: {
        unit: {
          select: {
            label: true,
            unitType: { select: { property: { select: { id: true, name: true } } } },
          },
        },
        transactions: {
          where: { type: { in: ["GUEST_STAY_PAYMENT_RECEIVED", "GUEST_DEPOSIT_REFUND"] } },
          orderBy: { date: "desc" },
          select: { type: true, amount: true, method: true },
        },
      },
    }),
    prisma.property.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unitTypes: {
          select: {
            label: true,
            tenantDefaultNightlyRateAmount: true,
            units: {
              where: { status: "ACTIVE" },
              orderBy: { label: "asc" },
              select: { id: true, label: true, tenantDefaultNightlyRateAmount: true },
            },
          },
        },
      },
    }),
    // Real cash collected this month — same "actual, not projected" basis as
    // every other "collected this month" KPI in this app.
    prisma.transaction.aggregate({
      where: {
        type: "GUEST_STAY_PAYMENT_RECEIVED",
        direction: "INCOMING",
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const bookings = stays.map((s) => {
    const paidAmount = s.transactions
      .filter((t) => t.type === "GUEST_STAY_PAYMENT_RECEIVED")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const depositRefunded = s.transactions
      .filter((t) => t.type === "GUEST_DEPOSIT_REFUND")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const latestMethod = s.transactions[0]?.method ?? null;
    const totalAmount = Number(s.totalAmount);

    return {
      id: s.id,
      guestName: s.guestName,
      guestPhone: s.guestPhone,
      guestAddress: s.guestAddress,
      guestIdType: s.guestIdType,
      guestIdNumber: s.guestIdNumber,
      numberOfGuests: s.numberOfGuests,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      ratePerNight: Number(s.ratePerNight),
      totalAmount,
      depositAmount: s.depositAmount != null ? Number(s.depositAmount) : null,
      status: s.status,
      notes: s.notes,
      propertyId: s.unit.unitType.property.id,
      propertyName: s.unit.unitType.property.name,
      unitId: s.unitId,
      unitLabel: s.unit.label,
      paidAmount,
      remaining: Math.max(0, totalAmount - paidAmount),
      depositRefunded,
      paymentMethod: latestMethod,
    };
  });

  const propertiesWithUnits = properties
    .map((p) => ({
      id: p.id,
      name: p.name,
      units: p.unitTypes.flatMap((ut) =>
        ut.units.map((u) => ({
          id: u.id,
          label: u.label,
          unitTypeLabel: ut.label,
          tenantDefaultNightlyRateAmount:
            u.tenantDefaultNightlyRateAmount != null
              ? Number(u.tenantDefaultNightlyRateAmount)
              : ut.tenantDefaultNightlyRateAmount != null
                ? Number(ut.tenantDefaultNightlyRateAmount)
                : null,
        }))
      ),
    }))
    .filter((p) => p.units.length > 0);

  const currentlyCheckedIn = bookings.filter((b) => b.status === "CHECKED_IN").length;
  const todayCheckIns = bookings.filter(
    (b) => b.status === "RESERVED" && b.checkInDate >= startOfDay(today) && b.checkInDate <= endOfDay(today)
  ).length;
  const todayCheckOuts = bookings.filter(
    (b) =>
      b.status === "CHECKED_IN" &&
      b.checkOutDate &&
      b.checkOutDate >= startOfDay(today) &&
      b.checkOutDate <= endOfDay(today)
  ).length;
  const monthlyRevenue = Number(revenueAgg._sum.amount ?? 0);

  return {
    bookings,
    propertiesWithUnits,
    currentlyCheckedIn,
    todayCheckIns,
    todayCheckOuts,
    monthlyRevenue,
  };
}

export type AllGuestStaysData = Awaited<ReturnType<typeof getAllGuestStaysData>>;
