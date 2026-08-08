"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PropertyDetail } from "@/lib/properties-data";

type Filter = "all" | "paid" | "overdue" | "former";

export function MobileTenantsList({ tenants }: { tenants: PropertyDetail["tenants"] }) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  const filtered = useMemo(() => {
    const byStatus =
      filter === "paid"
        ? tenants.filter((tn) => tn.leaseStatus === "ACTIVE" && tn.overdueAmount <= 0)
        : filter === "overdue"
          ? tenants.filter((tn) => tn.leaseStatus === "ACTIVE" && tn.overdueAmount > 0)
          : filter === "former"
            ? tenants.filter((tn) => tn.leaseStatus !== "ACTIVE")
            : tenants;
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((tn) =>
      `${tn.tenantName} ${tn.contactInfo ?? ""} ${tn.propertyName} ${tn.unitLabel}`.toLowerCase().includes(q)
    );
  }, [tenants, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("filterPaid") },
    { key: "overdue", label: t("filterOverdue") },
    { key: "former", label: t("filterFormer") },
  ];

  if (tenants.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">{t("noTenants")}</p>;
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <InputGroup>
        <InputGroupAddon>
          <Search className="size-4 opacity-50" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("rentSearchPlaceholder")}
        />
      </InputGroup>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noTenants")}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {filtered.map((tn) => {
              const isFormer = tn.leaseStatus !== "ACTIVE";
              return (
                <li key={tn.id} className={isFormer ? "opacity-60" : undefined}>
                  <Link
                    href={`/tenants/${tn.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/60"
                  >
                    <InitialAvatar name={tn.tenantName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tn.tenantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tn.propertyName} · {tn.unitLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {formatTaka(tn.monthlyRentAmount)}
                      </p>
                      {isFormer ? (
                        <Badge className="border-transparent bg-muted text-muted-foreground">
                          {t("vacatedLabel")}
                        </Badge>
                      ) : (
                        <StatusPill status={tn.rentStatus} labels={rentStatusLabels} />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
