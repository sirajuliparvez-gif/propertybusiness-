// Percentage-type service charge is always computed fresh from the current
// monthlyRentAmount (not stored as a snapshot), so it automatically tracks
// rent changes if a lease is ever edited/renewed.
export function computeServiceChargeAmount(
  monthlyRentAmount: number,
  serviceChargeType: "FLAT" | "PERCENTAGE" | null,
  serviceChargeValue: number | null
): number {
  if (!serviceChargeType || serviceChargeValue == null) return 0;
  return serviceChargeType === "PERCENTAGE" ? (monthlyRentAmount * serviceChargeValue) / 100 : serviceChargeValue;
}
