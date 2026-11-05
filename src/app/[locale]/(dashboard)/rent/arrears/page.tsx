import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { RentArrearsLedger } from "@/components/properties/rent-arrears-ledger";
import clean from "@/components/properties/rent-arrears.module.css";
import { getRentArrearsReport } from "@/lib/rent-arrears-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";

export default async function RentArrearsPage({ searchParams }: {
  searchParams: Promise<{ from?: string; to?: string; property?: string; tenant?: string; show?: string }>;
}) {
  const requested = await searchParams;
  const [report, t, p, nav, locale] = await Promise.all([
    getRentArrearsReport(requested), getTranslations("RentArrears"), getTranslations("Properties"), getTranslations("Nav"), getLocale(),
  ]);
  const period = `${monthLabel(report.from, locale)} – ${monthLabel(report.to, locale)}`;
  const generatedDate = formatDate(new Date(), locale);
  const columns = [t("month"), t("billed"), p("monthlyReportCollected"), p("monthlyReportAdjusted"), p("monthlyReportRemaining"), t("overdue")];
  const amounts = (totals: typeof report.totals) => [totals.due, totals.collected, totals.adjusted, totals.remaining, totals.overdue];
  const monthly = report.months.map((month) => ({ month, totals: report.rows.reduce((sum, tenant) => {
    const row = tenant.months.find((entry) => entry.month === month);
    if (row) for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += row[key];
    return sum;
  }, { due: 0, collected: 0, adjusted: 0, settled: 0, remaining: 0, credit: 0, overdue: 0 }) }));
  const selectedProperty = report.properties.find((property) => property.id === report.property)?.name;
  const selectedTenant = report.tenantOptions.find((tenant) => tenant.id === report.tenant)?.name;
  const returnParams = new URLSearchParams({ from: report.from, to: report.to });
  if (report.property) returnParams.set("property", report.property);
  if (report.tenant) returnParams.set("tenant", report.tenant);
  if (report.includeSettled) returnParams.set("show", "all");
  const filterClass = "h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm";
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" render={<Link href="/rent" />} nativeButton={false}><ArrowLeft className="size-4" />{p("rentCollectionTitle")}</Button>
      <InvoicePrintButton />
    </div>
    <details className={`${clean.filters} print:hidden`}><summary>{t("filters")} · {period}</summary>
    <form action={`/${locale}/rent/arrears`} method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0 space-y-1 text-xs font-medium">{t("from")}<input aria-label={t("from")} type="month" name="from" required defaultValue={report.from} min={report.earliest} max={report.currentMonth} className={filterClass} /></label>
      <label className="min-w-0 space-y-1 text-xs font-medium">{t("to")}<input aria-label={t("to")} type="month" name="to" required defaultValue={report.to} min={report.earliest} max={report.currentMonth} className={filterClass} /></label>
      <label className="min-w-0 space-y-1 text-xs font-medium">{t("property")}<select aria-label={t("property")} name="property" defaultValue={report.property} className={filterClass}>
        <option value="">{t("allProperties")}</option>{report.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
      </select></label>
      <label className="min-w-0 space-y-1 text-xs font-medium">{p("tenantName")}<select aria-label={p("tenantName")} name="tenant" defaultValue={report.tenant} className={filterClass}>
        <option value="">{t("allTenants")}</option>{report.tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.unit} · {tenant.propertyName}</option>)}
      </select></label>
      <label className="min-w-0 space-y-1 text-xs font-medium">{t("show")}<select aria-label={t("show")} name="show" defaultValue={report.includeSettled ? "all" : "owing"} className={filterClass}>
        <option value="owing">{t("owingOnly")}</option><option value="all">{t("includeSettled")}</option>
      </select></label>
      <Button type="submit" className="self-end">{t("apply")}</Button>
    </form></details>
    <article data-testid="invoice" className={`${styles.report} ${styles.arrearsPrint}`}>
      <header className={clean.header}>
        <div><div className={clean.brandRow}><Image src="/logo.jpg" alt="" width={36} height={36} unoptimized /><p className={clean.brand}>{nav("brand")}</p></div><h1>{t("title")}</h1><p className={clean.period}>{period} · {selectedProperty ?? t("allProperties")}{selectedTenant ? ` · ${selectedTenant}` : ""}</p></div>
        <div className={clean.metadata}><ReportPrintMetadata pageName="rentArrearsReport" initialDate={generatedDate} locale={locale} dateLabel={p("monthlyReportPrintDate")} pageLabel={p("monthlyReportPage")} title={`${nav("brand")} · ${t("title")}`} month={period} /></div>
      </header>
      <div className={clean.printBrand}><Image src="/logo.jpg" alt="" width={48} height={48} unoptimized /><div><strong>{nav("brand")}</strong><h1>{t("title")}</h1><p>{period}{selectedProperty ? ` · ${selectedProperty}` : ""}</p></div></div>
      <dl className={clean.overview}>
        <div><dt>{t("totalOutstanding")}</dt><dd className={clean.mainBalance}>{formatTaka(report.totals.remaining)}</dd></div>
        <div><dt>{t("overdue")}</dt><dd>{formatTaka(report.totals.overdue)}</dd></div>
        <div><dt>{t("inPaymentWindow")}</dt><dd>{formatTaka(report.totals.remaining - report.totals.overdue)}</dd></div>
        <div className={clean.count}><dt className="sr-only">{t("show")}</dt><dd>{t("tenantCount", { count: report.owingTenants })}{report.includeSettled ? ` · ${t("includeSettled")}` : ""}</dd></div>
      </dl>
      <div className={clean.printNotes}>
        <p>{t("scope")}</p><p>{t("cutover")}</p>
        {report.totals.credit > 0 && <p>{p("monthlyReportCredit", { amount: formatTaka(report.totals.credit) })}</p>}
        <div className={clean.printSignatures}><span>{p("monthlyReportPreparedBy")}: __________________</span><span>{p("monthlyReportApprovedBy")}: __________________</span></div>
      </div>
      <RentArrearsLedger key={`${report.from}-${report.to}-${report.property}-${report.tenant}-${report.includeSettled}`} tenants={report.rows} monthLabels={Object.fromEntries(report.months.map((month) => [month, monthLabel(month, locale)]))} selectedTenant={report.tenant} arrearsPeriod={{ from: report.from, to: report.to }} returnTo={`/rent/arrears?${returnParams}`} />
      <details className={`${clean.notes} print:hidden`}><summary>{t("monthlySummary")}</summary>
      <div className={styles.tableWrap}><table className={styles.table}>
        <caption className="sr-only">{t("monthlySummary")}</caption>
        <thead><tr>{columns.map((column, index) => <th key={column} scope="col" className={index ? "text-right" : "text-left"}>{column}</th>)}</tr></thead>
        <tbody>{monthly.map(({ month, totals }) => <tr key={month} className={styles.tenant}><th scope="row" className="text-left">{monthLabel(month, locale)}</th>{amounts(totals).map((amount, index) => <td key={index} className={`${styles.number} ${index >= 3 && amount > 0 ? styles.remaining : ""}`}>{formatTaka(amount)}</td>)}</tr>)}</tbody>
        <tfoot><tr className={styles.total}><th scope="row" className="text-left">{p("total")}</th>{amounts(report.totals).map((amount, index) => <td key={index} className={styles.number}>{formatTaka(amount)}</td>)}</tr></tfoot>
      </table></div>
      </details>
      <details className={`${clean.notes} print:hidden`}><summary>{t("calculationNotes")}</summary><p>{t("basis")}</p><p>{t("cutover")}</p><p>{t("overdueNote", { amount: formatTaka(report.totals.overdue) })}</p></details>
      <footer className={`${styles.footer} ${clean.reportFooter}`}>
        {report.totals.credit > 0 && <p className={styles.scope}>{p("monthlyReportCredit", { amount: formatTaka(report.totals.credit) })}</p>}
        <p className={styles.scope}>{t("scope")}</p><p className="hidden print:block">{t("cutover")}</p>
        <div className={styles.signatures}><p>{p("monthlyReportPreparedBy")}</p><p>{p("monthlyReportApprovedBy")}</p></div>
      </footer>
    </article>
  </div>;
}
