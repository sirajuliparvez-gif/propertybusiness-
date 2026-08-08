"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Home, Wallet, Plus, Building2, Menu as MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickActionsSheet } from "@/components/mobile/quick-actions-sheet";

export function MobileTabBar() {
  const t = useTranslations("Mobile");
  const pathname = usePathname();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const tabs = [
    { id: "home", href: "/", label: t("tabHome"), icon: Home },
    { id: "rent", href: "/rent", label: t("tabRent"), icon: Wallet },
    { id: "properties", href: "/properties", label: t("tabProperties"), icon: Building2 },
    { id: "menu", href: "/menu", label: t("tabMenu"), icon: MenuIcon },
  ] as const;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const mid = Math.ceil(tabs.length / 2);
  const leftTabs = tabs.slice(0, mid);
  const rightTabs = tabs.slice(mid);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-(--shadow-md) backdrop-blur supports-backdrop-filter:bg-card/80 md:hidden"
        aria-label={t("tabMenu")}
      >
        {leftTabs.map((tab) => (
          <TabLink key={tab.id} tab={tab} active={isActive(tab.href)} />
        ))}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setQuickActionsOpen(true)}
            aria-label={t("tabAdd")}
            className="-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-(--shadow-md) ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </button>
        </div>

        {rightTabs.map((tab) => (
          <TabLink key={tab.id} tab={tab} active={isActive(tab.href)} />
        ))}
      </nav>

      <QuickActionsSheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />
    </>
  );
}

function TabLink({
  tab,
  active,
}: {
  tab: { href: string; label: string; icon: typeof Home };
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
      <span>{tab.label}</span>
    </Link>
  );
}
