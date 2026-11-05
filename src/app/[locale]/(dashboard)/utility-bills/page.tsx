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

export default async function UtilityBillsPage({ searchParams }: { searchParams: Promise<{ month?: string; add?: string }> }) {
  const { month, add } = await searchParams;
  const openAddForm = add === "bill";
  const t = await getTranslations("Properties");
  const { bills, properties, totalUnpaid, unpaidCount, paidThisMonth, paymentRate, selectedMonth, availableMonths } =
    await getAllUtilityBillsData(month);

  const dismissAddFormTo = selectedMonth ? `/utility-bills?month=${selectedMonth}` : "/utility-bills";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("utilityBillsSection")}</h1>
          <p className="text-sm text-muted-foreground">{t("utilityBillsPageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ReportMonthSelect month={selectedMonth ?? "ALL"} months={availableMonths} basePath="/utility-bills" allowAll />
          <Button variant="outline" render={<Link href={`/utility-bills/report${selectedMonth ? `?month=${selectedMonth}` : ""}`} />} nativeButton={false}><FileText className="size-4" />{t("utilityReportTitle")}</Button>
          {properties.length > 0 ? <AddUtilityBillDialogGlobal
            key={String(openAddForm)}
            properties={properties}
            dismissTo={openAddForm ? dismissAddFormTo : undefined}
          /> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("totalUnpaid")}
          value={formatTaka(totalUnpaid)}
          icon={AlertTriangle}
          tone={totalUnpaid > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("unpaidBillsCount")}
          value={String(unpaidCount)}
          icon={ListChecks}
          tone="warning"
        />
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
      </div>

      <MobileUtilityBillsList key={selectedMonth ?? "ALL"} bills={bills} />
      <div className="hidden md:block">
        <UtilityBillsTable
          key={selectedMonth ?? "ALL"}
          bills={bills}
          showPropertyColumn
          propertyOptions={properties.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
