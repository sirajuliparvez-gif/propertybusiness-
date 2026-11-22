import { getTranslations } from "next-intl/server";
import { getAllTenantsData } from "@/lib/tenants-data";
import { getAllTenants } from "@/lib/properties-data";
import { TenantsTable } from "@/components/properties/tenants-table";
import { MobileTenantsList } from "@/components/mobile/mobile-tenants-list";
import { AddTenantDialogGlobal } from "@/components/properties/add-tenant-dialog-global";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const openAddForm = add === "tenant";
  const t = await getTranslations("Properties");
  const [
    {
      tenants,
      propertiesWithVacantUnits,
    },
    existingTenants,
  ] = await Promise.all([getAllTenantsData(), getAllTenants()]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("tenants")}</h1>
          <p className="text-sm text-muted-foreground">{t("tenantsPageSubtitle")}</p>
        </div>
        {propertiesWithVacantUnits.length > 0 ? (
          <AddTenantDialogGlobal
            key={String(openAddForm)}
            properties={propertiesWithVacantUnits}
            existingTenants={existingTenants}
            dismissTo={openAddForm ? "/tenants" : undefined}
          />
        ) : null}
      </div>

      <MobileTenantsList tenants={tenants} directory />
      <div className="hidden md:block">
        <TenantsTable tenants={tenants} showPropertyColumn />
      </div>
    </div>
  );
}
