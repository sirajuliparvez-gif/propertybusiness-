import { Label } from "@/components/ui/label";

export function FormField({
  label,
  htmlFor,
  required,
  className,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  className?: string;
  // Small muted note under the label — e.g. a reference value the input's
  // own placeholder can't show (too long, or needs to stay visible while typing).
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {hint ? <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
