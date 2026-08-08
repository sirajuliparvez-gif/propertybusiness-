import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Phone,
  Building2,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Clock,
  FileText,
  Printer,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { StatusPill } from "@/components/properties/status-pill";
import { StatTile } from "@/components/stat-tile";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { VacateTenantDialog } from "@/components/properties/vacate-tenant-dialog";
import { EditTenantDialog } from "@/components/properties/edit-tenant-dialog";
import { AddUtilityBillDialog } from "@/components/properties/add-utility-bill-dialog";
import { UtilityBillsTable } from "@/components/properties/utility-bills-table";
import { MobileUtilityBillsList } from "@/components/mobile/mobile-utility-bills-list";
import { getTenantProfile } from "@/lib/tenants-data";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const tenant = await getTenantProfile(id);
  if (!tenant) notFound();

  const isFormer = tenant.leaseStatus !== "ACTIVE";
  const rentStatusLabels = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };
  const progressPct = tenant.totalDue > 0 ? Math.min(100, Math.round((tenant.totalPaid / tenant.totalDue) * 100)) : 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/tenants" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("tenants")} / {tenant.displayId}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-5">
        <div className="flex items-center gap-4">
          <InitialAvatar name={tenant.tenantName} className="size-14 text-lg" />
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {tenant.displayId}
              {tenant.occupation ? ` · ${tenant.occupation}` : ""}
            </p>
            <h1 className="text-xl font-bold tracking-tight">{tenant.tenantName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {tenant.contactInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-mono">
                  <Phone className="size-3" />
                  {tenant.contactInfo}
                </span>
              ) : null}
              <Link
                href={`/properties/${tenant.propertyId}`}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Building2 className="size-3" />
                {tenant.propertyName} · {tenant.unitLabel}
              </Link>
              {isFormer ? (
                <Badge className="border-transparent bg-muted text-muted-foreground">
                  {t("vacatedLabel")}
                </Badge>
              ) : (
                <StatusPill status={tenant.rentStatus} labels={rentStatusLabels} />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href={`/tenants/${tenant.id}/invoice`} />} nativeButton={false}>
            <Printer className="size-3.5" />
            {t("invoiceLabel")}
          </Button>
          <EditTenantDialog
            leaseId={tenant.id}
            tenantId={tenant.tenantId}
            tenantName={tenant.tenantName}
            contactInfo={tenant.contactInfo}
            occupation={tenant.occupation}
            tenantType={tenant.tenantType}
            nidNumber={tenant.nidNumber}
            businessRegistrationNumber={tenant.businessRegistrationNumber}
            monthlyRentAmount={tenant.monthlyRentAmount}
            initialDownpaymentAmount={tenant.initialDownpaymentAmount}
            currentDownpaymentBalance={tenant.currentDownpaymentBalance}
            serviceChargeType={tenant.serviceChargeType}
            serviceChargeValue={tenant.serviceChargeValue}
            notes={tenant.notes}
            returnTo={`/tenants/${tenant.id}`}
          />
          {!isFormer ? (
            <>
              <RecordTenantRentPaymentDialog
                propertyId={tenant.propertyId}
                tenantLeaseId={tenant.id}
                monthlyRentAmount={tenant.monthlyRentAmount}
                currentDownpaymentBalance={tenant.currentDownpaymentBalance}
                serviceChargeType={tenant.serviceChargeType}
                serviceChargeValue={tenant.serviceChargeValue}
                returnTo={`/tenants/${tenant.id}`}
              />
              <VacateTenantDialog
                leaseId={tenant.id}
                propertyId={tenant.propertyId}
                tenantName={tenant.tenantName}
                currentDownpaymentBalance={tenant.currentDownpaymentBalance}
                returnTo="/tenants"
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatTile
          label={t("leaseMonthlyRent")}
          value={formatTaka(tenant.monthlyRentAmount)}
          icon={Wallet}
          tone="default"
          hint={t("perMonth")}
        />
        <StatTile
          label={t("totalPaid")}
          value={formatTaka(tenant.totalPaid)}
          icon={CheckCircle2}
          tone="success"
          hint={`${tenant.payments.length} ${t("entries")}`}
        />
        <StatTile
          label={t("downpaymentBalance")}
          value={formatTaka(tenant.currentDownpaymentBalance)}
          icon={TrendingUp}
          tone="violet"
        />
        <StatTile
          label={t("onTimeRate")}
          value={tenant.onTimeRate != null ? `${tenant.onTimeRate}%` : "—"}
          icon={Clock}
          tone={tenant.onTimeRate == null || tenant.onTimeRate >= 80 ? "teal" : "warning"}
          hint={t("monthsTrackedHint", { count: tenant.trackedMonths })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tenantInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {tenant.occupation ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("tenantOccupation")}</span>
                <span className="font-medium">{tenant.occupation}</span>
              </div>
            ) : null}
            {tenant.contactInfo ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("tenantContact")}</span>
                <span className="font-mono font-medium">{tenant.contactInfo}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("propertyLabel")}</span>
              <span className="font-medium">{tenant.propertyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("unit")}</span>
              <span className="font-mono font-medium">{tenant.unitLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("leaseStarted")}</span>
              <span className="font-mono font-medium tabular-nums">{formatDate(tenant.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("duration")}</span>
              <span className="font-mono font-medium tabular-nums">
                {tenant.durationMonths} {t("months")}
              </span>
            </div>
            {isFormer && tenant.movedOutAt ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("vacatedOn")}</span>
                <span className="font-mono font-medium tabular-nums">{formatDate(tenant.movedOutAt)}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("paymentSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("totalDueLabel")}</p>
                <p className="font-mono font-semibold tabular-nums">{formatTaka(tenant.totalDue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("paid")}</p>
                <p className="font-mono font-semibold tabular-nums text-success">{formatTaka(tenant.totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("remaining")}</p>
                <p
                  className={`font-mono font-semibold tabular-nums ${tenant.remaining > 0 ? "text-destructive" : ""}`}
                >
                  {formatTaka(tenant.remaining)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{t("preferredPaymentMethod")}</span>
              <span className="font-medium">{paymentMethodLabel(t, tenant.preferredMethod)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("avgPaymentDay")}</span>
              <span className="font-mono font-medium tabular-nums">
                {tenant.avgPaymentDay != null ? tenant.avgPaymentDay : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("downpaymentDetailsSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("initialDownpayment")}</p>
              <p className="font-mono font-semibold tabular-nums">
                {formatTaka(tenant.initialDownpaymentAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("totalAdjusted")}</p>
              <p className="font-mono font-semibold tabular-nums text-warning">
                {formatTaka(tenant.totalAdjustedFromDownpayment)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("downpaymentBalance")}</p>
              <p className="font-mono font-semibold tabular-nums text-success">
                {formatTaka(tenant.currentDownpaymentBalance)}
              </p>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("adjustmentHistory")}</p>
            {tenant.downpaymentAdjustments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("noAdjustments")}</p>
            ) : (
              <>
              <div className="flex flex-col gap-1.5 md:hidden">
                {tenant.downpaymentAdjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{a.month}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(a.createdAt)}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-warning">
                      {formatTaka(a.amountAdjusted)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adjustedFor")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead>{t("reason")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.downpaymentAdjustments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.month}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-warning">
                        {formatTaka(a.amountAdjusted)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {tenant.tenantDocuments.length > 0 || tenant.leaseDocuments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tenantDocuments")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tenant.tenantDocuments.map((d, i) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-primary hover:underline"
              >
                <FileText className="size-3.5" />
                {d.label === "NID_CARD"
                  ? t("nidPhoto")
                  : d.label === "TENANT_PHOTO"
                    ? t("tenantPhoto")
                    : // Legacy documents uploaded before the label field existed —
                      // fall back to a positional name rather than guessing.
                      `${t("tenantDocuments")} ${i + 1}`}
              </a>
            ))}
            {tenant.leaseDocuments.map((d) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-primary hover:underline"
              >
                <FileText className="size-3.5" />
                {t("agreementCopyLabel")}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("utilityBillsSection")}</CardTitle>
          {!isFormer ? (
            <AddUtilityBillDialog
              propertyId={tenant.propertyId}
              fixedUnitId={tenant.unitId}
              returnTo={`/tenants/${tenant.id}`}
              previousElectricityReadingByUnit={tenant.previousElectricityReadingByUnit}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          <MobileUtilityBillsList bills={tenant.utilityBills} returnTo={`/tenants/${tenant.id}`} />
          <div className="hidden md:block">
            <UtilityBillsTable bills={tenant.utilityBills} returnTo={`/tenants/${tenant.id}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("paymentHistorySection")} — {tenant.payments.length} {t("months")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noRentPayments")}</p>
          ) : (
            <>
            <Card className="overflow-hidden p-0 md:hidden">
              <ul className="divide-y">
                {tenant.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium">{p.month}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.status === "ADJUSTED_FROM_DOWNPAYMENT"
                          ? t("adjustFromDownpayment")
                          : paymentMethodLabel(t, p.method)}
                        {p.paidAt ? ` · ${formatDate(p.paidAt)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {formatTaka(p.paidAmount)}
                      </p>
                      <StatusPill status={p.status} labels={rentStatusLabels} />
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
                {tenant.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.month}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatTaka(p.paidAmount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.status === "ADJUSTED_FROM_DOWNPAYMENT" ? (
                        <span className="text-xs font-medium text-primary">{t("adjustFromDownpayment")}</span>
                      ) : (
                        paymentMethodLabel(t, p.method)
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {p.paidAt ? formatDate(p.paidAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.status} labels={rentStatusLabels} />
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
