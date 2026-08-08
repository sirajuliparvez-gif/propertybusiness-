import { getTranslations } from "next-intl/server";
import { Users, TrendingUp, Wallet, AlertTriangle, Percent } from "lucide-react";
import { getAllTenantsData } from "@/lib/tenants-data";
import { getAllTenants } from "@/lib/properties-data";
import { TenantsTable } from "@/components/properties/tenants-table";
import { MobileTenantsList } from "@/components/mobile/mobile-tenants-list";
import { AddTenantDialogGlobal } from "@/components/properties/add-tenant-dialog-global";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function TenantsPage() {
  const t = await getTranslations("Properties");
  const [
    {
      tenants,
      totalActiveTenants,
      expectedIncome,
      collectedThisMonth,
      totalOverdueRent,
      collectionRate,
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
          <AddTenantDialogGlobal properties={propertiesWithVacantUnits} existingTenants={existingTenants} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <StatTile
          label={t("activeTenantsCount")}
          value={String(totalActiveTenants)}
          icon={Users}
          tone="default"
        />
        <StatTile
          label={t("expectedIncome")}
          value={formatTaka(expectedIncome)}
          icon={TrendingUp}
          tone="violet"
        />
        <StatTile
          label={t("collectedThisMonth")}
          value={formatTaka(collectedThisMonth)}
          icon={Wallet}
          tone="success"
        />
        <StatTile
          label={t("overdueRent")}
          value={formatTaka(totalOverdueRent)}
          icon={AlertTriangle}
          tone={totalOverdueRent > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("collectionRate")}
          value={`${collectionRate}%`}
          icon={Percent}
          tone="teal"
        />
      </div>

      <MobileTenantsList tenants={tenants} />
      <div className="hidden md:block">
        <TenantsTable tenants={tenants} showPropertyColumn />
      </div>
    </div>
  );
}
