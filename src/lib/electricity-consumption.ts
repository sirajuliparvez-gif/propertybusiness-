// Meter-reading based electricity consumption — the taka amount on an
// ELECTRICITY bill is still entered by hand from the real bill (tariffs are
// tiered, not a flat rate), but the meter reading is cumulative, so how many
// units were actually used a given month is always "this reading minus the
// previous month's own reading for the same unit". Nothing stores the
// consumption number itself — it's derived fresh every time from the chain
// of readings, so it can never drift out of sync with the readings.

type ReadingBill = {
  id: string;
  type: string;
  unitId: string | null;
  dueDate: Date;
  meterReading: number | null;
};

function unitKey(unitId: string | null) {
  return unitId ?? "__property__";
}

// Walks a property's full electricity-bill history (any order) and returns,
// per bill id, the previous reading it chains from and the resulting
// consumption — null when there's nothing before it to compare against
// (first-ever reading for that unit).
export function attachElectricityConsumption<T extends ReadingBill>(
  bills: T[]
): Map<string, { previousReading: number | null; consumption: number | null }> {
  const sorted = [...bills]
    .filter((b) => b.type === "ELECTRICITY")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const lastReadingByUnit = new Map<string, number>();
  const result = new Map<string, { previousReading: number | null; consumption: number | null }>();

  for (const b of sorted) {
    const key = unitKey(b.unitId);
    const previousReading = lastReadingByUnit.get(key) ?? null;
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
    .filter((b) => b.type === "ELECTRICITY" && b.meterReading != null)
    .filter((b) => !beforeMonth || b.month < beforeMonth)
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  const result = new Map<string, number>();
  for (const b of sorted) {
    const key = unitKey(b.unitId);
    if (!result.has(key) && b.meterReading != null) result.set(key, b.meterReading);
  }
  return result;
}
