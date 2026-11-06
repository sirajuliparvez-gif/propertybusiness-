import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Scissors } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CashMemoHeader, CashMemoReading, CashMemoSignatures, cashMemoClassName } from "@/components/properties/cash-memo";
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
  brand,
  locale,
  date,
  typeLabels,
  statusLabel,
  remaining,
}: {
  bill: Bill;
  t: Translate;
  brand: string;
  locale: string;
  date: string;
  typeLabels: Record<string, string>;
  statusLabel: string;
  remaining: number;
}) {
  return (
    <div
      data-testid="invoice-copy"
      className={cashMemoClassName}
    >
      <CashMemoHeader
        brand={brand}
        title={t("cashMemoUtilityTitle")}
        month={monthLabel(bill.month, locale)}
        property={bill.propertyName}
        unit={bill.unitLabel}
        name={bill.tenantName ?? t(bill.paidByCompany ? "invoiceCompanyBorne" : "invoiceNoTenant")}
        contact={bill.tenantContact}
        date={date}
        billNumber={`U-${bill.month.replace("-", "")}-${bill.id.slice(-10).toUpperCase()}`}
        companyAddress={t("cashMemoCompanyAddress")}
        companyPhone={t("cashMemoCompanyPhone")}
        labels={{
          unit: t("cashMemoUnit"), name: t("cashMemoName"), month: t("invoiceBillMonth"),
          date: t("cashMemoDate"), billNumber: t("cashMemoBillNumber"),
        }}
      />
      {bill.tenantName && bill.paidByCompany ? (
        <p className="text-xs text-muted-foreground">{t("invoiceCompanyBorne")}</p>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("invoiceBillSection")}
        </p>
        <div className="cash-memo-fields grid grid-cols-2 gap-x-4 gap-y-2 border-y border-dashed py-2 sm:grid-cols-4">
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
            <p className="font-mono font-medium tabular-nums">{formatDate(bill.dueDate, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("status")}</p>
            <p data-testid="invoice-status" className="font-medium">
              {statusLabel}
            </p>
          </div>
        </div>
        {bill.type === "ELECTRICITY" && bill.meterReading != null ? (
          <CashMemoReading
            current={bill.meterReading}
            previous={bill.previousMeterReading}
            units={bill.consumptionUnits}
            label={t("cashMemoReading")}
            unitLabel={t("cashMemoUnits")}
            missing={t("cashMemoReadingMissing")}
            locale={locale}
          />
        ) : null}
      </div>

      <div className="cash-memo-fields grid grid-cols-2 gap-x-4 gap-y-2 border-y border-dashed py-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("paidDate")}</p>
          <p className="font-mono font-medium tabular-nums">
            {bill.paidAt ? formatDate(bill.paidAt, locale) : t("notYetPaid")}
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

      <div className="cash-memo-totals flex items-center justify-between rounded-md border border-sky-900/25 bg-sky-500/5 px-3 py-2">
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
      <CashMemoSignatures tenant={t("cashMemoTenantSignature")} company={t("cashMemoCompanySignature")} />
    </div>
  );
}

export default async function UtilityBillInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("Properties");
  const tNav = await getTranslations("Nav");
  const locale = await getLocale();
  const date = formatDate(dhakaNow(), locale);

  const bill = await getUtilityBillInvoice(id);
  if (!bill) notFound();

  const typeLabels: Record<string, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };
  const statusLabel =
    bill.status === "PAID" ? t("paid") : bill.status === "PARTIAL" ? t("invoicePartiallyPaid") : t("billStatusUnpaid");
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
      <div data-testid="invoice" className="print-two-up flex flex-col print:block">
        <InvoiceCopy
          bill={bill}
          t={t}
          brand={tNav("brand")}
          locale={locale}
          date={date}
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
          brand={tNav("brand")}
          locale={locale}
          date={date}
          typeLabels={typeLabels}
          statusLabel={statusLabel}
          remaining={remaining}
        />
      </div>
    </div>
  );
}
