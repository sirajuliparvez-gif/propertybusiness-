import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/app/[locale]/(dashboard)/page";

export async function MobileDashboard({ data }: { data: DashboardData }) {
  const t = await getTranslations("Dashboard");
  const tp = await getTranslations("Properties");

  const rentStatusLabels = {
    PAID: tp("paid"),
    PARTIAL: tp("pending"),
    UNPAID: tp("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: tp("paid"),
  };

  const unpaidTenants = data.rentCollection.payments
    .filter((p) => p.overdueAmount > 0)
    .sort((a, b) => b.overdueAmount - a.overdueAmount)
    .slice(0, 5);

  const topProperties = [...data.propertyPerformance]
    .sort((a, b) => b.net - a.net)
    .slice(0, 5);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 md:hidden">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <Card className="border-none bg-linear-to-br from-primary/15 via-card to-card">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t("netThisMonth")}</p>
          <p
            className={cn(
              "mt-1 font-mono text-3xl font-bold tracking-tight tabular-nums",
              data.net >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {formatTaka(data.net)}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-success">
              +{formatTaka(data.income)} {t("income")}
            </span>
            <span className="text-destructive">
              -{formatTaka(data.expense)} {t("expense")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{tp("collectionRate")}</p>
            <span className="font-mono text-sm font-bold tabular-nums">
              {data.rentCollection.collectionRate}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${data.rentCollection.collectionRate}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="font-mono text-base font-bold tabular-nums text-success">
                {formatTaka(data.rentCollection.totalCollected)}
              </p>
              <p className="text-[11px] text-muted-foreground">{tp("collectedThisMonth")}</p>
            </div>
            <div>
              <p className="font-mono text-base font-bold tabular-nums text-destructive">
                {formatTaka(data.rentCollection.totalRemaining)}
              </p>
              <p className="text-[11px] text-muted-foreground">{tp("remaining")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {unpaidTenants.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("rentDue")}
          </p>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y">
              {unpaidTenants.map((p) => (
                <li key={p.id}>
                  <Link
                    href="/rent"
                    className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/60"
                  >
                    <InitialAvatar name={p.tenantName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.tenantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.propertyName} · {p.unitLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {formatTaka(p.overdueAmount)}
                      </p>
                      <StatusPill status={p.rentStatus} labels={rentStatusLabels} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {topProperties.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("mostProfit")}
          </p>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y">
              {topProperties.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Building2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-sm font-semibold tabular-nums",
                      p.net >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatTaka(p.net)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
