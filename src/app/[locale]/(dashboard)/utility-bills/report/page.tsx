import Image from "next/image";
import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportMonthSelect } from "@/components/properties/report-month-select";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { getMonthlyUtilityReport } from "@/lib/monthly-utility-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";

const typeKeys = { ELECTRICITY: "utilityTypeElectricity", GAS: "utilityTypeGas", WATER: "utilityTypeWater", OTHER: "utilityTypeOther" } as const;

export default async function MonthlyUtilityReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const [t, nav, locale, report] = await Promise.all([
    getTranslations("Properties"), getTranslations("Nav"), getLocale(), getMonthlyUtilityReport(requested),
  ]);
  const { rows, totals, month, months } = report;
  const groups = rows.reduce((groups, row) => {
    const group = groups.get(row.propertyId) ?? [];
    group.push(row); groups.set(row.propertyId, group); return groups;
  }, new Map<string, typeof rows>());
  const columns = [t("utilityReportBill"), t("utilityType"), t("utilityReportBilled"), t("utilityReportCollected"), t("utilityReportCompany"), t("transactionTypeUtilityProfit"), t("monthlyReportRemaining"), t("utilityReportStatus")];
  const statusLabels = { PAID: t("paid"), PARTIAL: t("utilityReportPartial"), UNPAID: t("billStatusUnpaid") };
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" render={<Link href="/utility-bills" />} nativeButton={false}><ArrowLeft className="size-4" />{t("utilityBillsSection")}</Button>
      <div className="flex flex-wrap items-center gap-2">
        <ReportMonthSelect month={month} months={months} basePath="/utility-bills/report" />
        <InvoicePrintButton />
      </div>
    </div>
    <article data-testid="invoice" className={`${styles.report} ${styles.utilityPrint}`}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}><Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} /><p className={styles.brandName}>{nav("brand")}</p></div>
          <h1 className={styles.title}>{t("utilityReportTitle")}</h1>
        </div>
        <div className={styles.metadata}>
          <span className={styles.month}>{monthLabel(month, locale)}</span>
          <p>{t("utilityReportBillCount", { count: rows.length })}</p>
          <ReportPrintMetadata initialDate={formatDate(new Date(), locale)} locale={locale} dateLabel={t("monthlyReportPrintDate")}
            pageLabel={t("monthlyReportPage")} title={`${nav("brand")} · ${t("utilityReportTitle")}`} month={monthLabel(month, locale)} pageName="monthlyUtilityReport" />
        </div>
      </header>
      <dl className={styles.summary}>
        {[[t("utilityReportBilled"), totals.billed], [t("utilityReportSettled"), totals.settled], [t("utilityReportCollected"), totals.collected], [t("monthlyReportRemaining"), totals.remaining]].map(([label, value], index) =>
          <div key={label} className={styles.metric}><dt>{label}</dt><dd className={index === 2 ? styles.collected : index === 3 ? styles.remaining : undefined}>{formatTaka(Number(value))}</dd></div>)}
      </dl>
      <p className={styles.note}>{t("utilityReportBasis")}</p>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.utilityTable}`}>
          <caption className="sr-only">{t("utilityReportTitle")} — {monthLabel(month, locale)}</caption>
          <thead><tr>{columns.map((label, index) => <th key={label} scope="col" className={index > 1 && index < 7 ? "text-right" : "text-left"}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">{t("utilityReportEmpty")}</td></tr> : [...groups].map(([id, bills]) => <Fragment key={id}>
              <tr className={styles.property}><th scope="rowgroup" colSpan={8}><span className={styles.propertyName}><Building2 className="size-4 print:hidden" />{bills[0].propertyName}</span></th></tr>
              {bills.map((bill) => <tr key={bill.id} className={styles.tenant}>
                <th scope="row" className={`${styles.name} text-left`}>{bill.unitLabel ?? t("utilityReportPropertyBill")}{bill.unitLabel && <span className={styles.billDetail}>{bill.tenantName ?? t("utilityReportTenantUnknown")}</span>}</th>
                <td>{t(typeKeys[bill.type])}</td>
                {[bill.billed, bill.collected, bill.company, bill.profit, bill.remaining].map((value, index) => <td key={index} className={`${styles.number} ${index === 4 && value > 0 ? styles.remaining : index === 1 && value > 0 ? styles.collected : ""}`}>{formatTaka(value)}</td>)}
                <td className="whitespace-nowrap">{statusLabels[bill.status as keyof typeof statusLabels]}</td>
              </tr>)}
            </Fragment>)}
          </tbody>
          <tfoot><tr className={styles.total}><th colSpan={2} scope="row" className="text-left">{t("total")}</th>
            {[totals.billed, totals.collected, totals.company, totals.profit, totals.remaining].map((value, index) => <td key={index} className={styles.number}>{formatTaka(value)}</td>)}<td />
          </tr></tfoot>
        </table>
      </div>
      <footer className={styles.footer}>
        {totals.unclassified > 0 && <p className="mb-3 text-sm">{t("utilityReportUnclassified", { amount: formatTaka(totals.unclassified) })}</p>}
        <p className={styles.scope}>{t("utilityReportScope")}</p>
        <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
      </footer>
    </article>
  </div>;
}
