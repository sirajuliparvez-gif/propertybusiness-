"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill, isRentSettled, rentPillStatus } from "@/components/properties/status-pill";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RentCollectionData } from "@/lib/tenants-data";
import { RentMonthSelect } from "@/components/properties/rent-month-select";

type Filter = "pending" | "all" | "paid" | "overdue";

export function MobileRentList({
  payments,
  totalDue,
  totalCollected,
  totalRemaining,
  collectionRate,
  selectedMonth,
  availableMonths,
}: RentCollectionData) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");

  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    PENDING: t("dueInPeriod"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  const counts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((p) => !isRentSettled(p.rentStatus, p.overdueAmount)).length,
      paid: payments.filter((p) => isRentSettled(p.rentStatus, p.overdueAmount)).length,
      overdue: payments.filter((p) => p.pastDueAmount > 0).length,
    }),
    [payments]
  );

  const filtered = useMemo(() => {
    const byStatus =
      filter === "pending"
        ? payments.filter((p) => !isRentSettled(p.rentStatus, p.overdueAmount))
        : filter === "paid"
        ? payments.filter((p) => isRentSettled(p.rentStatus, p.overdueAmount))
        : filter === "overdue"
          ? payments.filter((p) => p.pastDueAmount > 0)
          : payments;
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((p) =>
      `${p.tenantName} ${p.contactInfo ?? ""} ${p.propertyName} ${p.unitLabel}`.toLowerCase().includes(q)
    );
  }, [payments, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: t("filterCollectionPending") },
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterPastDue") },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("rentCollectionTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("rentPageSubtitle")}</p>
        </div>
        <RentMonthSelect months={availableMonths} selectedMonth={selectedMonth} />
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
              <p className="text-[10px] leading-tight text-muted-foreground">{t("collectedForMonth")}</p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold tabular-nums text-destructive">
                {formatTaka(totalRemaining)}
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground">{t("collectionPendingAmount")}</p>
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
          aria-label={t("rentSearchLabel")}
        />
      </InputGroup>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
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
            {filtered.map((p) => {
              const settled = isRentSettled(p.rentStatus, p.overdueAmount);
              return (
              <li key={p.id} className={cn("flex items-stretch", p.pastDueAmount > 0 ? "bg-destructive/5" : undefined)}>
                <div className="min-w-0 flex-1">
                <RecordTenantRentPaymentDialog
                  propertyId={p.propertyId}
                  tenantLeaseId={p.id}
                  tenantName={p.tenantName}
                  propertyName={p.propertyName}
                  unitLabel={p.unitLabel}
                  monthlyRentAmount={p.monthlyRentAmount}
                  currentDownpaymentBalance={p.currentDownpaymentBalance}
                  serviceChargeType={p.serviceChargeType}
                  serviceChargeValue={p.serviceChargeValue}
                  overdueMonths={p.overdueMonths}
                  monthSettled={settled}
                  returnTo={`/rent?month=${selectedMonth}`}
                  variant="row"
                  triggerLabel={settled ? t("advanceRentPayment") : t("collectRent")}
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
                          {formatTaka(p.monthlyRentAmount + p.serviceChargeAmount)}
                        </p>
                        <StatusPill status={rentPillStatus(p.rentStatus, p.rentPastDue)} labels={rentStatusLabels} />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {settled ? t("advanceRentPayment") : t("collectRent")}
                        </p>
                        {p.pastDueMonthsCount > 1 ? (
                          <p className="text-xs font-medium text-destructive">
                            {t("monthsOverdueCount", { count: p.pastDueMonthsCount })}
                          </p>
                        ) : null}
                      </div>
                    </>
                  }
                />
                </div>
                <Link
                  href={`/tenants/${p.id}/invoice`}
                  title={t("invoiceLabel")}
                  className="flex w-12 shrink-0 items-center justify-center border-l text-primary transition-colors active:bg-muted/60"
                >
                  <Printer className="size-4" />
                  <span className="sr-only">{t("invoiceLabel")}</span>
                </Link>
              </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
