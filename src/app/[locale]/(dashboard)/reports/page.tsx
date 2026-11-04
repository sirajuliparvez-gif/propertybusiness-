import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, monthLabel, shortMonthLabel } from "@/lib/format";
import { getReportsData } from "@/lib/reports-data";
import { ReportsView } from "@/components/properties/reports-view";

export default async function ReportsPage() {
  const t = await getTranslations("Properties");
  const data = await getReportsData();
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("reportsPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("reportsPageSubtitle")}</p>
      </div>

      <ReportsView {...data} generatedDate={formatDate(new Date(), locale)}
        labels={Object.fromEntries(data.months.map((m) => [m.month, {
          full: monthLabel(m.month, locale), short: shortMonthLabel(m.month, locale),
        }]))} />
    </div>
  );
}
