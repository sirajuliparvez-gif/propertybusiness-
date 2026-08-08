"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import type { RentCollectionData } from "@/lib/tenants-data";

type Filter = "all" | "paid" | "overdue";
const ALL_PROPERTIES = "ALL";

export function RentCollectionTable({ payments }: { payments: RentCollectionData["payments"] }) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  const properties = useMemo(() => {
    const byId = new Map<string, string>();
    payments.forEach((p) => {
      if (!byId.has(p.propertyId)) byId.set(p.propertyId, p.propertyName);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [payments]);

  const counts = useMemo(
    () => ({
      all: payments.length,
      paid: payments.filter((p) => p.overdueAmount <= 0).length,
      overdue: payments.filter((p) => p.overdueAmount > 0).length,
    }),
    [payments]
  );

  const filtered = useMemo(() => {
    const byProperty =
      propertyFilter === ALL_PROPERTIES ? payments : payments.filter((p) => p.propertyId === propertyFilter);
    const byStatus =
      filter === "paid"
        ? byProperty.filter((p) => p.overdueAmount <= 0)
        : filter === "overdue"
          ? byProperty.filter((p) => p.overdueAmount > 0)
          : byProperty;

    const q = query.trim().toLowerCase();
    const byQuery = !q
      ? byStatus
      : byStatus.filter((p) =>
          `${p.tenantName} ${p.contactInfo ?? ""} ${p.propertyName} ${p.unitLabel}`.toLowerCase().includes(q)
        );

    if (!dateFrom && !dateTo) return byQuery;
    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the "to" day

    return byQuery.filter((p) => {
      if (!p.currentDueDate) return false;
      const due = new Date(p.currentDueDate);
      return (!rangeStart || due >= rangeStart) && (!rangeEnd || due < rangeEnd);
    });
  }, [payments, filter, propertyFilter, query, dateFrom, dateTo]);

  if (payments.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noTenants")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-8 w-64">
            <InputGroupAddon>
              <Search className="size-3.5 opacity-50" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("rentSearchPlaceholder")}
              className="text-xs"
            />
          </InputGroup>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t("dateRangeFrom")}
            className="h-8 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t("dateRangeTo")}
            className="h-8 w-36 text-xs"
          />
          {dateFrom || dateTo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              {t("clearDateRange")}
            </Button>
          ) : null}

          {properties.length > 0 ? (
            <Select
              value={propertyFilter}
              onValueChange={(v) => setPropertyFilter(v ?? ALL_PROPERTIES)}
              items={[
                { value: ALL_PROPERTIES, label: t("allProperties") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROPERTIES}>{t("allProperties")}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noRentSearchResults")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tenant")}</TableHead>
              <TableHead>{t("propertyLabel")}</TableHead>
              <TableHead>{t("unit")}</TableHead>
              <TableHead className="text-right">{t("rentAmountColumn")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("paidDate")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              return (
                <TableRow key={p.id} className={p.overdueAmount > 0 ? "bg-destructive/5" : undefined}>
                  <TableCell>
                    <Link href={`/tenants/${p.id}`} className="flex items-center gap-2 hover:underline">
                      <InitialAvatar name={p.tenantName} />
                      <div className="flex flex-col">
                        {p.tenantName}
                        {p.contactInfo ? (
                          <span className="font-mono text-xs text-muted-foreground">{p.contactInfo}</span>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/properties/${p.propertyId}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {p.propertyName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{p.unitLabel}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatTaka(p.monthlyRentAmount)}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.currentDueDate ? formatDate(p.currentDueDate) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.currentPaidAt ? formatDate(p.currentPaidAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {p.rentStatus === "ADJUSTED_FROM_DOWNPAYMENT" ? (
                      <span className="text-xs font-medium text-primary">{t("adjustFromDownpayment")}</span>
                    ) : (
                      <span className="text-muted-foreground">{paymentMethodLabel(t, p.paymentMethod)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.rentStatus} labels={rentStatusLabels} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <RecordTenantRentPaymentDialog
                        propertyId={p.propertyId}
                        tenantLeaseId={p.id}
                        monthlyRentAmount={p.monthlyRentAmount}
                        currentDownpaymentBalance={p.currentDownpaymentBalance}
                        serviceChargeType={p.serviceChargeType}
                        serviceChargeValue={p.serviceChargeValue}
                        returnTo="/rent"
                        iconOnly
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
