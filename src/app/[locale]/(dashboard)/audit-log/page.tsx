import { getLocale, getTranslations } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";

const ACTION_KEYS: Record<string, string> = {
  "transaction.update": "auditActTransactionUpdate",
  "transaction.delete": "auditActTransactionDelete",
  "rentPayment.update": "auditActRentPaymentUpdate",
  "rentPayment.delete": "auditActRentPaymentDelete",
  "utilityBill.update": "auditActUtilityBillUpdate",
  "utilityBill.delete": "auditActUtilityBillDelete",
  "salaryPayment.reverse": "auditActSalaryReverse",
  "utilityPayment.reverse": "auditActUtilityReverse",
  "ownerWithdrawal.create": "auditActOwnerWithdrawal",
  "property.delete": "auditActPropertyDelete",
  "lease.vacate": "auditActLeaseVacate",
  "lease.reactivate": "auditActLeaseReactivate",
  "unit.status": "auditActUnitStatus",
  "import.run": "auditActImport",
};

const LIMIT = 200;

// Who deleted or changed money and records, newest first. Admins only.
export default async function AuditLogPage() {
  await requireAdmin();
  const t = await getTranslations("Settings");
  const locale = await getLocale();
  const formatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });

  // The log table is created by a one-off SQL migration; until it exists the page says so instead of failing.
  const rows = await prisma.auditLog
    .findMany({ orderBy: { createdAt: "desc" }, take: LIMIT })
    .catch(() => null);

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ScrollText className="size-6" />
          {t("auditLogTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auditLogSubtitle", { count: LIMIT })}</p>
      </div>

      {rows === null ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("auditLogNotReady")}</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("auditLogEmpty")}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("auditColWhen")}</th>
                  <th className="px-3 py-2 font-medium">{t("auditColWho")}</th>
                  <th className="px-3 py-2 font-medium">{t("auditColAction")}</th>
                  <th className="px-3 py-2 font-medium">{t("auditColDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatter.format(row.createdAt)}</td>
                    <td className="px-3 py-2">
                      {row.userName ?? "—"}
                      {row.userRole ? <span className="ml-1 text-xs text-muted-foreground">({row.userRole})</span> : null}
                    </td>
                    <td className="px-3 py-2 font-medium">{ACTION_KEYS[row.action] ? t(ACTION_KEYS[row.action]) : row.action}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
