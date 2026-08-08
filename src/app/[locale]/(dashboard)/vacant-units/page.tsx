import { getTranslations } from "next-intl/server";
import { Home, TrendingDown, Clock, Percent } from "lucide-react";
import { getAllVacantUnitsData } from "@/lib/vacant-units-data";
import { getAllTenants } from "@/lib/properties-data";
import { VacantUnitsGrid } from "@/components/properties/vacant-units-grid";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function VacantUnitsPage() {
  const t = await getTranslations("Properties");
  const [{ properties, totalVacant, potentialMonthlyLoss, oldestVacancy, occupancyRate }, existingTenants] =
    await Promise.all([getAllVacantUnitsData(), getAllTenants()]);

  const longestVacantDays = oldestVacancy
    ? Math.max(0, Math.floor((Date.now() - oldestVacancy.getTime()) / 86_400_000))
    : null;

  // AddTenantDialogGlobal's cascading picker needs this exact shape — built
  // straight from the vacancy data already fetched, no extra query needed.
  const addTenantProperties = properties.map((p) => ({
    id: p.id,
    name: p.name,
    units: p.vacantUnits.map((u) => ({
      id: u.id,
      label: u.unitLabel,
      unitTypeLabel: u.unitTypeLabel,
      tenantDefaultRentAmount: u.expectedRent,
      tenantDefaultDownpaymentAmount: u.expectedDownpayment,
    })),
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("vacantUnitsListTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("vacantUnitsPageSubtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("vacantUnitsCount")}
          value={String(totalVacant)}
          icon={Home}
          tone={totalVacant > 0 ? "warning" : "default"}
        />
        <StatTile
          label={t("potentialMonthlyLoss")}
          value={formatTaka(potentialMonthlyLoss)}
          icon={TrendingDown}
          tone={potentialMonthlyLoss > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("longestVacantUnit")}
          value={longestVacantDays != null ? t("vacantDays", { count: longestVacantDays }) : "—"}
          icon={Clock}
          tone="warning"
        />
        <StatTile
          label={t("occupancy")}
          value={`${occupancyRate}%`}
          icon={Percent}
          tone="teal"
        />
      </div>

      <VacantUnitsGrid
        properties={properties}
        addTenantProperties={addTenantProperties}
        existingTenants={existingTenants}
      />
    </div>
  );
}
