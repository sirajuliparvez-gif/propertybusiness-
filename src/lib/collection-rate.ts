// Share of the month's rent that has actually been collected, 0-100.
// It is a money ratio (collected / due), not a head-count: a tenant with nothing
// owed used to count as "fully paid", so the rate showed 1% with ৳0 collected.
// Rounded down so it never says 100% until every taka is in.
export function collectionRatePercent(totalCollected: number, totalDue: number): number {
  if (!(totalDue > 0) || !(totalCollected > 0)) return 0;
  return Math.min(100, Math.floor((totalCollected / totalDue) * 100));
}
