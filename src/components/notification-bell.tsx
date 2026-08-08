"use client";

import { useTranslations } from "next-intl";
import { Bell, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/dashboard-data";

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("Dashboard");
  const visible = items.slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative size-8" />}>
        <Bell className="size-4" />
        {items.length > 0 ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">{t("notifications")}</span>
          {items.length > 0 ? (
            <span className="text-xs text-muted-foreground">{items.length}</span>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="size-5 text-success" />
              {t("allClear")}
            </div>
          ) : (
            visible.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className="flex items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.tone === "destructive" ? "bg-destructive" : "bg-warning"
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.subtitle}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
