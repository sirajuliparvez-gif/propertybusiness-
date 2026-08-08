"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, CheckCircle2, ArrowRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTypeIcon } from "@/lib/property-types";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportsData } from "@/lib/reports-data";

// Must match reports-data.ts's own COMPANY_KEY exactly — kept as a separate
// literal (not a shared import) because reports-data.ts pulls in the Prisma
// client, which can't be bundled into a "use client" component.
const COMPANY_KEY = "__company__";

function pctDelta(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function DeltaBadge({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className={cn("font-mono text-xs font-semibold tabular-nums", good ? "text-success" : "text-destructive")}>
      {pct >= 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

const CATEGORY_COLORS = {
  ownerRent: "oklch(0.55 0.18 240)",
  payroll: "oklch(0.5 0.18 285)",
  maintenance: "oklch(0.65 0.18 55)",
  other: "oklch(0.6 0.03 260)",
} as const;

export function ReportsView({ months, propertyPLByMonth, defaultMonth }: ReportsData) {
  const t = useTranslations("Properties");
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("bn", { month: "long" });
    const fmtShort = new Intl.DateTimeFormat("bn", { month: "short" });
    return new Map(months.map((m) => [m.month, { full: fmt.format(m.date), short: fmtShort.format(m.date) }]));
  }, [months]);

  const monthIndex = months.findIndex((m) => m.month === selectedMonth);
  const data = months[monthIndex] ?? months[months.length - 1];
  const prevData = monthIndex > 0 ? months[monthIndex - 1] : null;

  const propertyRows = propertyPLByMonth[data.month] ?? [];
  const totals = propertyRows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      ownerRent: acc.ownerRent + r.ownerRent,
      otherExpense: acc.otherExpense + r.otherExpense + r.payroll,
      netProfit: acc.netProfit + r.netProfit,
    }),
    { income: 0, ownerRent: 0, otherExpense: 0, netProfit: 0 }
  );

  const incomeDelta = prevData ? pctDelta(data.income, prevData.income) : 0;
  const expenseDelta = prevData
    ? pctDelta(data.ownerRent + data.payroll + data.otherExpense, prevData.ownerRent + prevData.payroll + prevData.otherExpense)
    : 0;
  const profitDelta = prevData ? pctDelta(data.netProfit, prevData.netProfit) : 0;

  const grossMargin = data.income > 0 ? Math.round((data.grossProfit / data.income) * 100) : 0;

  const categories = (
    [
      { key: "ownerRent", label: t("transactionTypeRentPaidToOwner"), value: data.ownerRent },
      { key: "payroll", label: t("transactionTypePayrollExpense"), value: data.payroll },
      { key: "maintenance", label: t("expenseTypeMaintenance"), value: data.maintenance },
      { key: "other", label: t("expenseTypeOther"), value: data.other },
    ] as const
  ).filter((c) => c.value > 0);
  const categoryTotal = categories.reduce((sum, c) => sum + c.value, 0);

  let cumulative = 0;
  const conicStops = categories
    .map((c) => {
      const start = (cumulative / categoryTotal) * 100;
      cumulative += c.value;
      const end = (cumulative / categoryTotal) * 100;
      return `${CATEGORY_COLORS[c.key]} ${start}% ${end}%`;
    })
    .join(", ");

  const maxAbsNet = Math.max(1, ...months.map((m) => Math.abs(m.netProfit)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Select
          value={selectedMonth}
          onValueChange={(v) => setSelectedMonth(v ?? defaultMonth)}
          items={months.map((m) => ({ value: m.month, label: monthLabels.get(m.month)?.full ?? m.month }))}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.month} value={m.month}>
                {monthLabels.get(m.month)?.full ?? m.month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hero: gross → net */}
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl bg-card p-5 ring-1 ring-(--card-ring) shadow-(--shadow-sm)">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Wallet className="size-3.5" />
            {t("grossProfit")}
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{formatTaka(data.grossProfit)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatTaka(data.income)} − {formatTaka(data.ownerRent)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.max(0, Math.min(100, grossMargin))}%` }}
            />
          </div>
        </div>

        <div className="flex flex-row items-center justify-center gap-2 text-center md:flex-col">
          <ArrowRight className="size-5 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t("lessOperatingCost")}</p>
            <p className="font-mono text-sm font-semibold text-destructive">
              −{formatTaka(data.payroll + data.otherExpense)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-card p-5 ring-1 ring-(--card-ring) shadow-(--shadow-sm)">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              {t("netProfit")}
            </div>
            {prevData ? <DeltaBadge pct={profitDelta} /> : null}
          </div>
          <p className={cn("mt-2 font-mono text-2xl font-bold tabular-nums", data.netProfit < 0 && "text-destructive")}>
            {formatTaka(data.netProfit)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatTaka(data.grossProfit)} − {formatTaka(data.payroll + data.otherExpense)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", data.netProfit >= 0 ? "bg-success" : "bg-destructive")}
              style={{ width: `${Math.max(2, Math.min(100, Math.abs(data.margin)))}%` }}
            />
          </div>
        </div>
      </div>

      {/* P&L waterfall */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {monthLabels.get(data.month)?.full} — {t("pnlStatement")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            { label: t("expectedIncome"), value: data.income, tone: "bg-success", pct: 100 },
            { label: t("transactionTypeRentPaidToOwner"), value: -data.ownerRent, tone: "bg-destructive/70", pct: (data.ownerRent / Math.max(1, data.income)) * 100 },
            { label: `= ${t("grossProfit")}`, value: data.grossProfit, tone: "bg-blue-500", pct: (data.grossProfit / Math.max(1, data.income)) * 100, muted: true },
            { label: t("transactionTypePayrollExpense"), value: -data.payroll, tone: "bg-destructive/70", pct: (data.payroll / Math.max(1, data.income)) * 100 },
            { label: t("otherOperatingExpense"), value: -data.otherExpense, tone: "bg-destructive/70", pct: (data.otherExpense / Math.max(1, data.income)) * 100 },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[180px_1fr_auto]">
              <span className={cn("text-sm", row.muted ? "text-muted-foreground" : "font-medium")}>{row.label}</span>
              <div className="hidden h-2 w-full overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className={cn("h-full rounded-full", row.tone)}
                  style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-right font-mono text-sm font-semibold tabular-nums",
                  row.value < 0 ? "text-destructive" : row.muted ? "text-muted-foreground" : "text-success"
                )}
              >
                {row.value < 0 ? "−" : ""}
                {formatTaka(Math.abs(row.value))}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t pt-3 sm:grid-cols-[180px_1fr_auto]">
            <span className="text-sm font-semibold">{t("netProfit")}</span>
            <div className="hidden h-2.5 w-full overflow-hidden rounded-full bg-muted sm:block">
              <div
                className={cn("h-full rounded-full", data.netProfit >= 0 ? "bg-success" : "bg-destructive")}
                style={{ width: `${Math.max(2, Math.min(100, Math.abs(data.margin)))}%` }}
              />
            </div>
            <span
              className={cn(
                "text-right font-mono text-base font-bold tabular-nums",
                data.netProfit >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatTaka(data.netProfit)}
            </span>
          </div>

          {prevData ? (
            <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("margin")}</p>
                <p className={cn("font-mono text-sm font-semibold tabular-nums", data.margin >= 0 ? "text-success" : "text-destructive")}>
                  {data.margin}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("incomeChange")}</p>
                <DeltaBadge pct={incomeDelta} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("expenseChange")}</p>
                <DeltaBadge pct={expenseDelta} invert />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("profitChange")}</p>
                <DeltaBadge pct={profitDelta} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Trend + category breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("sixMonthTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end justify-between gap-2">
              {months.map((m) => {
                const height = Math.max(4, (Math.abs(m.netProfit) / maxAbsNet) * 100);
                const active = m.month === selectedMonth;
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setSelectedMonth(m.month)}
                    className={cn(
                      "flex h-full flex-1 flex-col items-center justify-end gap-1.5 rounded-md px-1 py-1.5 transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {m.netProfit >= 0 ? "" : "−"}
                      {formatTaka(Math.abs(m.netProfit)).replace("৳", "")}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={cn(
                          "w-full rounded-t-sm",
                          m.netProfit >= 0 ? "bg-success" : "bg-destructive",
                          active && "ring-2 ring-primary ring-offset-1"
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className={cn("text-xs", active ? "font-semibold text-primary" : "text-muted-foreground")}>
                      {monthLabels.get(m.month)?.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("expenseBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {categoryTotal > 0 ? (
              <>
                <div
                  className="relative flex size-32 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(${conicStops})` }}
                >
                  <div className="flex size-20 flex-col items-center justify-center rounded-full bg-card text-center">
                    <span className="text-[10px] text-muted-foreground">{t("total")}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums">{formatTaka(categoryTotal)}</span>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-1.5">
                  {categories.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[c.key] }}
                      />
                      <span className="flex-1 truncate">{c.label}</span>
                      <span className="font-mono tabular-nums">{formatTaka(c.value)}</span>
                      <span className="w-9 text-right font-mono text-muted-foreground tabular-nums">
                        {Math.round((c.value / categoryTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noExpenses")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-property P&L */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("propertyWisePL")}</CardTitle>
          <span className="text-xs text-muted-foreground">{t("sortedByProfit")}</span>
        </CardHeader>
        <CardContent>
          {propertyRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>
          ) : (
            <>
            <div className="flex flex-col gap-2 md:hidden">
              {propertyRows.map((r) => {
                const isCompanyRow = r.propertyId === COMPANY_KEY;
                const TypeIcon = isCompanyRow ? Users : getTypeIcon(t, r.propertyType);
                return (
                  <div key={r.propertyId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {isCompanyRow ? t("companyExpenseRowLabel") : r.propertyName}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-sm font-semibold tabular-nums",
                          r.netProfit >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {formatTaka(r.netProfit)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", r.margin >= 0 ? "bg-success" : "bg-destructive")}
                        style={{ width: `${Math.max(2, Math.min(100, Math.abs(r.margin)))}%` }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t("expectedColumn")}</p>
                        <p className="font-mono tabular-nums">{formatTaka(r.income)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("totalExpense")}</p>
                        <p className="font-mono tabular-nums text-muted-foreground">
                          {formatTaka(r.ownerRent + r.payroll + r.otherExpense)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("margin")}</p>
                        <p
                          className={cn(
                            "font-mono tabular-nums",
                            r.margin >= 15 ? "text-success" : r.margin >= 0 ? "text-warning" : "text-destructive"
                          )}
                        >
                          {r.margin}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">{t("total")}</span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    totals.netProfit >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {formatTaka(totals.netProfit)}
                </span>
              </div>
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("propertyLabel")}</TableHead>
                  <TableHead className="text-right">{t("expectedColumn")}</TableHead>
                  <TableHead className="text-right">{t("leaseColumn")}</TableHead>
                  <TableHead className="text-right">{t("totalExpense")}</TableHead>
                  <TableHead className="text-right">{t("netProfit")}</TableHead>
                  <TableHead className="text-right">{t("margin")}</TableHead>
                  <TableHead>{t("visualColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyRows.map((r) => {
                  const isCompanyRow = r.propertyId === COMPANY_KEY;
                  const TypeIcon = isCompanyRow ? Users : getTypeIcon(t, r.propertyType);
                  return (
                    <TableRow key={r.propertyId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="size-3.5 text-muted-foreground" />
                          {isCompanyRow ? t("companyExpenseRowLabel") : r.propertyName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatTaka(r.income)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {formatTaka(r.ownerRent)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {formatTaka(r.payroll + r.otherExpense)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums",
                          r.netProfit >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {formatTaka(r.netProfit)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums",
                          r.margin >= 15 ? "text-success" : r.margin >= 0 ? "text-warning" : "text-destructive"
                        )}
                      >
                        {r.margin}%
                      </TableCell>
                      <TableCell>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", r.margin >= 0 ? "bg-success" : "bg-destructive")}
                            style={{ width: `${Math.max(2, Math.min(100, Math.abs(r.margin)))}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-muted-foreground">{t("total")}</TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {formatTaka(totals.income)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatTaka(totals.ownerRent)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatTaka(totals.otherExpense)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold tabular-nums",
                      totals.netProfit >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatTaka(totals.netProfit)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
