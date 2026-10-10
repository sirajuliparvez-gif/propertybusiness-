import { getTranslations } from "next-intl/server";
import { TrendingUp, CheckCircle2, AlertTriangle, Percent } from "lucide-react";
import { getRentCollectionData } from "@/lib/tenants-data";
import { RentCollectionTable } from "@/components/properties/rent-collection-table";
import { MobileRentList } from "@/components/mobile/mobile-rent-list";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";
import { RentMonthSelect } from "@/components/properties/rent-month-select";

export default async function RentCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = await getTranslations("Properties");
  const { month } = await searchParams;
  const rentCollection = await getRentCollectionData(month);
  const { payments, totalDue, totalCollected, totalRemaining, collectionRate } = rentCollection;

  return (
    <>
    <MobileRentList {...rentCollection} />
    <div className="hidden min-w-0 flex-1 flex-col gap-6 md:flex">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("rentCollectionTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("rentPageSubtitle")}</p>
        </div>
        <RentMonthSelect months={rentCollection.availableMonths} selectedMonth={rentCollection.selectedMonth} />
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

      <RentCollectionTable payments={payments} selectedMonth={rentCollection.selectedMonth} />
    </div>
    </>
  );
}
