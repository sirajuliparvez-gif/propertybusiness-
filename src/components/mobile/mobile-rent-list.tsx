"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RentCollectionData } from "@/lib/tenants-data";

type Filter = "all" | "paid" | "overdue";

export function MobileRentList({
  payments,
  totalDue,
  totalCollected,
  totalRemaining,
  collectionRate,
}: RentCollectionData) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  const counts = useMemo(
    () => ({
      all: payments.length,
      paid: payments.filter((p) => p.overdueAmount <= 0).length,
      overdue: payments.filter((p) => p.overdueAmount > 0).length,
    }),
    [payments]
  );

  const filtered = useMemo(() => {
    const byStatus =
      filter === "paid"
        ? payments.filter((p) => p.overdueAmount <= 0)
        : filter === "overdue"
          ? payments.filter((p) => p.overdueAmount > 0)
          : payments;
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((p) =>
      `${p.tenantName} ${p.contactInfo ?? ""} ${p.propertyName} ${p.unitLabel}`.toLowerCase().includes(q)
    );
  }, [payments, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 md:hidden">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("rentCollectionTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("rentPageSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("collectionRate")}</p>
            <span className="font-mono text-sm font-bold tabular-nums">{collectionRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${collectionRate}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-sm font-bold tabular-nums">{formatTaka(totalDue)}</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{t("expectedIncome")}</p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold tabular-nums text-success">
                {formatTaka(totalCollected)}
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground">{t("collectedThisMonth")}</p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold tabular-nums text-destructive">
                {formatTaka(totalRemaining)}
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground">{t("remaining")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <InputGroup>
        <InputGroupAddon>
          <Search className="size-4 opacity-50" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("rentSearchPlaceholder")}
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
            {f.label} <span className="opacity-60">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noRentSearchResults")}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {filtered.map((p) => (
              <li key={p.id} className={p.overdueAmount > 0 ? "bg-destructive/5" : undefined}>
                <RecordTenantRentPaymentDialog
                  propertyId={p.propertyId}
                  tenantLeaseId={p.id}
                  monthlyRentAmount={p.monthlyRentAmount}
                  currentDownpaymentBalance={p.currentDownpaymentBalance}
                  serviceChargeType={p.serviceChargeType}
                  serviceChargeValue={p.serviceChargeValue}
                  returnTo="/rent"
                  variant="row"
                  rowContent={
                    <>
                      <InitialAvatar name={p.tenantName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.tenantName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.propertyName} · {p.unitLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          {formatTaka(p.monthlyRentAmount)}
                        </p>
                        <StatusPill status={p.rentStatus} labels={rentStatusLabels} />
                      </div>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
