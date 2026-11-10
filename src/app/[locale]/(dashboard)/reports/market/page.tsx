import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { getMonthlyMarketReport } from "@/lib/monthly-market-report-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { transactionTypeLabels } from "@/lib/transaction-type-labels";

const money = (amount: number) => formatTaka(amount, 2);
const utilityTypes = [
  ["ELECTRICITY", "utilityTypeElectricity"],
  ["WATER", "utilityTypeWater"],
  ["GAS", "utilityTypeGas"],
  ["WASTE", "utilityTypeWaste"],
  ["SECURITY", "utilityTypeSecurity"],
  ["OTHER", "utilityTypeOther"],
] as const;
const filterClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm sm:w-auto";

export default async function MonthlyMarketReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; market?: string }>;
}) {
  const query = await searchParams;
  const [t, nav, locale, data] = await Promise.all([
    getTranslations("Properties"), getTranslations("Nav"), getLocale(),
    getMonthlyMarketReport(query.month, query.market),
  ]);
  const { month, prevMonth, currentMonth, markets, market, report } = data;
  const period = monthLabel(month, locale);
  const prevPeriod = monthLabel(prevMonth, locale);
  const tenantTotals = (report?.tenants ?? []).reduce((sum, row) => ({
    prev: sum.prev + row.prevMonthCents, current: sum.current + row.thisMonthCents,
    other: sum.other + row.otherMonthsCents, received: sum.received + row.receivedCents,
  }), { prev: 0, current: 0, other: 0, received: 0 });
  const title = t(market ? "marketMonthlyReportTitle" : "allMarketsMonthlyTitle");
  const reportName = market?.name ?? t("allMarketsOption");
  const salaries = report?.otherTransactions.filter((entry) => entry.type === "PAYROLL_EXPENSE") ?? [];
  const utilities = report?.otherTransactions.filter((entry) => entry.type === "UTILITY_EXPENSE") ?? [];
  const otherTransactions = report?.otherTransactions.filter((entry) =>
    entry.type !== "PAYROLL_EXPENSE" && entry.type !== "UTILITY_EXPENSE"
  ) ?? [];
  const utilityCosts = { ELECTRICITY: 0, WATER: 0, GAS: 0, WASTE: 0, SECURITY: 0, OTHER: 0 };
  for (const entry of utilities) {
    utilityCosts[entry.utilityBill?.type ?? "OTHER"] += Math.round(entry.outgoing * 100);
  }
  const utilityCents = Object.values(utilityCosts).reduce((sum, amount) => sum + amount, 0);
  const salaryCents = salaries.reduce((sum, entry) => sum + Math.round(entry.outgoing * 100), 0);
  const otherIncome = (Math.round((report?.totals.incoming ?? 0) * 100) - Math.round((report?.rentReceived ?? 0) * 100)) / 100;
  const otherExpenses = (Math.round((report?.totals.outgoing ?? 0) * 100) - salaryCents - utilityCents) / 100;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" render={<Link href="/reports" />} nativeButton={false}>
          <ArrowLeft className="size-4" />{t("reportsPageTitle")}
        </Button>
        {report && <InvoicePrintButton />}
      </div>
      {!report ? (
        <div className="rounded-xl border bg-card p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{t("noProperties")}</p>
        </div>
      ) : (
        <>
          <form action={`/${locale}/reports/market`} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 print:hidden">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("marketReportMarket")}
              <select name="market" defaultValue={market?.id ?? "all"} className={filterClass}>
                <option value="all">{t("allMarketsOption")}</option>
                {markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("rentMonthFilter")}
              <input type="month" name="month" defaultValue={month} max={currentMonth} required className={filterClass} />
            </label>
            <Button type="submit">{t("marketReportApply")}</Button>
          </form>

          <article data-testid="invoice" className={`${styles.report} ${styles.marketPrint}`}>
            <header className={styles.header}>
              <div>
                <div className={styles.brand}>
                  <Image src="/logo.jpg" alt={nav("brand")} width={52} height={52} priority className={styles.logo} />
                  <p className={styles.brandName}>{nav("brand")}</p>
                </div>
                <h1 className={styles.title}>{title}</h1>
                <p className="mt-1 font-semibold">{reportName}</p>
                {market?.address && <p className="text-xs text-muted-foreground">{market.address}</p>}
              </div>
              <div className={styles.metadata}>
                <span className={styles.month}>{period}</span>
                <ReportPrintMetadata initialDate={formatDate(new Date(), locale)} locale={locale}
                  dateLabel={t("monthlyReportPrintDate")} pageLabel={t("monthlyReportPage")}
                  title={`${title} · ${reportName}`} month={period} pageName="monthlyMarketReport" />
              </div>
            </header>

            <dl className={styles.summary}>
              {[
                [t("financialReportIncome"), report.totals.incoming, styles.collected],
                [t("totalExpense"), report.totals.outgoing, styles.remaining],
                [t("marketReportNet"), report.totals.net, report.totals.net < 0 ? styles.remaining : styles.collected],
                [t("marketReportMonthDue"), report.rentTotals.remaining, styles.remaining],
              ].map(([label, amount, color]) => (
                <div key={label} className={styles.metric}>
                  <dt>{label}</dt><dd className={String(color)}>{money(Number(amount))}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.note}>{t("marketReportBasis")}</p>

            {market ? (<>
              <h2 id="market-rent-heading" className={styles.sectionTitle}>{t("marketReportRentSection")}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-labelledby="market-rent-heading">
                  <colgroup span={2} />
                  <colgroup span={4} />
                  <colgroup span={2} />
                  <thead>
                    <tr>
                      <th scope="col" rowSpan={2} className="text-left">{t("tenantName")}</th>
                      <th scope="col" rowSpan={2} className="text-left">{t("unit")}</th>
                      <th scope="colgroup" colSpan={4} className={`${styles.rentBillStart} border-b text-center`}>
                        {t("marketReportRentReceived", { month: period })}
                      </th>
                      <th scope="colgroup" colSpan={2} className={`${styles.rentBillStart} border-b text-center`}>
                        {t("marketReportBillGroup", { month: period })}
                      </th>
                    </tr>
                    <tr>
                      <th scope="col" className={`${styles.rentBillStart} text-right`}>{t("marketReportRentForMonth", { month: prevPeriod })}</th>
                      <th scope="col" className="text-right">{t("marketReportRentForMonth", { month: period })}</th>
                      <th scope="col" className="text-right">{t("marketReportOtherMonths")}</th>
                      <th scope="col" className="text-right">{t("marketReportReceivedTotal")}</th>
                      <th scope="col" className={`${styles.rentBillStart} text-right`}>{t("marketReportMonthBilled")}</th>
                      <th scope="col" className="text-right">{t("marketReportBillRemaining")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tenants.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground">{t("monthlyReportEmpty")}</td></tr>}
                    {report.tenants.map((row) => (
                      <tr key={row.id} className={styles.tenant}>
                        <th scope="row" className={`${styles.name} text-left`}>
                          {row.name ?? t("marketReportUnknownTenant")}
                          {[...row.receiptMonths.entries()].sort().map(([billMonth, cents]) => (
                            <span key={billMonth} className={styles.billDetail}>
                              {t("marketReportRentFromOtherMonth", { month: monthLabel(billMonth, locale), amount: money(cents / 100) })}
                            </span>
                          ))}
                        </th>
                        <td className={styles.unit}>{row.unit ?? "—"}</td>
                        <td className={`${styles.number} ${styles.rentBillStart}`}>{money(row.prevMonthCents / 100)}</td>
                        <td className={styles.number}>{money(row.thisMonthCents / 100)}</td>
                        <td className={styles.number}>{money(row.otherMonthsCents / 100)}</td>
                        <td className={`${styles.number} ${styles.collected}`}>{money(row.receivedCents / 100)}</td>
                        <td className={`${styles.number} ${styles.rentBillStart}`}>{row.bill ? money(row.bill.due) : "—"}</td>
                        <td className={`${styles.number} ${row.bill?.remaining ? styles.remaining : ""}`}>{row.bill ? money(row.bill.remaining) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className={styles.total}>
                    <th scope="row" colSpan={2} className="text-left">{t("total")}</th>
                    {[tenantTotals.prev / 100, tenantTotals.current / 100, tenantTotals.other / 100, report.rentReceived,
                      report.rentTotals.due, report.rentTotals.remaining].map((amount, index) => (
                      <td key={index} className={`${styles.number} ${index === 0 || index === 4 ? styles.rentBillStart : ""}`}>{money(amount)}</td>
                    ))}
                  </tr></tfoot>
                </table>
              </div>

            </>) : (<>
              <h2 id="market-breakdown-heading" className={styles.sectionTitle}>{t("allMarketsBreakdown")}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-labelledby="market-breakdown-heading">
                  <thead><tr>
                    <th scope="col" className="text-left">{t("marketReportMarket")}</th>
                    <th scope="col" className="text-right">{t("marketReportRentReceived", { month: period })}</th>
                    <th scope="col" className="text-right">{t("financialReportIncome")}</th>
                    <th scope="col" className="text-right">{t("totalExpense")}</th>
                    <th scope="col" className="text-right">{t("marketReportNet")}</th>
                    <th scope="col" className="text-right">{t("marketReportMonthDue")}</th>
                  </tr></thead>
                  <tbody>
                    {report.marketRows.map((row) => (
                      <tr key={row.id} className={styles.tenant}>
                        <th scope="row" className={`${styles.name} text-left`}>
                          <a className="hover:underline" href={`/${locale}/reports/market?month=${month}&market=${encodeURIComponent(row.id)}`}>{row.name}</a>
                        </th>
                        <td className={styles.number}>{money(row.receivedCents / 100)}</td>
                        <td className={styles.number}>{money(row.incomeCents / 100)}</td>
                        <td className={styles.number}>{money(row.expenseCents / 100)}</td>
                        <td className={styles.number}>{money((row.incomeCents - row.expenseCents) / 100)}</td>
                        <td className={styles.number}>{money(row.rentRemaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className={styles.total}>
                    <th scope="row" className="text-left">{t("total")}</th>
                    {[report.rentReceived, report.totals.incoming, report.totals.outgoing, report.totals.net, report.rentTotals.remaining].map((amount, index) => (
                      <td key={index} className={styles.number}>{money(amount)}</td>
                    ))}
                  </tr></tfoot>
                </table>
              </div>
            </>)}

            <h2 id="market-payroll-heading" className={styles.sectionTitle}>{t("marketReportPayrollSection")}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="market-payroll-heading">
                <thead><tr>
                  <th scope="col" className="text-left">{t("date")}</th>
                  <th scope="col" className="text-left">{t("employeeName")}</th>
                  <th scope="col" className="text-right">{t("transactionReportOutgoing")}</th>
                </tr></thead>
                <tbody>
                  {salaries.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground">{t("marketReportPayrollEmpty")}</td></tr>}
                  {salaries.map((entry) => (
                    <tr key={entry.id} className={styles.tenant}>
                      <td className="whitespace-nowrap">{formatDate(entry.date, locale)}</td>
                      <th scope="row" className={`${styles.name} break-words text-left`}>{entry.detail || "—"}</th>
                      <td className={`${styles.number} ${styles.remaining}`}>{money(entry.outgoing)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className={styles.total}>
                  <th scope="row" colSpan={2} className="text-left">{t("marketReportPayrollTotal")}</th>
                  <td className={styles.number}>{money(salaryCents / 100)}</td>
                </tr></tfoot>
              </table>
            </div>

            <h2 id="market-utility-heading" className={styles.sectionTitle}>{t("marketReportUtilitySection")}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="market-utility-heading">
                <thead><tr>
                  <th scope="col" className="text-left">{t("utilityType")}</th>
                  <th scope="col" className="text-right">{t("transactionReportOutgoing")}</th>
                </tr></thead>
                <tbody>
                  {utilityTypes.map(([type, label]) => (
                    <tr key={type} className={styles.tenant}>
                      <th scope="row" className={`${styles.name} text-left`}>{t(label)}</th>
                      <td className={`${styles.number} ${styles.remaining}`}>{money(utilityCosts[type] / 100)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className={styles.total}>
                  <th scope="row" className="text-left">{t("marketReportUtilityTotal")}</th>
                  <td className={styles.number}>{money(utilityCents / 100)}</td>
                </tr></tfoot>
              </table>
            </div>

            <h2 id="market-other-heading" className={styles.sectionTitle}>{t("marketReportOtherSection")}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-labelledby="market-other-heading">
                <thead><tr>
                  <th scope="col" className="text-left">{t("date")}</th>
                  <th scope="col" className="text-left">{t("transactionReportDetails")}</th>
                  <th scope="col" className="text-right">{t("transactionReportIncoming")}</th>
                  <th scope="col" className="text-right">{t("transactionReportOutgoing")}</th>
                </tr></thead>
                <tbody>
                  {otherTransactions.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground">{t("marketReportOtherEmpty")}</td></tr>}
                  {otherTransactions.map((entry) => (
                    <tr key={entry.id} className={styles.tenant}>
                      <td className="whitespace-nowrap">{formatDate(entry.date, locale)}</td>
                      <th scope="row" className={`${styles.name} break-words text-left`}>
                        {t(transactionTypeLabels[entry.type] ?? "expenseTypeOther")}
                        {entry.detail && <span className={styles.billDetail}>{entry.detail}</span>}
                      </th>
                      <td className={`${styles.number} ${styles.collected}`}>{entry.direction === "INCOMING" ? money(entry.incoming) : "—"}</td>
                      <td className={`${styles.number} ${styles.remaining}`}>{entry.direction === "OUTGOING" ? money(entry.outgoing) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className={styles.total}>
                  <th scope="row" colSpan={2} className="text-left">{t("total")}</th>
                  <td className={styles.number}>{money(otherIncome)}</td>
                  <td className={styles.number}>{money(otherExpenses)}</td>
                </tr></tfoot>
              </table>
            </div>
            <h2 id="market-total-heading" className={styles.sectionTitle}>{t("marketReportGrandTotal")}</h2>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.marketTotalsTable}`} aria-labelledby="market-total-heading">
                <tbody>
                  {[
                    { label: t("marketReportRentReceived", { month: period }), amount: report.rentReceived },
                    { label: t("marketReportOtherIncome"), amount: otherIncome },
                    { label: t("financialReportIncome"), amount: report.totals.incoming, total: true },
                    { label: t("marketReportPayrollSection"), amount: salaryCents / 100 },
                    { label: t("marketReportUtilitySection"), amount: utilityCents / 100 },
                    { label: t("marketReportOtherExpenses"), amount: otherExpenses },
                    { label: t("totalExpense"), amount: report.totals.outgoing, total: true },
                  ].map(({ label, amount, total }) => (
                    <tr key={label} className={total ? styles.total : styles.tenant}>
                      <th scope="row" className={`${styles.name} text-left`}>{label}</th>
                      <td className={styles.number}>{money(amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row" className="text-left">{t("marketReportNet")}</th>
                    <td className={`${styles.number} ${report.totals.net < 0 ? styles.remaining : styles.collected}`}>
                      {money(report.totals.net)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <footer className={styles.footer}>
              <p className={styles.scope}>{t(market ? "marketReportScope" : "allMarketsScope")}</p>
              <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
