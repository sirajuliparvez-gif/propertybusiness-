import { NotificationBell } from "@/components/notification-bell";
import { getActionRequiredData, toNotificationList } from "@/lib/dashboard-data";

export async function DashboardNotifications() {
  // Shares the dashboard's request-scoped query, but streams independently
  // so other pages never wait for notification data before they can render.
  const data = await getActionRequiredData();
  return <NotificationBell items={toNotificationList(data)} />;
}
