import { dhakaNow } from "@/lib/dhaka-time";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Building2, Scissors } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantProfile } from "@/lib/tenants-data";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { formatTaka, formatDate, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { isMonthPastDue, LEDGER_START_MONTH, RENT_DUE_DAY } from "@/lib/rent-ledger";
import { cn } from "@/lib/utils";
import { InvoiceHeader } from "@/components/invoice-header";
import { InvoiceMonthSelect } from "@/components/properties/invoice-month-select";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";

function currentMonthKey() {
  const now = dhakaNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function TwoUpInvoice({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="invoice" className="print-two-up flex flex-col">
      {children}
      <div aria-hidden="true" className="my-4 flex items-center gap-2 text-muted-foreground print:my-2">
        <Scissors className="size-3.5 shrink-0" />
        <span className="h-0 flex-1 border-t border-dashed border-current opacity-60" />
      </div>
      {children}
    </div>
  );
}

// One statement per tenant and month: the month's rent, any rent still owed from earlier months, every utility bill
// billed to this tenant that is dated in the month or still unpaid from before, and the balance left to pay. Printed
// from the tenant page, the rent page or a utility bill, it always shows the same complete picture.
export default async function TenantInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; bill?: string }>;
}) {
  const { id } = await params;
  const { month: requestedMonth, bill: highlightedBillId } = await searchParams;
  const t = await getTranslations("Properties");
  const tNav = await getTranslations("Nav");

  const tenant = await getTenantProfile(id);
  if (!tenant) notFound();

  // Only the bills dated while this tenant rented the unit are theirs (an earlier tenant's unpaid bill is not).
  const leaseEnd = tenant.leaseStatus === "ACTIVE" ? null : (tenant.movedOutAt ?? tenant.endDate ?? null);
  const unitBills = tenant.utilityBills.filter(
    (b) => b.dueDate >= tenant.startDate && (!leaseEnd || b.dueDate <= leaseEnd)
  );

  const nowMonth = currentMonthKey();
  const availableMonths = Array.from(
    new Set([...tenant.payments.map((p) => p.month), ...unitBills.map((b) => b.month), nowMonth])
  ).sort((a, b) => (a < b ? 1 : -1));
  const selectedMonth =
    requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0];

  // ---- rent
  const payment = tenant.payments.find((p) => p.month === selectedMonth) ?? null;
  // Rent is only tracked from LEDGER_START_MONTH on; an earlier month with no record has no rent to show.
  const rentTracked = payment != null || selectedMonth >= LEDGER_START_MONTH;
  const serviceChargeAmount = computeServiceChargeAmount(
    tenant.monthlyRentAmount,
    tenant.serviceChargeType,
    tenant.serviceChargeValue
  );
  // A month that has never had a payment recorded still has a real due amount (this lease's standing rent).
  const rentDue = rentTracked ? (payment?.dueAmount ?? tenant.monthlyRentAmount + serviceChargeAmount) : 0;
  const rentPaid = rentTracked ? (payment?.paidAmount ?? 0) : 0;
  const rentRemaining = Math.max(0, rentDue - rentPaid);
  const rentStatus = payment?.status ?? "UNPAID";
  const invoiceCreatedAt = payment?.createdAt ?? dhakaNow();
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const rentDeadline = new Date(selectedYear, selectedMonthNumber - 1, RENT_DUE_DAY);
  const adjustment = tenant.downpaymentAdjustments.find((a) => a.month === selectedMonth) ?? null;
  const previousRentDue = tenant.payments
    .filter((p) => p.month < selectedMonth)
    .reduce((sum, p) => sum + Math.max(0, p.dueAmount - p.paidAmount), 0);

  const rentStatusLabels: Record<string, string> = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: isMonthPastDue(selectedMonth, RENT_DUE_DAY) ? t("overdueStatus") : t("dueInPeriod"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  // ---- utility bills
  // Company-paid bills (water, by policy) are never charged to the tenant: listed for reference, kept out of the totals.
  const billable = unitBills.filter((b) => !b.paidByCompany);
  const byDate = (a: (typeof unitBills)[number], b: (typeof unitBills)[number]) => a.dueDate.getTime() - b.dueDate.getTime();
  const earlierUnpaidBills = billable.filter((b) => b.month < selectedMonth && b.status !== "PAID").sort(byDate);
  const monthBills = billable.filter((b) => b.month === selectedMonth).sort(byDate);
  const statementBills = [...earlierUnpaidBills, ...monthBills];
  const companyBorneBills = unitBills.filter((b) => b.paidByCompany && b.month === selectedMonth).sort(byDate);

  const billRemaining = (b: (typeof unitBills)[number]) =>
    b.status === "PAID" ? 0 : Math.max(0, b.amount - b.paidAmount);
  const utilityDue = statementBills.reduce((sum, b) => sum + b.amount, 0);
  const utilityPaid = statementBills.reduce((sum, b) => sum + b.paidAmount, 0);

  const utilityTypeLabels: Record<string, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };
  const billStatusLabel = (status: string) =>
    status === "PAID" ? t("paid") : status === "PARTIAL" ? t("pending") : t("billStatusUnpaid");

  // ---- totals
  const totalDue = rentDue + previousRentDue + utilityDue;
  const totalPaid = rentPaid + utilityPaid;
  const balance = Math.max(0, totalDue - totalPaid);

  const highlightedShown = highlightedBillId
    ? [...statementBills, ...companyBorneBills].some((b) => b.id === highlightedBillId)
    : false;

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href={`/tenants/${id}`} />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {tenant.tenantName} / {t("invoiceLabel")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceMonthSelect leaseId={id} months={availableMonths} selectedMonth={selectedMonth} />
          <InvoicePrintButton />
        </div>
      </div>

      <TwoUpInvoice>
      <div
        data-testid="invoice-copy"
        className="flex break-inside-avoid flex-col gap-6 rounded-xl border bg-card p-6 text-sm print:break-inside-avoid print:gap-3 print:rounded-none print:border-0 print:p-0 sm:p-8"
      >
        <InvoiceHeader brand={tNav("brand")} title={t("invoiceLabel")} subtitle={monthLabel(selectedMonth)}>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3" />
            {tenant.propertyName} · {tenant.unitLabel}
          </p>
        </InvoiceHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{t("tenant")}</p>
            <p className="font-medium">{tenant.tenantName}</p>
            {tenant.contactInfo ? <p className="font-mono text-xs text-muted-foreground">{tenant.contactInfo}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-muted-foreground">{t("invoiceGeneratedOn")}</p>
            <p className="font-mono font-medium tabular-nums">{formatDate(invoiceCreatedAt)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("invoiceRentSection")}
          </p>
          {rentTracked ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalDueLabel")}</p>
                  <p data-testid="invoice-rent-due" className="font-mono font-semibold tabular-nums">{formatTaka(rentDue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("paid")}</p>
                  <p className="font-mono font-semibold tabular-nums text-success">{formatTaka(rentPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("remaining")}</p>
                  <p className={cn("font-mono font-semibold tabular-nums", rentRemaining > 0 && "text-destructive")}>
                    {formatTaka(rentRemaining)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("invoiceDueDateLabel")}</p>
                  <p className="font-mono font-medium tabular-nums">{formatDate(rentDeadline)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("status")}</p>
                  <p data-testid="invoice-status" className="font-medium">
                    {rentStatusLabels[rentStatus] ?? rentStatus}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("paidDate")}</p>
                  <p className="font-mono font-medium tabular-nums">
                    {payment?.paidAt ? formatDate(payment.paidAt) : t("notYetPaid")}
                  </p>
                </div>
              </div>
              {payment?.method ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("paymentMethod")}: {paymentMethodLabel(t, payment.method)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t("noRentRecordThisMonth")}
            </p>
          )}
          {previousRentDue > 0 ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <span className="font-medium text-destructive">{t("invoicePreviousRentDue")}</span>
              <span data-testid="invoice-previous-rent" className="font-mono text-sm font-semibold tabular-nums text-destructive">
                {formatTaka(previousRentDue)}
              </span>
            </div>
          ) : null}
          {adjustment ? (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="font-medium text-primary">{t("adjustedFromDownpaymentNote")}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  {t("amount")}: <span className="font-mono font-medium text-foreground">{formatTaka(adjustment.amountAdjusted)}</span>
                </span>
                <span>
                  {t("downpaymentBalance")}:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {formatTaka(tenant.currentDownpaymentBalance)}
                  </span>
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("invoiceUtilitySection")}
          </p>
          {statementBills.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t("noUtilityBillsThisMonth")}
            </p>
          ) : (
            <Table data-testid="invoice-bills">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("utilityType")}</TableHead>
                  <TableHead>{t("invoiceBillMonth")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="text-right">{t("paid")}</TableHead>
                  <TableHead className="text-right">{t("remaining")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementBills.map((b) => (
                  <TableRow
                    key={b.id}
                    data-bill-id={b.id}
                    className={cn(b.id === highlightedBillId && "bg-primary/5 print:bg-transparent")}
                  >
                    <TableCell>
                      {utilityTypeLabels[b.type] ?? b.type}
                      {b.type === "ELECTRICITY" && b.meterReading != null ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("previousReadingColumn")}: {b.previousMeterReading ?? "—"} · {t("currentReadingColumn")}:{" "}
                          {b.meterReading}
                          {b.consumptionUnits != null ? ` · ${t("consumptionCell", { units: b.consumptionUnits })}` : ""}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {b.month}
                      {b.month < selectedMonth ? (
                        <div className="mt-0.5">
                          <Badge variant="outline" className="border-destructive/40 text-[0.65rem] text-destructive">
                            {t("invoicePreviousBill")}
                          </Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatTaka(b.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-success">{formatTaka(b.paidAmount)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        billRemaining(b) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {formatTaka(billRemaining(b))}
                    </TableCell>
                    <TableCell>
                      <span data-testid="invoice-bill-status">{billStatusLabel(b.status)}</span>
                      {b.paidAt ? (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{formatDate(b.paidAt)}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {companyBorneBills.length > 0 ? (
            <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium">{t("invoiceCompanyBorneSection")}</p>
              <ul className="flex flex-col gap-0.5">
                {companyBorneBills.map((b) => (
                  <li key={b.id} className={cn("flex items-center justify-between", b.id === highlightedBillId && "font-semibold")}>
                    <span>
                      {utilityTypeLabels[b.type] ?? b.type} · {monthLabel(b.month)}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatTaka(b.amount)} · {billStatusLabel(b.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {highlightedShown ? (
            <p className="mt-2 text-xs text-muted-foreground print:hidden">{t("invoiceBillHighlightNote")}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("invoiceGrandDue")}</p>
            <p data-testid="invoice-total-due" className="font-mono text-lg font-bold tabular-nums">{formatTaka(totalDue)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t("invoiceGrandPaid")}</p>
            <p data-testid="invoice-total-paid" className="font-mono text-lg font-bold tabular-nums text-success">
              {formatTaka(totalPaid)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("invoiceBalanceDue")}</p>
            <p
              data-testid="invoice-balance"
              className={cn("font-mono text-lg font-bold tabular-nums", balance > 0 ? "text-destructive" : "text-success")}
            >
              {formatTaka(balance)}
            </p>
          </div>
        </div>
      </div>
      </TwoUpInvoice>
    </div>
  );
}
