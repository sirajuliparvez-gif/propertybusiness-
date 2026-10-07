import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Building2, Scissors } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceHeader } from "@/components/invoice-header";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { getUtilityBillInvoice } from "@/lib/utility-bills-data";
import { formatTaka, formatDate, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { dhakaNow } from "@/lib/dhaka-time";

type Bill = NonNullable<Awaited<ReturnType<typeof getUtilityBillInvoice>>>;
type Translate = (key: string) => string;

// One of the two identical copies printed per sheet — the tenant takes one,
// the other stays in the office, cut apart along the dashed line between
// them. Kept as a component so the two copies can never drift apart.
function InvoiceCopy({
  bill,
  t,
  tNav,
  typeLabels,
  statusLabel,
  remaining,
}: {
  bill: Bill;
  t: Translate;
  tNav: Translate;
  typeLabels: Record<string, string>;
  statusLabel: string;
  remaining: number;
}) {
  return (
    <div
      data-testid="invoice-copy"
      className="flex break-inside-avoid flex-col gap-3 rounded-xl border bg-card p-6 text-sm print:break-inside-avoid print:gap-2 print:rounded-none print:border-0 print:p-0 sm:p-8"
    >
      <InvoiceHeader brand={tNav("brand")} title={t("utilityInvoiceTitle")} subtitle={monthLabel(bill.month)}>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="size-3" />
          {bill.propertyName}
          {bill.unitLabel ? ` · ${bill.unitLabel}` : ""}
          {bill.tenantName ? ` · ${bill.tenantName}` : ""}
        </p>
      </InvoiceHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{t("invoiceBilledTo")}</p>
          {bill.tenantName ? (
            <>
              <p className="font-medium">{bill.tenantName}</p>
              {bill.tenantContact ? (
                <p className="font-mono text-xs text-muted-foreground">{bill.tenantContact}</p>
              ) : null}
              {bill.paidByCompany ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("invoiceCompanyBorne")}</p>
              ) : null}
            </>
          ) : bill.paidByCompany ? (
            <p className="font-medium">{t("invoiceCompanyBorne")}</p>
          ) : (
            <p className="text-muted-foreground">{t("invoiceNoTenant")}</p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold text-muted-foreground">{t("invoiceGeneratedOn")}</p>
          <p className="font-mono font-medium tabular-nums">{formatDate(dhakaNow())}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">#{bill.id.slice(-8).toUpperCase()}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("invoiceBillSection")}
        </p>
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 print:p-2 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("utilityType")}</p>
            <p className="font-medium">{typeLabels[bill.type] ?? bill.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("invoiceBillAmount")}</p>
            <p className="font-mono font-semibold tabular-nums">{formatTaka(bill.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("invoiceDueDateLabel")}</p>
            <p className="font-mono font-medium tabular-nums">{formatDate(bill.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("status")}</p>
            <p data-testid="invoice-status" className="font-medium">
              {statusLabel}
            </p>
          </div>
        </div>
        {bill.type === "ELECTRICITY" && bill.meterReading != null ? (
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border p-3 print:p-2">
            <div>
              <p className="text-xs text-muted-foreground">{t("previousReadingColumn")}</p>
              <p className="font-mono font-medium tabular-nums">{bill.previousMeterReading ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("currentReadingColumn")}</p>
              <p className="font-mono font-medium tabular-nums">{bill.meterReading}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("consumptionColumn")}</p>
              <p className="font-mono font-medium tabular-nums">{bill.consumptionUnits ?? "—"}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 print:p-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("paidDate")}</p>
          <p className="font-mono font-medium tabular-nums">
            {bill.paidAt ? formatDate(bill.paidAt) : t("notYetPaid")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("paymentMethod")}</p>
          <p className="font-medium">{bill.paymentMethod ? paymentMethodLabel(t, bill.paymentMethod) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("invoiceCollected")}</p>
          <p className="font-mono font-medium tabular-nums">{formatTaka(bill.paidAmount)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4 print:pt-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("invoiceBillAmount")}</p>
          <p className="font-mono text-lg font-bold tabular-nums">{formatTaka(bill.amount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("paid")}</p>
          <p className="font-mono text-lg font-bold tabular-nums text-success">{formatTaka(bill.paidAmount)}</p>
          {remaining > 0 ? (
            <p className="font-mono text-xs tabular-nums text-destructive">
              {t("remaining")}: {formatTaka(remaining)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function UtilityBillInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const tNav = await getTranslations("Nav");

  const bill = await getUtilityBillInvoice(id);
  if (!bill) notFound();

  const typeLabels: Record<string, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };
  const statusLabel =
    bill.status === "PAID" ? t("paid") : bill.status === "PARTIAL" ? t("pending") : t("billStatusUnpaid");
  const remaining = Math.max(0, bill.amount - bill.paidAmount);

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href="/utility-bills" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {typeLabels[bill.type] ?? bill.type} / {t("invoiceLabel")}
          </span>
        </div>
        <InvoicePrintButton />
      </div>

      {/* Two-up: one A4 sheet carries the same bill twice, cut apart along
          the dashed rule — one copy for the tenant, one for the file. */}
      <div data-testid="invoice" className="print-two-up flex flex-col">
        <InvoiceCopy
          bill={bill}
          t={t}
          tNav={tNav}
          typeLabels={typeLabels}
          statusLabel={statusLabel}
          remaining={remaining}
        />
        <div aria-hidden="true" className="my-4 flex items-center gap-2 text-muted-foreground print:my-2">
          <Scissors className="size-3.5 shrink-0" />
          <span className="h-0 flex-1 border-t border-dashed border-current opacity-60" />
        </div>
        <InvoiceCopy
          bill={bill}
          t={t}
          tNav={tNav}
          typeLabels={typeLabels}
          statusLabel={statusLabel}
          remaining={remaining}
        />
      </div>
    </div>
  );
}
