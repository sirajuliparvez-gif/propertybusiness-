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

export function AppSidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items = [
    { href: "/", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/properties", label: t("properties"), icon: Building2 },
    { href: "/vacant-units", label: t("vacantUnits"), icon: DoorOpen },
    { href: "/tenants", label: t("tenants"), icon: Users },
    { href: "/rent", label: t("rent"), icon: Wallet },
    { href: "/utility-bills", label: t("utilityBills"), icon: Zap },
    { href: "/guest-stays", label: t("guestStays"), icon: BedDouble },
    { href: "/employees", label: t("employees"), icon: HardHat },
    { href: "/transactions", label: t("transactions"), icon: ArrowLeftRight },
    { href: "/reports", label: t("reports"), icon: BarChart3 },
    { href: "/import-export", label: t("importExport"), icon: FileSpreadsheet },
  ];

  const shortcuts = [
    { href: "/rent/arrears", label: t("quickRentArrears"), icon: HandCoins },
    { href: "/rent/report", label: t("quickRentReport"), icon: FileText },
    { href: "/utility-bills?add=bill", label: t("quickUtilityBill"), icon: Zap },
    { href: "/transactions?add=expense", label: t("quickExpense"), icon: Receipt },
  ];
  const activeShortcut = shortcuts.find((item) => pathname === item.href);

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
      <SidebarContent>
        <SidebarGroup className="border-b border-sidebar-border">
          <SidebarGroupLabel>{t("quickActions")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shortcuts.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={item === activeShortcut}
                    tooltip={item.label}
                    render={<Link href={item.href} prefetch={false} aria-current={item === activeShortcut ? "page" : undefined} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : !activeShortcut && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("settings")}
              render={<Link href="/settings" />}
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
