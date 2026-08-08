import { Building2, Store, BedDouble, Home, Briefcase, ShoppingBag } from "lucide-react";

// Plain data + pure functions only — no "use client" directive — so this can
// be imported from both Server Components (e.g. the property detail page)
// and Client Components (forms, pickers). A client-only module's exports
// can't be called as plain functions from server code, only rendered as
// components, so these helpers must not live inside property-type-picker.tsx.

export const PROPERTY_TYPE_KEYS = [
  "apartment",
  "market",
  "hotel",
  "house",
  "office",
  "shop",
] as const;

export type PropertyTypeKey = (typeof PROPERTY_TYPE_KEYS)[number];

// The `type` column stores a translated label (not a stable key), so this
// checks against both locales' "hotel" label directly rather than needing
// the current UI locale to match whatever locale the property was created in.
const HOTEL_TYPE_LABELS = ["হোটেল", "Hotel"];

export function isHotelType(type: string | null | undefined) {
  return !!type && HOTEL_TYPE_LABELS.includes(type);
}

export const TYPE_ICONS: Record<PropertyTypeKey, typeof Building2> = {
  apartment: Building2,
  market: Store,
  hotel: BedDouble,
  house: Home,
  office: Briefcase,
  shop: ShoppingBag,
};

// Reverse-lookup from a stored (translated) type label back to its icon —
// `t` must be the caller's own `useTranslations("Properties")` (or
// `getTranslations` on the server) instance so this matches regardless of
// which locale the property was created in vs. the locale currently being
// viewed.
export function getTypeIcon(t: (key: string) => string, type: string | null | undefined) {
  if (!type) return Building2;
  const key = PROPERTY_TYPE_KEYS.find((k) => t(`typeOption_${k}`) === type);
  return key ? TYPE_ICONS[key] : Building2;
}
