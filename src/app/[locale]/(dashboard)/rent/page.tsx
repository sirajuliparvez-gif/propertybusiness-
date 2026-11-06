import { Link, redirect } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";
import { TrendingUp, CheckCircle2, AlertTriangle, Percent, FileText } from "lucide-react";
import { getRentCollectionData } from "@/lib/tenants-data";
import { RentCollectionTable } from "@/components/properties/rent-collection-table";
import { MobileRentList } from "@/components/mobile/mobile-rent-list";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { findRentBill } from "@/lib/rent-bill-search";
import { RentBillSearch } from "@/components/properties/rent-bill-search";
import { RentMonthSelect } from "@/components/properties/rent-month-select";

export default async function RentCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tenant?: string; billSearch?: string; billMarket?: string; billMonth?: string }>;
}) {
  const t = await getTranslations("Properties");
  const arrears = await getTranslations("RentArrears");
  const { month, tenant, billSearch, billMarket, billMonth } = await searchParams;
  const query = typeof billSearch === "string" ? billSearch.trim().slice(0, 48) : undefined;
  const marketId = typeof billMarket === "string" ? billMarket : undefined;
  const lookupMonth = typeof billMonth === "string" ? billMonth : undefined;
  let searchError: string | undefined;
  if (query) {
    await requireCurrentUser();
    const result = await findRentBill(query, marketId, lookupMonth);
    if (result.bill) {
      redirect({ href: `/rent/${encodeURIComponent(result.bill.tenantLeaseId)}/invoice?month=${result.bill.month}&tenant=1`, locale: await getLocale() });
    }
    searchError = result.error;
  }
  const tenantLeaseId = typeof tenant === "string" && tenant ? tenant : undefined;
  const [rentCollection, markets] = await Promise.all([
    getRentCollectionData(month, tenantLeaseId),
    prisma.property.findMany({
      where: { OR: [{ deletedAt: null }, { rentBillNumbers: { some: {} } }] },
      select: { id: true, name: true, billMarketCode: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const { payments, totalDue, totalCollected, totalRemaining, collectionRate } = rentCollection;

  return (
    <>
    <div className="flex flex-wrap justify-end gap-2 print:hidden">
      <Button variant="outline" render={<Link href="/rent/arrears" />} nativeButton={false}>
        <FileText className="size-4" />{arrears("title")}
      </Button>
      <Button variant="outline" render={<Link href={`/rent/report?month=${rentCollection.selectedMonth}`} />} nativeButton={false}>
        <FileText className="size-4" />{t("monthlyReportTitle")}
      </Button>
    </div>
    {tenantLeaseId ? (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span>{payments[0]?.tenantName ?? t("rentSelectedTenant")}</span>
        <Button size="sm" variant="outline" render={<Link href={`/rent?month=${rentCollection.selectedMonth}`} />} nativeButton={false}>
          {t("rentShowAllTenants")}
        </Button>
      </div>
    ) : null}
    <RentBillSearch markets={markets} month={rentCollection.selectedMonth} query={query}
      marketId={marketId} billMonth={lookupMonth} error={searchError} />
    <MobileRentList key={tenantLeaseId ?? "all"} {...rentCollection} tenantLeaseId={tenantLeaseId} />
    <div className="hidden min-w-0 flex-1 flex-col gap-6 md:flex">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("rentCollectionTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("rentPageSubtitle")}</p>
        </div>
        <RentMonthSelect months={rentCollection.availableMonths} selectedMonth={rentCollection.selectedMonth} tenantLeaseId={tenantLeaseId} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("expectedIncome")}
          value={formatTaka(totalDue)}
          icon={TrendingUp}
          tone="default"
        />
        <StatTile
          label={t("collectedForMonth")}
          value={formatTaka(totalCollected)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatTile
          label={t("collectionPendingAmount")}
          value={formatTaka(totalRemaining)}
          icon={AlertTriangle}
          tone={totalRemaining > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("collectionRate")}
          value={`${collectionRate}%`}
          icon={Percent}
          tone="teal"
        />
      </div>

      <RentCollectionTable key={tenantLeaseId ?? "all"} payments={payments} selectedMonth={rentCollection.selectedMonth} tenantLeaseId={tenantLeaseId} />
    </div>
    </>
  );
}
