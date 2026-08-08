import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantProfile } from "@/lib/tenants-data";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { formatTaka, formatDate, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { InvoiceMonthSelect } from "@/components/properties/invoice-month-select";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function billMonthKey(dueDate: Date) {
  const d = new Date(dueDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TenantInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month: requestedMonth } = await searchParams;
  const t = await getTranslations("Properties");
  const tNav = await getTranslations("Nav");

  const tenant = await getTenantProfile(id);
  if (!tenant) notFound();

  const nowMonth = currentMonthKey();
  const availableMonths = Array.from(new Set([...tenant.payments.map((p) => p.month), nowMonth])).sort(
    (a, b) => (a < b ? 1 : -1)
  );
  const selectedMonth =
    requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0];

  const payment = tenant.payments.find((p) => p.month === selectedMonth) ?? null;
  const serviceChargeAmount = computeServiceChargeAmount(
    tenant.monthlyRentAmount,
    tenant.serviceChargeType,
    tenant.serviceChargeValue
  );
  // A month that's never had a payment recorded yet still has a real due
  // amount (this lease's standing rent) — the invoice should show that, not
  // pretend the month doesn't exist.
  const rentDue = payment?.dueAmount ?? tenant.monthlyRentAmount + serviceChargeAmount;
  const rentPaid = payment?.paidAmount ?? 0;
  const rentStatus = payment?.status ?? "UNPAID";
  const adjustment = tenant.downpaymentAdjustments.find((a) => a.month === selectedMonth) ?? null;

  const rentStatusLabels: Record<string, string> = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    UNPAID: t("overdueStatus"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  const monthUtilityBills = tenant.utilityBills.filter((b) => billMonthKey(b.dueDate) === selectedMonth);
  const utilityTotal = monthUtilityBills.reduce((sum, b) => sum + b.amount, 0);
  const utilityPaidTotal = monthUtilityBills
    .filter((b) => b.status === "PAID")
    .reduce((sum, b) => sum + b.amount, 0);

  const utilityTypeLabels: Record<string, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  const totalDue = rentDue + utilityTotal;
  const totalPaid = rentPaid + utilityPaidTotal;

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

      <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 text-sm print:rounded-none print:border-0 print:p-0 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-lg font-bold tracking-tight">{tNav("brand")}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" />
              {tenant.propertyName} · {tenant.unitLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-tight">{t("invoiceLabel")}</p>
            <p className="text-sm font-medium text-muted-foreground">{monthLabel(selectedMonth)}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{t("tenant")}</p>
            <p className="font-medium">{tenant.tenantName}</p>
            {tenant.contactInfo ? <p className="font-mono text-xs text-muted-foreground">{tenant.contactInfo}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-muted-foreground">{t("invoiceGeneratedOn")}</p>
            <p className="font-mono font-medium tabular-nums">{formatDate(new Date())}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("invoiceRentSection")}
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalDueLabel")}</p>
              <p className="font-mono font-semibold tabular-nums">{formatTaka(rentDue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("paid")}</p>
              <p className="font-mono font-semibold tabular-nums text-success">{formatTaka(rentPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("status")}</p>
              <p className="font-medium">{rentStatusLabels[rentStatus] ?? rentStatus}</p>
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
          {monthUtilityBills.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t("noUtilityBillsThisMonth")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("utilityType")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("paidDate")}</TableHead>
                  <TableHead className="text-right">{t("previousReadingColumn")}</TableHead>
                  <TableHead className="text-right">{t("currentReadingColumn")}</TableHead>
                  <TableHead className="text-right">{t("consumptionColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthUtilityBills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{utilityTypeLabels[b.type] ?? b.type}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatTaka(b.amount)}</TableCell>
                    <TableCell>{b.status === "PAID" ? t("paid") : t("billStatusUnpaid")}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {b.status === "PAID" ? formatDate(b.dueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {b.type === "ELECTRICITY" && b.previousMeterReading != null ? b.previousMeterReading : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {b.type === "ELECTRICITY" && b.meterReading != null ? b.meterReading : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {b.type === "ELECTRICITY" && b.consumptionUnits != null ? b.consumptionUnits : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("invoiceTotalDue")}</p>
            <p className="font-mono text-lg font-bold tabular-nums">{formatTaka(totalDue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("invoiceTotalPaid")}</p>
            <p className="font-mono text-lg font-bold tabular-nums text-success">{formatTaka(totalPaid)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
