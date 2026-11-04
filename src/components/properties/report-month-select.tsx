"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { monthLabel } from "@/lib/format";

export function ReportMonthSelect({ month, months, basePath = "/rent/report", allowAll = false, label }: { month: string; months: string[]; basePath?: string; allowAll?: boolean; label?: string }) {
  const locale = useLocale();
  const t = useTranslations("Properties");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <label className="sr-only" htmlFor="report-month">{label ?? t(allowAll ? "monthFilterLabel" : "rentMonthFilter")}</label>
      <select
        id="report-month"
        name="month"
        value={month}
        disabled={pending}
        onChange={(event) => {
          const nextMonth = event.target.value;
          startTransition(() => router.push(nextMonth === "ALL" ? basePath : `${basePath}?month=${nextMonth}`, { scroll: false }));
        }}
        className="h-10 rounded-lg border bg-card px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
      >
        {allowAll && <option value="ALL">{t("allMonths")}</option>}
        {months.map((value) => <option key={value} value={value}>{monthLabel(value, locale)}</option>)}
      </select>
      {pending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
      <span role="status" className="sr-only">{pending ? t("monthFilterLoading") : ""}</span>
    </div>
  );
}
