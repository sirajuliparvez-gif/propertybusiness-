import { computeServiceChargeAmount } from "@/lib/service-charge";

export type RentTerms = {
  monthlyRentAmount: number;
  serviceChargeType: "FLAT" | "PERCENTAGE" | null;
  serviceChargeValue: number | null;
};

export type EffectiveRentTerms = RentTerms & { effectiveMonth: string };

export function resolveRentTermsForMonth(
  fallback: RentTerms,
  rates: EffectiveRentTerms[],
  month: string
): RentTerms {
  const effective = rates
    .filter((rate) => rate.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
  return effective ?? fallback;
}

export function rentTermsDueAmount(terms: RentTerms) {
  return (
    terms.monthlyRentAmount +
    computeServiceChargeAmount(terms.monthlyRentAmount, terms.serviceChargeType, terms.serviceChargeValue)
  );
}

export function numericRentRates(
  rates: Array<{
    effectiveMonth: string;
    monthlyRentAmount: { toString(): string } | number;
    serviceChargeType: "FLAT" | "PERCENTAGE" | null;
    serviceChargeValue: { toString(): string } | number | null;
  }>
): EffectiveRentTerms[] {
  return rates.map((rate) => ({
    effectiveMonth: rate.effectiveMonth,
    monthlyRentAmount: Number(rate.monthlyRentAmount),
    serviceChargeType: rate.serviceChargeType,
    serviceChargeValue: rate.serviceChargeValue == null ? null : Number(rate.serviceChargeValue),
  }));
}
