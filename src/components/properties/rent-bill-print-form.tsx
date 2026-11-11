"use client";

import { flushSync } from "react-dom";
import { Fragment, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Printer, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CashMemoHeader, CashMemoReading, CashMemoSignatures, cashMemoClassName } from "@/components/properties/cash-memo";
import { useRouter } from "@/i18n/navigation";
import { confirmRentBillPrint, reserveRentBillNumber } from "@/lib/actions/rent-bill-print";
import { addOlderRentDue } from "@/lib/actions/tenant-rent";
import { addOlderUtilityDue } from "@/lib/actions/utility-bills";
import { paymentMonthRange, previousPaymentMonth } from "@/lib/payment-month";
import { Input } from "@/components/ui/input";
import { useBillDraft, useBillSession } from "@/components/properties/bill-form-session";
import { formatTaka, monthLabel } from "@/lib/format";
import { arrearsRow, isSmallLeftover, type ArrearsCandidate, type RentBillPrintKey, type RentBillPrintRow } from "@/lib/rent-bill-print";

const money = (cents: number) => formatTaka(cents / 100, 2);

export function RentBillPrintForm({
  leaseId, month, rows, printed, printedDate, revision, header, prepare, returnTo, embedded = false, utilityEditors, arrearsCandidates = [], olderDueMonths = [], olderDueAmount = 0, canAddDue = false, leaseStartMonth = "",
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
  utilityEditors?: Partial<Record<RentBillPrintKey, ReactNode>>;
  // Unpaid dues of earlier months that can be added to this bill.
  arrearsCandidates?: ArrearsCandidate[];
  // Earlier months the app does not track on its own, which can be added by hand, and the usual rent.
  olderDueMonths?: string[];
  olderDueAmount?: number;
  // Whether an earlier due may be added by hand, and the month the lease started (earliest month for a utility due).
  canAddDue?: boolean;
  leaseStartMonth?: string;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const session = useBillSession();
  const [open, setOpen] = useState(prepare);
  const [billNumber, setBillNumber] = useState(header.billNumber);
  const [printedDraft, setPrintedDraft] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addingDue, setAddingDue] = useState(false);
  const [dueKind, setDueKind] = useState<"RENT" | "ELECTRICITY" | "GAS" | "WASTE" | "SECURITY" | "OTHER">(olderDueMonths.length ? "RENT" : "ELECTRICITY");
  const [dueMonth, setDueMonth] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [selected, setSelected] = useBillDraft<RentBillPrintKey[]>(`print:${month}:selected`, () =>
    (printed ?? rows).flatMap(({ key }) => key === "ARREARS" ? [] : [key]));
  // A bill already printed keeps what it carried; a new one starts with the small leftovers added.
  const [chosenArrears, setChosenArrears] = useBillDraft<string[]>(`print:${month}:arrears`, () => printed
    ? printed.find(({ key }) => key === "ARREARS")?.lines.map(({ id }) => id) ?? []
    : arrearsCandidates.filter(isSmallLeftover).map(({ id }) => id));
  const labels = {
    ARREARS: t("rentBillPreviousDues"),
    RENT: t("invoiceRentLabel"), ELECTRICITY: t("utilityTypeElectricity"), GAS: t("utilityTypeGas"),
    WATER: t("utilityTypeWater"), WASTE: t("utilityTypeWaste"),
    SECURITY: t("utilityTypeSecurity"), OTHER: t("cashMemoOtherCharges"),
  };
  const arrears = arrearsRow(arrearsCandidates, chosenArrears);
  const draft = [...rows.filter(({ key }) => key !== "ARREARS" && selected.includes(key as RentBillPrintKey)), ...(arrears ? [arrears] : [])];
  const dueLabel = (due: ArrearsCandidate) => {
    const what = due.kind === "rent" ? t("invoiceRentLabel")
      : `${labels[(due.type ?? "OTHER") as keyof typeof labels]}${due.meterLabel ? ` · ${due.meterLabel}` : ""}`;
    return `${what} · ${monthLabel(due.month, locale)}`;
  };
  // "৳9,470 of ৳9,500 already received" — shown when only the balance of a charge is still due.
  const dueNote = (due: ArrearsCandidate) => due.paidCents > 0
    ? t("rentBillDuePartial", { paid: money(due.paidCents), total: money(due.dueCents) }) : null;
  const draftSnapshot = JSON.stringify(draft);
  const copy = open ? draft : printed ?? rows;
  const expected = copy.reduce((sum, row) => sum + row.remainingCents, 0);
  const denseCopy = copy.some(({ key }) => key === "ARREARS");

  function print() {
    if (session?.blocked) return;
    startTransition(async () => {
      try {
        if (!billNumber) {
          const assigned = await reserveRentBillNumber(leaseId, month);
          if (!assigned) {
            toast.error(t("rentBillNumberFailed"));
            return;
          }
          flushSync(() => setBillNumber(assigned));
        }
        await document.fonts.ready;
        window.print();
        if (open) setPrintedDraft(draftSnapshot);
      } catch {
        toast.error(t("rentBillNumberFailed"));
      }
    });
  }

  function confirm() {
    if (session?.blocked || printedDraft !== draftSnapshot) return;
    startTransition(async () => {
      try {
        if (await confirmRentBillPrint(leaseId, month, revision, arrears ? [...selected, "ARREARS"] : selected, printedDraft, chosenArrears)) {
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

  // Months a utility due can be added for: from the lease start up to the month before this bill.
  const utilityDueMonths = (() => {
    try { return leaseStartMonth && leaseStartMonth <= previousPaymentMonth(month) ? paymentMonthRange(leaseStartMonth, previousPaymentMonth(month), 36) : []; } catch { return []; }
  })();
  const dueMonthOptions = dueKind === "RENT" ? olderDueMonths : utilityDueMonths;
  const dueAmountNumber = Number(dueAmount || (dueKind === "RENT" ? olderDueAmount : 0));
  const dueItem = (due: ArrearsCandidate) => (
    <li key={due.id}>
      <label className="flex cursor-pointer items-center gap-3 py-1 text-sm">
        <input type="checkbox" checked={chosenArrears.includes(due.id)}
          onChange={(event) => {
            const checked = event.target.checked;
            setChosenArrears((previous) => checked ? [...previous, due.id] : previous.filter((id) => id !== due.id));
            setPrintedDraft(null);
          }} />
        <span className="flex-1">
          {dueLabel(due)}
          {dueNote(due) ? <span className="block text-xs text-muted-foreground">
            {dueNote(due)}{isSmallLeftover(due) ? ` · ${t("rentBillSmallLeftover")}` : ""}
          </span> : null}
        </span>
        <span className="tabular-nums">{money(due.remainingCents)}</span>
      </label>
    </li>
  );
  const dueGroup = (title: string, empty: string, dues: ArrearsCandidate[]) => (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {dues.length ? <ul className="divide-y">{dues.map(dueItem)}</ul> : <p className="py-1 text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
  const dueKinds = [["RENT", labels.RENT], ["ELECTRICITY", labels.ELECTRICITY], ["GAS", labels.GAS], ["WASTE", labels.WASTE], ["SECURITY", labels.SECURITY], ["OTHER", labels.OTHER]] as const;
  const previousDues = arrearsCandidates.length || canAddDue ? (
    <div className="min-w-0 bg-muted/30 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("rentBillPreviousDues")}</p>
        {canAddDue && !addingDue ? (
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => {
            setDueKind(olderDueMonths.length ? "RENT" : "ELECTRICITY");
            setAddingDue(true);
          }}>{t("rentBillAddOlderDue")}</Button>
        ) : null}
      </div>
      {dueGroup(t("rentBillRentDues"), t("rentBillNoRentDues"), arrearsCandidates.filter((due) => due.kind === "rent"))}
      {dueGroup(t("rentBillUtilityDues"), t("rentBillNoUtilityDues"), arrearsCandidates.filter((due) => due.kind === "utility"))}
      {canAddDue && addingDue ? (
        <div className="mt-3 space-y-1 border-t pt-2">
          <div className="grid gap-2 min-[560px]:grid-cols-[1fr_1fr_1fr_auto]">
            <select aria-label={t("rentBillOlderDueFor")} value={dueKind}
              onChange={(event) => { setDueKind(event.target.value as typeof dueKind); setDueMonth(""); }}
              className="h-9 w-full rounded-lg border bg-card px-2 text-sm">
              {dueKinds.filter(([kind]) => kind !== "RENT" || olderDueMonths.length > 0).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
            <select aria-label={t("rentBillOlderDueMonth")} value={dueMonth} onChange={(event) => setDueMonth(event.target.value)}
              className="h-9 w-full rounded-lg border bg-card px-2 text-sm">
              <option value="">{t("rentBillOlderDueMonth")}</option>
              {dueMonthOptions.map((option) => <option key={option} value={option}>{monthLabel(option, locale)}</option>)}
            </select>
            <Input aria-label={t("rentBillOlderDueAmount")} type="number" min={0.01} step="0.01" value={dueAmount}
              placeholder={dueKind === "RENT" && olderDueAmount ? `${t("rentBillOlderDueAmount")} (${money(olderDueAmount * 100)})` : t("rentBillOlderDueAmount")}
              onChange={(event) => setDueAmount(event.target.value)} />
            <div className="flex gap-1">
              <Button type="button" size="sm" disabled={!dueMonth || !(dueAmountNumber > 0)} onClick={addDue}>{t("rentBillOlderDueSave")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAddingDue(false)}>{t("cancel")}</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t(dueKind === "RENT" ? "rentBillOlderDueHint" : "rentBillOlderUtilityDueHint")}</p>
        </div>
      ) : null}
    </div>
  ) : null;

  const baseRows = rows.filter((row) => row.key !== "ARREARS");
  const otherRows = baseRows.filter((row) => row.key !== "RENT" && row.key !== "ELECTRICITY");
  // Gas, water and the like: added on demand; one that already has a bill is always shown.
  const [addedCharges, setAddedCharges] = useState<RentBillPrintKey[]>(() => otherRows.flatMap((row) => row.dueCents != null ? [row.key as RentBillPrintKey] : []));
  const chargeShown = (row: RentBillPrintRow) => row.dueCents != null || addedCharges.includes(row.key as RentBillPrintKey);
  // One line per charge: tick to print it, amount on the right, its own fields underneath.
  const rowLine = (row: RentBillPrintRow, boxed = false) => (
    <div key={row.key} className={boxed ? "min-w-0 rounded-md border px-3 py-2" : "min-w-0 px-3 py-3"}>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={selected.includes(row.key as RentBillPrintKey)}
          onChange={(event) => {
            const checked = event.target.checked;
            setSelected((previous) => checked ? [...previous, row.key as RentBillPrintKey] : previous.filter((key) => key !== row.key));
            setPrintedDraft(null);
          }} />
        <span className="flex-1 font-medium">{labels[row.key]}</span>
        <span className="tabular-nums font-medium">{row.dueCents == null ? "—" : money(row.remainingCents)}</span>
      </label>
      {utilityEditors?.[row.key as RentBillPrintKey]}
    </div>
  );

  function addDue() {
    if (!dueMonth || !(dueAmountNumber > 0)) return;
    startTransition(async () => {
      try {
        const result = dueKind === "RENT" ? await addOlderRentDue(leaseId, dueMonth, dueAmountNumber)
          : await addOlderUtilityDue(leaseId, dueKind, dueMonth, dueAmountNumber);
        if (!result.ok) {
          toast.error(t(result.error === "exists" ? "rentBillOlderDueExists" : "rentBillOlderDueFailed"));
          return;
        }
        toast.success(t("rentBillOlderDueAdded"));
        const newId = "id" in result ? String(result.id) : dueMonth;
        setChosenArrears((previous) => [...previous, newId]);
        setPrintedDraft(null);
        setAddingDue(false);
        setDueMonth("");
        setDueAmount("");
        router.refresh();
      } catch {
        toast.error(t("rentBillOlderDueFailed"));
      }
    });
  }

  const correction = open ? revision : revision - 1;
  const copyContents = (
    <>
      <CashMemoHeader {...header} billNumber={billNumber || "—"} date={!open && printedDate ? printedDate : header.date} />
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
                {row.details?.length ? (
                  <span className="cash-memo-arrears mt-0.5 block text-xs font-normal">
                    {row.details.map((due) => `${dueLabel(due)} ${money(due.remainingCents)}${dueNote(due) ? ` (${dueNote(due)})` : ""}`).join(" · ")}
                  </span>
                ) : null}
                {row.readings.map((reading, index) => (
                  <CashMemoReading key={index} {...reading} compact={row.readings.length > 1} label={t("cashMemoReading")} unitLabel={t("cashMemoUnits")}
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
    </>
  );

  return (
    <>
      <div className="space-y-2 print:hidden">
        {billNumber ? <p className="text-xs text-muted-foreground">
          {t("cashMemoBillNumber")} <strong className="tabular-nums text-foreground">{billNumber}</strong>
        </p> : null}
        {open ? (
          <section className={`mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-lg border bg-card p-4${embedded ? " min-h-[calc(100dvh-8.5rem)]" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="text-base font-semibold">{t(revision ? "rentBillCorrection" : "rentBillPrintOptions")}</h2>
              <p className="text-xs text-muted-foreground">{t("rentBillChooseLines")}</p>
            </div>
            <fieldset disabled={pending} className="min-w-0 divide-y rounded-md border">
              {baseRows.filter((row) => row.key === "RENT").map((row) => (
                <Fragment key={row.key}>{rowLine(row)}{previousDues}</Fragment>
              ))}
              {baseRows.filter((row) => row.key === "ELECTRICITY").map((row) => rowLine(row))}
              {otherRows.length ? (
                <div className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="me-1 text-sm font-medium">{t("rentBillAddCharge")}</span>
                    {otherRows.map((row) => (
                      <Button key={row.key} type="button" size="sm" variant={chargeShown(row) ? "secondary" : "outline"}
                        aria-pressed={chargeShown(row)} disabled={row.dueCents != null}
                        onClick={() => setAddedCharges((previous) => previous.includes(row.key as RentBillPrintKey)
                          ? previous.filter((key) => key !== row.key) : [...previous, row.key as RentBillPrintKey])}>
                        <Plus className="size-3.5" />{labels[row.key]}
                      </Button>
                    ))}
                  </div>
                  {otherRows.some(chargeShown) ? (
                    <div className="grid gap-2 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-3">
                      {otherRows.filter(chargeShown).map((row) => rowLine(row, true))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{t("rentBillOtherBlankHint")}</p>
                </div>
              ) : null}
            </fieldset>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
              <p className="me-auto flex items-baseline gap-2 text-base font-semibold">
                <span>{t("rentBillExpected")}</span><span className="text-lg tabular-nums">{money(expected)}</span>
              </p>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => {
                if (embedded && window.parent !== window) window.parent.postMessage("rent-bill-print-cancelled", window.location.origin);
                else { setOpen(false); setPrintedDraft(null); }
              }}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={print} disabled={!draft.length || pending}><Printer className="size-4" />{t("invoicePrintBill")}</Button>
              {printedDraft === draftSnapshot ? (
                <Button type="button" variant="outline" disabled={pending} onClick={confirm}>{t("rentBillConfirmPrinted")}</Button>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="flex flex-wrap gap-2">
            {printed ? <Button type="button" variant="outline" disabled={pending} onClick={print}>{t("rentBillReprint")}</Button> : null}
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              {revision ? t("rentBillCorrection") : t("rentBillPrintOptions")}
            </Button>
          </div>
        )}
      </div>
      <div data-testid="issued-rent-bill-copy" className="print-invoice-a4 hidden print:block">
        <section className={`${cashMemoClassName} rent-bill-paper-copy${denseCopy ? " rent-bill-paper-copy--dense" : ""}`}>
          <p className="rent-bill-copy-label">{t("rentBillTenantCopy")}{correction > 0 ? ` · ${t("rentBillRevisionLabel", { count: correction })}` : ""}</p>
          {copyContents}
        </section>
        <div className="rent-bill-cut-line" aria-hidden="true"><Scissors /></div>
        <section className={`${cashMemoClassName} rent-bill-paper-copy${denseCopy ? " rent-bill-paper-copy--dense" : ""}`}>
          <p className="rent-bill-copy-label">{t("rentBillOfficeCopy")}{correction > 0 ? ` · ${t("rentBillRevisionLabel", { count: correction })}` : ""}</p>
          {copyContents}
        </section>
      </div>
    </>
  );
}
