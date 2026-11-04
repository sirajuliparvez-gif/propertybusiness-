import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { Users, Wallet, CheckCircle2, AlertTriangle, Percent, FileText } from "lucide-react";
import { getAllStaffData } from "@/lib/employees-data";
import { StaffTable } from "@/components/properties/staff-table";
import { MobileStaffList } from "@/components/mobile/mobile-staff-list";
import { AddEmployeeDialogGlobal } from "@/components/properties/add-employee-dialog-global";
import { StatTile } from "@/components/stat-tile";
import { formatTaka } from "@/lib/format";

export default async function EmployeesPage() {
  const t = await getTranslations("Properties");
  const {
    staff,
    totalActiveStaff,
    totalMonthlyPayroll,
    paidThisMonth,
    totalPastDuePayroll,
    payrollSettledRate,
    properties,
  } = await getAllStaffData();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("staff")}</h1>
          <p className="text-sm text-muted-foreground">{t("staffPageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" render={<Link href="/employees/report" />} nativeButton={false}><FileText className="size-4" />{t("salaryReportTitle")}</Button>
          <AddEmployeeDialogGlobal properties={properties} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <StatTile
          label={t("activeStaffCount")}
          value={String(totalActiveStaff)}
          icon={Users}
          tone="default"
        />
        <StatTile
          label={t("monthlyPayroll")}
          value={formatTaka(totalMonthlyPayroll)}
          icon={Wallet}
          tone="violet"
        />
        <StatTile
          label={t("payrollPaidThisMonth")}
          value={formatTaka(paidThisMonth)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatTile
          label={t("overduePayroll")}
          value={formatTaka(totalPastDuePayroll)}
          icon={AlertTriangle}
          tone={totalPastDuePayroll > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("payrollSettledRate")}
          value={`${payrollSettledRate}%`}
          icon={Percent}
          tone="teal"
        />
      </div>

      <MobileStaffList staff={staff} />
      <div className="hidden md:block">
        <StaffTable staff={staff} payrollCost={totalMonthlyPayroll} showPropertyColumn />
      </div>
    </div>
  );
}
