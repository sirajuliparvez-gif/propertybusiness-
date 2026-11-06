"use client";

import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CashMemoHeader, CashMemoReading, CashMemoSignatures, cashMemoClassName } from "@/components/properties/cash-memo";
import { useRouter } from "@/i18n/navigation";
import { confirmRentBillPrint } from "@/lib/actions/rent-bill-print";
import { formatTaka } from "@/lib/format";
import type { RentBillPrintKey, RentBillPrintRow } from "@/lib/rent-bill-print";

const money = (cents: number) => formatTaka(cents / 100, 2);

export function RentBillPrintForm({
  leaseId, month, rows, printed, printedDate, revision, header, prepare, returnTo, embedded = false, addUtilityBill, utilityEditors,
}: {
  leaseId: string;
  month: string;
  rows: RentBillPrintRow[];
  printed: RentBillPrintRow[] | null;
  printedDate?: string;
  revision: number;
  header: ComponentProps<typeof CashMemoHeader>;
  prepare: boolean;
  returnTo: string;
  embedded?: boolean;
  addUtilityBill?: ReactNode;
  utilityEditors?: Partial<Record<RentBillPrintKey, ReactNode>>;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(prepare);
  const [printedDraft, setPrintedDraft] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<RentBillPrintKey[]>(() => (printed ?? rows).map(({ key }) => key));
  const labels = {
    RENT: t("invoiceRentLabel"), ELECTRICITY: t("utilityTypeElectricity"), GAS: t("utilityTypeGas"),
    WATER: t("utilityTypeWater"), WASTE: t("utilityTypeWaste"),
    SECURITY: t("utilityTypeSecurity"), OTHER: t("cashMemoOtherCharges"),
  };
  const draft = rows.filter(({ key }) => selected.includes(key));
  const draftSnapshot = JSON.stringify(draft);
  const copy = open ? draft : printed ?? rows;
  const expected = copy.reduce((sum, row) => sum + row.remainingCents, 0);

  async function print() {
    await document.fonts.ready;
    window.print();
    if (open) setPrintedDraft(draftSnapshot);
  }

  function confirm() {
    if (printedDraft !== draftSnapshot) return;
    startTransition(async () => {
      try {
        if (await confirmRentBillPrint(leaseId, month, revision, selected, printedDraft)) {
          toast.success(t("rentBillPrinted"));
          if (embedded && window.parent !== window) {
            window.parent.postMessage("rent-bill-print-saved", window.location.origin);
          } else {
            router.push(returnTo);
          }
          return;
        }
      } catch {
        // Keep the selection available if saving fails.
      }
      toast.error(t("rentBillPrintChanged"));
      setPrintedDraft(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="print:hidden">
        {open ? (
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{t(revision ? "rentBillCorrection" : "rentBillPrintOptions")}</h2>
                <p className="text-xs text-muted-foreground">{t("rentBillChooseLines")}</p>
              </div>
              {addUtilityBill}
            </div>
            <fieldset disabled={pending} className="divide-y">
              {rows.map((row) => (
                <div key={row.key} className="py-1">
                  <label className="flex cursor-pointer items-center gap-3 py-1 text-sm">
                    <input type="checkbox" checked={selected.includes(row.key)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelected((previous) => checked ? [...previous, row.key] : previous.filter((key) => key !== row.key));
                        setPrintedDraft(null);
                      }} />
                    <span className="flex-1">{labels[row.key]}</span>
                    <span className="tabular-nums">{row.dueCents == null ? "—" : money(row.remainingCents)}</span>
                  </label>
                  {utilityEditors?.[row.key]}
                </div>
              ))}
            </fieldset>
            <p className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>{t("rentBillExpected")}</span><span>{money(expected)}</span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => {
                if (embedded && window.parent !== window) window.parent.postMessage("rent-bill-print-cancelled", window.location.origin);
                else { setOpen(false); setPrintedDraft(null); }
              }}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={() => void print()} disabled={!draft.length || pending}><Printer className="size-4" />{t("invoicePrintBill")}</Button>
              {printedDraft === draftSnapshot ? (
                <Button type="button" variant="outline" disabled={pending} onClick={confirm}>{t("rentBillConfirmPrinted")}</Button>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="flex flex-wrap gap-2">
            {printed ? <Button type="button" variant="outline" onClick={() => void print()}>{t("rentBillReprint")}</Button> : null}
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              {revision ? t("rentBillCorrection") : t("rentBillPrintOptions")}
            </Button>
          </div>
        )}
      </div>
      <div data-testid="issued-rent-bill-copy" className="print-invoice-a4 hidden print:block">
        <div className={cashMemoClassName}>
          <CashMemoHeader {...header} date={!open && printedDate ? printedDate : header.date} />
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b">
              <th scope="col" className="p-2 text-start">{t("cashMemoCharge")}</th>
              <th scope="col" className="p-2 text-end">{t("invoiceSimpleBillTotal")}</th>
              <th scope="col" className="p-2 text-end">{t("invoiceSimplePaid")}</th>
              <th scope="col" className="p-2 text-end">{t("remaining")}</th>
            </tr></thead>
            <tbody>
              {copy.map((row) => (
                <tr key={row.key} className="border-b">
                  <th scope="row" className="p-2 text-start">
                    {labels[row.key]}
                    {row.readings.map((reading, index) => (
                      <CashMemoReading key={index} {...reading} label={t("cashMemoReading")} unitLabel={t("cashMemoUnits")}
                        missing={t("cashMemoReadingMissing")} locale={locale} />
                    ))}
                  </th>
                  {row.dueCents == null ? <td colSpan={3} className="min-w-28 border-b border-dashed p-2" /> : (
                    <>
                      <td className="p-2 text-end tabular-nums">{money(row.dueCents)}</td>
                      <td className="p-2 text-end tabular-nums">{money(row.dueCents - row.remainingCents)}</td>
                      <td className="p-2 text-end tabular-nums">{money(row.remainingCents)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="flex justify-between gap-2 font-semibold"><span>{t("rentBillExpected")}</span><span>{money(expected)}</span></p>
          <CashMemoSignatures tenant={t("cashMemoTenantSignature")} company={t("cashMemoCompanySignature")} />
        </div>
      </div>
    </>
  );
}
