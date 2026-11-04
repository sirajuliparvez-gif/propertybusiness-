import Image from "next/image";
import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Building2, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportMonthSelect } from "@/components/properties/report-month-select";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { getMonthlySalaryReport } from "@/lib/monthly-salary-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";

export default async function MonthlySalaryReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const [t, nav, locale, report] = await Promise.all([
    getTranslations("Properties"), getTranslations("Nav"), getLocale(), getMonthlySalaryReport(requested),
  ]);
  const { rows, totals, month, months } = report;
  const groups = rows.reduce((groups, row) => {
    const key = row.propertyId ?? "__company__";
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group); return groups;
  }, new Map<string, typeof rows>());
  const labels = [t("salaryReportStaff"), t("invoiceSalaryDueLabel"), t("invoiceSalaryPaidLabel"), t("salaryReportOutstanding"), t("salaryReportPaymentDate"), t("utilityReportStatus")];
  const statusLabels = { PAID: t("paid"), PARTIAL: t("utilityReportPartial"), PENDING: t("salaryReportUnpaid") };
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" render={<Link href="/employees" />} nativeButton={false}><ArrowLeft className="size-4" />{t("staff")}</Button>
      <div className="flex flex-wrap items-center gap-2">
        <ReportMonthSelect month={month} months={months} basePath="/employees/report" />
        <InvoicePrintButton />
      </div>
    </div>
    <article data-testid="invoice" className={`${styles.report} ${styles.salaryPrint}`}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}><Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} /><p className={styles.brandName}>{nav("brand")}</p></div>
          <h1 className={styles.title}>{t("salaryReportTitle")}</h1>
        </div>
        <div className={styles.metadata}>
          <span className={styles.month}>{monthLabel(month, locale)}</span>
          <p>{t("salaryReportCount", { count: rows.length })}</p>
          <ReportPrintMetadata initialDate={formatDate(new Date(), locale)} locale={locale} dateLabel={t("monthlyReportPrintDate")}
            pageLabel={t("monthlyReportPage")} title={`${nav("brand")} · ${t("salaryReportTitle")}`} month={monthLabel(month, locale)} pageName="monthlySalaryReport" />
        </div>
      </header>
      <dl className={styles.summary}>
        {[[t("invoiceSalaryDueLabel"), formatTaka(totals.due)], [t("invoiceSalaryPaidLabel"), formatTaka(totals.paid)], [t("salaryReportOutstanding"), formatTaka(totals.remaining)], [t("salaryReportPendingStaff"), new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(totals.unpaidStaff)]].map(([label, value], index) =>
          <div key={label} className={styles.metric}><dt>{label}</dt><dd className={index === 1 ? styles.collected : index === 2 ? styles.remaining : undefined}>{value}</dd></div>)}
      </dl>
      <p className={styles.note}>{t("salaryReportBasis")}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">{t("salaryReportTitle")} — {monthLabel(month, locale)}</caption>
          <thead><tr>{labels.map((label, index) => <th key={label} scope="col" className={index > 0 && index < 4 ? "text-right" : "text-left"}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">{t("salaryReportEmpty")}</td></tr> : [...groups].map(([key, staff]) => <Fragment key={key}>
              <tr className={styles.property}><th scope="rowgroup" colSpan={6}><span className={styles.propertyName}>{key === "__company__" ? <Users className="size-4 print:hidden" /> : <Building2 className="size-4 print:hidden" />}{staff[0].propertyName ?? t("companyStaffLabel")}</span></th></tr>
              {staff.map((employee) => <tr key={employee.id} className={styles.tenant}>
                <th scope="row" className={`${styles.name} text-left`}>{employee.name}<span className={styles.billDetail}>{employee.role}</span></th>
                {[employee.due, employee.paid, employee.remaining].map((value, index) => <td key={index} className={`${styles.number} ${index === 2 && value > 0 ? styles.remaining : index === 1 && value > 0 ? styles.collected : ""}`}>{formatTaka(value)}</td>)}
                <td className="whitespace-nowrap">{employee.paidAt ? formatDate(employee.paidAt, locale) : "—"}</td>
                <td className="whitespace-nowrap">{statusLabels[employee.status]}</td>
              </tr>)}
            </Fragment>)}
          </tbody>
          <tfoot><tr className={styles.total}><th scope="row" className="text-left">{t("total")}</th>
            {[totals.due, totals.paid, totals.remaining].map((value, index) => <td key={index} className={styles.number}>{formatTaka(value)}</td>)}<td colSpan={2} />
          </tr></tfoot>
        </table>
      </div>
      <footer className={styles.footer}>
        {totals.credit > 0 && <p className="mb-3 text-sm">{t("salaryReportCredit", { amount: formatTaka(totals.credit) })}</p>}
        <p className={styles.scope}>{t("salaryReportScope")}</p>
        <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
      </footer>
    </article>
  </div>;
}
