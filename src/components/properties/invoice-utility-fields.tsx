"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { UtilityType } from "@/generated/prisma/client";
import { FormField } from "@/components/properties/form-field";
import { PreviousMeterReadingField } from "@/components/properties/previous-meter-reading-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTenantUtilityBills, getPreviousTenantMeterReading, updateUtilityBill } from "@/lib/actions/utility-bills";
import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { formatTaka } from "@/lib/format";

export function InvoiceUtilityFields({
  leaseId, month, dueDate, type, label, fixedAmount, previous = null, bill, chooseDate = false, leaseStart,
}: {
  leaseId: string;
  month: string;
  dueDate: string;
  fixedAmount: string | null;
  type: UtilityType;
  label: string;
  previous?: number | null;
  chooseDate?: boolean;
  leaseStart?: string;
  bill?: {
    id: string;
    propertyId: string;
    unitId: string;
    amount: number;
    paidAmount: number;
    meterReading: number | null;
    previousMeterReadingOverride: number | null;
  };
}) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const id = useId();
  const [previousInput, setPreviousInput] = useState<string | null>(null);
  const [current, setCurrent] = useState(bill?.meterReading?.toString() ?? "");
  const [billDate, setBillDate] = useState(dueDate);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const [manualAmount, setManualAmount] = useState(bill?.amount.toString() ?? "");
  const [rate, setRate] = useState("");
  const [previousForDate, setPreviousForDate] = useState<{ date: string; reading: number | null } | null>(null);
  const [savedNew, setSavedNew] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const isElectricity = type === "ELECTRICITY";
  const usingRate = isElectricity && fixedAmount == null && rate !== "";
  useEffect(() => {
    if (!isElectricity || !chooseDate || !billDate || billDate === dueDate) return;
    let active = true;
    void getPreviousTenantMeterReading(leaseId, billDate).then((result) => {
      if (active) setPreviousForDate({ date: billDate, reading: result?.reading ?? null });
    }, () => {
      if (active) setPreviousForDate({ date: billDate, reading: null });
    });
    return () => { active = false; };
  }, [isElectricity, chooseDate, billDate, dueDate, leaseId]);
  const automaticPrevious = billDate === dueDate ? previous
    : previousForDate?.date === billDate ? previousForDate.reading : null;
  const previousValue = previousInput ?? automaticPrevious?.toString() ?? "";
  const units = previousValue !== "" && current !== "" ? Number(current) - Number(previousValue) : null;
  const amount = fixedAmount != null ? String(bill?.amount ?? fixedAmount)
    : usingRate ? electricityAmountAtRate(units, rate) : manualAmount;
  const belowPaid = bill != null && !!amount && Number(amount) < bill.paidAmount;
  const changed = bill == null || Number(amount) !== bill.amount ||
    (isElectricity && (current !== (bill.meterReading?.toString() ?? "") || previousInput !== null));
  const canSave = !savedNew && changed && !!amount && Number.isFinite(Number(amount)) && Number(amount) >= (bill ? 0 : 0.01) &&
    (units == null || units >= 0) && !belowPaid;

  return (
    <form className="grid gap-2 pb-1" action={(data) => {
      if (!canSave || pending) return;
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
              setFeedback(t(result.error));
              return;
            }
          }
          if (!bill) setSavedNew(true);
          toast.success(t("invoiceInlineBillSaved", { bill: label }));
          router.refresh();
        } catch {
          setFeedback(t("utilityBillAddFailed"));
        }
      });
    }}>
      <input type="hidden" name="type" value={type} />
      {chooseDate ? (
        <FormField label={t("billDueDate")} htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} name="dueDate" type="date" value={billDate} disabled={pending}
            min={leaseStart && leaseStart > monthStart ? leaseStart : monthStart} max={`${month}-${lastDay}`}
            onChange={(event) => setBillDate(event.target.value)} required />
        </FormField>
      ) : <input type="hidden" name="dueDate" value={dueDate} />}
      {bill ? (
        <>
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="propertyId" value={bill.propertyId} />
          <input type="hidden" name="unitId" value={bill.unitId} />
        </>
      ) : null}
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
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-amount`} className="sr-only">{t("invoiceInlineBillAmount", { bill: label })}</label>
          <Input id={`${id}-amount`} name="amount" type="number" step="0.01" min={bill ? 0 : 0.01}
            placeholder={t("invoiceUtilityBillAmount")} value={amount} disabled={pending}
            readOnly={usingRate || fixedAmount != null} required onChange={(event) => setManualAmount(event.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={!canSave || pending}
          aria-label={t("invoiceInlineBillSave", { bill: label })}>{t("save")}</Button>
      </div>
      <div className="text-xs" aria-live="polite">
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
