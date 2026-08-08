import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import {
  ArrowLeft,
  Building2,
  MapPin,
  User,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Pencil,
  Users2,
  HardHat,
  Banknote,
  AlertTriangle,
  DoorOpen,
  UserX,
  Zap,
  BedDouble,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/stat-tile";
import { TenantsTable } from "@/components/properties/tenants-table";
import { StaffTable } from "@/components/properties/staff-table";
import { GuestStaysTable } from "@/components/properties/guest-stays-table";
import { MobileTenantsList } from "@/components/mobile/mobile-tenants-list";
import { MobileStaffList } from "@/components/mobile/mobile-staff-list";
import { MobileGuestStaysList } from "@/components/mobile/mobile-guest-stays-list";
import { MobileUtilityBillsList } from "@/components/mobile/mobile-utility-bills-list";
import { AddGuestStayDialogGlobal } from "@/components/properties/add-guest-stay-dialog-global";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import { getPropertyDetail, getAllTenants } from "@/lib/properties-data";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { AddUnitTypeDialog } from "@/components/properties/add-unit-type-dialog";
import { EditUnitTypeDialog } from "@/components/properties/edit-unit-type-dialog";
import { UnitDetailDialog } from "@/components/properties/unit-detail-dialog";
import { AddExpenseDialog } from "@/components/properties/add-expense-dialog";
import { AddUtilityBillDialog } from "@/components/properties/add-utility-bill-dialog";
import { UtilityBillsTable } from "@/components/properties/utility-bills-table";
import { RecordOwnerRentPaymentDialog } from "@/components/properties/record-owner-rent-payment-dialog";
import { EndLeaseAgreementButton } from "@/components/properties/end-lease-agreement-button";
import { RenewLeaseAgreementDialog } from "@/components/properties/renew-lease-agreement-dialog";
import { getTypeIcon } from "@/lib/property-types";

const EXPENSE_TYPE_LABEL_KEYS: Record<string, string> = {
  UTILITY_EXPENSE: "expenseTypeUtility",
  MAINTENANCE_EXPENSE: "expenseTypeMaintenance",
  OTHER: "expenseTypeOther",
};

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const format = await getFormatter();
  const property = await getPropertyDetail(id);

  if (!property) notFound();

  const allTenants = await getAllTenants();

  const vacantUnits = property.totalUnits - property.occupiedUnits;
  const isFixedRent = property.activeAgreement?.fixedMonthlyRentAmount != null;
  const TypeIcon = getTypeIcon(t, property.type);
  const profitable = property.netProfit >= 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/properties" className="hover:text-foreground hover:underline">
          {t("title")}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{property.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/properties" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400">
            <TypeIcon className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {property.displayId} · {property.type ?? t("title")}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{property.name}</h1>
              <Badge
                className={cn(
                  "border-transparent",
                  property.status === "ACTIVE"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {property.status === "ACTIVE" ? t("active") : t("inactive")}
              </Badge>
            </div>
            {property.address ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {property.address}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/properties/${property.id}/edit`} />} nativeButton={false}>
            <Pencil className="size-3.5" />
            {t("edit")}
          </Button>
          <DeletePropertyButton propertyId={property.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatTile
          label={t("expectedIncome")}
          value={formatTaka(property.expectedIncome)}
          icon={TrendingUp}
          tone="default"
          hint={`${formatTaka(property.collectedIncome)} / ${formatTaka(property.expectedIncome)} ${t("thisMonth").toLowerCase()}`}
        />
        <StatTile
          label={t("leaseCost")}
          value={formatTaka(property.monthlyOwnerRent)}
          icon={Wallet}
          tone="violet"
          hint={t("paidToOwner")}
        />
        <StatTile
          label={t("totalExpense")}
          value={formatTaka(property.totalExpense)}
          icon={Receipt}
          tone="warning"
          hint={`${property.expenses.length} ${t("entries")}`}
        />
        <StatTile
          label={t("netProfit")}
          value={formatTaka(property.netProfit)}
          icon={profitable ? TrendingUp : TrendingDown}
          tone={profitable ? "success" : "destructive"}
          hint={`${property.profitMargin}% ${t("margin")}`}
        />
        <StatTile
          label={t("overdueRent")}
          value={formatTaka(property.totalOverdueRent)}
          icon={AlertTriangle}
          tone={property.totalOverdueRent > 0 ? "destructive" : "default"}
        />
        <StatTile
          label={t("vacantUnitsCount")}
          value={String(vacantUnits)}
          icon={DoorOpen}
          tone={vacantUnits > 0 ? "warning" : "teal"}
        />
        <StatTile
          label={t("overduePayroll")}
          value={formatTaka(property.totalOverduePayroll)}
          icon={UserX}
          tone={property.totalOverduePayroll > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400">
                <User className="size-3.5" />
              </span>
              {t("ownerInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{property.owner.name}</p>
            {property.owner.contactInfo ? (
              <p className="text-muted-foreground">{property.owner.contactInfo}</p>
            ) : null}
            {property.owner.address ? (
              <p className="text-muted-foreground">{property.owner.address}</p>
            ) : null}

            <div className="mt-3! space-y-1.5 border-t pt-3">
              {property.activeAgreement ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("leaseSince")}</span>
                  <span className="font-medium tabular-nums">
                    {format.dateTime(property.activeAgreement.startDate, { dateStyle: "medium" })}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("leaseCost")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTaka(property.monthlyOwnerRent)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("totalUnitsLabel")}</span>
                <span className="font-mono font-medium tabular-nums">{property.totalUnits}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("occupancy")}</span>
                <span className="font-mono font-medium tabular-nums text-success">
                  {property.totalUnits > 0
                    ? Math.round((property.occupiedUnits / property.totalUnits) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-warning/25 to-warning/5 text-warning">
                <FileText className="size-3.5" />
              </span>
              {t("activeLeaseAgreement")}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {property.activeAgreement ? (
                <>
                  <RecordOwnerRentPaymentDialog
                    propertyId={property.id}
                    ownerLeaseAgreementId={property.activeAgreement.id}
                    defaultAmount={property.monthlyOwnerRent}
                    units={property.allUnits}
                  />
                  <EndLeaseAgreementButton
                    agreementId={property.activeAgreement.id}
                    propertyId={property.id}
                    downpaymentAmount={property.activeAgreement.downpaymentAmount}
                  />
                </>
              ) : null}
              <RenewLeaseAgreementDialog
                propertyId={property.id}
                oldAgreementId={property.activeAgreement?.id}
                currentFixedMonthlyRentAmount={property.activeAgreement?.fixedMonthlyRentAmount}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {property.activeAgreement ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <p>
                    <span className="text-muted-foreground">{t("downpaymentAmount")}: </span>
                    <span className="font-semibold tabular-nums">
                      {formatTaka(property.totalOwnerDownpayment)}
                    </span>
                  </p>
                  {isFixedRent ? (
                    <p>
                      <span className="text-muted-foreground">{t("fixedMonthlyRentAmount")}: </span>
                      <span className="font-semibold tabular-nums">
                        {formatTaka(property.activeAgreement.fixedMonthlyRentAmount!)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {format.dateTime(property.activeAgreement.startDate, { dateStyle: "medium" })}
                  {property.activeAgreement.endDate
                    ? ` – ${format.dateTime(property.activeAgreement.endDate, { dateStyle: "medium" })}`
                    : ""}
                </p>
                {property.activeAgreement.notes ? (
                  <p className="text-muted-foreground">{property.activeAgreement.notes}</p>
                ) : null}

                {property.activeAgreement.documents.length > 0 ? (
                  <div className="flex flex-col gap-1.5 border-t pt-3">
                    {property.activeAgreement.documents.map((d) => (
                      <a
                        key={d.id}
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-primary underline-offset-2 hover:underline"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        {t("viewDocument")}
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          {formatDate(d.uploadedAt)}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="border-t pt-3 text-xs text-muted-foreground">{t("noDocuments")}</p>
                )}

                <div className="border-t pt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("rentPaymentHistory")}
                  </p>
                  {property.activeAgreement.rentPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noRentPayments")}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {property.activeAgreement.rentPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-mono text-muted-foreground">{formatDate(p.dueDate)}</span>
                          <span className="text-muted-foreground">{p.unitLabel ?? t("wholeProperty")}</span>
                          <span className="text-muted-foreground">{paymentMethodLabel(t, p.paymentMethod)}</span>
                          <span className="font-mono font-medium tabular-nums">{formatTaka(p.paidAmount)}</span>
                          <Badge className="border-transparent bg-success/15 text-success">{t("paid")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-muted-foreground">
                {t("noActiveLeaseAgreement")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-warning/25 to-warning/5 text-warning">
              <DoorOpen className="size-3.5" />
            </span>
            {t("vacantUnitsListTitle")} ({property.vacantUnitsList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {property.vacantUnitsList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noVacantUnits")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {property.vacantUnitsList.map((u) => (
                <UnitDetailDialog
                  key={u.id}
                  unit={u}
                  propertyId={property.id}
                  propertyType={property.type}
                  tenants={allTenants}
                  triggerClassName="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20"
                >
                  {u.label}
                  <span className="ml-1 text-warning/70">· {u.unitTypeLabel}</span>
                </UnitDetailDialog>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400">
              <Users2 className="size-3.5" />
            </span>
            {t("tenants")} ({property.tenants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MobileTenantsList tenants={property.tenants} />
          <div className="hidden md:block">
            <TenantsTable tenants={property.tenants} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-teal-500/25 to-teal-500/5 text-teal-600 dark:text-teal-400">
              <HardHat className="size-3.5" />
            </span>
            {t("staff")} ({property.staff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MobileStaffList staff={property.staff} propertyId={property.id} />
          <div className="hidden md:block">
            <StaffTable staff={property.staff} payrollCost={property.payrollCost} propertyId={property.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400">
              <BedDouble className="size-3.5" />
            </span>
            {t("guestStaysPageTitle")} ({property.guestStays.length})
          </CardTitle>
          <AddGuestStayDialogGlobal
            properties={[{ id: property.id, name: property.name, units: property.allUnits }]}
            initialPropertyId={property.id}
            returnTo={`/properties/${property.id}`}
          />
        </CardHeader>
        <CardContent>
          <MobileGuestStaysList bookings={property.guestStays} />
          <div className="hidden md:block">
            <GuestStaysTable bookings={property.guestStays} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-destructive/25 to-destructive/5 text-destructive">
              <Banknote className="size-3.5" />
            </span>
            {t("expenses")}
          </CardTitle>
          <AddExpenseDialog propertyId={property.id} units={property.allUnits} />
        </CardHeader>
        <CardContent>
          {property.expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noExpenses")}</p>
          ) : (
            <>
            <div className="flex flex-col gap-3 md:hidden">
              <Card className="overflow-hidden p-0">
                <ul className="divide-y">
                  {property.expenses.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t(EXPENSE_TYPE_LABEL_KEYS[e.type] ?? "expenseTypeOther")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(e.date)}
                          {e.unitLabel ? ` · ${e.unitLabel}` : ""}
                          {e.notes ? ` · ${e.notes}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                        {formatTaka(e.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="flex items-center justify-between px-1 text-sm">
                <span className="text-muted-foreground">{t("total")}</span>
                <span className="font-mono font-semibold tabular-nums">{formatTaka(property.totalExpense)}</span>
              </div>
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("unit")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {property.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-muted-foreground">{formatDate(e.date)}</TableCell>
                    <TableCell>{t(EXPENSE_TYPE_LABEL_KEYS[e.type] ?? "expenseTypeOther")}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{e.unitLabel ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.notes ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {paymentMethodLabel(t, e.paymentMethod)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatTaka(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right text-muted-foreground">
                    {t("total")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {formatTaka(property.totalExpense)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-teal-500/25 to-teal-500/5 text-teal-600 dark:text-teal-400">
              <Zap className="size-3.5" />
            </span>
            {t("utilityBillsSection")}
          </CardTitle>
          <AddUtilityBillDialog
            propertyId={property.id}
            units={property.allUnits}
            previousElectricityReadingByUnit={property.previousElectricityReadingByUnit}
          />
        </CardHeader>
        <CardContent>
          <MobileUtilityBillsList bills={property.utilityBills} />
          <div className="hidden md:block">
            <UtilityBillsTable bills={property.utilityBills} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400">
              <Building2 className="size-3.5" />
            </span>
            {t("unitTypes")}
          </CardTitle>
          <AddUnitTypeDialog
            propertyId={property.id}
            propertyType={property.type}
            existingUnitCount={property.totalUnits}
          />
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">{t("unitTypeVsUnitHint")}</p>
          {property.unitTypes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noUnitTypes")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {property.unitTypes.map((ut) => (
                <div key={ut.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{ut.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ut.sizeValue ? `${ut.sizeValue} ${ut.sizeUnit} · ` : ""}
                        {isFixedRent
                          ? t("fixedTotalRent")
                          : ut.ownerRentAmount != null
                            ? `${formatTaka(ut.ownerRentAmount)} ${t("monthlyOwnerRent").toLowerCase()}`
                            : t("ownerRentNotSetYet")}
                      </p>
                    </div>
                    <EditUnitTypeDialog
                      propertyId={property.id}
                      propertyType={property.type}
                      unitType={ut}
                      totalUnitCount={property.totalUnits}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ut.units.map((u) => {
                      const isCustomRent =
                        u.sizeValue !== ut.sizeValue ||
                        u.sizeUnit !== ut.sizeUnit ||
                        u.ownerRentAmount !== ut.ownerRentAmount ||
                        u.ownerDownpaymentAmount !== ut.ownerDownpaymentAmount ||
                        u.tenantDefaultRentAmount !== ut.tenantDefaultRentAmount ||
                        u.tenantDefaultDownpaymentAmount !== ut.tenantDefaultDownpaymentAmount ||
                        u.tenantDefaultNightlyRateAmount !== ut.tenantDefaultNightlyRateAmount;
                      const titleParts = [
                        u.tenantName,
                        u.sizeValue != null ? `${u.sizeValue} ${u.sizeUnit ?? ""}`.trim() : null,
                        u.ownerRentAmount != null
                          ? `${t("ownerRentAmount")}: ${formatTaka(u.ownerRentAmount)}`
                          : null,
                        u.ownerDownpaymentAmount != null
                          ? `${t("ownerDownpaymentAmount")}: ${formatTaka(u.ownerDownpaymentAmount)}`
                          : null,
                        u.tenantDefaultRentAmount != null
                          ? `${t("tenantDefaultRentAmount")}: ${formatTaka(u.tenantDefaultRentAmount)}`
                          : null,
                        u.tenantDefaultDownpaymentAmount != null
                          ? `${t("tenantDefaultDownpaymentAmount")}: ${formatTaka(u.tenantDefaultDownpaymentAmount)}`
                          : null,
                        u.tenantDefaultNightlyRateAmount != null
                          ? `${t("tenantDefaultNightlyRateAmount")}: ${formatTaka(u.tenantDefaultNightlyRateAmount)}`
                          : null,
                      ].filter(Boolean);
                      return (
                        <UnitDetailDialog
                          key={u.id}
                          unit={u}
                          propertyId={property.id}
                          propertyType={property.type}
                          tenants={allTenants}
                          triggerClassName={cn(
                            "relative rounded-md border px-2 py-1 text-xs font-medium",
                            u.status === "INACTIVE"
                              ? "border-muted-foreground/20 bg-muted text-muted-foreground opacity-60 hover:opacity-80"
                              : u.occupied
                                ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                                : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
                          )}
                        >
                          <span
                            title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
                            className={u.status === "INACTIVE" ? "line-through" : undefined}
                          >
                            {u.label}
                          </span>
                          {isCustomRent ? (
                            <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-primary" />
                          ) : null}
                        </UnitDetailDialog>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
