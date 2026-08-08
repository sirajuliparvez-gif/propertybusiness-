import { getTranslations } from "next-intl/server";
import {
  DoorOpen,
  Users,
  Zap,
  BedDouble,
  HardHat,
  ArrowLeftRight,
  BarChart3,
  FileSpreadsheet,
  ChevronRight,
  Building2,
  Wallet,
  Settings,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/format";
import { getYearlyFinancials } from "@/lib/dashboard-data";
import { Card, CardContent } from "@/components/ui/card";

async function getMenuData() {
  const [activeProperties, activeTenantLeases, yearly] = await Promise.all([
    prisma.property.count({ where: { status: "ACTIVE" } }),
    prisma.tenantLease.count({ where: { status: "ACTIVE" } }),
    getYearlyFinancials(1),
  ]);

  return {
    activeProperties,
    activeTenantLeases,
    ytdNet: yearly[0]?.net ?? 0,
  };
}

export default async function MenuPage() {
  const t = await getTranslations("Mobile");
  const nav = await getTranslations("Nav");
  const data = await getMenuData();

  const navItems = [
    { href: "/vacant-units", label: nav("vacantUnits"), icon: DoorOpen },
    { href: "/tenants", label: nav("tenants"), icon: Users },
    { href: "/utility-bills", label: nav("utilityBills"), icon: Zap },
    { href: "/guest-stays", label: nav("guestStays"), icon: BedDouble },
    { href: "/employees", label: nav("employees"), icon: HardHat },
    { href: "/transactions", label: nav("transactions"), icon: ArrowLeftRight },
    { href: "/reports", label: nav("reports"), icon: BarChart3 },
    { href: "/import-export", label: nav("importExport"), icon: FileSpreadsheet },
    { href: "/settings", label: nav("settings"), icon: Settings },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 md:hidden">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("menuNavigate")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{nav("brand")}</h1>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("menuQuickStats")}
        </p>
        <Card className="mb-3 border-none bg-linear-to-br from-primary/12 via-card to-card">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Wallet className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t("menuYtdProfit")}</p>
              <p
                className={`truncate font-mono text-xl font-bold tabular-nums ${
                  data.ytdNet >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatTaka(data.ytdNet)}
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none bg-linear-to-br from-blue-500/10 via-card to-card">
            <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
              <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-lg font-bold tabular-nums">
                {data.activeProperties}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {t("menuTotalProperties")}
              </span>
            </CardContent>
          </Card>
          <Card className="border-none bg-linear-to-br from-violet-500/10 via-card to-card">
            <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
              <Users className="size-4 text-violet-600 dark:text-violet-400" />
              <span className="font-mono text-lg font-bold tabular-nums">
                {data.activeTenantLeases}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {t("menuTotalTenants")}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.label}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
