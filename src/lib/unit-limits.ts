// The "Number of Units" field creates that many units at once. A stray extra digit
// once created 408 empty units in one click, so the count has a hard maximum and
// anything above the confirm threshold asks first.
export const MAX_UNITS_PER_FORM = 100;
export const CONFIRM_UNIT_COUNT_ABOVE = 20;

export function isValidUnitCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= MAX_UNITS_PER_FORM;
}

export function unitCountNeedsConfirmation(count: number): boolean {
  return Number.isInteger(count) && count > CONFIRM_UNIT_COUNT_ABOVE && count <= MAX_UNITS_PER_FORM;
}
