import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportMonthSelect } from "@/components/properties/report-month-select";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { getMonthlyTransactionReport } from "@/lib/monthly-transaction-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";

const typeKeys: Record<string, string> = {
  RENT_RECEIVED_FROM_TENANT: "transactionTypeRentReceived", RENT_PAID_TO_OWNER: "transactionTypeRentPaidToOwner",
  DOWNPAYMENT_PAID_TO_OWNER: "transactionTypeDownpaymentPaidToOwner", DOWNPAYMENT_RECEIVED_FROM_TENANT: "transactionTypeDownpaymentReceivedFromTenant",
  DOWNPAYMENT_REFUND_TO_TENANT: "transactionTypeDownpaymentRefundToTenant", DOWNPAYMENT_REFUND_FROM_OWNER: "transactionTypeDownpaymentRefundFromOwner",
  UTILITY_REIMBURSEMENT_FROM_TENANT: "transactionTypeUtilityReimbursement", UTILITY_PROFIT_FROM_TENANT: "transactionTypeUtilityProfit",
  SERVICE_CHARGE_RECEIVED_FROM_TENANT: "transactionTypeServiceCharge", GUEST_STAY_PAYMENT_RECEIVED: "transactionTypeGuestStayPayment",
  GUEST_DEPOSIT_REFUND: "transactionTypeGuestDepositRefund", PAYROLL_EXPENSE: "transactionTypePayrollExpense",
  UTILITY_EXPENSE: "transactionTypeUtilityExpense", MAINTENANCE_EXPENSE: "expenseTypeMaintenance", OTHER: "expenseTypeOther", OWNER_WITHDRAWAL: "transactionTypeOwnerWithdrawal",
};

export default async function MonthlyTransactionReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const [t, nav, locale, report] = await Promise.all([
    getTranslations("Properties"), getTranslations("Nav"), getLocale(), getMonthlyTransactionReport(requested),
  ]);
  const { rows, totals, month, months } = report;
  const columns = [t("date"), t("transactionReportDetails"), t("propertyLabel"), t("paymentMethod"), t("transactionReportIncoming"), t("transactionReportOutgoing"), t("transactionReportBalance")];
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" render={<Link href="/transactions" />} nativeButton={false}><ArrowLeft className="size-4" />{t("transactionsPageTitle")}</Button>
      <div className="flex flex-wrap items-center gap-2"><ReportMonthSelect month={month} months={months} basePath="/transactions/report" /><InvoicePrintButton /></div>
    </div>
    <article data-testid="invoice" className={`${styles.report} ${styles.transactionPrint}`}>
      <header className={styles.header}>
        <div><div className={styles.brand}><Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} /><p className={styles.brandName}>{nav("brand")}</p></div><h1 className={styles.title}>{t("transactionReportTitle")}</h1></div>
        <div className={styles.metadata}>
          <span className={styles.month}>{monthLabel(month, locale)}</span><p>{t("transactionReportCount", { count: rows.length })}</p>
          <ReportPrintMetadata initialDate={formatDate(new Date(), locale)} locale={locale} dateLabel={t("monthlyReportPrintDate")}
            pageLabel={t("monthlyReportPage")} title={`${nav("brand")} · ${t("transactionReportTitle")}`} month={monthLabel(month, locale)} pageName="monthlyTransactionReport" />
        </div>
      </header>
      <dl className={styles.summary}>
        {[[t("transactionReportIncoming"), totals.incoming], [t("transactionReportOutgoing"), totals.outgoing], [t("transactionReportNet"), totals.net], [t("transactionReportClosing"), totals.closing]].map(([label, value], index) =>
          <div key={label} className={styles.metric}><dt>{label}</dt><dd className={index === 1 || Number(value) < 0 ? styles.remaining : index === 0 ? styles.collected : undefined}>{formatTaka(Number(value))}</dd></div>)}
      </dl>
      <p className={styles.note}>{t("transactionReportBasis")}</p>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.transactionTable}`}>
          <caption className="sr-only">{t("transactionReportTitle")} — {monthLabel(month, locale)}</caption>
          <thead><tr>{columns.map((label, index) => <th key={label} scope="col" className={index > 3 ? "text-right" : "text-left"}>{label}</th>)}</tr></thead>
          <tbody>
            <tr className={styles.total}><th colSpan={6} scope="row" className="text-left">{t("transactionReportOpening")}</th><td className={styles.number}>{formatTaka(totals.opening)}</td></tr>
            {rows.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">{t("transactionReportEmpty")}</td></tr> : rows.map((entry) => <tr key={entry.id} className={styles.tenant}>
              <td className="whitespace-nowrap">{formatDate(entry.date, locale)}</td>
              <th scope="row" className={`${styles.name} ${styles.transactionDetails} text-left`}>
                {t(typeKeys[entry.type] ?? "expenseTypeOther")}
                {entry.relatedName && <span className={styles.billDetail}>{entry.relatedName}</span>}
                {entry.notes && <span className={styles.billDetail}>{entry.notes}</span>}
              </th>
              <td>{entry.propertyName ?? t("companyStaffLabel")}{entry.unitLabel && <span className={styles.billDetail}>{entry.unitLabel}</span>}</td>
              <td>{entry.method ? paymentMethodLabel(t, entry.method) : "—"}</td>
              <td className={`${styles.number} ${styles.collected}`}>{entry.direction === "INCOMING" ? formatTaka(entry.incoming) : "—"}</td>
              <td className={`${styles.number} ${styles.remaining}`}>{entry.direction === "OUTGOING" ? formatTaka(entry.outgoing) : "—"}</td>
              <td className={styles.number}>{formatTaka(entry.balance)}</td>
            </tr>)}
          </tbody>
          <tfoot><tr className={styles.total}><th colSpan={4} scope="row" className="text-left">{t("transactionReportClosing")}</th>
            {[totals.incoming, totals.outgoing, totals.closing].map((value, index) => <td key={index} className={styles.number}>{formatTaka(value)}</td>)}
          </tr></tfoot>
        </table>
      </div>
      <footer className={styles.footer}><p className={styles.scope}>{t("transactionReportScope")}</p>
        <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
      </footer>
    </article>
  </div>;
}
