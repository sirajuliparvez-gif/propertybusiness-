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
import { monthLabel } from "@/lib/format";

export function InvoiceMonthSelect({
  leaseId,
  months,
  selectedMonth,
  basePath,
  tenantScope = false,
  embedded = false,
  action,
}: {
  leaseId: string;
  months: string[];
  selectedMonth: string;
  // Defaults to the tenant invoice; the salary slip passes its own route.
  basePath?: string;
  tenantScope?: boolean;
  embedded?: boolean;
  action?: "receive" | "print";
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="print:hidden">
      <Select
        value={selectedMonth}
        onValueChange={(v) => {
          if (!v || v === selectedMonth) return;
          const query = new URLSearchParams({ month: v });
          if (tenantScope) query.set("tenant", "1");
          if (embedded) query.set("embed", "1");
          if (action) query.set(action, "1");
          router.push(`${basePath ?? `/tenants/${leaseId}/invoice`}?${query}`);
        }}
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
