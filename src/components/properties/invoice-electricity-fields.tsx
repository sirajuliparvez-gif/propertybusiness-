"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormField } from "@/components/properties/form-field";
import { PreviousMeterReadingField } from "@/components/properties/previous-meter-reading-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTenantUtilityBills, updateUtilityBill } from "@/lib/actions/utility-bills";
import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { formatTaka } from "@/lib/format";

export function InvoiceElectricityFields({
  leaseId, month, dueDate, fixedAmount, previous, bill,
}: {
  leaseId: string;
  month: string;
  dueDate: string;
  fixedAmount: string | null;
  previous: number | null;
  bill?: {
    id: string;
    propertyId: string;
    unitId: string;
    amount: number;
    paidAmount: number;
    paidByCompany: boolean;
    meterReading: number | null;
  };
}) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const id = useId();
  const [previousInput, setPreviousInput] = useState<string | null>(null);
  const [current, setCurrent] = useState(bill?.meterReading?.toString() ?? "");
  const [rate, setRate] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const previousValue = previousInput ?? previous?.toString() ?? "";
  const units = previousValue !== "" && current !== "" ? Number(current) - Number(previousValue) : null;
  const amount = fixedAmount == null ? electricityAmountAtRate(units, rate) : String(bill?.amount ?? fixedAmount);
  const belowPaid = bill != null && !!amount && Number(amount) < bill.paidAmount;
  const canSave = !!amount && units != null && Number.isFinite(units) && units >= 0 && !belowPaid;

  return (
    <form className="grid gap-2 rounded-md border bg-background p-2.5" action={(data) => {
      if (!canSave || pending) return;
      setFeedback("");
      startTransition(async () => {
        try {
          if (bill) {
            const result = await updateUtilityBill(data, { leaseId, month, electricityReading: true });
            if (!result.ok) {
              setFeedback(result.error === "amountBelowPaid"
                ? t("billErrAmountBelowPaid", { amount: formatTaka(bill.paidAmount, 2) })
                : t("utilityBillInvalidAmount"));
              return;
            }
          } else {
            const result = await addTenantUtilityBills(leaseId, month, [data]);
            if (!result.ok) {
              setFeedback(t(result.error));
              return;
            }
          }
          toast.success(t("invoiceElectricitySaved"));
          router.refresh();
        } catch {
          setFeedback(t("utilityBillAddFailed"));
        }
      });
    }}>
      <input type="hidden" name="type" value="ELECTRICITY" />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="amount" value={amount} />
      {bill ? (
        <>
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="propertyId" value={bill.propertyId} />
          <input type="hidden" name="unitId" value={bill.unitId} />
          <input type="hidden" name="paidByCompany" value={String(bill.paidByCompany)} />
        </>
      ) : null}
      <fieldset disabled={pending} className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
        <PreviousMeterReadingField id={`${id}-previous`} automatic={previous} manual={previousInput}
          onChange={setPreviousInput} recordAutomatic />
        <FormField label={t("invoiceElectricityCurrent")} htmlFor={`${id}-current`}>
          <Input id={`${id}-current`} name="meterReading" type="number" step="any" min={0}
            value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </FormField>
        <FormField label={t("invoiceElectricityRate")} htmlFor={`${id}-rate`}>
          <Input id={`${id}-rate`} name="electricityUnitRate" type="number" step="any" min={0}
            value={rate} onChange={(event) => setRate(event.target.value)} disabled={fixedAmount != null} />
        </FormField>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs" aria-live="polite">
          {amount && units != null ? t("electricityRateCalculation", { units, amount: formatTaka(Number(amount), 2) }) : null}
          {fixedAmount != null ? <p className="text-muted-foreground">{t("utilityDefaultsLocked")}</p> : null}
          {belowPaid ? <p className="text-destructive">{t("billErrAmountBelowPaid", { amount: formatTaka(bill.paidAmount, 2) })}</p> : null}
          {rate && !amount ? <p className="text-destructive">{t("electricityRateNeedsReadings")}</p> : null}
          {feedback ? <p role="status">{feedback}</p> : null}
        </div>
        <Button type="submit" size="sm" disabled={!canSave || pending}>{t("invoiceElectricitySave")}</Button>
      </div>
    </form>
  );
}
