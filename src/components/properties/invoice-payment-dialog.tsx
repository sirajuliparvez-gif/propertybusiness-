"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/properties/form-field";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { allocateInvoicePayment, invoicePaymentSnapshot, reconcileInvoiceAllocation, type InvoicePaymentLine } from "@/lib/invoice-payment";
import { useBillDraft, useBillSession } from "@/components/properties/bill-form-session";
import { receiptAttempt, type ReceiptAttempt } from "@/lib/receipt-request";
import { recordOverdueRentPayment } from "@/lib/actions/tenant-rent";

const money = (cents: number) => formatTaka(cents / 100, 2);
function readCents(value: string) {
  const normalized = value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6)).trim();
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : NaN;
}

export function InvoicePaymentDialog({
  tenantName, tenantLeaseId, propertyId, month, returnTo, lines, reconciliation, inline = false,
}: {
  tenantName: string;
  tenantLeaseId: string;
  propertyId: string;
  month: string;
  returnTo: string;
  lines: (InvoicePaymentLine & { label: string })[];
  reconciliation?: { revision: number; open: boolean; printedCents?: number };
  inline?: boolean;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(reconciliation?.open ?? false);
  const session = useBillSession();
  const scope = `receive:${month}:`;
  const [matches, setMatches] = useBillDraft(scope + "matches", true);
  const [onlyRent, setOnlyRent] = useBillDraft(scope + "onlyRent", false);
  const [received, setReceived] = useBillDraft(scope + "received", "");
  const [split, setSplit] = useBillDraft<Record<string, string>>(scope + "split", {});
  const [pending, startTransition] = useTransition();
  const attempt = useRef<ReceiptAttempt | null>(null);
  const rent = lines.filter((line) => line.kind === "rent" && line.month === month);
  const hasEarlierUtilities = lines.some((line) => line.kind === "utility" && line.month < month);
  const total = lines.reduce((sum, line) => sum + line.remainingCents, 0);
  const rentTotal = rent.reduce((sum, line) => sum + line.remainingCents, 0);
  const amount = reconciliation && matches ? total : readCents(received);
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= total;
  const planned = valid ? allocateInvoicePayment(onlyRent ? rent : lines, Math.min(amount, total)) : [];
  const showSplit = Boolean(reconciliation) && valid && amount < total && lines.length > 1;
  const suggested = new Map(planned.map(({ id, paidCents }) => [id, paidCents]));
  const splitValues = lines.map(({ id }) => split[id] ?? ((suggested.get(id) ?? 0) / 100).toFixed(2));
  const splitCents = splitValues.map((value) => value.trim() ? readCents(value) : 0);
  const manual = lines.map(({ id }, index) => [id, splitCents[index]]);
  const validSplit = !showSplit || reconcileInvoiceAllocation(lines, amount, manual) !== null;
  const actionLabel = t(reconciliation ? "rentBillReceive" : "invoiceTakePayment");
  const labels = new Map(lines.map((line) => [line.id, line.label]));
  const today = dhakaTodayISO();
  const [date, setDate] = useBillDraft("paymentDate", today);
  const methods = [
    ["CASH", "paymentMethodCash"], ["BKASH", "paymentMethodBkash"], ["NAGAD", "paymentMethodNagad"],
    ["BANK", "paymentMethodBank"], ["BANK_CHECK", "paymentMethodBankCheck"], ["OTHER", "paymentMethodOther"],
  ] as const;
  const [method, setMethod] = useBillDraft<(typeof methods)[number][0]>("paymentMethod", "CASH");

  const paymentForm = (
    <>
        <p className="text-sm font-medium">{tenantName} · {monthLabel(month, locale)}</p>
        <form className="grid gap-4" action={(formData) => {
          if (!valid || !validSplit || pending || session?.blocked) return;
          startTransition(async () => {
            try {
            attempt.current = receiptAttempt(formData, attempt.current);
            formData.set("receiptRequestId", attempt.current.id);
            const result = await recordOverdueRentPayment(formData);
            if (result && !result.ok) {
              toast.error(t(result.reason === "changed" ? "invoicePaymentChanged" : "invoicePaymentInvalid"));
              if (result.reason === "changed") {
                setOpen(false);
                setOnlyRent(false);
                setReceived("");
                setSplit({});
                router.refresh();
              }
            }
            } catch (error) {
              if (error && typeof error === "object" && "digest" in error) throw error;
              toast.error(t("receiptRetrySame"));
            }
          });
        }}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="invoiceMonth" value={month} />
          <input type="hidden" name="invoiceChoice" value={reconciliation ? "reconcile" : onlyRent ? "rent" : "partial"} />
          {reconciliation ? <input type="hidden" name="printRevision" value={reconciliation.revision} /> : null}
          {showSplit && validSplit ? <input type="hidden" name="receiptAllocation" value={JSON.stringify(manual)} /> : null}
          <input type="hidden" name="invoiceSnapshot" value={invoicePaymentSnapshot(lines)} />
          <input type="hidden" name="amount" value={(amount / 100).toFixed(2)} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {reconciliation ? (
            <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <legend className="sr-only">{t("rentBillMatchQuestion")}</legend>
              <p className="flex justify-between gap-2 font-semibold"><span>{t("rentBillExpected")}</span><span>{money(total)}</span></p>
              {reconciliation.printedCents != null && reconciliation.printedCents !== total ? (
                <p className="text-xs text-muted-foreground">{t("rentBillOriginalExpected", { amount: money(reconciliation.printedCents) })}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={matches ? "default" : "outline"} aria-pressed={matches}
                  disabled={pending} onClick={() => setMatches(true)}>{t("rentBillMatched")}</Button>
                <Button type="button" size="sm" variant={!matches ? "default" : "outline"} aria-pressed={!matches}
                  disabled={pending} onClick={() => setMatches(false)}>{t("rentBillDifferent")}</Button>
              </div>
            </fieldset>
          ) : null}
          {!reconciliation || !matches ? <FormField label={t("invoicePaymentAmount")} htmlFor="invoice-received" required>
            <Input
              id="invoice-received"
              value={received}
              inputMode="decimal"
              disabled={pending}
              onChange={(event) => {
                setReceived(event.target.value);
                setSplit({});
                setOnlyRent(false);
              }}
              required
            />
            {received && !valid ? <p className="text-xs text-destructive">{t("invoicePaymentInvalid")}</p> : null}
          </FormField> : null}
          {valid && (
            <section className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
              {reconciliation && amount < total ? (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("receiptReceived")}</dt>
                      <dd className="font-semibold tabular-nums">{money(amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("receiptCheckRemaining")}</dt>
                      <dd className="font-semibold tabular-nums text-destructive">{money(total - amount)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">{t("receiptCheckBalanceStays", { month: monthLabel(month, locale) })}</p>
                </>
              ) : <p className="font-semibold">{t("invoicePaymentPreview", { amount: money(amount), remaining: money(total - amount) })}</p>}
              {onlyRent || hasEarlierUtilities ? (
                <p className="text-xs text-muted-foreground">
                  {t(onlyRent ? "invoicePaymentOnlyRent" : "invoiceOldestFirst")}
                </p>
              ) : null}
              {showSplit ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-2 font-medium">{t("receiptCheckSplit")}</legend>
                  {lines.map((line, index) => {
                    const paid = splitCents[index];
                    const lineValid = Number.isSafeInteger(paid) && paid >= 0 && paid <= line.remainingCents;
                    return (
                      <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-3 rounded-md border bg-background px-3 py-2">
                        <label htmlFor={`receipt-split-${index}`} className="font-medium">{line.label}</label>
                        <span className="text-xs text-muted-foreground">{t("receiptReceived")}</span>
                        <div className="text-xs text-muted-foreground">
                          {t("rentBillExpected")} {money(line.remainingCents)}
                          {lineValid ? <span className={paid < line.remainingCents ? "block font-medium text-destructive" : "block"}>
                            {t("receiptCheckRemaining")} {money(line.remainingCents - paid)}
                          </span> : null}
                        </div>
                        <Input id={`receipt-split-${index}`} inputMode="decimal" value={splitValues[index]} disabled={pending}
                          aria-invalid={!lineValid} onChange={(event) => setSplit({ ...split, [line.id]: event.target.value })} />
                      </div>
                    );
                  })}
                  {!validSplit ? <p className="text-xs text-destructive" role="status">{t("receiptCheckSplitInvalid", { amount: money(amount) })}</p> : null}
                </fieldset>
              ) : reconciliation && amount < total ? null : <details>
                <summary className="cursor-pointer text-muted-foreground">{t("invoicePaymentBreakdown")}</summary>
                <ul className="mt-2 grid gap-1">
                  {planned.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>{monthLabel(line.month, locale)} · {labels.get(line.id)}</span>
                      <span>{money(line.paidCents)}</span>
                    </li>
                  ))}
                </ul>
              </details>}
            </section>
          )}
          {!reconciliation ? <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("invoiceAmountShortcuts")}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => {
                setOnlyRent(false);
                setReceived((total / 100).toFixed(2));
              }}>{t("invoicePayAll")}</Button>
              {rentTotal > 0 && rentTotal !== total ? (
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => {
                  setOnlyRent(true);
                  setReceived((rentTotal / 100).toFixed(2));
                }}>{t("invoicePayMonthRent")}</Button>
              ) : null}
            </div>
          </details> : null}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {t("invoicePaymentDetails")} · {date ? formatDate(date, locale) : t("paymentDate")} · {t(methods.find(([value]) => value === method)![1])}
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <FormField label={t("paymentDate")} htmlFor="invoice-payment-date" required>
                <Input id="invoice-payment-date" name="date" type="date" value={date} onInput={(event) => setDate(event.currentTarget.value)} onChange={(event) => setDate(event.target.value)} max={today} required />
              </FormField>
              <FormField label={t("invoiceMoneyMethod")} htmlFor="invoice-payment-method">
                <select id="invoice-payment-method" name="method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="h-8 w-full rounded-lg border bg-background px-2">
                  {methods.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                </select>
              </FormField>
            </div>
          </details>
          {date ? <p className="text-sm text-muted-foreground" role="status">
            {t("collectionCashMonthHint", { month: monthLabel(date.slice(0, 7), locale) })}
          </p> : null}
          <Button type="submit" disabled={!valid || !validSplit || !date || date > today || pending || session?.blocked}>{t("invoicePaymentSave")}</Button>
        </form>
    </>
  );

  if (inline) return <div className="space-y-3">{paymentForm}</div>;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (!next) {
        setOnlyRent(false);
        setMatches(true);
        setReceived("");
        setSplit({});
        setDate(today);
        setMethod("CASH");
      }
    }}>
      <DialogTrigger render={<Button />}>{actionLabel}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{actionLabel}</DialogTitle></DialogHeader>
        {paymentForm}
      </DialogContent>
    </Dialog>
  );
}
