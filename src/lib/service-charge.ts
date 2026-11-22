// Percentage-type service charge is always computed fresh from the current
// monthlyRentAmount (not stored as a snapshot), so it automatically tracks
// rent changes if a lease is ever edited/renewed.
export function computeServiceChargeAmount(
  monthlyRentAmount: number,
  serviceChargeType: "FLAT" | "PERCENTAGE" | null,
  serviceChargeValue: number | null
): number {
  if (!serviceChargeType || serviceChargeValue == null) return 0;
  // Rounded to whole paisa: a percentage like 3442.989 can never be paid off in 2-decimal amounts,
  // which left such rent "partly paid" and overdue forever.
  return serviceChargeType === "PERCENTAGE" ? Math.round(monthlyRentAmount * serviceChargeValue) / 100 : serviceChargeValue;
}
