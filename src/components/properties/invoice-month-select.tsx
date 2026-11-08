"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthLabel } from "@/lib/format";

export function InvoiceMonthSelect({
  leaseId,
  months,
  selectedMonth,
  basePath,
  tenantScope = false,
  embedded = false,
  action,
  minMonth,
  maxMonth,
}: {
  leaseId: string;
  months: string[];
  selectedMonth: string;
  // Defaults to the tenant invoice; the salary slip passes its own route.
  basePath?: string;
  tenantScope?: boolean;
  embedded?: boolean;
  action?: "receive" | "print";
  minMonth?: string;
  maxMonth?: string;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();

  function changeMonth(value: string | null) {
    if (!value || value === selectedMonth || (minMonth && value < minMonth) || (maxMonth && value > maxMonth)) return;
    const query = new URLSearchParams({ month: value });
    if (tenantScope) query.set("tenant", "1");
    if (embedded) query.set("embed", "1");
    if (action) query.set(action, "1");
    router.push(`${basePath ?? `/tenants/${leaseId}/invoice`}?${query}`);
  }

  if (embedded) {
    return <form className="flex items-center gap-2 print:hidden" onSubmit={(event) => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get("month");
      if (typeof value === "string") changeMonth(value);
    }}>
      <Input key={selectedMonth} className="w-44" type="month" name="month" required
        aria-label={t("selectInvoiceMonth")} defaultValue={selectedMonth} min={minMonth} max={maxMonth} />
      <Button type="submit" size="sm" variant="outline">{t("invoiceOpenMonth")}</Button>
    </form>;
  }

  return (
    <div className="print:hidden">
      <Select
        value={selectedMonth}
        onValueChange={changeMonth}
        items={months.map((m) => ({ value: m, label: monthLabel(m, locale) }))}
      >
        <SelectTrigger className="w-48" aria-label={t("selectInvoiceMonth")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
