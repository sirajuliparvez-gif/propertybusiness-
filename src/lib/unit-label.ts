// Label used by unit pickers (add/edit utility bill): the shop number
// followed by the shop's business name while it's occupied — "০২ · ভাই ভাই
// সেলুন" — falling back to the unit type for a vacant unit, which has no
// name of its own.
export function unitPickerLabel(unit: {
  label: string;
  unitTypeLabel: string;
  tenantName?: string | null;
}) {
  const name = unit.tenantName || unit.unitTypeLabel;
  return name ? `${unit.label} · ${name}` : unit.label;
}
