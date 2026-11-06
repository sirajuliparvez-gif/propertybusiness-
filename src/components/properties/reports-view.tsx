"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import styles from "./financial-report.module.css";
import { InvoicePrintButton } from "./invoice-print-button";
import { ReportPrintMetadata } from "./report-print-metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  utility: "oklch(0.7 0.18 25)",
  maintenance: "oklch(0.65 0.18 55)",
  other: "oklch(0.6 0.03 260)",
} as const;

export function ReportsView({ months, propertyPLByMonth, defaultMonth, generatedDate, labels }: ReportsData & { generatedDate: string; labels: Record<string, { full: string; short: string }> }) {
  const t = useTranslations("Properties");
  const nav = useTranslations("Nav");
  const locale = useLocale();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // ICU abbreviations differ between Node and WebKit for Bengali months.
  // Use the server snapshot on both renders to keep hydration stable.
  const monthLabels = new Map(Object.entries(labels));

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

  const categories = (
    [
      { key: "ownerRent", label: t("transactionTypeRentPaidToOwner"), value: data.ownerRent },
      { key: "payroll", label: t("transactionTypePayrollExpense"), value: data.payroll },
      { key: "utility", label: t("expenseTypeUtility"), value: data.utility },
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

  const expense = data.ownerRent + data.payroll + data.otherExpense;
  const statement = [
    { label: t("financialReportIncome"), amount: data.income },
    { label: t("transactionTypeRentPaidToOwner"), amount: -data.ownerRent },
    { label: t("grossProfit"), amount: data.grossProfit, subtotal: true },
    { label: t("transactionTypePayrollExpense"), amount: -data.payroll },
    { label: t("expenseTypeUtility"), amount: -data.utility },
    { label: t("expenseTypeMaintenance"), amount: -data.maintenance },
    { label: t("expenseTypeOther"), amount: -data.other },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <Button variant="outline" render={<Link href={`/reports/market?month=${data.month}`} />} nativeButton={false}>
          <FileText className="size-4" />{t("marketMonthlyReportTitle")}
        </Button>
        <label className="sr-only" htmlFor="financial-report-month">{t("rentMonthFilter")}</label>
        <select id="financial-report-month" value={data.month} onChange={(event) => setSelectedMonth(event.target.value)}
          className="h-10 rounded-lg border bg-card px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {[...months].reverse().map((m) => <option key={m.month} value={m.month}>{monthLabels.get(m.month)?.full}</option>)}
        </select>
        <InvoicePrintButton />
      </div>
      <article data-testid="invoice" className={`${styles.report} ${styles.financialPrint}`}>
        <header className={styles.header}>
          <div>
            <div className={styles.brand}>
              <Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} />
              <p className={styles.brandName}>{nav("brand")}</p>
            </div>
            <h2 className={styles.title}>{t("financialReportTitle")}</h2>
          </div>
          <div className={styles.metadata}>
            <span className={styles.month}>{monthLabels.get(data.month)?.full}</span>
            <ReportPrintMetadata initialDate={generatedDate} locale={locale} dateLabel={t("monthlyReportPrintDate")}
              pageLabel={t("monthlyReportPage")} title={`${nav("brand")} · ${t("financialReportTitle")}`}
              month={monthLabels.get(data.month)?.full ?? data.month} pageName="monthlyFinancialReport" />
          </div>
        </header>
        <dl className={styles.summary}>
          {[
            [t("financialReportIncome"), data.income], [t("totalExpense"), expense],
            [t("grossProfit"), data.grossProfit], [t("netProfit"), data.netProfit],
          ].map(([label, value], index) => <div key={label} className={styles.metric}>
            <dt>{label}</dt>
            <dd className={index === 1 || Number(value) < 0 ? styles.remaining : index === 0 || index === 3 ? styles.collected : undefined}>{formatTaka(Number(value))}</dd>
          </div>)}
        </dl>
        <p className={styles.note}>{t("financialReportBasis")}</p>
        <h3 className={styles.sectionTitle}>{t("pnlStatement")}</h3>
        <table className={`${styles.table} ${styles.statement}`}>
          <caption className="sr-only">{t("pnlStatement")} — {monthLabels.get(data.month)?.full}</caption>
          <tbody>
            {statement.map((row) => <tr key={row.label} className={row.subtotal ? styles.total : undefined}>
              <th scope="row" className="text-left font-medium">{row.label}</th>
              <td className={`${styles.number} ${row.amount < 0 ? styles.remaining : ""}`}>{formatTaka(row.amount || 0)}</td>
            </tr>)}
          </tbody>
          <tfoot><tr className={styles.total}>
            <th scope="row" className="text-left">{t("netProfit")}</th>
            <td className={`${styles.number} ${data.netProfit < 0 ? styles.remaining : styles.collected}`}>{formatTaka(data.netProfit)}</td>
          </tr></tfoot>
        </table>
        <h3 className={styles.sectionTitle}>{t("propertyWisePL")}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t("propertyWisePL")} — {monthLabels.get(data.month)?.full}</caption>
            <thead><tr>
              {[t("propertyLabel"), t("financialReportIncome"), t("transactionTypeRentPaidToOwner"), t("financialReportOperatingExpense"), t("netProfit"), t("margin")].map((label, i) =>
                <th key={label} scope="col" className={i === 0 ? "text-left" : "text-right"}>{label}</th>)}
            </tr></thead>
            <tbody>
              {propertyRows.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("noTransactions")}</td></tr> : propertyRows.map((row) => <tr key={row.propertyId} className={styles.tenant}>
                <th scope="row" className={`${styles.name} text-left`}>{row.propertyId === COMPANY_KEY ? t("companyExpenseRowLabel") : (
                  <>
                    <Link className="text-primary underline-offset-4 hover:underline print:hidden"
                      href={`/reports/market?month=${data.month}&market=${row.propertyId}`}>{row.propertyName}</Link>
                    <span className="hidden print:inline">{row.propertyName}</span>
                  </>
                )}</th>
                {[row.income, row.ownerRent, row.payroll + row.otherExpense, row.netProfit].map((value, index) =>
                  <td key={index} className={`${styles.number} ${index === 3 ? value < 0 ? styles.remaining : styles.collected : ""}`}>{formatTaka(value)}</td>)}
                <td className={styles.number}>{row.margin}%</td>
              </tr>)}
            </tbody>
            <tfoot><tr className={styles.total}>
              <th scope="row" className="text-left">{t("total")}</th>
              {[totals.income, totals.ownerRent, totals.otherExpense, totals.netProfit].map((value, index) =>
                <td key={index} className={styles.number}>{formatTaka(value)}</td>)}
              <td className={styles.number}>{totals.income > 0 ? Math.round(totals.netProfit / totals.income * 1000) / 10 : 0}%</td>
            </tr></tfoot>
          </table>
        </div>
        <footer className={styles.footer}>
          <p className={styles.scope}>{t("financialReportScope")}</p>
          <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
        </footer>
      </article>
      <div className="flex flex-col gap-4 print:hidden">
        {prevData && <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>{t("incomeChange")}: <DeltaBadge pct={incomeDelta} /></span>
          <span>{t("expenseChange")}: <DeltaBadge pct={expenseDelta} invert /></span>
          <span>{t("profitChange")}: <DeltaBadge pct={profitDelta} /></span>
        </div>}
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

      </div>
    </div>
  );
}
