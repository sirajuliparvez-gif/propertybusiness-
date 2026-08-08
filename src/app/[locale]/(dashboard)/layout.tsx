import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { MobileTopBar } from "@/components/mobile/mobile-top-bar";
import { MobileTabBar } from "@/components/mobile/mobile-tab-bar";
import { getActionRequiredData, toNotificationList } from "@/lib/dashboard-data";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUser();

  const notifications = toNotificationList(await getActionRequiredData());

  return (
    <SidebarProvider>
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <SidebarInset>
        <div className="hidden print:hidden md:block">
          <SiteHeader notifications={notifications} />
        </div>
        <div className="print:hidden md:hidden">
          <MobileTopBar notifications={notifications} />
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 print:p-0">
          {children}
        </main>
        <div className="print:hidden md:hidden">
          <MobileTabBar />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
