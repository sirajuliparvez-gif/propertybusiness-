import { getTranslations } from "next-intl/server";
import { getReportsData } from "@/lib/reports-data";
import { ReportsView } from "@/components/properties/reports-view";

export default async function ReportsPage() {
  const t = await getTranslations("Properties");
  const data = await getReportsData();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("reportsPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("reportsPageSubtitle")}</p>
      </div>

      <ReportsView {...data} />
    </div>
  );
}
