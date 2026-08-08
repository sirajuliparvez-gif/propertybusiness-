import { getTranslations } from "next-intl/server";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  DoorOpen,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/format";
import { StatTile } from "@/components/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getActionRequiredData,
  getMonthlyFinancials,
  getYearlyFinancials,
  getPropertyPerformance,
  getOccupancyStats,
  getCashFlowForecast,
  getTotalOutstanding,
} from "@/lib/dashboard-data";
import { getRentCollectionData } from "@/lib/tenants-data";
import { ActionRequired } from "@/components/dashboard/action-required";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { PropertyPerformance } from "@/components/dashboard/property-performance";
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

async function getDashboardData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    activeProperties,
    activeTenantLeases,
    incomeAgg,
    expenseAgg,
    recentTransactions,
    actionRequired,
    monthlyFinancials,
    yearlyFinancials,
    propertyPerformance,
    occupancy,
    cashFlowForecast,
    totalOutstanding,
    rentCollection,
  ] = await Promise.all([
    prisma.property.count({ where: { status: "ACTIVE" } }),
    prisma.tenantLease.count({ where: { status: "ACTIVE" } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { direction: "INCOMING", date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { direction: "OUTGOING", date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.transaction.findMany({
      take: 6,
      orderBy: { date: "desc" },
      include: {
        property: { select: { name: true } },
        recordedBy: { select: { name: true } },
      },
    }),
    getActionRequiredData(),
    getMonthlyFinancials(12),
    getYearlyFinancials(3),
    getPropertyPerformance(),
    getOccupancyStats(),
    getCashFlowForecast(),
    getTotalOutstanding(),
    getRentCollectionData(),
  ]);

  const income = incomeAgg._sum.amount ? Number(incomeAgg._sum.amount) : 0;
  const expense = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;

  return {
    activeProperties,
    activeTenantLeases,
    vacantUnits: occupancy.totalUnits - occupancy.occupiedUnits,
    totalUnits: occupancy.totalUnits,
    occupancyRate: occupancy.occupancyRate,
    income,
    expense,
    net: income - expense,
    recentTransactions,
    actionRequired,
    monthlyFinancials,
    yearlyFinancials,
    propertyPerformance,
    cashFlowForecast,
    totalOutstanding,
    rentCollection,
  };
}

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const data = await getDashboardData();

  return (
    <>
    <MobileDashboard data={data} />
    <div className="hidden min-w-0 flex-1 flex-col gap-6 md:flex">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatTile
          label={t("activeProperties")}
          value={String(data.activeProperties)}
          icon={Building2}
          tone="default"
        />
        <StatTile
          label={t("activeTenants")}
          value={String(data.activeTenantLeases)}
          icon={Users}
          tone="violet"
        />
        <StatTile
          label={t("occupancyRate")}
          value={`${data.occupancyRate}%`}
          icon={Percent}
          tone="teal"
        />
        <StatTile
          label={t("vacantUnits")}
          value={`${data.vacantUnits} / ${data.totalUnits}`}
          icon={DoorOpen}
          tone={data.vacantUnits > 0 ? "warning" : "teal"}
        />
        <StatTile
          label={t("monthlyIncome")}
          value={formatTaka(data.income)}
          icon={TrendingUp}
          tone="success"
        />
        <StatTile
          label={t("monthlyExpense")}
          value={formatTaka(data.expense)}
          icon={TrendingDown}
          tone="destructive"
        />
        <StatTile
          label={t("totalOutstanding")}
          value={formatTaka(data.totalOutstanding.total)}
          icon={AlertCircle}
          tone={data.totalOutstanding.total > 0 ? "destructive" : "default"}
          hint={
            data.totalOutstanding.total > 0
              ? `${t("rentDue")} ${formatTaka(data.totalOutstanding.rent)} · ${t(
                  "utilityDueTab"
                )} ${formatTaka(data.totalOutstanding.utility)} · ${t("payrollDue")} ${formatTaka(
                  data.totalOutstanding.payroll
                )}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none bg-linear-to-br from-primary/12 via-card to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-primary/25 to-primary/5 text-primary">
                <Wallet className="size-3.5" />
              </span>
              {t("netThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={cn(
                "font-mono text-3xl font-bold tracking-tight tabular-nums",
                data.net >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatTaka(data.net)}
            </span>
          </CardContent>
        </Card>

        <Card className="border-none bg-linear-to-br from-violet-500/10 via-card to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400">
                <ArrowRightLeft className="size-3.5" />
              </span>
              {t("cashFlowForecast")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "font-mono text-3xl font-bold tracking-tight tabular-nums",
                  data.cashFlowForecast.net >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatTaka(data.cashFlowForecast.net)}
              </span>
              <div className="text-right text-xs">
                <p className="text-success">
                  +{formatTaka(data.cashFlowForecast.incoming)} {t("expectedIncoming")}
                </p>
                <p className="text-destructive">
                  -{formatTaka(data.cashFlowForecast.outgoing)} {t("expectedOutgoing")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ActionRequired data={data.actionRequired} />

      <IncomeExpenseChart monthly={data.monthlyFinancials} yearly={data.yearlyFinancials} />

      <PropertyPerformance data={data.propertyPerformance} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400">
              <History className="size-3.5" />
            </span>
            {t("recentActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noActivity")}
            </p>
          ) : (
            <ul className="divide-y">
              {data.recentTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        tx.direction === "INCOMING"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {tx.direction === "INCOMING" ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tx.property?.name ?? "কোম্পানি স্টাফ"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tx.type.replaceAll("_", " ").toLowerCase()}
                        {tx.recordedBy ? ` · ${t("recordedBy")} ${tx.recordedBy.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {formatTaka(Number(tx.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
