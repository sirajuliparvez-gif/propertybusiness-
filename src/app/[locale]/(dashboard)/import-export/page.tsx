import { getTranslations } from "next-intl/server";
import { ImportExportPanel } from "@/components/properties/import-export-panel";
import { getPropertiesForMonthlyEntry } from "@/lib/import-export/monthly";

export default async function ImportExportPage() {
  const t = await getTranslations("Properties");
  const properties = await getPropertiesForMonthlyEntry();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("importExportPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("importExportPageSubtitle")}</p>
      </div>

      <ImportExportPanel properties={properties} />
    </div>
  );
}
