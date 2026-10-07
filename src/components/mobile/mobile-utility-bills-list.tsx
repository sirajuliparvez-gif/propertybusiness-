"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, Search, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PayUtilityBillButton,
  UTILITY_TYPE_LABEL_KEYS,
  utilityInvoiceHref,
  type UtilityBillRow,
} from "@/components/properties/utility-bills-table";
import { EditUtilityBillDialog } from "@/components/properties/edit-utility-bill-dialog";
import { DeleteUtilityBillButton } from "@/components/properties/delete-utility-bill-button";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";

type Filter = "all" | "unpaid" | "paid";

export function MobileUtilityBillsList({
  bills,
  returnTo = "/utility-bills",
}: {
  bills: UtilityBillRow[];
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? bills.filter((b) => `${b.propertyName ?? ""} ${b.unitLabel ?? ""} ${b.tenantName ?? ""}`.toLowerCase().includes(q))
      : bills;
    if (filter === "unpaid") return searched.filter((b) => b.status !== "PAID");
    if (filter === "paid") return searched.filter((b) => b.status === "PAID");
    return searched;
  }, [bills, filter, query]);

  if (bills.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">{t("noUtilityBills")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "unpaid", label: t("filterUnpaid") },
    { key: "paid", label: t("filterPaid") },
  ];

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <InputGroup className="h-9">
        <InputGroupAddon>
          <Search className="size-3.5 opacity-50" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("utilitySearchPlaceholder")}
        />
      </InputGroup>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noUtilityBills")}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {filtered.map((b) => {
              const row = (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Zap className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {b.propertyName ? `${b.propertyName} · ` : ""}
                      {t(UTILITY_TYPE_LABEL_KEYS[b.type] ?? "utilityTypeOther")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.unitLabel ?? "—"}
                      {b.tenantName ? ` · ${b.tenantName}` : ""} · {formatDate(b.dueDate)}
                      {b.status === "PAID" ? ` · ${paymentMethodLabel(t, b.paymentMethod)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">{formatTaka(b.amount)}</p>
                    <Badge
                      className={cn(
                        "border-transparent",
                        b.status === "PAID"
                          ? "bg-success/15 text-success"
                          : b.status === "PARTIAL"
                            ? "bg-warning/15 text-warning"
                            : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {b.status === "PAID" ? t("paid") : b.status === "PARTIAL" ? t("pending") : t("billStatusUnpaid")}
                    </Badge>
                  </div>
                </>
              );
              return (
                <li key={b.id} className="flex items-stretch">
                  <div className="min-w-0 flex-1">
                    {b.status !== "PAID" ? (
                      <PayUtilityBillButton
                        billId={b.id}
                        propertyId={b.propertyId}
                        type={b.type}
                        amount={b.amount}
                        paidAmount={b.paidAmount}
                        paidByCompany={b.paidByCompany}
                        returnTo={returnTo}
                        variant="row"
                        rowContent={row}
                      />
                    ) : (
                      <div className="flex w-full items-center gap-3 px-4 py-3">{row}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-stretch divide-x">
                    <Link
                      href={utilityInvoiceHref(b)}
                      title={t("invoicePrint")}
                      className="flex w-12 items-center justify-center text-primary transition-colors active:bg-muted/60"
                    >
                      <Printer className="size-4" />
                      <span className="sr-only">{t("invoicePrint")}</span>
                    </Link>
                    <div className="flex w-12 items-center justify-center">
                      <EditUtilityBillDialog bill={b} returnTo={returnTo} />
                    </div>
                    {b.status !== "PAID" ? (
                      <div className="flex w-12 items-center justify-center">
                        <DeleteUtilityBillButton
                          billId={b.id}
                          propertyId={b.propertyId}
                          paidAmount={b.paidAmount}
                          returnTo={returnTo}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
