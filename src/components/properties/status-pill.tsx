import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "PAID" | "PENDING" | "UNPAID" | "PARTIAL" | "ADJUSTED_FROM_DOWNPAYMENT" | null;

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
