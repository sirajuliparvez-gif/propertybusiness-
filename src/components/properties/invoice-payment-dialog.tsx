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
import { formatTaka, monthLabel } from "@/lib/format";
import { allocateInvoicePayment, invoicePaymentSnapshot, type InvoicePaymentLine } from "@/lib/invoice-payment";
import { recordOverdueRentPayment } from "@/lib/actions/tenant-rent";

const money = (cents: number) => formatTaka(cents / 100, 2);
type Choice = "all" | "rent" | "partial";

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
  const [choice, setChoice] = useState<Choice | null>(null);
  const [partial, setPartial] = useState("");
  const [pending, startTransition] = useTransition();
  const rent = lines.filter((line) => line.kind === "rent" && line.month === month);
  const total = lines.reduce((sum, line) => sum + line.remainingCents, 0);
  const rentTotal = rent.reduce((sum, line) => sum + line.remainingCents, 0);
  const normalizedPartial = partial.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6)).trim();
  const partialCents = /^\d+(\.\d{1,2})?$/.test(normalizedPartial)
    ? Math.round(Number(normalizedPartial) * 100) : 0;
  const amount = choice === "all" ? total : choice === "rent" ? rentTotal : partialCents;
  const valid = choice != null && Number.isSafeInteger(amount) && amount > 0 && amount <= total;
  const planned = valid ? allocateInvoicePayment(choice === "rent" ? rent : lines, amount) : [];
  const rentPaid = planned.filter((line) => line.kind === "rent").reduce((sum, line) => sum + line.paidCents, 0);
  const utilityPaid = amount - rentPaid;
  const labels = new Map(lines.map((line) => [line.id, line.label]));
  const today = dhakaTodayISO();

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (!next) { setChoice(null); setPartial(""); }
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
                setChoice(null);
                setPartial("");
                router.refresh();
              }
            }
          });
        }}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="invoiceMonth" value={month} />
          <input type="hidden" name="invoiceChoice" value={choice ?? ""} />
          <input type="hidden" name="invoiceSnapshot" value={invoicePaymentSnapshot(lines)} />
          <input type="hidden" name="amount" value={(amount / 100).toFixed(2)} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <fieldset className="grid gap-2" disabled={pending}>
            <legend className="mb-2 text-sm font-medium">{t("invoicePaymentChoice")}</legend>
            {([["all", "invoicePayAll", total], ["rent", "invoicePayMonthRent", rentTotal], ["partial", "invoicePayPart", null]] as const)
              .filter(([, , balance]) => balance !== 0)
              .map(([value, label, balance]) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 has-checked:border-primary has-checked:bg-primary/5">
                  <input type="radio" name="paymentChoiceDisplay" value={value} checked={choice === value}
                    onChange={() => setChoice(value)} className="size-4 accent-primary" />
                  <span className="flex-1">{t(label)}</span>
                  {balance != null && <strong className="tabular-nums">{money(balance)}</strong>}
                </label>
              ))}
          </fieldset>
          {choice === "partial" && (
            <FormField label={t("invoicePaymentAmount")} htmlFor="invoice-partial" required>
              <Input id="invoice-partial" value={partial} inputMode="decimal" onChange={(event) => setPartial(event.target.value)} required />
              <p className={partial && !valid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {t(partial && !valid ? "invoicePaymentInvalid" : "invoiceOldestFirst")}
              </p>
            </FormField>
          )}
          {valid && <>
            <section className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
              <p className="font-semibold">{t("invoicePaymentPreview", { amount: money(amount), remaining: money(total - amount) })}</p>
              {rentPaid > 0 && <p>{t("invoiceRentLabel")} {money(rentPaid)}</p>}
              {utilityPaid > 0 && <p>{t("invoiceUtilityLabel")} {money(utilityPaid)}</p>}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("paymentDate")} htmlFor="invoice-payment-date" required>
                <Input id="invoice-payment-date" name="date" type="date" defaultValue={today} max={today} required />
              </FormField>
              <FormField label={t("invoiceMoneyMethod")} htmlFor="invoice-payment-method">
                <select id="invoice-payment-method" name="method" defaultValue="CASH" className="h-8 w-full rounded-lg border bg-background px-2">
                  {([["CASH", "paymentMethodCash"], ["BKASH", "paymentMethodBkash"], ["NAGAD", "paymentMethodNagad"], ["BANK", "paymentMethodBank"], ["BANK_CHECK", "paymentMethodBankCheck"], ["OTHER", "paymentMethodOther"]] as const)
                    .map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                </select>
              </FormField>
            </div>
          </>}
          <Button type="submit" disabled={!valid || pending}>{t("invoicePaymentSave")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
