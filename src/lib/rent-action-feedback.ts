export type RentActionResult =
  | "recorded"
  | "alreadyPaid"
  | "advance"
  | "overdue"
  | "arrearsAdded"
  | "arrearsAlreadyExists"
  | "updated"
  | "deleted";

export function withRentActionFeedback(
  returnTo: string,
  result: RentActionResult,
  details: { month?: string; amount?: number; count?: number } = {}
) {
  const url = new URL(returnTo, "http://local");
  url.searchParams.set("rentResult", result);
  if (details.month) url.searchParams.set("rentMonth", details.month);
  if (details.amount != null) url.searchParams.set("rentAmount", String(details.amount));
  if (details.count != null) url.searchParams.set("rentCount", String(details.count));
  return `${url.pathname}${url.search}`;
}
