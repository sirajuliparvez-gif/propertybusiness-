import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceHeader } from "@/components/invoice-header";
import { InvoiceMonthSelect } from "@/components/properties/invoice-month-select";
import { InvoicePrintButton } from "@/components/properties/invoice-print-button";
import { getEmployeeProfile } from "@/lib/employees-data";
import { formatTaka, formatDate, monthLabel } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { dhakaNow } from "@/lib/dhaka-time";
import { isMonthPastDue, SALARY_DUE_DAY } from "@/lib/rent-ledger";

function currentMonthKey() {
  const now = dhakaNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function EmployeeSalarySlipPage({
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

  const employee = await getEmployeeProfile(id);
  if (!employee) notFound();

  const nowMonth = currentMonthKey();
  const availableMonths = Array.from(new Set([...employee.payments.map((p) => p.month), nowMonth])).sort((a, b) =>
    a < b ? 1 : -1
  );
  const selectedMonth =
    requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0];

  // A month with no recorded payment still owes the employee's standing salary.
  const payment = employee.payments.find((p) => p.month === selectedMonth && !p.isVirtual) ?? null;
  const salaryDue = payment?.dueAmount ?? employee.salaryAmount;
  const salaryPaid = payment?.amountPaid ?? 0;
  const status = payment?.status ?? "PENDING";
  const statusLabels: Record<string, string> = {
    PAID: t("paid"),
    PARTIAL: t("pending"),
    // Unpaid is "payment period" until the 15th, বকেয়া after it.
    PENDING: isMonthPastDue(selectedMonth, SALARY_DUE_DAY) ? t("overdueStatus") : t("dueInPeriod"),
  };
  const remaining = Math.max(0, salaryDue - salaryPaid);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const salaryDeadline = new Date(selectedYear, selectedMonthNumber - 1, SALARY_DUE_DAY);

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" render={<Link href={`/employees/${id}`} />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {employee.name} / {t("salarySlipTitle")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceMonthSelect
            leaseId={id}
            months={availableMonths}
            selectedMonth={selectedMonth}
            basePath={`/employees/${id}/invoice`}
          />
          <InvoicePrintButton />
        </div>
      </div>

      <div
        data-testid="invoice"
        className="flex flex-col gap-6 rounded-xl border bg-card p-6 text-sm print:rounded-none print:border-0 print:p-0 sm:p-8"
      >
        <InvoiceHeader brand={tNav("brand")} title={t("salarySlipTitle")} subtitle={monthLabel(selectedMonth)}>
          {employee.propertyName ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" />
              {employee.propertyName}
            </p>
          ) : null}
        </InvoiceHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{t("invoiceEmployeeName")}</p>
            <p className="font-medium">{employee.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {employee.displayId} · {employee.role}
            </p>
            {employee.contactInfo ? (
              <p className="font-mono text-xs text-muted-foreground">{employee.contactInfo}</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-muted-foreground">{t("invoiceGeneratedOn")}</p>
            <p className="font-mono font-medium tabular-nums">{formatDate(dhakaNow())}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("invoiceSalarySection")}
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("invoiceSalaryDueLabel")}</p>
              <p className="font-mono font-semibold tabular-nums">{formatTaka(salaryDue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("invoiceSalaryPaidLabel")}</p>
              <p className="font-mono font-semibold tabular-nums text-success">{formatTaka(salaryPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("remaining")}</p>
              <p className={`font-mono font-semibold tabular-nums ${remaining > 0 ? "text-destructive" : ""}`}>
                {formatTaka(remaining)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("invoiceDueDateLabel")}</p>
              <p className="font-mono font-medium tabular-nums">{formatDate(salaryDeadline)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("status")}</p>
              <p data-testid="invoice-status" className="font-medium">
                {statusLabels[status] ?? status}
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
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("invoiceSalaryDueLabel")}</p>
            <p className="font-mono text-lg font-bold tabular-nums">{formatTaka(salaryDue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("invoiceSalaryPaidLabel")}</p>
            <p className="font-mono text-lg font-bold tabular-nums text-success">{formatTaka(salaryPaid)}</p>
            {remaining > 0 ? (
              <p className="font-mono text-xs tabular-nums text-destructive">
                {t("remaining")}: {formatTaka(remaining)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
