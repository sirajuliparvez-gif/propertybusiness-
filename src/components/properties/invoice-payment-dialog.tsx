"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/properties/form-field";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { allocateInvoicePayment, invoicePaymentSnapshot, type InvoicePaymentLine } from "@/lib/invoice-payment";
import { recordOverdueRentPayment } from "@/lib/actions/tenant-rent";

const money = (cents: number) => formatTaka(cents / 100, 2);

export function InvoicePaymentDialog({
  tenantName, tenantLeaseId, propertyId, month, returnTo, lines,
}: {
  tenantName: string;
  tenantLeaseId: string;
  propertyId: string;
  month: string;
  returnTo: string;
  lines: (InvoicePaymentLine & { label: string })[];
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [onlyRent, setOnlyRent] = useState(false);
  const [received, setReceived] = useState("");
  const [pending, startTransition] = useTransition();
  const rent = lines.filter((line) => line.kind === "rent" && line.month === month);
  const total = lines.reduce((sum, line) => sum + line.remainingCents, 0);
  const rentTotal = rent.reduce((sum, line) => sum + line.remainingCents, 0);
  const normalizedAmount = received.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6)).trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(normalizedAmount)
    ? Math.round(Number(normalizedAmount) * 100) : 0;
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= total;
  const planned = valid ? allocateInvoicePayment(onlyRent ? rent : lines, amount) : [];
  const labels = new Map(lines.map((line) => [line.id, line.label]));
  const today = dhakaTodayISO();
  const [date, setDate] = useState(today);
  const methods = [
    ["CASH", "paymentMethodCash"], ["BKASH", "paymentMethodBkash"], ["NAGAD", "paymentMethodNagad"],
    ["BANK", "paymentMethodBank"], ["BANK_CHECK", "paymentMethodBankCheck"], ["OTHER", "paymentMethodOther"],
  ] as const;
  const [method, setMethod] = useState<(typeof methods)[number][0]>("CASH");

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (!next) {
        setOnlyRent(false);
        setReceived("");
        setDate(today);
        setMethod("CASH");
      }
    }}>
      <DialogTrigger render={<Button />}>{t("invoiceTakePayment")}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("invoiceTakePayment")}</DialogTitle></DialogHeader>
        <p className="text-sm font-medium">{tenantName} · {monthLabel(month, locale)}</p>
        <form className="grid gap-4" action={(formData) => {
          if (!valid || pending) return;
          startTransition(async () => {
            const result = await recordOverdueRentPayment(formData);
            if (result && !result.ok) {
              toast.error(t(result.reason === "changed" ? "invoicePaymentChanged" : "invoicePaymentInvalid"));
              if (result.reason === "changed") {
                setOpen(false);
                setOnlyRent(false);
                setReceived("");
                router.refresh();
              }
            }
          });
        }}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="invoiceMonth" value={month} />
          <input type="hidden" name="invoiceChoice" value={onlyRent ? "rent" : "partial"} />
          <input type="hidden" name="invoiceSnapshot" value={invoicePaymentSnapshot(lines)} />
          <input type="hidden" name="amount" value={(amount / 100).toFixed(2)} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <FormField label={t("invoicePaymentAmount")} htmlFor="invoice-received" required>
            <Input
              id="invoice-received"
              value={received}
              inputMode="decimal"
              disabled={pending}
              onChange={(event) => {
                setReceived(event.target.value);
                setOnlyRent(false);
              }}
              required
            />
            {received && !valid ? <p className="text-xs text-destructive">{t("invoicePaymentInvalid")}</p> : null}
          </FormField>
          {valid && (
            <section className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
              <p className="font-semibold">{t("invoicePaymentPreview", { amount: money(amount), remaining: money(total - amount) })}</p>
              <p className="text-xs text-muted-foreground">
                {t(onlyRent ? "invoicePaymentOnlyRent" : "invoiceOldestFirst")}
              </p>
              <details>
                <summary className="cursor-pointer text-muted-foreground">{t("invoicePaymentBreakdown")}</summary>
                <ul className="mt-2 grid gap-1">
                  {planned.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>{monthLabel(line.month, locale)} · {labels.get(line.id)}</span>
                      <span>{money(line.paidCents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
          <details className="text-sm">
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
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {t("invoicePaymentDetails")} · {date ? formatDate(date, locale) : t("paymentDate")} · {t(methods.find(([value]) => value === method)![1])}
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <FormField label={t("paymentDate")} htmlFor="invoice-payment-date" required>
                <Input id="invoice-payment-date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} max={today} required />
              </FormField>
              <FormField label={t("invoiceMoneyMethod")} htmlFor="invoice-payment-method">
                <select id="invoice-payment-method" name="method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="h-8 w-full rounded-lg border bg-background px-2">
                  {methods.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                </select>
              </FormField>
            </div>
          </details>
          <Button type="submit" disabled={!valid || !date || date > today || pending}>{t("invoicePaymentSave")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
