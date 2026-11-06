import { dhakaISO, dhakaNow, dhakaTodayISO } from "@/lib/dhaka-time";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Droplet, Flame, History, House, ReceiptText, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantProfile } from "@/lib/tenants-data";
import { formatTaka, formatDate, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { isMonthPastDue, LEDGER_START_MONTH, RENT_DUE_DAY } from "@/lib/rent-ledger";
import { cn } from "@/lib/utils";
import { CashMemoHandwritingRow, CashMemoHeader, CashMemoReading, CashMemoSignatures, cashMemoClassName } from "@/components/properties/cash-memo";
import { InvoiceMonthSelect } from "@/components/properties/invoice-month-select";
import { InvoicePaymentDialog } from "@/components/properties/invoice-payment-dialog";
import { InvoiceElectricityFields } from "@/components/properties/invoice-electricity-fields";
import { getPreviousTenantMeterReading } from "@/lib/actions/utility-bills";
import { EditUtilityBillDialog } from "@/components/properties/edit-utility-bill-dialog";
import { InvoiceAddUtilityBillDialog } from "@/components/properties/add-utility-bill-dialog";
import { invoicePaymentSnapshot } from "@/lib/invoice-payment";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { rentTermsDueAmount, resolveRentTermsForMonth } from "@/lib/rent-terms";
import { RentBillPrintForm } from "@/components/properties/rent-bill-print-form";
import { RecordTenantRentPaymentDialog } from "@/components/properties/record-tenant-rent-payment-dialog";
import { limitToPrintedBill, rentBillPrintKeys, rentBillPrintRows, type RentBillPrintRow } from "@/lib/rent-bill-print";
import { prisma } from "@/lib/prisma";

function formatInvoiceAmount(amount: number) {
  return formatTaka(amount, 2);
}

function currentMonthKey() {
  const now = dhakaNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// One statement per tenant and month, with the selected month's rent and utility bills.
// The on-screen statement also shows unpaid utilities from earlier months.
export default async function TenantInvoicePage({
  params,
  searchParams,
  fromRent = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; bill?: string; tenant?: string; print?: string; receive?: string; embed?: string }>;
  fromRent?: boolean;
}) {
  const { id } = await params;
  const { month: requestedMonth, bill: highlightedBillId, tenant: tenantScope, print, receive, embed } = await searchParams;
  const embedded = fromRent && embed === "1";
  const t = await getTranslations("Properties");
  const tNav = await getTranslations("Nav");
  const history = await getTranslations("TenantHistory");
  const locale = await getLocale();

  const tenant = await getTenantProfile(id);
  if (!tenant) notFound();

  // Only the bills dated while this tenant rented the unit are theirs (an earlier tenant's unpaid bill is not).
  const leaseEnd = tenant.leaseStatus === "ACTIVE" ? null : (tenant.movedOutAt ?? tenant.endDate ?? null);
  const leaseStartDay = dhakaISO(tenant.startDate);
  const leaseEndDay = leaseEnd ? dhakaISO(leaseEnd) : null;
  const unitBills = tenant.utilityBills.filter((bill) => {
    const dueDay = dhakaISO(bill.dueDate);
    return dueDay >= leaseStartDay && (!leaseEndDay || dueDay <= leaseEndDay);
  });

  const nowMonth = currentMonthKey();
  const availableMonths = Array.from(
    new Set([...tenant.payments.map((p) => p.month), ...unitBills.map((b) => b.month), nowMonth])
  ).sort((a, b) => (a < b ? 1 : -1));
  const selectedMonth =
    requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0];

  // ---- rent
  const payment = tenant.payments.find((p) => p.month === selectedMonth) ?? null;
  // Rent is only tracked from LEDGER_START_MONTH on; an earlier month with no record has no rent to show.
  const rentTracked = payment != null || (
    selectedMonth >= LEDGER_START_MONTH &&
    selectedMonth >= dhakaISO(tenant.startDate).slice(0, 7) &&
    (tenant.leaseStatus === "ACTIVE" || (leaseEnd != null && selectedMonth <= dhakaISO(leaseEnd).slice(0, 7)))
  );
  const selectedTerms = resolveRentTermsForMonth(
    {
      monthlyRentAmount: tenant.configuredMonthlyRentAmount,
      serviceChargeType: tenant.configuredServiceChargeType,
      serviceChargeValue: tenant.configuredServiceChargeValue,
    },
    tenant.rentRates,
    selectedMonth
  );
  // A month that has never had a payment recorded still has a real due amount (this lease's standing rent).
  const rentDue = rentTracked ? (payment?.dueAmount ?? rentTermsDueAmount(selectedTerms)) : 0;
  const rentPaid = rentTracked ? (payment?.paidAmount ?? 0) : 0;
  const rentRemaining = Math.max(0, rentDue - rentPaid);
  const rentStatus = payment?.status ?? "UNPAID";
  const billDate = dhakaNow();
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const rentDeadline = new Date(selectedYear, selectedMonthNumber - 1, RENT_DUE_DAY);
  const adjustment = tenant.downpaymentAdjustments.find((a) => a.month === selectedMonth) ?? null;
  const earlierRent = tenant.payments.filter((entry) => entry.month < selectedMonth).map((entry) => ({
    ...entry,
    remaining: Math.max(0, entry.dueAmount - entry.paidAmount),
  }));
  const earlierRentDue = earlierRent.reduce((sum, entry) => sum + entry.remaining, 0);

  const rentStatusLabels: Record<string, string> = {
    PAID: t("paid"),
    PARTIAL: t("invoicePartiallyPaid"),
    UNPAID: isMonthPastDue(selectedMonth, RENT_DUE_DAY) ? t("overdueStatus") : t("dueInPeriod"),
    ADJUSTED_FROM_DOWNPAYMENT: t("paid"),
  };

  // ---- utility bills
  // Company-paid bills (water, by policy) are never charged to the tenant: listed for reference, kept out of the totals.
  const paidByCompany = (bill: (typeof unitBills)[number]) => bill.paidByCompany || bill.type === "WATER";
  const billable = unitBills.filter((b) => !paidByCompany(b));
  const byDate = (a: (typeof unitBills)[number], b: (typeof unitBills)[number]) => a.dueDate.getTime() - b.dueDate.getTime();
  const earlierUnpaidBills = billable.filter((b) => b.month < selectedMonth && b.status !== "PAID").sort(byDate);
  const monthBills = billable.filter((b) => b.month === selectedMonth).sort(byDate);
  const statementBills = [...earlierUnpaidBills, ...monthBills];
  const companyBorneBills = unitBills.filter((b) => paidByCompany(b) && b.month === selectedMonth).sort(byDate);

  const billRemaining = (b: (typeof unitBills)[number]) =>
    b.status === "PAID" ? 0 : Math.max(0, b.amount - b.paidAmount);
  const utilityDue = statementBills.reduce((sum, b) => sum + b.amount, 0);
  const utilityRemaining = statementBills.reduce((sum, b) => sum + billRemaining(b), 0);

  const utilityTypeLabels: Record<string, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };
  const monthUtilityRows = [
    { type: "ELECTRICITY", icon: Zap, label: t("utilityTypeElectricity") },
    { type: "GAS", icon: Flame, label: t("utilityTypeGas") },
    { type: "WATER", icon: Droplet, label: t("utilityTypeWater") },
    { type: "OTHER", icon: ReceiptText, label: t("cashMemoOtherCharges") },
  ].map(({ type, label, icon }) => {
    const bills = monthBills.filter((b) => b.type === type);
    const companyBills = companyBorneBills.filter((b) => b.type === type);
    const due = bills.reduce((sum, b) => sum + b.amount, 0);
    const remaining = bills.reduce((sum, b) => sum + billRemaining(b), 0);
    return { type, label, icon, bills, companyBills, due, remaining };
  });
  const detailBills = [
    ...earlierUnpaidBills,
    ...monthBills.filter((b) => monthUtilityRows.some((row) => row.type === b.type && row.bills.length > 1)),
  ];
  const billStatusLabel = (status: string) =>
    status === "PAID" ? t("paid") : status === "PARTIAL" ? t("invoicePartiallyPaid") : t("billStatusUnpaid");

  // ---- totals
  const totalDue = rentDue + utilityDue;
  // An overpayment on one bill does not settle another bill.
  const balance = rentRemaining + utilityRemaining;
  const totalSettled = totalDue - balance;
  const previousUtilityDue = earlierUnpaidBills.reduce((sum, b) => sum + billRemaining(b), 0);
  const monthlyBalance = balance - previousUtilityDue;

  const paymentLines = [
    { id: selectedMonth, month: selectedMonth, kind: "rent" as const, remaining: rentRemaining, label: t("invoiceRentLabel") },
    ...statementBills.map((bill) => ({
      id: bill.id, month: bill.month, kind: "utility" as const, remaining: billRemaining(bill), label: fromRent ? `${utilityTypeLabels[bill.type]} · ${formatDate(bill.dueDate, locale)}` : utilityTypeLabels[bill.type],
    })),
  ].map(({ remaining, ...line }) => ({ ...line, remainingCents: Math.round(remaining * 100) }))
    .filter(({ remainingCents }) => remainingCents > 0);

  const invoiceQuery = new URLSearchParams({
    month: selectedMonth,
    ...(highlightedBillId ? { bill: highlightedBillId } : {}),
    ...(fromRent && tenantScope === "1" ? { tenant: "1" } : {}),
    ...(embedded ? { embed: "1", ...(receive === "1" ? { receive: "1" } : {}) } : {}),
  });
  const invoiceBasePath = `/${fromRent ? "rent" : "tenants"}/${id}/invoice`;
  const invoicePath = `${invoiceBasePath}?${invoiceQuery}`;
  const rentListPath = `/rent?month=${selectedMonth}${tenantScope === "1" ? `&tenant=${encodeURIComponent(id)}` : ""}`;
  const printIssue = fromRent ? await prisma.rentBillPrint.findFirst({
    where: { tenantLeaseId: id, month: selectedMonth }, orderBy: { revision: "desc" },
  }) : null;
  const printed = printIssue ? printIssue.rows as RentBillPrintRow[] : null;
  const monthlyLines = paymentLines.filter((line) => line.month === selectedMonth);
  const receiptLines = !fromRent ? paymentLines : printed
    ? limitToPrintedBill(monthlyLines, printed).map((line) => ({
        ...line, label: monthlyLines.find(({ id }) => id === line.id)!.label,
      }))
    : monthlyLines;
  const billNumber = `R-${selectedMonth.replace("-", "")}-${tenant.id.slice(-10).toUpperCase()}`;
  const memoHeader = {
    brand: tNav("brand"),
    month: monthLabel(selectedMonth, locale),
    property: tenant.propertyName,
    unit: tenant.unitLabel,
    name: tenant.tenantName,
    date: formatDate(billDate, locale),
    billNumber,
    companyAddress: t("cashMemoCompanyAddress"),
    companyPhone: t("cashMemoCompanyPhone"),
    labels: {
      unit: t("cashMemoUnit"), name: t("cashMemoName"), month: t("invoiceBillMonth"),
      date: t("cashMemoDate"), billNumber: t("cashMemoBillNumber"),
    },
  };

  const highlightedShown = highlightedBillId
    ? [...statementBills, ...companyBorneBills].some((b) => b.id === highlightedBillId)
    : false;

  const canCollect = tenant.leaseStatus === "ACTIVE" && selectedMonth <= nowMonth;
  const receiveForm = canCollect && receiptLines.length > 0 ? (
    <InvoicePaymentDialog
      key={`${invoicePaymentSnapshot(receiptLines)}:${printIssue?.revision ?? 0}:${receive ?? ""}`}
      tenantLeaseId={tenant.id}
      tenantName={tenant.tenantName}
      propertyId={tenant.propertyId}
      month={selectedMonth}
      lines={receiptLines}
      returnTo={invoicePath}
      inline={embedded}
      reconciliation={fromRent ? {
        revision: printIssue?.revision ?? 0,
        open: receive === "1",
        printedCents: printed?.reduce((sum, row) => sum + row.remainingCents, 0),
      } : undefined}
    />
  ) : null;
  const currentBills = [...monthBills, ...companyBorneBills];
  const electricityBills = currentBills.filter((bill) => bill.type === "ELECTRICITY");
  const today = dhakaTodayISO();
  const defaultBillDate = selectedMonth === nowMonth ? today : `${selectedMonth}-10`;
  const newBillDate = defaultBillDate < leaseStartDay ? leaseStartDay : defaultBillDate;
  const canEditPrintedBills = fromRent && canCollect && !(embedded && receive === "1");
  const previousForNewBill = canEditPrintedBills && !electricityBills.length && newBillDate.startsWith(selectedMonth)
    ? await getPreviousTenantMeterReading(id, newBillDate) : null;
  const fixedElectricityAmount = tenant.utilityBillDefaults.find((item) => item.type === "ELECTRICITY")?.amount ?? null;
  const utilityEditors = canEditPrintedBills ? Object.fromEntries(
    rentBillPrintKeys.filter((type) => type !== "RENT").map((type) => {
      const bills = currentBills.filter((bill) => bill.type === type);
      if (type === "ELECTRICITY" && !bills.length && newBillDate.startsWith(selectedMonth)) {
        return [type, <InvoiceElectricityFields key="new-electricity-bill" leaseId={id} month={selectedMonth} dueDate={newBillDate}
          fixedAmount={fixedElectricityAmount} previous={previousForNewBill?.reading ?? null} />];
      }
      return [type, bills.length ? (
        <ul className="mb-1 divide-y rounded-md bg-muted/40 px-2">
          {bills.map((bill) => {
            const billKey = JSON.stringify([bill.type, bill.amount, bill.paidAmount, bill.dueDate, bill.paidByCompany,
              bill.meterReading, bill.previousMeterReadingOverride]);
            return (
              <li key={bill.id} className="space-y-1 py-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>{formatDate(bill.dueDate, locale)} · {formatInvoiceAmount(bill.amount)}
                    {paidByCompany(bill) ? ` · ${t("paidByCompanyLabel")}` : ""}
                  </span>
                  <EditUtilityBillDialog
                    key={billKey} bill={bill} returnTo={invoicePath} fixedUnitId={bill.unitId}
                    invoice={{ leaseId: id, month: selectedMonth, startDate: leaseStartDay }}
                  />
                </div>
                {type === "ELECTRICITY" ? <InvoiceElectricityFields key={billKey + "-readings"} leaseId={id}
                  month={selectedMonth} dueDate={dhakaISO(bill.dueDate)} fixedAmount={fixedElectricityAmount}
                  previous={bill.previousMeterReading} bill={bill} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null];
    }),
  ) : undefined;
  const printForm = fromRent ? (
    <RentBillPrintForm key={`${selectedMonth}:${printIssue?.revision ?? 0}:${print ?? ""}`}
      leaseId={id} month={selectedMonth} rows={rentBillPrintRows(tenant, selectedMonth)}
      printed={printed} revision={printIssue?.revision ?? 0} prepare={print === "1"} returnTo={rentListPath}
      addUtilityBill={canCollect ? <InvoiceAddUtilityBillDialog leaseId={id} month={selectedMonth} compact /> : undefined}
      utilityEditors={utilityEditors}
      printedDate={printIssue ? formatDate(printIssue.printedAt, locale) : undefined}
      header={{ ...memoHeader, title: t("cashMemoRentTitle"), contact: tenant.contactInfo }} embedded={embedded} />
  ) : null;
  const otherCollection = canCollect && fromRent && print !== "1" ? (
    <RecordTenantRentPaymentDialog
      key={selectedMonth}
      propertyId={tenant.propertyId} tenantLeaseId={id} tenantName={tenant.tenantName}
      propertyName={tenant.propertyName} unitLabel={tenant.unitLabel}
      collectionBalance={rentRemaining} monthlyRentAmount={tenant.monthlyRentAmount}
      serviceChargeType={tenant.serviceChargeType} serviceChargeValue={tenant.serviceChargeValue}
      currentDownpaymentBalance={tenant.currentDownpaymentBalance}
      rentRates={tenant.rentRates} paymentProgress={tenant.paymentProgress} overdueMonths={tenant.overdueMonths}
      initialBillingMonth={selectedMonth} returnTo={embedded ? invoicePath : rentListPath}
      triggerLabel={t("rentBillOtherCollection")}
    />
  ) : null;
  const noOutstanding = <p className="rounded-md border px-3 py-2 text-sm print:hidden">{t("rentBillNoOutstanding")}</p>;

  if (embedded) {
    return (
      <div data-rent-bill-embed className="space-y-3">
        {receive === "1" ? (
          <>
            {receiveForm ?? noOutstanding}
            {otherCollection}
          </>
        ) : (
          <>
            <p className="text-sm font-medium print:hidden">{tenant.tenantName} · {monthLabel(selectedMonth, locale)}</p>
            {printForm}
          </>
        )}
      </div>
    );
  }

  return (
    <div data-tenant-invoice-page className="mx-auto flex w-full max-w-[155mm] min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {fromRent ? (
          <Button variant="outline" render={<Link href={rentListPath} />} nativeButton={false}>
            <ArrowLeft className="size-4" />
            {t("backToRentCollection")}
          </Button>
        ) : null}
        <InvoiceMonthSelect leaseId={id} months={availableMonths} selectedMonth={selectedMonth}
          basePath={invoiceBasePath} tenantScope={fromRent && tenantScope === "1"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {!fromRent ? <InvoicePrintButton label={t("invoicePrintBill")} /> : null}
        {(!fromRent || print !== "1") ? receiveForm : null}
        {otherCollection}
        {!fromRent && canCollect ? <InvoiceAddUtilityBillDialog key={selectedMonth} leaseId={id} month={selectedMonth} /> : null}
      </div>
      {fromRent && receive === "1" && !receiptLines.length ? noOutstanding : null}
      {printForm}

      <div data-testid="invoice" className={cn("print-invoice-a4", fromRent && "print:hidden")}>
      <div
        data-testid="invoice-copy"
        className={cn(cashMemoClassName, "tenant-bill gap-4 rounded-lg border-sky-900/40 p-4 sm:p-5")}
      >
        <CashMemoHeader {...memoHeader} title={t("cashMemoRentTitle")} contact={tenant.contactInfo} />

        <section className="print:hidden tenant-bill-summary overflow-hidden rounded-lg border border-primary/25 bg-primary/[0.045]" aria-label={t("cashMemoSummary")}>
          <dl className="tenant-bill-summary-main grid grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[1.25fr_1fr_1fr]">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm font-semibold">{t("invoiceSimpleBalance")}</dt>
              <dd data-testid="invoice-balance" className={cn("tenant-bill-balance mt-1 text-2xl leading-tight font-bold tabular-nums", balance > 0 ? "text-destructive" : "text-success")}>
                {formatInvoiceAmount(balance)}
              </dd>
            </div>
            <div className="sm:border-s sm:ps-4">
              <dt className="text-xs text-muted-foreground">{t("invoiceSimpleBillTotal")}</dt>
              <dd data-testid="invoice-total-due" className="text-base font-semibold tabular-nums">{formatInvoiceAmount(totalDue)}</dd>
            </div>
            <div className="border-s ps-3 sm:ps-4">
              <dt className="text-xs text-muted-foreground">{t("invoiceSimplePaid")}</dt>
              <dd data-testid="invoice-total-paid" className="text-base font-semibold tabular-nums text-success">{formatInvoiceAmount(totalSettled)}</dd>
            </div>
          </dl>
          {previousUtilityDue > 0 ? (
            <dl className="tenant-bill-breakdown flex flex-wrap gap-x-6 gap-y-2 border-t border-primary/15 px-4 py-2.5 text-xs sm:px-6">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">{t("cashMemoMonthlyBalance")}</dt>
                <dd className="font-semibold tabular-nums">{formatInvoiceAmount(monthlyBalance)}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">{t("cashMemoEarlierUtilities")}</dt>
                <dd className="font-semibold tabular-nums">{formatInvoiceAmount(previousUtilityDue)}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="min-w-0" aria-label={t("cashMemoMonthlyCharges")}>
          <h2 className="mb-2.5 text-base font-bold sm:text-lg print:break-after-avoid">
            {t("cashMemoMonthlyCharges")}
          </h2>
          <Table data-testid="invoice-monthly-charges" className="tenant-bill-charges text-xs sm:text-sm">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead scope="col" className="h-8 whitespace-normal">{t("cashMemoCharge")}</TableHead>
                <TableHead scope="col" className="h-8 whitespace-normal text-right">{t("invoiceSimpleBillTotal")}</TableHead>
                <TableHead scope="col" className="h-8 whitespace-normal text-right">{t("invoiceSimplePaid")}</TableHead>
                <TableHead scope="col" className="h-8 whitespace-normal text-right">{t("cashMemoShortBalance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <th scope="row" className="p-2 text-left align-middle font-medium">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <House aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    {t("cashMemoRentCharge")}
                  </span>
                  {!rentTracked ? <span className="text-xs font-normal text-muted-foreground">{t("cashMemoNoCharge")}</span> : null}
                  {rentTracked && rentDue > selectedTerms.monthlyRentAmount ? (
                    <span className="block text-[0.7rem] font-normal text-muted-foreground">{t("cashMemoRentIncludesService")}</span>
                  ) : null}
                </th>
                <TableCell data-testid="invoice-rent-due" className="text-right tabular-nums">
                  {rentTracked ? formatInvoiceAmount(rentDue) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {rentTracked ? formatInvoiceAmount(Math.min(rentPaid, rentDue)) : "—"}
                </TableCell>
                <TableCell className={cn("bg-muted/30 text-right tabular-nums", rentRemaining > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                  {rentTracked ? formatInvoiceAmount(rentRemaining) : "—"}
                </TableCell>
              </TableRow>
              {monthUtilityRows.map(({ type, label, icon: Icon, bills, companyBills, due, remaining }) => {
                if (bills.length === 0 && companyBills.length === 0) {
                  return <CashMemoHandwritingRow key={type} label={label} />;
                }

                return (
                  <TableRow key={type} className={cn(
                    [...bills, ...companyBills].some((b) => b.id === highlightedBillId) && "bg-primary/5 print:bg-transparent"
                  )}>
                    <th scope="row" className="p-2 text-left align-middle font-medium">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                        {label}
                      </span>
                      {companyBills.length > 0 ? (
                        <span className="block text-[0.7rem] font-normal text-muted-foreground">
                          {t("cashMemoCompanyShare", { amount: formatInvoiceAmount(companyBills.reduce((sum, b) => sum + b.amount, 0)) })}
                        </span>
                      ) : null}
                      {type === "ELECTRICITY" ? [...bills, ...companyBills].map((b) => b.meterReading != null ? (
                        <CashMemoReading key={b.id}
                          current={b.meterReading} previous={b.previousMeterReading} units={b.consumptionUnits}
                          label={t("cashMemoReading")} unitLabel={t("cashMemoUnits")} missing={t("cashMemoReadingMissing")}
                          locale={locale}
                        />
                      ) : null) : null}
                    </th>
                    <TableCell className="text-right tabular-nums">{bills.length ? formatInvoiceAmount(due) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bills.length ? formatInvoiceAmount(due - remaining) : "—"}</TableCell>
                    <TableCell className={cn("bg-muted/30 text-right tabular-nums", remaining > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {bills.length ? formatInvoiceAmount(remaining) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rentTracked ? (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="print:hidden">{t("invoiceRentSection")}: <strong data-testid="invoice-status">{rentStatusLabels[rentStatus] ?? rentStatus}</strong></span>
              <span>{t("invoiceDueDateLabel")}: {formatDate(rentDeadline, locale)}</span>
              {payment?.paidAt ? <span className="print:hidden">{t("paidDate")}: {formatDate(payment.paidAt, locale)}</span> : null}
              {payment?.method ? <span className="print:hidden">{t("paymentMethod")}: {paymentMethodLabel(t, payment.method)}</span> : null}
            </p>
          ) : null}
          {adjustment ? (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs print:hidden">
              <p className="font-medium text-primary">{t("adjustedFromDownpaymentNote")}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  {t("amount")}: <span className="font-mono font-medium text-foreground">{formatInvoiceAmount(adjustment.amountAdjusted)}</span>
                </span>
                <span>
                  {t("downpaymentBalance")}:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {formatInvoiceAmount(tenant.currentDownpaymentBalance)}
                  </span>
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {detailBills.length > 0 ? (
          <section className="min-w-0 print:hidden">
            <h2 className="mb-1 tenant-bill-section-label rounded-t-md border-b bg-muted/60 px-3 py-2.5 text-sm font-semibold print:break-after-avoid">
              {t(detailBills.some((b) => b.month === selectedMonth) ? "invoiceUtilitySection" : "cashMemoEarlierUtilities")}
            </h2>
            <Table data-testid="invoice-bills" className="tenant-bill-detail text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("utilityType")}</TableHead>
                  <TableHead>{t("invoiceBillMonth")}</TableHead>
                  <TableHead className="text-right">{t("invoiceSimpleBillTotal")}</TableHead>
                  <TableHead className="text-right">{t("invoiceSimplePaid")}</TableHead>
                  <TableHead className="text-right">{t("remaining")}</TableHead>
                  <TableHead className="hidden sm:table-cell print:table-cell">{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailBills.map((b) => (
                  <TableRow
                    key={b.id}
                    data-bill-id={b.id}
                    className={cn(b.id === highlightedBillId && "bg-primary/5 print:bg-transparent")}
                  >
                    <TableCell>
                      {utilityTypeLabels[b.type] ?? b.type}
                      <p className="text-xs text-muted-foreground sm:hidden print:hidden">
                        {billStatusLabel(b.status)}
                        {b.paidAt ? ` · ${formatDate(b.paidAt, locale)}` : null}
                      </p>
                      {b.month < selectedMonth && b.type === "ELECTRICITY" && b.meterReading != null ? (
                        <CashMemoReading
                          current={b.meterReading}
                          previous={b.previousMeterReading}
                          units={b.consumptionUnits}
                          label={t("cashMemoReading")}
                          unitLabel={t("cashMemoUnits")}
                          missing={t("cashMemoReadingMissing")}
                          locale={locale}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {monthLabel(b.month, locale)}
                      {b.month < selectedMonth ? (
                        <div className="mt-0.5">
                          <Badge variant="outline" className="border-destructive/40 text-[0.65rem] text-destructive">
                            {t("invoicePreviousBill")}
                          </Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatInvoiceAmount(b.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-success">{formatInvoiceAmount(b.paidAmount)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        billRemaining(b) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {formatInvoiceAmount(billRemaining(b))}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell print:table-cell">
                      <span data-testid="invoice-bill-status">{billStatusLabel(b.status)}</span>
                      {b.paidAt ? (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{formatDate(b.paidAt, locale)}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ) : null}
        {highlightedShown ? (
          <p className="text-xs text-muted-foreground print:hidden">{t("invoiceBillHighlightNote")}</p>
        ) : null}

        <div className="hidden items-center justify-between gap-3 border-t px-2 pt-2 font-semibold print:flex print:break-inside-avoid">
          <span>{t("invoiceMonthlyPrintTotal")}</span>
          <strong data-testid="invoice-monthly-print-total" className="text-lg tabular-nums">
            {formatInvoiceAmount(rentDue + monthUtilityRows.reduce((sum, row) => sum + row.due, 0))}
          </strong>
        </div>

        <CashMemoSignatures tenant={t("cashMemoTenantSignature")} company={t("cashMemoCompanySignature")} />
      </div>
      </div>

      <section aria-labelledby="earlier-rent-heading" className="mt-2 rounded-lg border bg-card print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 id="earlier-rent-heading" className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("invoiceEarlierRentHistory")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("invoiceHistoryScreenOnly")}</p>
          </div>
          <Button variant="outline" size="sm" render={<Link href={`/tenants/${id}/history`} />} nativeButton={false}>
            {history("open")}
          </Button>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">{t("invoicePreviousRentDue")}</p>
          <strong className={cn("text-lg tabular-nums", earlierRentDue > 0 ? "text-destructive" : "text-success")}>
            {formatInvoiceAmount(earlierRentDue)}
          </strong>
        </div>
        {earlierRent.length ? (
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="px-4">{t("invoiceBillMonth")}</TableHead>
                <TableHead scope="col" className="text-right">{t("invoiceSimpleBillTotal")}</TableHead>
                <TableHead scope="col" className="text-right">{t("invoiceSimplePaid")}</TableHead>
                <TableHead scope="col" className="px-4 text-right">{t("remaining")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earlierRent.map((entry) => (
                <TableRow key={entry.month}>
                  <TableCell className="whitespace-normal px-4 font-medium">
                    {monthLabel(entry.month, locale)}
                    {entry.paidAt ? (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{formatDate(entry.paidAt, locale)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatInvoiceAmount(entry.dueAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInvoiceAmount(entry.paidAmount)}</TableCell>
                  <TableCell className={cn("px-4 text-right tabular-nums", entry.remaining > 0 && "font-semibold text-destructive")}>
                    {formatInvoiceAmount(entry.remaining)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">{t("invoiceNoEarlierRent")}</p>
        )}
      </section>
    </div>
  );
}
