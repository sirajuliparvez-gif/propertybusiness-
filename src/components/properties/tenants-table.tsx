"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { VacateTenantDialog } from "@/components/properties/vacate-tenant-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import type { PropertyDetail } from "@/lib/properties-data";

type Filter = "all" | "paid" | "overdue" | "former";
const ALL_PROPERTIES = "ALL";

export function TenantsTable({
  tenants,
  showPropertyColumn = false,
}: {
  tenants: PropertyDetail["tenants"];
  showPropertyColumn?: boolean;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  // Only meaningful on the cross-property page (showPropertyColumn) — the
  // per-property usage has just one property, so no dropdown is rendered.
  const properties = useMemo(() => {
    const byId = new Map<string, string>();
    tenants.forEach((tn) => {
      if (!byId.has(tn.propertyId)) byId.set(tn.propertyId, tn.propertyName);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [tenants]);

  // A tenancy "existed" within [dateFrom, dateTo] if its lease span overlaps
  // that range at all — an ongoing lease (leftOn === null) has no upper
  // bound, so it always overlaps any range that isn't entirely before its
  // start. Either side of the range can be left open (only one date picked).
  const filtered = useMemo(() => {
    const byProperty =
      propertyFilter === ALL_PROPERTIES ? tenants : tenants.filter((tn) => tn.propertyId === propertyFilter);

    const byStatus =
      filter === "paid"
        ? byProperty.filter((tn) => tn.leaseStatus === "ACTIVE" && tn.overdueAmount <= 0)
        : filter === "overdue"
          ? byProperty.filter((tn) => tn.leaseStatus === "ACTIVE" && tn.overdueAmount > 0)
          : filter === "former"
            ? byProperty.filter((tn) => tn.leaseStatus !== "ACTIVE")
            : byProperty;

    if (!dateFrom && !dateTo) return byStatus;

    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the "to" day

    return byStatus.filter((tn) => {
      const leaseStart = new Date(tn.startDate);
      const leaseEnd = tn.leftOn ? new Date(tn.leftOn) : null;
      const startsBeforeRangeEnds = !rangeEnd || leaseStart < rangeEnd;
      const endsAfterRangeStarts = !rangeStart || !leaseEnd || leaseEnd >= rangeStart;
      return startsBeforeRangeEnds && endsAfterRangeStarts;
    });
  }, [tenants, filter, propertyFilter, dateFrom, dateTo]);

  if (tenants.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noTenants")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
    { key: "former", label: t("filterFormer") },
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
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {showPropertyColumn && properties.length > 0 ? (
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
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noTenants")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tenant")}</TableHead>
              {showPropertyColumn ? <TableHead>{t("propertyLabel")}</TableHead> : null}
              <TableHead>{t("unit")}</TableHead>
              <TableHead className="text-right">{t("rentAmountColumn")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
              <TableHead>{t("utilityBillStatusColumn")}</TableHead>
              <TableHead>{t("thisMonth")}</TableHead>
              <TableHead className="text-right">{t("downpaymentBalance")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tn) => {
              const isFormer = tn.leaseStatus !== "ACTIVE";
              return (
                <TableRow key={tn.id} className={isFormer ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/tenants/${tn.id}`} className="flex items-center gap-2 hover:underline">
                      <InitialAvatar name={tn.tenantName} />
                      <div className="flex flex-col">
                        {tn.tenantName}
                        {tn.contactInfo ? (
                          <span className="font-mono text-xs text-muted-foreground">{tn.contactInfo}</span>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  {showPropertyColumn ? (
                    <TableCell>
                      <Link
                        href={`/properties/${tn.propertyId}`}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {tn.propertyName}
                      </Link>
                    </TableCell>
                  ) : null}
                  <TableCell className="font-mono text-muted-foreground">{tn.unitLabel}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatTaka(tn.monthlyRentAmount)}
                  </TableCell>
                  <TableCell>
                    {isFormer ? (
                      <span className="text-muted-foreground">—</span>
                    ) : tn.rentStatus === "ADJUSTED_FROM_DOWNPAYMENT" ? (
                      <span className="text-xs font-medium text-primary">
                        {t("adjustFromDownpayment")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{paymentMethodLabel(t, tn.paymentMethod)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tn.utilityBillStatus ? (
                      <Badge
                        className={cn(
                          "border-transparent",
                          tn.utilityBillStatus === "PAID"
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning"
                        )}
                      >
                        {tn.utilityBillStatus === "PAID" ? t("paid") : t("billStatusUnpaid")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isFormer ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge className="w-fit border-transparent bg-muted text-muted-foreground">
                          {t("vacatedLabel")}
                        </Badge>
                        {tn.leftOn ? (
                          <span className="text-xs text-muted-foreground">
                            {t("vacatedOn")}: {formatDate(tn.leftOn)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <StatusPill status={tn.rentStatus} labels={rentStatusLabels} />
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono tabular-nums",
                      isFormer ? "text-muted-foreground" : undefined
                    )}
                  >
                    {formatTaka(tn.currentDownpaymentBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title={t("invoiceLabel")}
                        render={<Link href={`/tenants/${tn.id}/invoice`} />}
                        nativeButton={false}
                        className="border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Printer className="size-3.5" />
                        <span className="sr-only">{t("invoiceLabel")}</span>
                      </Button>
                      {isFormer ? null : (
                        <>
                          <RecordTenantRentPaymentDialog
                            propertyId={tn.propertyId}
                            tenantLeaseId={tn.id}
                            monthlyRentAmount={tn.monthlyRentAmount}
                            currentDownpaymentBalance={tn.currentDownpaymentBalance}
                            serviceChargeType={tn.serviceChargeType}
                            serviceChargeValue={tn.serviceChargeValue}
                            returnTo={showPropertyColumn ? "/tenants" : undefined}
                            iconOnly
                          />
                          <VacateTenantDialog
                            leaseId={tn.id}
                            propertyId={tn.propertyId}
                            tenantName={tn.tenantName}
                            currentDownpaymentBalance={tn.currentDownpaymentBalance}
                            returnTo={showPropertyColumn ? "/tenants" : undefined}
                            iconOnly
                          />
                        </>
                      )}
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
