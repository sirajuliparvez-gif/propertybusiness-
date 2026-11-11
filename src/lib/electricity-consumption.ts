// Readings are cumulative. A bill can store its own previous reading
// without changing how later readings are chained.
export function electricityAmountAtRate(units: number | null, unitRate: string) {
  const rate = Number(unitRate);
  const total = (units ?? 0) * rate;
  if (units == null || units <= 0 || rate <= 0 || !Number.isFinite(total)) return "";
  const rounded = total.toFixed(2);
  return Number(rounded) > 0 ? rounded : "";
}

type ReadingBill = {
  id: string;
  type: string;
  unitId: string | null;
  dueDate: Date;
  // Tiebreaker for two bills sharing the exact same dueDate (e.g. a whole
  // month's bills entered in one sitting) — without it, ordering falls back
  // to whatever order the DB happens to return equal rows in, which isn't
  // stable across queries and can pair a bill with the wrong "previous"
  // reading (even producing negative consumption).
  createdAt: Date;
  meterReading: number | null;
  previousMeterReadingOverride?: number | null;
  // Optional second/third meter on the same unit; each meter chains separately.
  meterLabel?: string | null;
};

function unitKey(unitId: string | null, meterLabel?: string | null) {
  return `${unitId ?? "__property__"}|${meterLabel ?? ""}`;
}

function chronological(a: ReadingBill, b: ReadingBill) {
  return a.dueDate.getTime() - b.dueDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime();
}

// Walks a property's full electricity-bill history (any order) and returns,
// per bill id, the previous reading it chains from and the resulting
// consumption — null when there's nothing before it to compare against
// (first-ever reading for that unit).
export function attachElectricityConsumption<T extends ReadingBill>(
  bills: T[]
): Map<string, { previousReading: number | null; consumption: number | null }> {
  const sorted = [...bills].filter((b) => b.type === "ELECTRICITY").sort(chronological);

  const lastReadingByUnit = new Map<string, number>();
  const result = new Map<string, { previousReading: number | null; consumption: number | null }>();

  for (const b of sorted) {
    const key = unitKey(b.unitId, b.meterLabel);
    const previousReading = b.previousMeterReadingOverride ?? lastReadingByUnit.get(key) ?? null;
    const consumption =
      b.meterReading != null && previousReading != null ? b.meterReading - previousReading : null;
    result.set(b.id, { previousReading, consumption });
    if (b.meterReading != null) lastReadingByUnit.set(key, b.meterReading);
  }

  return result;
}

// The reading a NEW bill (not in the list yet) would chain from — i.e. the
// most recent electricity reading on record for that unit, optionally
// excluding everything from `beforeMonth` onward (YYYY-MM) so a monthly
// sheet can show "last month's reading" as the reference even if this
// month's own bill has already been recorded once.
export function latestElectricityReadingByUnit(
  bills: (ReadingBill & { month: string })[],
  beforeMonth?: string
): Map<string, number> {
  const sorted = [...bills]
    // The monthly sheet has one reading column per unit: the unnamed meter.
    .filter((b) => b.type === "ELECTRICITY" && b.meterReading != null && !b.meterLabel)
    .filter((b) => !beforeMonth || b.month < beforeMonth)
    .sort((a, b) => -chronological(a, b));

  const result = new Map<string, number>();
  for (const b of sorted) {
    const key = b.unitId ?? "__property__";
    if (!result.has(key) && b.meterReading != null) result.set(key, b.meterReading);
  }
  return result;
}
