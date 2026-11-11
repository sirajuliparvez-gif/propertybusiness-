import { ReportMonthSelect } from "@/components/properties/report-month-select";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, ListChecks, Percent, FileText } from "lucide-react";
import { getAllUtilityBillsData } from "@/lib/utility-bills-data";
import { AddUtilityBillDialogGlobal } from "@/components/properties/add-utility-bill-dialog-global";
import { UtilityBillsTable } from "@/components/properties/utility-bills-table";
import { MobileUtilityBillsList } from "@/components/mobile/mobile-utility-bills-list";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export async function UtilityBillsView({ month, openAddForm = false, unpaidOnly = false }: {
  month?: string;
  openAddForm?: boolean;
  unpaidOnly?: boolean;
}) {
  const [t, nav] = await Promise.all([getTranslations("Properties"), getTranslations("Nav")]);
  const { bills, properties, totalUnpaid, unpaidCount, paidThisMonth, paymentRate, selectedMonth, currentMonth, availableMonths } =
    await getAllUtilityBillsData(month);

  const basePath = unpaidOnly ? "/utility-bills/arrears" : "/utility-bills";
  const viewPath = selectedMonth ? `${basePath}?month=${selectedMonth}` : basePath;
  const visibleBills = unpaidOnly
    ? bills.filter((bill) => bill.month < currentMonth && bill.status !== "PAID" && bill.amount > bill.paidAmount)
    : bills;
  const visibleUnpaid = unpaidOnly ? visibleBills.reduce((total, bill) => total + bill.amount - bill.paidAmount, 0) : totalUnpaid;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{unpaidOnly ? nav("utilityArrears") : t("utilityBillsSection")}</h1>
          <p className="text-sm text-muted-foreground">{t(unpaidOnly ? "utilityArrearsSubtitle" : "utilityBillsPageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ReportMonthSelect month={selectedMonth ?? "ALL"} months={unpaidOnly ? availableMonths.filter((m) => m < currentMonth) : availableMonths} basePath={basePath} allowAll />
          {!unpaidOnly && <Button variant="outline" render={<Link href={`/utility-bills/report${selectedMonth ? `?month=${selectedMonth}` : ""}`} />} nativeButton={false}><FileText className="size-4" />{t("utilityReportTitle")}</Button>}
          {!unpaidOnly && properties.length > 0 ? <AddUtilityBillDialogGlobal
            key={String(openAddForm)}
            properties={properties}
            dismissTo={openAddForm ? viewPath : undefined}
          /> : null}
        </div>
      </div>

      <div className={unpaidOnly ? "grid max-w-2xl grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"}>
        <StatTile
          label={t("totalUnpaid")}
          value={formatTaka(visibleUnpaid, unpaidOnly ? 2 : 0)}
          icon={AlertTriangle}
          tone={visibleUnpaid > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("unpaidBillsCount")}
          value={String(unpaidOnly ? visibleBills.length : unpaidCount)}
          icon={ListChecks}
          tone="warning"
        />
        {!unpaidOnly && (
          <>
            <StatTile
              label={t("utilityReportSettled")}
              value={formatTaka(paidThisMonth)}
              icon={CheckCircle2}
              tone="success"
            />
            <StatTile
              label={t("billPaymentRate")}
              value={`${paymentRate}%`}
              icon={Percent}
              tone="teal"
            />
          </>
        )}
      </div>

      <MobileUtilityBillsList key={viewPath} bills={visibleBills} unpaidOnly={unpaidOnly} returnTo={unpaidOnly ? viewPath : undefined} />
      <div className="hidden md:block">
        <UtilityBillsTable
          key={viewPath}
          bills={visibleBills}
          unpaidOnly={unpaidOnly}
          returnTo={unpaidOnly ? viewPath : undefined}
          showPropertyColumn
          propertyOptions={properties.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
