import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceHeader } from "@/components/invoice-header";
import { CashMemoSignatures } from "@/components/properties/cash-memo";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { isPaymentMonth } from "@/lib/payment-month";
import { paymentMethodLabel } from "@/lib/payment-method";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { dhakaISO } from "@/lib/dhaka-time";

export default async function MoneyReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string; receiptId: string }>;
  searchParams: Promise<{ from?: string; month?: string }>;
}) {
  await requireCurrentUser();
  const { id, receiptId } = await params;
  const { from, month } = await searchParams;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(receiptId)) notFound();

  const entries = await prisma.transaction.findMany({
    where: {
      paymentReceiptId: receiptId, tenantLeaseId: id, direction: "INCOMING",
      type: { in: ["RENT_RECEIVED_FROM_TENANT", "UTILITY_REIMBURSEMENT_FROM_TENANT"] },
    },
    orderBy: { id: "asc" },
    select: {
      id: true, amount: true, date: true, method: true,
      rentPayment: { select: { month: true } },
      utilityBill: { select: { month: true, type: true } },
      property: { select: { name: true } },
      tenantLease: { select: { tenant: { select: { name: true } }, unit: { select: { label: true } } } },
    },
  });
  const first = entries[0];
  if (!first?.tenantLease) notFound();

  const [t, nav, locale] = await Promise.all([getTranslations("Properties"), getTranslations("Nav"), getLocale()]);
  const utilityLabels = {
    ELECTRICITY: t("utilityTypeElectricity"), GAS: t("utilityTypeGas"),
    WATER: t("utilityTypeWater"), OTHER: t("cashMemoOtherCharges"),
  };
  const dates = new Set(entries.map(({ date }) => dhakaISO(date)));
  const lines = entries.map((entry) => ({
    ...entry,
    label: entry.utilityBill ? utilityLabels[entry.utilityBill.type] : t("invoiceRentLabel"),
    month: entry.rentPayment?.month ?? entry.utilityBill?.month ?? "",
  })).sort((a, b) => a.month.localeCompare(b.month));
  const total = entries.slice(1).reduce((sum, entry) => sum.plus(entry.amount), first.amount);
  const selectedMonth = isPaymentMonth(month) ? `?month=${month}` : "";
  const backHref = from === "invoice" ? `/tenants/${id}/invoice${selectedMonth}`
    : from === "rent" ? `/rent${selectedMonth}` : `/transactions?month=${dhakaISO(first.date).slice(0, 7)}`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="outline" render={<Link href={backHref} />} nativeButton={false}>{t("receiptBack")}</Button>
        <InvoicePrintButton />
      </div>
      <article data-testid="money-receipt" className="print-invoice-a4 space-y-4 rounded-lg border border-sky-900/40 bg-card p-4 text-sm sm:p-6 print:p-4">
        <InvoiceHeader brand={nav("brand")} title={t("moneyReceipt")}
          details={<address className="text-xs not-italic text-muted-foreground">
            <p>{t("cashMemoCompanyAddress")}</p>
            <p>{t("cashMemoCompanyPhone")}</p>
          </address>}>
          <p className="text-xs text-muted-foreground">{first.property?.name}</p>
        </InvoiceHeader>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
          <div><dt className="text-xs text-muted-foreground">{t("receiptNumber")}</dt><dd className="font-medium">{receiptId.slice(0, 13).toUpperCase()}</dd></div>
          {dates.size === 1 ? <div><dt className="text-xs text-muted-foreground">{t("cashMemoDate")}</dt><dd>{formatDate(first.date, locale)}</dd></div> : null}
          <div><dt className="text-xs text-muted-foreground">{t("cashMemoName")}</dt><dd className="font-semibold">{first.tenantLease.tenant.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("cashMemoUnit")}</dt><dd>{first.tenantLease.unit.label}</dd></div>
        </dl>
        <table className="w-full text-start">
          <thead className="bg-muted/60 print:table-header-group">
            <tr><th scope="col" className="px-2 py-1.5 text-start">{t("cashMemoCharge")}</th><th scope="col" className="px-2 py-1.5 text-end">{t("receiptReceived")}</th></tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="break-inside-avoid border-b">
                <td className="px-2 py-1.5">{line.label}{line.month ? ` · ${monthLabel(line.month, locale)}` : ""}
                  {dates.size > 1 ? <span className="block text-xs text-muted-foreground">{formatDate(line.date, locale)}</span> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums">{formatTaka(Number(line.amount), 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex break-inside-avoid items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <div>
            <p className="font-semibold">{t("receiptTotalReceived")}</p>
            {first.method && entries.every(({ method }) => method === first.method) ? (
              <p className="text-xs text-muted-foreground">{paymentMethodLabel(t, first.method)}</p>
            ) : null}
          </div>
          <strong className="text-xl tabular-nums" data-testid="receipt-total">{formatTaka(Number(total), 2)}</strong>
        </div>
        <div className="break-inside-avoid">
          <CashMemoSignatures tenant={t("cashMemoTenantSignature")} company={t("cashMemoCompanySignature")} />
        </div>
      </article>
    </div>
  );
}
