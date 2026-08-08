import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, ListChecks, Percent } from "lucide-react";
import { getAllUtilityBillsData } from "@/lib/utility-bills-data";
import { AddUtilityBillDialogGlobal } from "@/components/properties/add-utility-bill-dialog-global";
import { UtilityBillsTable } from "@/components/properties/utility-bills-table";
import { MobileUtilityBillsList } from "@/components/mobile/mobile-utility-bills-list";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function UtilityBillsPage() {
  const t = await getTranslations("Properties");
  const { bills, properties, totalUnpaid, unpaidCount, paidThisMonth, paymentRate } =
    await getAllUtilityBillsData();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("utilityBillsSection")}</h1>
          <p className="text-sm text-muted-foreground">{t("utilityBillsPageSubtitle")}</p>
        </div>
        {properties.length > 0 ? <AddUtilityBillDialogGlobal properties={properties} /> : null}
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
          label={t("utilityPaidThisMonth")}
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

      <MobileUtilityBillsList bills={bills} />
      <div className="hidden md:block">
        <UtilityBillsTable bills={bills} showPropertyColumn />
      </div>
    </div>
  );
}
