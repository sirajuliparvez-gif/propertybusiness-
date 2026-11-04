"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/lib/format";
import { groupRentArrearsByProperty, type buildRentArrearsReport } from "@/lib/rent-arrears-report";
import styles from "@/components/properties/rent-arrears.module.css";

type Tenant = ReturnType<typeof buildRentArrearsReport>["rows"][number];

export function RentArrearsLedger({ tenants, monthLabels, selectedTenant }: {
  tenants: Tenant[]; monthLabels: Record<string, string>; selectedTenant: string;
}) {
  const t = useTranslations("RentArrears");
  const p = useTranslations("Properties");
  const [expanded, setExpanded] = useState(() => new Set(selectedTenant ? [selectedTenant] : []));
  const allExpanded = tenants.length > 0 && tenants.every((tenant) => expanded.has(tenant.id));
  const markets = groupRentArrearsByProperty(tenants);
  return <section className={styles.ledger}>
    <div className={`${styles.listHeading} print:hidden`}>
      <div><h2>{t("balances")}</h2><p className="print:hidden">{t("detailHint")}</p></div>
      {tenants.length > 0 && <Button variant="ghost" size="sm" className="print:hidden" onClick={() => setExpanded(allExpanded ? new Set() : new Set(tenants.map((tenant) => tenant.id)))}>{t(allExpanded ? "collapseAll" : "expandAll")}</Button>}
    </div>
    {tenants.length === 0 ? <p className={styles.empty}>{t("empty")}</p> : <div className={styles.screenLedger}>
      {markets.map((market) => <section key={market.id} className={styles.market}>
      <div className={styles.marketHeading}><div><h3>{market.name}</h3><p>{t("marketAccounts", { count: market.rows.length })}</p></div><div><span>{t("marketDue")}</span><strong>{formatTaka(market.totals.remaining)}</strong></div></div>
      <div className={styles.columnHead} aria-hidden="true"><span>{p("tenantName")}</span><span>{t("unpaidMonths")}</span><span>{p("monthlyReportCollected")}</span><span>{t("totalOutstanding")}</span><span /></div>
      {market.rows.map((tenant) => <details key={tenant.id} className={styles.account} open={expanded.has(tenant.id)} onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpanded((previous) => {
          if (previous.has(tenant.id) === open) return previous;
          const next = new Set(previous); if (open) next.add(tenant.id); else next.delete(tenant.id); return next;
        });
      }}>
        <summary className={styles.accountRow}>
          <span className={styles.identity}><strong>{tenant.tenantName}</strong><span>{p("monthlyReportUnitNumber")}: {tenant.unitLabel}{tenant.status !== "ACTIVE" ? ` · ${t("formerTenant")}` : ""}</span></span>
          <span className={styles.monthCount}>{t("monthsCount", { count: tenant.months.filter((month) => month.remaining > 0).length })}</span>
          <span className={styles.paid}><span className={styles.mobileLabel}>{p("monthlyReportCollected")}</span>{formatTaka(tenant.totals.collected)}{tenant.totals.adjusted > 0 && <small>{p("monthlyReportAdjusted")}: {formatTaka(tenant.totals.adjusted)}</small>}</span>
          <span className={`${styles.balance} ${tenant.totals.remaining > 0 ? styles.owedAmount : ""}`}><span className={styles.mobileLabel}>{t("totalOutstanding")}</span>{formatTaka(tenant.totals.remaining)}</span>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </summary>
        <div className={styles.monthDetail}>
          <div className={styles.detailScroll}><table className={styles.monthTable}>
            <caption className="sr-only">{tenant.tenantName} — {t("tenantBreakdown")}</caption>
            <thead><tr><th scope="col">{t("month")}</th><th scope="col">{t("billed")}</th><th scope="col">{p("monthlyReportCollected")}</th><th scope="col">{p("monthlyReportRemaining")}</th></tr></thead>
            <tbody>{tenant.months.map((month) => <tr key={month.month}><th scope="row">{monthLabels[month.month]}</th><td>{formatTaka(month.due)}</td><td>{formatTaka(month.collected)}{month.adjusted > 0 && <small>{p("monthlyReportAdjusted")}: {formatTaka(month.adjusted)}</small>}</td><td>{formatTaka(month.remaining)}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">{p("total")}</th><td>{formatTaka(tenant.totals.due)}</td><td>{formatTaka(tenant.totals.collected)}</td><td>{formatTaka(tenant.totals.remaining)}</td></tr></tfoot>
          </table></div>
        </div>
      </details>)}</section>)}
    </div>}
    <div className={styles.printLedger}>
      {markets.map((market) => <section key={market.id} className={styles.printMarket}>
        <table className={styles.printTable}>
          <colgroup>{[9, 35, 11, 15, 15, 15].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
          <thead>
            <tr><th colSpan={6} className={styles.printMarketTitle}>{market.name}<span>{t("marketDue")}: {formatTaka(market.totals.remaining)}</span></th></tr>
            <tr><th>{p("monthlyReportUnitNumber")}</th><th>{p("tenantName")}</th><th>{t("unpaidMonths")}</th><th>{p("monthlyReportCollected")}</th><th>{p("monthlyReportAdjusted")}</th><th>{t("totalOutstanding")}</th></tr>
          </thead>
          <tbody>{market.rows.map((tenant) => <Fragment key={tenant.id}>
            <tr className={styles.printTenantRow}><td>{tenant.unitLabel}</td><th scope="row">{tenant.tenantName}{tenant.status !== "ACTIVE" && <small>{t("formerTenant")}</small>}</th><td>{tenant.months.filter((month) => month.remaining > 0).length}</td><td>{formatTaka(tenant.totals.collected)}</td><td>{formatTaka(tenant.totals.adjusted)}</td><td className={tenant.totals.remaining > 0 ? styles.owedAmount : undefined}>{formatTaka(tenant.totals.remaining)}</td></tr>
            {expanded.has(tenant.id) && tenant.months.map((month) => <tr key={month.month} className={styles.printMonthRow}><td /><th scope="row">{monthLabels[month.month]}<small>{t("billed")}: {formatTaka(month.due)}</small></th><td /><td>{formatTaka(month.collected)}</td><td>{formatTaka(month.adjusted)}</td><td>{formatTaka(month.remaining)}</td></tr>)}
          </Fragment>)}
          <tr className={styles.printTotal}><th colSpan={3} scope="row">{p("total")}</th><td>{formatTaka(market.totals.collected)}</td><td>{formatTaka(market.totals.adjusted)}</td><td>{formatTaka(market.totals.remaining)}</td></tr>
          </tbody>
        </table>
      </section>)}
    </div>
  </section>;
}
