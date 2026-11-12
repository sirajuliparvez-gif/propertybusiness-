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
import type { ReceiptCheckLine } from "@/lib/invoice-payment";
import { dhakaISO } from "@/lib/dhaka-time";

export default async function MoneyReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string; receiptId: string }>;
  searchParams: Promise<{ from?: string; month?: string; tenant?: string; embed?: string; back?: string }>;
}) {
  await requireCurrentUser();
  const { id, receiptId } = await params;
  const { from, month, tenant, embed, back } = await searchParams;
  const embedded = from === "rent-invoice" && embed === "1";
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(receiptId)) notFound();

  const entries = await prisma.transaction.findMany({
    where: {
      paymentReceiptId: receiptId, tenantLeaseId: id, direction: "INCOMING",
      type: { in: ["RENT_RECEIVED_FROM_TENANT", "UTILITY_REIMBURSEMENT_FROM_TENANT", "DOWNPAYMENT_RECEIVED_FROM_TENANT"] },
    },
    orderBy: { id: "asc" },
    select: {
      id: true, amount: true, date: true, method: true, type: true, createdAt: true,
      rentPaymentId: true, utilityBillId: true,
      rentPayment: { select: { month: true, dueAmount: true } },
      utilityBill: { select: { month: true, type: true, unitId: true, meterLabel: true, amount: true } },
      property: { select: { name: true } },
      tenantLease: { select: { tenant: { select: { name: true } }, unit: { select: { label: true } } } },
    },
  });
  const first = entries[0];
  if (!first?.tenantLease) notFound();
  const comparison = await prisma.rentBillReceiptCheck.findUnique({ where: { receiptId, tenantLeaseId: id } });

  const shortLines = comparison && comparison.receivedCents < comparison.expectedCents
    ? comparison.lines as ReceiptCheckLine[] | null : null;
  const [t, nav, locale] = await Promise.all([getTranslations("Properties"), getTranslations("Nav"), getLocale()]);
  const utilityLabels = {
    ELECTRICITY: t("utilityTypeElectricity"), GAS: t("utilityTypeGas"),
    WATER: t("utilityTypeWater"), WASTE: t("utilityTypeWaste"),
    SECURITY: t("utilityTypeSecurity"), OTHER: t("cashMemoOtherCharges"),
  };
  // Money already received for the same rent month / bill before this receipt, so a balance reads as one.
  const placedAt = entries.reduce((min, entry) => entry.createdAt < min ? entry.createdAt : min, entries[0].createdAt);
  const earlierRows = await prisma.transaction.findMany({
    where: {
      paymentReceiptId: { not: receiptId }, createdAt: { lt: placedAt }, direction: "INCOMING",
      type: { in: ["RENT_RECEIVED_FROM_TENANT", "UTILITY_REIMBURSEMENT_FROM_TENANT"] },
      OR: [
        { rentPaymentId: { in: entries.flatMap((entry) => entry.rentPaymentId ? [entry.rentPaymentId] : []) } },
        { utilityBillId: { in: entries.flatMap((entry) => entry.utilityBillId ? [entry.utilityBillId] : []) } },
      ],
    },
    select: { rentPaymentId: true, utilityBillId: true, amount: true },
  });
  const earlierFor = (key: string | null) => key == null ? 0 : earlierRows
    .filter((row) => row.rentPaymentId === key || row.utilityBillId === key)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const dates = new Set(entries.map(({ date }) => dhakaISO(date)));
  const unitIds = [...new Set(entries.flatMap((e) => (e.utilityBill?.unitId ? [e.utilityBill.unitId] : [])))];
  const multiMeterUnits = new Set((await prisma.utilityBill.findMany({
    where: { type: "ELECTRICITY", unitId: { in: unitIds }, meterLabel: { not: null } }, select: { unitId: true }, distinct: ["unitId"],
  })).map((b) => b.unitId));
  const meterName = (b: { type: string; unitId: string | null; meterLabel: string | null }) =>
    b.meterLabel ?? (b.type === "ELECTRICITY" && multiMeterUnits.has(b.unitId) ? t("meterFirstName") : null);
  const lines = entries.map((entry) => ({
    ...entry,
    label: entry.type === "DOWNPAYMENT_RECEIVED_FROM_TENANT" ? t("rentBillAdvanceLabel")
      : entry.utilityBill ? utilityLabels[entry.utilityBill.type] + (meterName(entry.utilityBill) ? ` · ${meterName(entry.utilityBill)}` : "") : t("invoiceRentLabel"),
    month: entry.rentPayment?.month ?? entry.utilityBill?.month ?? "",
    earlier: earlierFor(entry.rentPaymentId ?? entry.utilityBillId),
    chargeTotal: Number(entry.rentPayment?.dueAmount ?? entry.utilityBill?.amount ?? 0),
  })).sort((a, b) => a.month.localeCompare(b.month));
  const total = entries.slice(1).reduce((sum, entry) => sum.plus(entry.amount), first.amount);
  const selectedMonth = isPaymentMonth(month) ? `?month=${month}` : "";
  const rentScope = tenant === "1" ? `${selectedMonth ? "&" : "?"}tenant=${encodeURIComponent(id)}` : "";
  // Where an arrears collection started (a local path only).
  const arrearsBack = from === "overdue" && back?.startsWith("/") && !back.startsWith("//") ? back : null;
  const backHref = arrearsBack ? arrearsBack : from === "invoice" ? `/tenants/${id}/invoice${selectedMonth}`
    : from === "rent-invoice" ? `/rent/${id}/invoice${selectedMonth}${tenant === "1" ? `${selectedMonth ? "&" : "?"}tenant=1` : ""}`
    : from === "rent" ? `/rent${selectedMonth}${rentScope}` : `/transactions?month=${dhakaISO(first.date).slice(0, 7)}`;

  return (
    <div data-rent-bill-embed={embedded || undefined} className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        {!embedded ? <Button variant="outline" render={<Link href={backHref} />} nativeButton={false}>{t("receiptBack")}</Button> : null}
        <InvoicePrintButton />
      </div>
      {comparison ? (
        <div className="mb-3 flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2 text-sm print:hidden">
          <span>{t("rentBillExpected")} <strong>{formatTaka(comparison.expectedCents / 100, 2)}</strong></span>
          <span>{comparison.receivedCents === comparison.expectedCents ? t("rentBillMatched")
            : comparison.receivedCents > comparison.expectedCents
              ? t("rentBillExtraAdvance", { amount: formatTaka((comparison.receivedCents - comparison.expectedCents) / 100, 2) })
              : t("overdueAfterPayment", { amount: formatTaka((comparison.expectedCents - comparison.receivedCents) / 100, 2) })}</span>
        </div>
      ) : null}
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
        {shortLines?.length ? (
          <table className="w-full text-start">
            <thead className="bg-muted/60 print:table-header-group">
              <tr>
                <th scope="col" className="px-2 py-1.5 text-start">{t("cashMemoCharge")}</th>
                <th scope="col" className="px-2 py-1.5 text-end">{t("rentBillExpected")}</th>
                <th scope="col" className="px-2 py-1.5 text-end">{t("receiptReceived")}</th>
                <th scope="col" className="px-2 py-1.5 text-end">{t("receiptCheckRemaining")}</th>
              </tr>
            </thead>
            <tbody>
              {shortLines.map((line) => (
                <tr key={line.id} className="break-inside-avoid border-b">
                  <td className="px-2 py-1.5">
                    {line.utilityType ? utilityLabels[line.utilityType] : t("invoiceRentLabel")}
                    <span className="block text-xs text-muted-foreground">{line.dueDate ? formatDate(line.dueDate, locale) : monthLabel(comparison?.month ?? "", locale)}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums">{formatTaka(line.expectedCents / 100, 2)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums">{formatTaka(line.paidCents / 100, 2)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-end font-medium tabular-nums">{formatTaka((line.expectedCents - line.paidCents) / 100, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <table className="w-full text-start">
          <thead className="bg-muted/60 print:table-header-group">
            <tr><th scope="col" className="px-2 py-1.5 text-start">{t("cashMemoCharge")}</th><th scope="col" className="px-2 py-1.5 text-end">{t("receiptReceived")}</th></tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="break-inside-avoid border-b">
                <td className="px-2 py-1.5">{line.label}{line.month ? ` · ${monthLabel(line.month, locale)}` : ""}
                  {dates.size > 1 ? <span className="block text-xs text-muted-foreground">{formatDate(line.date, locale)}</span> : null}
                  {line.earlier > 0 ? <span className="block text-xs text-muted-foreground">{t("receiptBalanceNote", { total: formatTaka(line.chargeTotal, 2), earlier: formatTaka(line.earlier, 2) })}</span> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums">{formatTaka(Number(line.amount), 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>}
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
