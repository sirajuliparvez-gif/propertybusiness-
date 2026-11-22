// A unit's number or name, compared the way a person would: "৪০৮" and "408", "A 1" and "a1"
// are the same unit, so adding one that already exists in the property is caught.
export const MAX_UNIT_LABEL_LENGTH = 40;

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

export function normalizeUnitLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

export function unitLabelKey(label: string): string {
  return normalizeUnitLabel(label)
    .replace(/[০-৯]/g, (digit) => String(BENGALI_DIGITS.indexOf(digit)))
    .replace(/\s+/g, "")
    .toLowerCase();
}
