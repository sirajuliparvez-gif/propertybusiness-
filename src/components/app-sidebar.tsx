"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Building2,
  LayoutDashboard,
  Users,
  Wallet,
  Zap,
  DoorOpen,
  BedDouble,
  HardHat,
  ArrowLeftRight,
  BarChart3,
  Settings,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  prefetch?: boolean;
};

export function AppSidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const groups: { label?: string; items: SidebarItem[] }[] = [
    {
      items: [
        { href: "/", label: t("dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      label: t("sidebarArrears"),
      items: [
        { href: "/rent/arrears", label: t("rentArrears"), icon: HandCoins, prefetch: false },
        { href: "/utility-bills/arrears", label: t("utilityArrears"), icon: Zap, prefetch: false },
      ],
    },
    {
      label: t("quickActions"),
      items: [
        { href: "/transactions?add=expense", label: t("quickExpense"), icon: Receipt, prefetch: false },
      ],
    },
    {
      label: t("sidebarMoney"),
      items: [
        { href: "/rent", label: t("rent"), icon: Wallet },
        { href: "/utility-bills", label: t("utilityBills"), icon: Zap },
        { href: "/transactions", label: t("transactions"), icon: ArrowLeftRight },
      ],
    },
    {
      label: t("sidebarManagement"),
      items: [
        { href: "/tenants", label: t("tenants"), icon: Users },
        { href: "/properties", label: t("properties"), icon: Building2 },
        { href: "/vacant-units", label: t("vacantUnits"), icon: DoorOpen },
        { href: "/employees", label: t("employees"), icon: HardHat },
        { href: "/guest-stays", label: t("guestStays"), icon: BedDouble },
      ],
    },
    {
      label: t("sidebarReports"),
      items: [
        { href: "/rent/report", label: t("quickRentReport"), icon: FileText, prefetch: false },
        { href: "/reports/market", label: t("allMarketReport"), icon: Building2, prefetch: false },
        { href: "/reports", label: t("reports"), icon: BarChart3 },
        { href: "/import-export", label: t("importExport"), icon: FileSpreadsheet },
      ],
    },
  ];
  const items = groups.flatMap((group) => group.items);
  const currentPage = items.find((item) => item.href === pathname);
  const activeItem = currentPage ?? items.find((item) => pathname.startsWith(`${item.href}/`));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-(--shadow-sm)">
                <Image src="/logo.jpg" alt="" width={32} height={32} className="size-full object-contain" />
              </div>
              <span className="truncate font-semibold">{t("brand")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:overflow-x-hidden group-data-[collapsible=icon]:overflow-y-auto">
        {groups.map(({ label, items }) => (
          <SidebarGroup
            key={items[0].href}
            role={label ? "group" : undefined}
            aria-label={label}
            className="py-1"
          >
            {label ? (
              <SidebarGroupLabel className="h-6 group-data-[collapsible=icon]:-mt-6">
                {label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={item === activeItem}
                      tooltip={item.label}
                      render={
                        <Link
                          href={item.href}
                          prefetch={item.prefetch}
                          aria-current={item === currentPage ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/settings"}
              tooltip={t("settings")}
              render={<Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined} />}
            >
              <Settings />
              <span>{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
