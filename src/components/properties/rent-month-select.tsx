"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthLabel } from "@/lib/format";

export function RentMonthSelect({ months, selectedMonth }: { months: string[]; selectedMonth: string }) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();

  return (
    <Select
      value={selectedMonth}
      onValueChange={(month) => {
        if (month) router.push(`/rent?month=${month}`);
      }}
      items={months.map((month) => ({ value: month, label: monthLabel(month, locale) }))}
    >
      <SelectTrigger className="w-44" aria-label={t("rentMonthFilter")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month} value={month}>
            {monthLabel(month, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
