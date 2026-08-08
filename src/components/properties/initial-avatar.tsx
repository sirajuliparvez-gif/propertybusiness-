import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-warning/15 text-warning",
  "bg-destructive/15 text-destructive",
  "bg-success/15 text-success",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function InitialAvatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        colorForName(name),
        className
      )}
    >
      {initial}
    </span>
  );
}
