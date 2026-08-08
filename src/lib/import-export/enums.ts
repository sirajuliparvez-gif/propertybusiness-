// Bengali-text <-> DB-enum mapping for import (reverse of the app's normal
// t()-driven display labels) and export (DB enum -> Bengali text). Kept as
// plain hardcoded maps rather than routed through next-intl, since import
// parsing runs in a server action with no locale-bound t() readily at hand,
// and the accepted-input set needs to be more forgiving than a single
// canonical label anyway (synonyms, English fallback).

export function parsePaymentMethod(raw: string | null): "CASH" | "BKASH" | "NAGAD" | "BANK" | "OTHER" | null {
  if (!raw) return null;
  const v = raw.trim();
  if (["ক্যাশ", "নগদ টাকা", "cash", "CASH"].includes(v)) return "CASH";
  if (["বিকাশ", "bkash", "BKASH"].includes(v)) return "BKASH";
  if (["নগদ", "nagad", "NAGAD"].includes(v)) return "NAGAD";
  if (["ব্যাংক ট্রান্সফার", "ব্যাংক", "bank", "BANK"].includes(v)) return "BANK";
  if (["অন্যান্য", "other", "OTHER"].includes(v)) return "OTHER";
  return null;
}

export function paymentMethodToBengali(method: string | null): string {
  const map: Record<string, string> = {
    CASH: "ক্যাশ",
    BKASH: "বিকাশ",
    NAGAD: "নগদ",
    BANK: "ব্যাংক ট্রান্সফার",
    OTHER: "অন্যান্য",
  };
  return method ? (map[method] ?? "") : "";
}

export function parseUtilityType(raw: string | null): "GAS" | "ELECTRICITY" | "WATER" | "OTHER" {
  const v = (raw ?? "").trim();
  if (["গ্যাস", "gas", "GAS"].includes(v)) return "GAS";
  if (["বিদ্যুৎ", "electricity", "ELECTRICITY"].includes(v)) return "ELECTRICITY";
  if (["পানি", "water", "WATER"].includes(v)) return "WATER";
  return "OTHER";
}

export function utilityTypeToBengali(type: string): string {
  const map: Record<string, string> = { GAS: "গ্যাস", ELECTRICITY: "বিদ্যুৎ", WATER: "পানি", OTHER: "অন্যান্য" };
  return map[type] ?? type;
}

export function parseServiceChargeType(raw: string | null): "FLAT" | "PERCENTAGE" | null {
  const v = (raw ?? "").trim();
  if (!v || ["নেই", "none", "NONE"].includes(v)) return null;
  if (["ফ্ল্যাট", "নির্দিষ্ট টাকা", "flat", "FLAT"].includes(v)) return "FLAT";
  if (["শতাংশ", "ভাড়ার শতাংশ", "percentage", "%", "PERCENTAGE"].includes(v)) return "PERCENTAGE";
  return null;
}

export function parseExpenseCategory(raw: string | null): "MAINTENANCE_EXPENSE" | "OTHER" {
  const v = (raw ?? "").trim();
  if (["মেরামত", "রিপেয়ার", "maintenance", "MAINTENANCE_EXPENSE"].includes(v)) return "MAINTENANCE_EXPENSE";
  return "OTHER";
}

export function parseRentPaymentMode(raw: string | null): "cash" | "downpaymentAdjustment" {
  const v = (raw ?? "").trim();
  if (["ডাউনপেমেন্ট থেকে সমন্বয়", "ডাউনপেমেন্ট", "downpaymentAdjustment", "adjustment"].includes(v)) {
    return "downpaymentAdjustment";
  }
  return "cash";
}

export function parseYesNo(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim();
  return ["হ্যাঁ", "হ্যা", "yes", "YES", "true", "TRUE", "1"].includes(v);
}

export function yesNoToBengali(value: boolean): string {
  return value ? "হ্যাঁ" : "না";
}
