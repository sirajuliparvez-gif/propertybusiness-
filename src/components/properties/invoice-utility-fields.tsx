"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { UtilityType } from "@/generated/prisma/client";
import { FormField } from "@/components/properties/form-field";
import { PreviousMeterReadingField } from "@/components/properties/previous-meter-reading-field";
import { MeterLabelField } from "@/components/properties/meter-label-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTenantUtilityBills, getPreviousTenantMeterReading, updateUtilityBill } from "@/lib/actions/utility-bills";
import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { useBillDraft, useBillSession } from "@/components/properties/bill-form-session";
import { formatTaka } from "@/lib/format";

export function InvoiceUtilityFields({
  leaseId, month, dueDate, type, label, fixedAmount, previous = null, bill, dateLabel, editAction, extraMeter = false,
}: {
  leaseId: string;
  month: string;
  dueDate: string;
  fixedAmount: string | null;
  type: UtilityType;
  label: string;
  previous?: number | null;
  // A new bill for an additional, named electricity meter (the unit's first meter stays unnamed).
  extraMeter?: boolean;
  dateLabel?: string;
  editAction?: ReactNode;
  bill?: {
    id: string;
    propertyId: string;
    unitId: string;
    amount: number;
    paidAmount: number;
    meterReading: number | null;
    meterLabel?: string | null;
    previousMeterReadingOverride: number | null;
  };
}) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const id = useId();
  const session = useBillSession();
  const scope = `utility:${month}:${type}:${bill?.id ?? (extraMeter ? "new-meter" : "new")}:`;
  const [previousInput, setPreviousInput] = useBillDraft<string | null>(scope + "previous", null);
  const [current, setCurrent] = useBillDraft(scope + "current", bill?.meterReading?.toString() ?? "");
  const [manualAmount, setManualAmount] = useBillDraft(scope + "amount", bill?.amount.toString() ?? "");
  const [rate, setRate] = useBillDraft(scope + "rate", "");
  const [meterLabel, setMeterLabel] = useBillDraft(scope + "meter", "");
  const [lookup, setLookup] = useState<{ key: string; reading: number | null } | null>(null);
  const lookupKey = `${leaseId}|${dueDate}|${meterLabel.trim()}`;
  useEffect(() => {
    if (!extraMeter || !meterLabel.trim()) return;
    let active = true;
    getPreviousTenantMeterReading(leaseId, dueDate, meterLabel).then(
      (found) => { if (active) setLookup({ key: lookupKey, reading: found?.reading ?? null }); },
      () => { if (active) setLookup({ key: lookupKey, reading: null }); },
    );
    return () => { active = false; };
  }, [extraMeter, leaseId, dueDate, meterLabel, lookupKey]);
  const automaticPrevious = extraMeter ? (lookup?.key === lookupKey ? lookup.reading : null) : previous;
  const [savedNew, setSavedNew] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const isElectricity = type === "ELECTRICITY";
  const usingRate = isElectricity && fixedAmount == null && rate !== "";
  const previousValue = previousInput ?? automaticPrevious?.toString() ?? "";
  const units = previousValue !== "" && current !== "" ? Number(current) - Number(previousValue) : null;
  const amount = fixedAmount != null ? String(bill?.amount ?? fixedAmount)
    : usingRate ? electricityAmountAtRate(units, rate) : manualAmount;
  const belowPaid = bill != null && !!amount && Number(amount) < bill.paidAmount;
  const changed = bill == null || Number(amount) !== bill.amount ||
    (isElectricity && (current !== (bill.meterReading?.toString() ?? "") || previousInput !== null));
  const canSave = !savedNew && changed && (!extraMeter || !!meterLabel.trim()) && !!amount && Number.isFinite(Number(amount)) && Number(amount) >= (bill ? 0 : 0.01) &&
    (units == null || units >= 0) && !belowPaid;

  return (
    <form className="grid gap-1.5" action={(data) => {
      if (!canSave || pending || session?.blocked) return;
      setFeedback("");
      startTransition(async () => {
        try {
          if (bill) {
            const result = await updateUtilityBill(data, { leaseId, month, quickEdit: true });
            if (!result.ok) {
              setFeedback(result.error === "amountBelowPaid"
                ? t("billErrAmountBelowPaid", { amount: formatTaka(bill.paidAmount, 2) })
                : result.error === "billChanged" ? t("invoiceBillChanged") : t("utilityBillInvalidAmount"));
              return;
            }
          } else {
            const result = await addTenantUtilityBills(leaseId, month, [data]);
            if (!result.ok) {
              if (result.error === "utilityBillDuplicateMonth") {
                toast.error(t(result.error));
                router.refresh();
              } else {
                setFeedback(t(result.error));
              }
              return;
            }
          }
          session?.clear(scope);
          if (!bill) setSavedNew(true);
          toast.success(t("invoiceInlineBillSaved", { bill: label }));
          router.refresh();
        } catch {
          setFeedback(t("utilityBillAddFailed"));
        }
      });
    }}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="dueDate" value={dueDate} />
      {bill ? (
        <>
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="propertyId" value={bill.propertyId} />
          <input type="hidden" name="unitId" value={bill.unitId} />
        </>
      ) : null}
      {bill?.meterLabel ? <p className="text-xs font-medium">{bill.meterLabel}</p> : null}
      {extraMeter ? <MeterLabelField id={`${id}-meter`} value={meterLabel} onChange={setMeterLabel} /> : null}
      {isElectricity ? <fieldset disabled={pending} className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
        <PreviousMeterReadingField id={`${id}-previous`} automatic={automaticPrevious} manual={previousInput}
          onChange={setPreviousInput} recordAutomatic={usingRate || bill?.previousMeterReadingOverride != null} />
        <FormField label={t("invoiceElectricityCurrent")} htmlFor={`${id}-current`}>
          <Input id={`${id}-current`} name="meterReading" type="number" step="any" min={0}
            value={current} onChange={(event) => setCurrent(event.target.value)} />
        </FormField>
        <FormField label={t("invoiceElectricityRate")} htmlFor={`${id}-rate`}>
          <Input id={`${id}-rate`} name="electricityUnitRate" type="number" step="any" min={0}
            value={rate} onChange={(event) => setRate(event.target.value)} disabled={fixedAmount != null} />
        </FormField>
      </fieldset> : null}
      <div className="flex items-center gap-1.5">
        {dateLabel ? <span className="max-w-[34%] shrink-0 text-xs leading-tight text-muted-foreground">{dateLabel}</span> : null}
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-amount`} className="sr-only">{t("invoiceInlineBillAmount", { bill: label })}</label>
          <Input id={`${id}-amount`} name="amount" type="number" step="0.01" min={bill ? 0 : 0.01}
            placeholder={t("invoiceUtilityBillAmount")} value={amount} disabled={pending}
            readOnly={usingRate || fixedAmount != null} required onChange={(event) => setManualAmount(event.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={!canSave || pending || session?.blocked}
          aria-label={t("invoiceInlineBillSave", { bill: label })}>{t("invoiceInlineSaveShort")}</Button>
        {editAction}
      </div>
      <div className="text-xs empty:hidden" aria-live="polite">
        {usingRate && amount && units != null ? t("electricityRateCalculation", { units, amount: formatTaka(Number(amount), 2) }) : null}
        {fixedAmount != null ? <p className="text-muted-foreground">{t("utilityDefaultsLocked")}</p> : null}
        {belowPaid ? <p className="text-destructive">{t("billErrAmountBelowPaid", { amount: formatTaka(bill.paidAmount, 2) })}</p> : null}
        {usingRate && !amount ? <p className="text-destructive">{t("electricityRateNeedsReadings")}</p> : null}
        {units != null && units < 0 && !usingRate ? <p className="text-destructive">{t("electricityRateNeedsReadings")}</p> : null}
        {feedback ? <p className="text-destructive" role="status">{feedback}</p> : null}
      </div>
    </form>
  );
}

// "+ another meter" for a shop that has a second electricity meter; most shops never open it.
export function AddMeterBill(props: Omit<Parameters<typeof InvoiceUtilityFields>[0], "type" | "extraMeter" | "bill">) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="mt-1 justify-self-start" onClick={() => setOpen(true)}>
        {t("invoiceAddMeterBill")}
      </Button>
    );
  }
  return (
    <div className="mt-2 border-t pt-2">
      <InvoiceUtilityFields {...props} type="ELECTRICITY" extraMeter />
    </div>
  );
}
