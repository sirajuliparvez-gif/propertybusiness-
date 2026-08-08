"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Building } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import type { NotificationItem } from "@/lib/dashboard-data";

export function MobileTopBar({ notifications }: { notifications: NotificationItem[] }) {
  const t = useTranslations("Nav");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 shadow-(--shadow-xs) backdrop-blur-md md:hidden">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-(--shadow-sm)">
          <Building className="size-3.5" />
        </div>
        <span className="truncate text-sm font-semibold">{t("brand")}</span>
      </Link>
      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>
      <NotificationBell items={notifications} />
    </header>
  );
}
