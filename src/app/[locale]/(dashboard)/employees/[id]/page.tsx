import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Phone, Building2, Wallet, CheckCircle2, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { StatTile } from "@/components/stat-tile";
import { RecordPayrollPaymentDialog } from "@/components/properties/record-payroll-payment-dialog";
import { EmployeeActions } from "@/components/properties/employee-actions";
import { EditEmployeeDialog } from "@/components/properties/edit-employee-dialog";
import { getEmployeeProfile, getActiveProperties } from "@/lib/employees-data";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const [employee, properties] = await Promise.all([getEmployeeProfile(id), getActiveProperties()]);
  if (!employee) notFound();

  const isTerminated = employee.status === "TERMINATED";
  const isInactive = employee.status === "INACTIVE";
  const payrollStatusLabels = { PAID: t("paid"), PENDING: t("pending") };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/employees" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("staff")} / {employee.displayId}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-5">
        <div className="flex items-center gap-4">
          <InitialAvatar name={employee.name} className="size-14 text-lg" />
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {employee.displayId} · {employee.role}
            </p>
            <h1 className="text-xl font-bold tracking-tight">{employee.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {employee.contactInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-mono">
                  <Phone className="size-3" />
                  {employee.contactInfo}
                </span>
              ) : null}
              {employee.propertyId ? (
                <Link
                  href={`/properties/${employee.propertyId}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Building2 className="size-3" />
                  {employee.propertyName}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                  <Building2 className="size-3" />
                  {t("companyStaffLabel")}
                </span>
              )}
              {isTerminated ? (
                <Badge className="border-transparent bg-muted text-muted-foreground">
                  {t("filterFormer")}
                </Badge>
              ) : isInactive ? (
                <Badge className="border-transparent bg-muted text-muted-foreground">
                  {t("inactiveLabel")}
                </Badge>
              ) : (
                <StatusPill status={employee.payrollStatus} labels={payrollStatusLabels} />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditEmployeeDialog
            employeeId={employee.id}
            propertyId={employee.propertyId}
            properties={properties}
            name={employee.name}
            contactInfo={employee.contactInfo}
            nidNumber={employee.nidNumber}
            role={employee.role}
            salaryAmount={employee.salaryAmount}
            notes={employee.notes}
            returnTo={`/employees/${employee.id}`}
          />
          {!isTerminated ? (
            <>
              <RecordPayrollPaymentDialog
                propertyId={employee.propertyId}
                employeeId={employee.id}
                defaultAmount={employee.salaryAmount}
                returnTo={`/employees/${employee.id}`}
              />
              <EmployeeActions
                employeeId={employee.id}
                propertyId={employee.propertyId}
                status={employee.status}
                returnTo={`/employees/${employee.id}`}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("salary")}
          value={formatTaka(employee.salaryAmount)}
          icon={Wallet}
          tone="default"
          hint={t("perMonth")}
        />
        <StatTile
          label={t("totalPaid")}
          value={formatTaka(employee.totalPaid)}
          icon={CheckCircle2}
          tone="success"
          hint={`${employee.payments.length} ${t("entries")}`}
        />
        <StatTile
          label={t("onTimeRate")}
          value={employee.onTimeRate != null ? `${employee.onTimeRate}%` : "—"}
          icon={Clock}
          tone={employee.onTimeRate == null || employee.onTimeRate >= 80 ? "teal" : "warning"}
          hint={t("monthsTrackedHint", { count: employee.trackedMonths })}
        />
        <StatTile
          label={t("duration")}
          value={`${employee.durationMonths} ${t("months")}`}
          icon={Clock}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("employeeInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("role")}</span>
              <span className="font-medium">{employee.role}</span>
            </div>
            {employee.contactInfo ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("phone")}</span>
                <span className="font-mono font-medium">{employee.contactInfo}</span>
              </div>
            ) : null}
            {employee.nidNumber ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("nidNumber")}</span>
                <span className="font-mono font-medium">{employee.nidNumber}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("propertyLabel")}</span>
              <span className="font-medium">{employee.propertyName ?? t("companyStaffLabel")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("joined")}</span>
              <span className="font-mono font-medium tabular-nums">{formatDate(employee.joinedAt)}</span>
            </div>
            {isTerminated && employee.terminatedAt ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("terminatedOn")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatDate(employee.terminatedAt)}
                </span>
              </div>
            ) : null}
            {employee.notes ? (
              <div className="border-t pt-1.5">
                <span className="text-muted-foreground">{t("notes")}</span>
                <p className="mt-0.5 font-medium">{employee.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("payrollSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
                <p className="font-mono font-semibold tabular-nums text-success">
                  {formatTaka(employee.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("entries")}</p>
                <p className="font-mono font-semibold tabular-nums">{employee.payments.length}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{t("preferredPaymentMethod")}</span>
              <span className="font-medium">{paymentMethodLabel(t, employee.preferredMethod)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("avgPaymentDay")}</span>
              <span className="font-mono font-medium tabular-nums">
                {employee.avgPaymentDay != null ? employee.avgPaymentDay : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("payrollHistorySection")} — {employee.payments.length} {t("months")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noPayrollPayments")}</p>
          ) : (
            <>
            <Card className="overflow-hidden p-0 md:hidden">
              <ul className="divide-y">
                {employee.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium">{p.month}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {paymentMethodLabel(t, p.method)}
                        {p.paidAt ? ` · ${formatDate(p.paidAt)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {formatTaka(p.amountPaid)}
                      </p>
                      <StatusPill status={p.status} labels={payrollStatusLabels} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("monthColumn")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead>{t("paidDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.month}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatTaka(p.amountPaid)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {paymentMethodLabel(t, p.method)}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {p.paidAt ? formatDate(p.paidAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.status} labels={payrollStatusLabels} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
