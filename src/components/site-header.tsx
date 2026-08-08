"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { LogoutButton } from "@/components/auth/logout-button";
import type { NotificationItem } from "@/lib/dashboard-data";

export function SiteHeader({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 min-w-0 shrink-0 items-center gap-2 border-b bg-background/70 px-3 shadow-(--shadow-xs) backdrop-blur-md sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="min-w-0 max-w-72 flex-1">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell items={notifications} />
        <LocaleToggle />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        <LogoutButton />
      </div>
    </header>
  );
}
