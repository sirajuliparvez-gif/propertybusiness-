"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PROPERTY_TYPE_KEYS, getTypeIcon } from "@/lib/property-types";
import type { getPropertiesList } from "@/lib/properties-data";

type Property = Awaited<ReturnType<typeof getPropertiesList>>[number];

export function PropertiesGrid({ properties }: { properties: Property[] }) {
  const t = useTranslations("Properties");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const typeFilters = [
    { key: null, label: t("filterAll") },
    ...PROPERTY_TYPE_KEYS.map((key) => ({ key: t(`typeOption_${key}`), label: t(`typeOption_${key}`) })),
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (typeFilter && p.type !== typeFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q)
      );
    });
  }, [properties, query, typeFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.key ?? "all"}
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
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Search className="size-4 opacity-50" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </InputGroup>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {query || typeFilter ? t("noSearchResults") : t("noProperties")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const vacant = p.totalUnits - p.occupiedUnits;
            const TypeIcon = getTypeIcon(t, p.type);
            const profitable = p.netProfit >= 0;
            return (
              <Link key={p.id} href={`/properties/${p.id}`}>
                <Card
                  className={cn(
                    "h-full overflow-hidden border-l-4 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-md)",
                    profitable ? "border-l-success" : "border-l-destructive"
                  )}
                >
                  <div
                    className="relative flex h-20 items-center justify-center bg-muted/50"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, var(--border) 0px, var(--border) 1px, transparent 1px, transparent 10px)",
                    }}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-(--shadow-sm)">
                      <TypeIcon className="size-5" />
                    </span>
                    <Badge
                      className={cn(
                        "absolute top-2 right-2 border-transparent",
                        vacant === 0
                          ? "bg-success/90 text-success-foreground"
                          : "bg-warning/90 text-warning-foreground"
                      )}
                    >
                      {p.occupiedUnits}/{p.totalUnits} {t("units")}
                    </Badge>
                  </div>

                  <CardContent className="flex flex-col gap-2 px-4 pt-3 pb-4">
                    <p className="text-xs font-medium text-muted-foreground">{p.displayId}</p>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold">{p.name}</p>
                      <Badge
                        className={cn(
                          "shrink-0 border-transparent",
                          p.status === "ACTIVE"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {p.status === "ACTIVE" ? t("active") : t("inactive")}
                      </Badge>
                    </div>
                    {p.address ? (
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        {p.address}
                      </p>
                    ) : null}

                    <div className="mt-1 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">{t("expectedIncome")}</p>
                        <p className="font-mono font-semibold tabular-nums">
                          {formatTaka(p.expectedIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("leaseCost")}</p>
                        <p className="font-mono tabular-nums text-muted-foreground">
                          {formatTaka(p.monthlyOwnerRent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("netProfit")}</p>
                        <p
                          className={cn(
                            "font-mono font-semibold tabular-nums",
                            profitable ? "text-success" : "text-destructive"
                          )}
                        >
                          {formatTaka(p.netProfit)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
