import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getPropertyOwners } from "@/lib/properties-data";
import { PropertyCreateForm } from "@/components/properties/property-create-form";

export default async function NewPropertyPage() {
  const t = await getTranslations("Properties");
  const owners = await getPropertyOwners();

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/properties" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{t("newProperty")}</h1>
      </div>

      <PropertyCreateForm owners={owners} />
    </div>
  );
}
