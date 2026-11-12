import { getTranslations } from "next-intl/server";

// A unit's first meter is stored with no label. Once a second, named meter exists
// on the same unit, show the unnamed one as "Meter 1" so each reading says which
// meter it belongs to. Display only: the stored label stays null so readings keep chaining.
export async function meterNames(bills: { id: string; type: string; unitId: string | null; meterLabel: string | null }[]) {
  const multi = new Set(bills.filter((b) => b.type === "ELECTRICITY" && b.meterLabel).map((b) => b.unitId ?? ""));
  const first = multi.size ? (await getTranslations("Properties"))("meterFirstName") : "";
  return new Map(bills.map((b) => [b.id, b.meterLabel ?? (b.type === "ELECTRICITY" && multi.has(b.unitId ?? "") ? first : null)]));
}
