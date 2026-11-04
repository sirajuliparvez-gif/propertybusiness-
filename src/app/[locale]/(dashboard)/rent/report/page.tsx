import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Fragment } from "react";
import styles from "./report.module.css";
import { ReportPrintMetadata } from "./print-metadata";
import { ReportMonthSelect } from "./month-select";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { getMonthlyRentReport } from "@/lib/monthly-rent-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";

export default async function MonthlyRentReportPage({ searchParams }: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: requestedMonth } = await searchParams;
  const [t, nav, locale, report] = await Promise.all([
    getTranslations("Properties"), getTranslations("Nav"), getLocale(), getMonthlyRentReport(requestedMonth),
  ]);
  const { rows, totals, month, months } = report;
  const generatedDate = formatDate(new Date(), locale);
  const propertyGroups = rows.reduce((groups, row) => {
    const group = groups.get(row.propertyName) ?? [];
    group.push(row);
    groups.set(row.propertyName, group);
    return groups;
  }, new Map<string, typeof rows>());
  const columns = [t("tenantName"), t("monthlyReportUnitNumber"), t("monthlyReportDue"), t("monthlyReportCollected"), t("monthlyReportAdjusted"), t("monthlyReportRemaining")];
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" render={<Link href={`/rent?month=${month}`} />} nativeButton={false}>
          <ArrowLeft className="size-4" />{t("rentCollectionTitle")}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <ReportMonthSelect month={month} months={months} />
          <InvoicePrintButton />
        </div>
      </div>
      <article data-testid="invoice" className={`monthly-rent-report ${styles.report}`}>
        <header className={styles.header}>
          <div>
            <div className={styles.brand}>
              <Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} />
              <p className={styles.brandName}>{nav("brand")}</p>
            </div>
            <h1 className={styles.title}>{t("monthlyReportTitle")}</h1>
          </div>
          <div className={styles.metadata}>
            <span className={styles.month}>{monthLabel(month, locale)}</span>
            <p>{t("monthlyReportGenerated", { date: generatedDate, count: rows.length })}</p>
            <ReportPrintMetadata initialDate={generatedDate} locale={locale}
              dateLabel={t("monthlyReportPrintDate")} pageLabel={t("monthlyReportPage")}
              title={`${nav("brand")} · ${t("monthlyReportTitle")}`} month={monthLabel(month, locale)} />
          </div>
        </header>
        <dl className={styles.summary}>
          {[
            [t("monthlyReportDue"), totals.due], [t("monthlyReportCollected"), totals.collected],
            [t("monthlyReportAdjusted"), totals.adjusted], [t("monthlyReportRemaining"), totals.remaining],
          ].map(([label, amount], index) => <div key={label} className={styles.metric}>
            <dt>{label}</dt>
            <dd className={index === 1 ? styles.collected : index === 3 ? styles.remaining : undefined}>{formatTaka(Number(amount))}</dd>
          </div>)}
        </dl>
        <p className={styles.note}>{t("monthlyReportBasis")}</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t("monthlyReportTitle")} — {monthLabel(month, locale)}</caption>
            <thead>
              <tr>
              {columns.map((column, i) => <th key={column} scope="col" className={i < 2 ? "text-left" : "text-right"}>{column}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={6} className="px-2 py-10 text-center text-muted-foreground">{t("monthlyReportEmpty")}</td></tr> : [...propertyGroups].map(([propertyName, propertyRows]) => <Fragment key={propertyName}>
                <tr className={styles.property}><th scope="rowgroup" colSpan={6}>
                  <span className={styles.propertyName}><Building2 className="size-4 print:hidden" />{propertyName}</span>
                </th></tr>
                {propertyRows.map((row) => <tr key={row.id} className={styles.tenant}>
                  <th scope="row" className={`${styles.name} text-left`}>{row.tenantName}</th>
                  <td className={styles.unit}>{row.unitLabel}</td>
                  {[row.due, row.collected, row.adjusted, row.remaining].map((value, index) => <td key={index} className={`${styles.number} ${value > 0 && index === 1 ? styles.collected : value > 0 && index === 3 ? styles.remaining : ""}`}>{formatTaka(value)}</td>)}
                </tr>)}
              </Fragment>)}
            </tbody>
            <tfoot><tr className={styles.total}>
              <th scope="row" colSpan={2} className="text-left">{t("total")}</th>
              {[totals.due, totals.collected, totals.adjusted, totals.remaining].map((value, index) => <td key={index} className={styles.number}>{formatTaka(value)}</td>)}
            </tr></tfoot>
          </table>
        </div>
        <footer className={styles.footer}>
        {totals.credit > 0 && <p className="mt-3 text-sm">{t("monthlyReportCredit", { amount: formatTaka(totals.credit) })}</p>}
        <p className={styles.scope}>{t("monthlyReportScope")}</p>
        <div className={styles.signatures}>
          <p>{t("monthlyReportPreparedBy")}</p>
          <p>{t("monthlyReportApprovedBy")}</p>
        </div>
        </footer>
      </article>
    </div>
  );
}
