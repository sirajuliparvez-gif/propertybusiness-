"use client";

import { useTranslations } from "next-intl";
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
}: {
  leaseId: string;
  months: string[];
  selectedMonth: string;
}) {
  const t = useTranslations("Properties");
  const router = useRouter();

  return (
    <div className="print:hidden">
      <Select
        value={selectedMonth}
        onValueChange={(v) => {
          if (v) router.push(`/tenants/${leaseId}/invoice?month=${v}`);
        }}
        items={months.map((m) => ({ value: m, label: monthLabel(m) }))}
      >
        <SelectTrigger className="w-48" aria-label={t("selectInvoiceMonth")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
