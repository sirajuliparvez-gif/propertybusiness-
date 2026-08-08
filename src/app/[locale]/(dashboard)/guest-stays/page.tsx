import { getTranslations } from "next-intl/server";
import { BedDouble, LogIn, LogOut, Wallet } from "lucide-react";
import { getAllGuestStaysData } from "@/lib/guest-stays-data";
import { GuestStaysTable } from "@/components/properties/guest-stays-table";
import { MobileGuestStaysList } from "@/components/mobile/mobile-guest-stays-list";
import { AddGuestStayDialogGlobal } from "@/components/properties/add-guest-stay-dialog-global";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function GuestStaysPage() {
  const t = await getTranslations("Properties");
  const { bookings, propertiesWithUnits, currentlyCheckedIn, todayCheckIns, todayCheckOuts, monthlyRevenue } =
    await getAllGuestStaysData();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("guestStaysPageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("guestStaysPageSubtitle")}</p>
        </div>
        {propertiesWithUnits.length > 0 ? (
          <AddGuestStayDialogGlobal properties={propertiesWithUnits} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("currentlyCheckedIn")}
          value={String(currentlyCheckedIn)}
          icon={BedDouble}
          tone="teal"
        />
        <StatTile
          label={t("todayCheckIns")}
          value={String(todayCheckIns)}
          icon={LogIn}
          tone="default"
        />
        <StatTile
          label={t("todayCheckOuts")}
          value={String(todayCheckOuts)}
          icon={LogOut}
          tone="violet"
        />
        <StatTile
          label={t("collectedThisMonth")}
          value={formatTaka(monthlyRevenue)}
          icon={Wallet}
          tone="success"
        />
      </div>

      <MobileGuestStaysList bookings={bookings} />
      <div className="hidden md:block">
        <GuestStaysTable bookings={bookings} showPropertyColumn />
      </div>
    </div>
  );
}
