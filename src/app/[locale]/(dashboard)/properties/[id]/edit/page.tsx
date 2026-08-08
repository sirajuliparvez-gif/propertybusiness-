import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getPropertyDetail, getPropertyOwners } from "@/lib/properties-data";
import { PropertyEditForm } from "@/components/properties/property-edit-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const [property, owners] = await Promise.all([getPropertyDetail(id), getPropertyOwners()]);

  if (!property) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/properties/${id}`} />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">
          {t("edit")} · {property.name}
        </h1>
      </div>

      <PropertyEditForm property={property} owners={owners} />
    </div>
  );
}
