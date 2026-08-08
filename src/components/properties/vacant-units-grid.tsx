"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Check, Plus as PlusIcon, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AddTenantDialogGlobal } from "@/components/properties/add-tenant-dialog-global";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PROPERTY_TYPE_KEYS, getTypeIcon } from "@/lib/property-types";
import type { AllVacantUnitsData } from "@/lib/vacant-units-data";
import type { AllTenantsData } from "@/lib/tenants-data";

const ALL_TYPES = "ALL";
const MAX_PIPS = 16;

export function VacantUnitsGrid({
  properties,
  addTenantProperties,
  existingTenants,
}: {
  properties: AllVacantUnitsData["properties"];
  addTenantProperties: AllTenantsData["propertiesWithVacantUnits"];
  existingTenants: { id: string; name: string; contactInfo: string | null }[];
}) {
  const t = useTranslations("Properties");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);

  const typeFilters = useMemo(() => {
    const present = new Set(properties.map((p) => p.type).filter(Boolean));
    return [
      { key: ALL_TYPES, label: t("filterAll") },
      ...PROPERTY_TYPE_KEYS.filter((key) => present.has(t(`typeOption_${key}`))).map((key) => ({
        key: t(`typeOption_${key}`),
        label: t(`typeOption_${key}`),
      })),
    ];
  }, [properties, t]);

  const filtered = useMemo(
    () => (typeFilter === ALL_TYPES ? properties : properties.filter((p) => p.type === typeFilter)),
    [properties, typeFilter]
  );

  if (properties.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noVacantUnits")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {typeFilters.length > 2 ? (
        <div className="flex flex-wrap gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const TypeIcon = getTypeIcon(t, p.type);
          const vacantCount = p.vacantUnits.length;
          const perUnitLoss = vacantCount > 0 ? Math.round(p.potentialMonthlyLoss / vacantCount) : 0;
          const pipsShown = Math.min(p.totalUnits, MAX_PIPS);
          const overflow = p.totalUnits - pipsShown;

          return (
            <Card key={p.id} className="overflow-hidden border-l-4 border-l-warning py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <TypeIcon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">{p.displayId}</p>
                    <p className="truncate font-semibold">{p.name}</p>
                    {p.address ? (
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {p.address}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: pipsShown }).map((_, i) => {
                    const isVacant = i >= p.occupiedUnits;
                    return (
                      <span
                        key={i}
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full",
                          isVacant
                            ? "border border-dashed border-warning text-warning"
                            : "bg-success/15 text-success"
                        )}
                      >
                        {isVacant ? <PlusIcon className="size-2.5" /> : <Check className="size-2.5" />}
                      </span>
                    );
                  })}
                  {overflow > 0 ? (
                    <span className="text-xs text-muted-foreground">+{overflow}</span>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("vacantUnitsCount")}</p>
                    <p className="font-mono font-semibold tabular-nums text-warning">
                      {vacantCount}/{p.totalUnits}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("perUnitLoss")}</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {perUnitLoss > 0 ? `~${formatTaka(perUnitLoss)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("potentialMonthlyLoss")}</p>
                    <p className="font-mono font-semibold tabular-nums text-destructive">
                      {p.potentialMonthlyLoss > 0 ? formatTaka(p.potentialMonthlyLoss) : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/properties/${p.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {t("viewPropertyLink")}
                    <ArrowRight className="size-3" />
                  </Link>
                  <AddTenantDialogGlobal
                    properties={addTenantProperties}
                    existingTenants={existingTenants}
                    initialPropertyId={p.id}
                    initialUnitId={p.vacantUnits[0]?.id}
                    returnTo="/vacant-units"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
