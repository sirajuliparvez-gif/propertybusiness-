"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/properties/form-field";
import { Input } from "@/components/ui/input";

export function PreviousMeterReadingField({
  id, automatic, manual, onChange,
}: {
  id: string;
  automatic: number | null;
  manual: string | null;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Properties");
  return (
    <FormField label={t("previousMeterReading")} htmlFor={id}>
      <Input id={id} type="number" step="any" min={0} placeholder="—"
        value={manual ?? automatic ?? ""}
        onChange={(event) => onChange(event.target.value)} />
      <input type="hidden" name="previousMeterReadingOverride" value={manual ?? ""} />
    </FormField>
  );
}
