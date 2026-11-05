import type { ReactNode } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { ReportPrintMetadata } from "@/components/properties/report-print-metadata";
import styles from "@/components/properties/financial-report.module.css";
import { requireCurrentUser } from "@/lib/auth/session";
import { getTenantHistory } from "@/lib/tenant-history-data";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { transactionTypeLabels } from "@/lib/transaction-type-labels";

function HistoryTable({ title, columns, rows, numberFrom, empty, headingLevel = 3 }: {
  title: string;
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
  numberFrom?: number;
  empty: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <section className={styles.historySection}>
    <Heading className={styles.historySectionTitle}>{title}</Heading>
    {rows.length ? <div className={styles.historyTableWrap} role="region" aria-label={title} tabIndex={0}>
      <table className={`${styles.table} ${styles.historyTable}`}>
        <caption className="sr-only">{title}</caption>
        <thead><tr>{columns.map((column, index) => (
          <th key={column} scope="col" className={numberFrom != null && index >= numberFrom ? styles.number : "text-left"}>{column}</th>
        ))}</tr></thead>
        <tbody>{rows.map(({ id, cells }) => (
          <tr key={id} className={styles.tenant}>
            {cells.map((cell, index) => index === 0 ? (
              <th key={index} scope="row" className={styles.historyRowLabel}>{cell}</th>
            ) : (
              <td key={index} className={numberFrom != null && index >= numberFrom ? styles.number : undefined}>{cell}</td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div> : <p className={styles.historyEmpty}>{empty}</p>}
  </section>;
}

const utilityLabels = {
  GAS: "utilityTypeGas", ELECTRICITY: "utilityTypeElectricity", WATER: "utilityTypeWater", OTHER: "utilityTypeOther",
} as const;
const documentLabels = {
  NID_CARD: "nidPhoto", TENANT_PHOTO: "tenantPhoto", AGREEMENT_COPY: "agreementCopyLabel",
} as const;

export default async function TenantHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const { id } = await params;
  const [history, t, h, nav, locale] = await Promise.all([
    getTenantHistory(id), getTranslations("Properties"), getTranslations("TenantHistory"), getTranslations("Nav"), getLocale(),
  ]);
  if (!history) notFound();

  const date = (value: Date | null) => value ? formatDate(value, locale) : "—";
  const month = (value: string) => monthLabel(value, locale);
  const asMoney = (value: { toString(): string } | number) => formatTaka(Number(value));
  const empty = h("empty");
  const docRow = (document: { id: string; label: string | null; uploadedAt: Date; fileUrl: string }, detail?: string) => {
    const label = document.label && Object.hasOwn(documentLabels, document.label)
      ? t(documentLabels[document.label as keyof typeof documentLabels])
      : h("document");
    const file = /^https?:\/\//i.test(document.fileUrl)
      ? <a href={document.fileUrl} target="_blank" rel="noreferrer" className="underline print:no-underline">{label}</a>
      : label;
    return { id: document.id, cells: [date(document.uploadedAt), file, detail ?? "—"] };
  };

  const summarize = (rows: { due: number; collected: number; adjusted: number; remaining: number }[]) =>
    rows.reduce((sum, row) => ({
      due: sum.due + row.due,
      collected: sum.collected + row.collected,
      adjusted: sum.adjusted + row.adjusted,
      remaining: sum.remaining + row.remaining,
    }), { due: 0, collected: 0, adjusted: 0, remaining: 0 });

  const renderSummary = (totals: ReturnType<typeof summarize>) => (
    <dl className={styles.historySummary}>
      {([
        [h("rentBilled"), totals.due, ""],
        [t("monthlyReportCollected"), totals.collected, styles.collected],
        [t("monthlyReportAdjusted"), totals.adjusted, ""],
        [h("rentRemaining"), totals.remaining, totals.remaining > 0 ? styles.remaining : ""],
      ] as const).map(([label, amount, tone]) => (
        <div key={label}><dt>{label}</dt><dd className={tone}>{asMoney(amount)}</dd></div>
      ))}
    </dl>
  );

  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" render={<Link href={`/tenants/${id}`} />} nativeButton={false}>
        <ArrowLeft className="size-4" />{h("back")}
      </Button>
      <InvoicePrintButton />
    </div>
    <article data-testid="invoice" className={`${styles.report} ${styles.tenantHistoryPrint}`}>
      <header className={styles.historyHeader}>
        <div className={styles.historyMasthead}>
          <div className={styles.brand}>
            <Image src="/logo.jpg" alt="" width={44} height={44} unoptimized className={styles.logo} />
            <p className={styles.brandName}>{nav("brand")}</p>
          </div>
          <div className={styles.metadata}>
            <p>{h("leaseCount", { count: history.leases.length })}</p>
            <ReportPrintMetadata initialDate={date(new Date())} locale={locale} dateLabel={t("monthlyReportPrintDate")}
              pageLabel={t("monthlyReportPage")} title={`${nav("brand")} · ${h("title")}`}
              month={history.name} pageName="tenantHistoryReport" />
          </div>
        </div>
        <h1 className={styles.historyTitle}>{h("title")}</h1>
        <p className={styles.historyName}>{history.name}</p>
        <p className={styles.historyScope}>{h("scope")}</p>
      </header>
      {renderSummary(summarize(history.leases.flatMap((lease) => lease.rentRows)))}

      {history.leases.map((lease) => {
        const documents = [
          ...lease.documents.map((document) => docRow(document, h("lease"))),
          ...lease.bills.flatMap((bill) => bill.documents.map((document) => docRow(document, `${t(utilityLabels[bill.type])} · ${month(bill.month)}`))),
        ];
        const leasePeriod = lease.endDate
          ? h("leasePeriodRange", { start: date(lease.startDate), end: date(lease.endDate) })
          : h("leasePeriodStart", { start: date(lease.startDate) });
        return <section key={lease.id} className={styles.historyLease} aria-label={`${lease.propertyName} · ${lease.unitLabel}`}>
          <header className={styles.historyLeaseHeader}>
            <div className={styles.historyLeaseTitle}>
              <h2>
                {lease.propertyName}
                <span className={styles.historyUnit}> · {t("unit")} {lease.unitLabel}</span>
              </h2>
              <span className={styles.historyStatus} data-active={lease.status === "ACTIVE"}>{h(`status.${lease.status}`)}</span>
            </div>
            <dl className={styles.historyLeaseDetails}>
              <div className={styles.historyPeriodBox}>
                <dt>{h("leasePeriod")}</dt>
                <dd>{leasePeriod}</dd>
                {lease.movedOutAt ? <dd className={styles.historyMoveOut}>{t("vacatedOn")} {date(lease.movedOutAt)}</dd> : null}
              </div>
              <div><dt>{t("initialDownpayment")}</dt><dd>{asMoney(lease.initialDownpayment)}</dd></div>
              <div className={styles.historyBalanceBox}><dt>{h("advanceBalance")}</dt><dd>{asMoney(lease.downpaymentBalance)}</dd></div>
            </dl>
            {lease.notes ? <p className={styles.historyLeaseNote}><span>{t("notes")}</span> {lease.notes}</p> : null}
          </header>
          {history.leases.length > 1 ? renderSummary(summarize(lease.rentRows)) : null}
          <HistoryTable title={t("paymentHistorySection")} columns={[h("billingMonth"), h("billed"), t("monthlyReportCollected"), t("monthlyReportAdjusted"), t("monthlyReportRemaining"), h("credit")]}
            numberFrom={1} empty={empty} rows={lease.rentRows.map((row) => ({
              id: row.month,
              cells: [
                month(row.month), asMoney(row.due),
                <span key="collected" className={row.collected > 0 ? styles.collected : undefined}>{asMoney(row.collected)}</span>,
                asMoney(row.adjusted),
                <strong key="remaining" className={row.remaining > 0 ? styles.remaining : undefined}>{asMoney(row.remaining)}</strong>,
                asMoney(row.credit),
              ],
            }))} />
          <HistoryTable title={t("rentChangeHistory")} columns={[h("effectiveMonth"), h("previousRent"), h("newRent"), h("change"), h("serviceCharge")]}
            empty={t("rentChangeHistoryEmpty")} rows={lease.rentRates.map((rate, index, rates) => {
              const before = rates[index - 1]?.monthlyRentAmount;
              const delta = before == null ? 0 : rate.monthlyRentAmount - before;
              const service = rate.serviceChargeType === "PERCENTAGE" ? `${rate.serviceChargeValue ?? 0}%`
                : rate.serviceChargeType === "FLAT" ? asMoney(rate.serviceChargeValue ?? 0) : "—";
              return {
                id: rate.effectiveMonth,
                cells: [
                  <>{month(rate.effectiveMonth)}{rate.effectiveMonth > history.currentMonth ? ` · ${t("rentChangeScheduled")}` : ""}</>,
                  before == null ? "—" : asMoney(before),
                  asMoney(rate.monthlyRentAmount),
                  before == null ? t("rentChangeFirstRate") : delta === 0 ? "—"
                    : t(delta > 0 ? "rentChangeIncrease" : "rentChangeDecrease", { amount: asMoney(Math.abs(delta)) }),
                  service,
                ],
              };
            }).reverse()} />
          <HistoryTable title={h("transactions")} columns={[t("date"), h("activity"), t("paymentMethod"), t("transactionReportIncoming"), t("transactionReportOutgoing")]}
            numberFrom={3} empty={empty} rows={lease.transactions.map((entry) => {
              const billingMonth = entry.rentPayment?.month ?? entry.utilityBill?.month;
              return {
                id: entry.id,
                cells: [
                  date(entry.date),
                  <>{t(transactionTypeLabels[entry.type] ?? "expenseTypeOther")}
                    {billingMonth ? <span className={styles.billDetail}>{month(billingMonth)}</span> : null}
                    {entry.notes ? <span className={styles.billDetail}>{entry.notes}</span> : null}
                    {entry.recordedBy ? <span className={styles.billDetail}>{entry.recordedBy.name}</span> : null}
                  </>,
                  entry.method ? paymentMethodLabel(t, entry.method) : "—",
                  entry.direction === "INCOMING" ? asMoney(entry.amount) : "—",
                  entry.direction === "OUTGOING" ? asMoney(entry.amount) : "—",
                ],
              };
            })} />
          <HistoryTable title={t("utilityBillsSection")} columns={[h("billingMonth"), t("utilityType"), h("billed"), h("settled"), t("monthlyReportRemaining")]}
            numberFrom={2} empty={empty} rows={lease.bills.map((bill) => ({
              id: bill.id,
              cells: [month(bill.month), t(utilityLabels[bill.type]), asMoney(bill.amount), asMoney(bill.paidAmount), asMoney(Math.max(0, Number(bill.amount) - Number(bill.paidAmount)))],
            }))} />
          {lease.adjustments.length ? <HistoryTable title={t("adjustmentHistory")} columns={[t("date"), h("billingMonth"), t("reason"), t("amount")]}
            numberFrom={3} empty={empty} rows={[...lease.adjustments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((entry) => ({
              id: entry.id, cells: [date(entry.createdAt), month(entry.rentPayment.month), entry.reason ?? "—", asMoney(entry.amountAdjusted)],
            }))} /> : null}
          {documents.length ? <HistoryTable title={t("tenantDocuments")} columns={[t("date"), h("document"), h("activity")]} rows={documents} empty={empty} /> : null}
        </section>;
      })}
      {history.documents.length ? <HistoryTable headingLevel={2} title={h("tenantDocuments")} columns={[t("date"), h("document"), h("activity")]}
        rows={history.documents.map((document) => docRow(document))} empty={empty} /> : null}
      <footer className={styles.footer}>
        <p className={styles.scope}>{h("auditLimit")}</p>
        <div className={styles.signatures}><p>{t("monthlyReportPreparedBy")}</p><p>{t("monthlyReportApprovedBy")}</p></div>
      </footer>
    </article>
  </div>;
}
