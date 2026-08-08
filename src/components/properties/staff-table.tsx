"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { EmployeeActions } from "@/components/properties/employee-actions";
import { RecordPayrollPaymentDialog } from "@/components/properties/record-payroll-payment-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import type { PropertyDetail } from "@/lib/properties-data";
import type { AllStaffData } from "@/lib/employees-data";

type Filter = "all" | "paid" | "overdue" | "inactive" | "former";
const ALL_PROPERTIES = "ALL";
const COMPANY_STAFF = "COMPANY";

export function StaffTable({
  staff,
  payrollCost,
  propertyId,
  showPropertyColumn = false,
}: {
  staff: PropertyDetail["staff"] | AllStaffData["staff"];
  payrollCost: number;
  propertyId?: string;
  showPropertyColumn?: boolean;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const payrollStatusLabels = { PAID: t("paid"), PENDING: t("pending") };

  // Only meaningful on the cross-property page (showPropertyColumn) — the
  // per-property usage has just one property, so no dropdown is rendered.
  const properties = useMemo(() => {
    if (!showPropertyColumn) return [];
    const byId = new Map<string, string>();
    (staff as AllStaffData["staff"]).forEach((s) => {
      if (s.propertyId && !byId.has(s.propertyId)) byId.set(s.propertyId, s.propertyName!);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [staff, showPropertyColumn]);

  const hasCompanyStaff = useMemo(
    () => showPropertyColumn && (staff as AllStaffData["staff"]).some((s) => !s.propertyId),
    [staff, showPropertyColumn]
  );

  // A staff member "existed" within [dateFrom, dateTo] if their employment
  // span overlaps that range — joinedAt is always set, terminatedAt is only
  // set once actually let go (still-employed staff, active or inactive,
  // has no upper bound so they always overlap unless the range is entirely
  // before they joined). Mirrors TenantsTable's lease-span overlap filter.
  const filtered = useMemo(() => {
    const byProperty =
      !showPropertyColumn || propertyFilter === ALL_PROPERTIES
        ? staff
        : propertyFilter === COMPANY_STAFF
          ? (staff as AllStaffData["staff"]).filter((s) => !s.propertyId)
          : (staff as AllStaffData["staff"]).filter((s) => s.propertyId === propertyFilter);

    const byStatus =
      filter === "paid"
        ? byProperty.filter((s) => s.status === "ACTIVE" && s.overdueAmount <= 0)
        : filter === "overdue"
          ? byProperty.filter((s) => s.status === "ACTIVE" && s.overdueAmount > 0)
          : filter === "inactive"
            ? byProperty.filter((s) => s.status === "INACTIVE")
            : filter === "former"
              ? byProperty.filter((s) => s.status === "TERMINATED")
              : byProperty;

    if (!dateFrom && !dateTo) return byStatus;

    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the "to" day

    return byStatus.filter((s) => {
      const joinedAt = new Date(s.joinedAt);
      const terminatedAt = s.terminatedAt ? new Date(s.terminatedAt) : null;
      const startsBeforeRangeEnds = !rangeEnd || joinedAt < rangeEnd;
      const endsAfterRangeStarts = !rangeStart || !terminatedAt || terminatedAt >= rangeStart;
      return startsBeforeRangeEnds && endsAfterRangeStarts;
    });
  }, [staff, filter, propertyFilter, showPropertyColumn, dateFrom, dateTo]);

  if (staff.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noStaff")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
    { key: "inactive", label: t("filterInactive") },
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

          {showPropertyColumn && (properties.length > 0 || hasCompanyStaff) ? (
            <Select
              value={propertyFilter}
              onValueChange={(v) => setPropertyFilter(v ?? ALL_PROPERTIES)}
              items={[
                { value: ALL_PROPERTIES, label: t("allProperties") },
                ...(hasCompanyStaff ? [{ value: COMPANY_STAFF, label: t("companyStaffLabel") }] : []),
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROPERTIES}>{t("allProperties")}</SelectItem>
                {hasCompanyStaff ? (
                  <SelectItem value={COMPANY_STAFF}>{t("companyStaffLabel")}</SelectItem>
                ) : null}
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
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noStaff")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              {showPropertyColumn ? <TableHead>{t("propertyLabel")}</TableHead> : null}
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("joined")}</TableHead>
              <TableHead className="text-right">{t("salary")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
              <TableHead>{t("thisMonth")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const isInactive = s.status === "INACTIVE";
              const isTerminated = s.status === "TERMINATED";
              const rowPropertyId = propertyId ?? (s as { propertyId?: string | null }).propertyId ?? null;
              const rowPropertyName = (s as { propertyName?: string | null }).propertyName;
              return (
                <TableRow key={s.id} className={isInactive || isTerminated ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/employees/${s.id}`} className="flex items-center gap-2 hover:underline">
                      <InitialAvatar name={s.name} />
                      {s.name}
                    </Link>
                  </TableCell>
                  {showPropertyColumn ? (
                    <TableCell>
                      {rowPropertyId ? (
                        <Link
                          href={`/properties/${rowPropertyId}`}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {rowPropertyName}
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                          {t("companyStaffLabel")}
                        </Badge>
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-muted-foreground">{s.role}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {s.contactInfo ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatDate(s.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatTaka(s.salaryAmount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isTerminated ? "—" : paymentMethodLabel(t, s.paymentMethod)}
                  </TableCell>
                  <TableCell>
                    {isTerminated ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge className="w-fit border-transparent bg-muted text-muted-foreground">
                          {t("filterFormer")}
                        </Badge>
                        {s.terminatedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(s.terminatedAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : isInactive ? (
                      <Badge className="w-fit border-transparent bg-muted text-muted-foreground">
                        {t("inactiveLabel")}
                      </Badge>
                    ) : (
                      <StatusPill status={s.payrollStatus} labels={payrollStatusLabels} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {s.status === "ACTIVE" ? (
                        <RecordPayrollPaymentDialog
                          propertyId={rowPropertyId}
                          employeeId={s.id}
                          defaultAmount={s.salaryAmount}
                          returnTo={showPropertyColumn ? "/employees" : undefined}
                          iconOnly={showPropertyColumn}
                        />
                      ) : null}
                      <EmployeeActions
                        employeeId={s.id}
                        propertyId={rowPropertyId}
                        status={s.status}
                        returnTo={showPropertyColumn ? "/employees" : undefined}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={showPropertyColumn ? 5 : 4} className="text-right text-muted-foreground">
                {t("monthlyPayroll")}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {formatTaka(payrollCost)}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
