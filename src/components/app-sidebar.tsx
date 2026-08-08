"use client";

import { useTranslations } from "next-intl";
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
  Building,
  FileSpreadsheet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-linear-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-(--shadow-sm)">
                <Building className="size-4" />
              </div>
              <span className="truncate font-semibold">{t("brand")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
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
