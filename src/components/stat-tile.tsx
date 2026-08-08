import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const toneStyles = {
  default: {
    bar: "bg-blue-500",
    icon: "bg-linear-to-br from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400",
  },
  violet: {
    bar: "bg-violet-500",
    icon: "bg-linear-to-br from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400",
  },
  teal: {
    bar: "bg-teal-500",
    icon: "bg-linear-to-br from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-400",
  },
  success: {
    bar: "bg-success",
    icon: "bg-linear-to-br from-success/25 to-success/5 text-success",
  },
  warning: {
    bar: "bg-warning",
    icon: "bg-linear-to-br from-warning/25 to-warning/5 text-warning",
  },
  destructive: {
    bar: "bg-destructive",
    icon: "bg-linear-to-br from-destructive/25 to-destructive/5 text-destructive",
  },
} as const;

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
  hint?: string;
}) {
  const styles = toneStyles[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl bg-card p-4 ring-1 ring-(--card-ring) shadow-(--shadow-sm) transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-md)">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", styles.bar)} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            styles.icon
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 font-mono text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
