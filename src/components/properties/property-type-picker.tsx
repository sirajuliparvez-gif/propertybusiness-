"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PROPERTY_TYPE_KEYS, TYPE_ICONS } from "@/lib/property-types";

export function PropertyTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Properties");

  return (
    <div className="grid grid-cols-3 gap-2">
      {PROPERTY_TYPE_KEYS.map((key) => {
        const Icon = TYPE_ICONS[key];
        const label = t(`typeOption_${key}`);
        const active = value === label;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(label)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
