"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/properties/form-field";
import { Input } from "@/components/ui/input";

// Optional name for an extra electricity meter on the same unit ("Meter 2").
// Blank = the unit's single, unnamed meter.
export function MeterLabelField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Properties");
  return (
    <FormField label={t("meterName")} htmlFor={id} className="sm:col-span-2">
      <Input id={id} name="meterLabel" maxLength={40} placeholder={t("meterNamePlaceholder")}
        value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}
