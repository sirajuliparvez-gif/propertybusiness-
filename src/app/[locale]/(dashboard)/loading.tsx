import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DashboardLoading() {
  const t = await getTranslations("Dashboard");
  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
