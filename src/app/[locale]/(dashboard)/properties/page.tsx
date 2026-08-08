import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getPropertiesList } from "@/lib/properties-data";
import { PropertiesGrid } from "@/components/properties/properties-grid";

export default async function PropertiesPage() {
  const t = await getTranslations("Properties");
  const properties = await getPropertiesList();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          className="hidden md:inline-flex"
          render={<Link href="/properties/new" />}
          nativeButton={false}
        >
          <Plus className="size-4" />
          {t("newProperty")}
        </Button>
      </div>

      <PropertiesGrid properties={properties} />
    </div>
  );
}
