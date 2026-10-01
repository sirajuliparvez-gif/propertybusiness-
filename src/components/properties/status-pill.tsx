import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "PAID" | "PENDING" | "UNPAID" | "PARTIAL" | "ADJUSTED_FROM_DOWNPAYMENT" | null;

// Unpaid rent inside its payment window (1st–10th) isn't overdue yet: show it
// with the amber "pending" styling and the dueInPeriod label instead of red.
export function rentPillStatus(status: Status, pastDue: boolean): Status {
  return status === "UNPAID" && !pastDue ? "PENDING" : status;
}

// Salary has the same two stages: unpaid inside its window (amber "payment period") and, once the 15th has passed,
// overdue (red). An unpaid PENDING month past its due day is shown as UNPAID so the pill turns red.
export function payrollPillStatus(status: Status, pastDue: boolean): Status {
  return status === "PENDING" && pastDue ? "UNPAID" : status;
}

// "Paid" means this month is actually settled. A lease with nothing owing
// because its rent is ৳0 has no recorded payment, so it stays unpaid until
// one is recorded instead of landing in the paid list automatically.
export function isRentSettled(status: Status, overdueAmount: number) {
  return overdueAmount <= 0 && (status === "PAID" || status === "ADJUSTED_FROM_DOWNPAYMENT");
}

export function StatusPill({ status, labels }: { status: Status; labels: Record<string, string> }) {
  if (!status) return null;
  const isPaid = status === "PAID" || status === "ADJUSTED_FROM_DOWNPAYMENT";
  const isOverdue = status === "UNPAID";
  return (
    <Badge
      className={cn(
        "border-transparent",
        isPaid
          ? "bg-success/15 text-success"
          : isOverdue
            ? "bg-destructive/15 text-destructive"
            : "bg-warning/15 text-warning"
      )}
    >
      <span
        className={cn(
          "mr-1 size-1.5 rounded-full",
          isPaid ? "bg-success" : isOverdue ? "bg-destructive" : "bg-warning"
        )}
      />
      {labels[status] ?? status}
    </Badge>
  );
}
