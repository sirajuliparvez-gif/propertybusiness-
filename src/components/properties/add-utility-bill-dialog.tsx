"use client";

import { dhakaTodayISO } from "@/lib/dhaka-time";
import { useEffect, useImperativeHandle, useRef, useState, useTransition, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/properties/form-field";
import { PreviousMeterReadingField } from "@/components/properties/previous-meter-reading-field";
import { addTenantUtilityBills, addUtilityBill, getPreviousPropertyMeterReading, getPreviousTenantMeterReading, getTenantUtilityBillDefaults } from "@/lib/actions/utility-bills";
import type { UtilityBillDefault } from "@/lib/utility-bill-defaults";
import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { unitPickerLabel } from "@/lib/unit-label";

const NONE_VALUE = "NONE";
type UtilityType = "GAS" | "ELECTRICITY" | "WATER" | "OTHER";

type PropertyBillFields = {
  propertyId: string;
  units?: { id: string; label: string; unitTypeLabel: string; tenantName?: string | null;
    leaseStart?: string | null; utilityDefaults?: UtilityBillDefault[] }[];
  fixedUnitId?: string;
  returnTo?: string;
  utilityDefaults?: UtilityBillDefault[];
  utilityDefaultsStart?: string;
};

type BillFormProps =
  | (PropertyBillFields & { tenantBilling?: never; onDraftChange?: never; onSaved?: never; collectionRef?: never })
  | { tenantBilling: { leaseId: string; month: string }; onDraftChange?: (hasDraft: boolean) => void; onSaved?: () => void;
    collectionRef?: Ref<{ read: (data: FormData) => FormData[] | null }> };

function collectionBillData(formData: FormData) {
  const bill = new FormData();
  for (const field of ["type", "paidByCompany", "meterReading", "previousMeterReadingOverride", "electricityUnitRate", "dueDate", "received"]) {
    const value = formData.get(field);
    if (typeof value === "string") bill.set(field, value);
  }
  bill.set("amount", String(formData.get("utilityAmount") ?? ""));
  return bill;
}

export function AddUtilityBillDialog(props: PropertyBillFields) {
  const t = useTranslations("Properties");
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" />
        {t("addUtilityBill")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addUtilityBill")}</DialogTitle>
        </DialogHeader>
        <AddUtilityBillForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceAddUtilityBillDialog({ leaseId, month, compact = false }: { leaseId: string; month: string; compact?: boolean }) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={compact ? "sm" : "default"} />}>
        <Plus className="size-4" />
        {t("invoiceAddBill")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invoiceAddBill")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{monthLabel(month, locale)}</p>
        <AddUtilityBillForm tenantBilling={{ leaseId, month }} onSaved={() => {
          setOpen(false);
          router.refresh();
        }} />
      </DialogContent>
    </Dialog>
  );
}

export function AddUtilityBillForm(props: BillFormProps) {
  const { tenantBilling, onDraftChange, onSaved, collectionRef } = props;
  const embedded = collectionRef != null;
  const Fields = embedded ? "div" : "form";
  const property = "propertyId" in props ? props : undefined;
  const { propertyId, units = [], fixedUnitId, returnTo, utilityDefaults, utilityDefaultsStart } = property ?? {};
  const t = useTranslations("Properties");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<UtilityType>("ELECTRICITY");
  const [unitId, setUnitId] = useState(NONE_VALUE);
  const [payerOverride, setPayerOverride] = useState<boolean | null>(null);
  const [meterReading, setMeterReading] = useState("");
  const [manualPreviousReading, setManualPreviousReading] = useState<string | null>(null);
  const [unitRate, setUnitRate] = useState("");
  const [draftAmount, setDraftAmount] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [received, setReceived] = useState("");
  const [queuedBills, setQueuedBills] = useState<{ id: number; data: FormData }[]>([]);
  const nextBillId = useRef(0);
  const editingBill = !!draftAmount || !!meterReading || !!manualPreviousReading || !!unitRate || !!received;
  const hasDraft = isPending || editingBill || queuedBills.length > 0;
  useEffect(() => {
    onDraftChange?.(hasDraft);
  }, [hasDraft, onDraftChange]);
  const todayValue = dhakaTodayISO();
  const month = tenantBilling?.month;
  const minDate = month ? `${month}-01` : undefined;
  const [year, monthNumber] = month?.split("-").map(Number) ?? [];
  const maxDate = month ? `${month}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()}` : undefined;
  const defaultDate = month && !todayValue.startsWith(month) ? `${month}-10` : todayValue;

  const readingDate = draftDate ?? defaultDate;
  const leaseId = tenantBilling?.leaseId;
  const [defaultsLookup, setDefaultsLookup] = useState<{ leaseId: string; defaults: UtilityBillDefault[] } | null>(null);
  useEffect(() => {
    if (!leaseId) return;
    let active = true;
    getTenantUtilityBillDefaults(leaseId).then(
      (defaults) => { if (active) setDefaultsLookup({ leaseId, defaults }); },
      () => {
        if (!active) return;
        setDefaultsLookup({ leaseId, defaults: [] });
        toast.error(t("utilityDefaultsLoadFailed"));
      },
    );
    return () => { active = false; };
  }, [leaseId, t]);
  const selectedUnit = units.find((unit) => unit.id === unitId);
  const defaults = utilityDefaults ?? selectedUnit?.utilityDefaults ??
    (defaultsLookup?.leaseId === leaseId ? defaultsLookup?.defaults : undefined);
  const loadingDefaults = leaseId != null && defaults == null;
  const defaultsStart = utilityDefaultsStart ?? selectedUnit?.leaseStart;
  const typeDefault = !defaultsStart || readingDate >= defaultsStart
    ? defaults?.find((item) => item.type === type)
    : undefined;
  const paidByCompany = typeDefault?.paidByCompany ?? payerOverride ?? false;
  const payerLocked = typeDefault?.paidByCompany != null;
  const amountLocked = typeDefault?.amount != null;
  const effectiveUnitId = fixedUnitId ?? (unitId === NONE_VALUE ? "" : unitId);
  const readingKey = JSON.stringify([leaseId, propertyId, effectiveUnitId, readingDate]);
  const [readingRefresh, setReadingRefresh] = useState(0);
  const [readingLookup, setReadingLookup] = useState<{
    key: string;
    previous: Awaited<ReturnType<typeof getPreviousTenantMeterReading>>;
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    if (type !== "ELECTRICITY" || !readingDate || (!leaseId && !propertyId)) return;
    let current = true;
    const lookup = leaseId ? getPreviousTenantMeterReading(leaseId, readingDate)
      : getPreviousPropertyMeterReading(propertyId!, effectiveUnitId, readingDate);
    lookup.then(
      (previous) => {
        if (current) setReadingLookup({ key: readingKey, previous });
      },
      () => {
        if (current) setReadingLookup({ key: readingKey, previous: null, failed: true });
      },
    );
    return () => { current = false; };
  }, [leaseId, propertyId, effectiveUnitId, readingDate, readingKey, readingRefresh, type]);

  const lookupForDate = readingLookup?.key === readingKey ? readingLookup : null;
  let previousReading = lookupForDate?.previous?.reading ?? null;
  if (tenantBilling) {
    let previous = lookupForDate?.previous ?? null;
    for (const { data } of queuedBills) {
      const reading = data.get("meterReading");
      const date = data.get("dueDate");
      if (data.get("type") === "ELECTRICITY" && typeof reading === "string" && reading !== "" &&
        typeof date === "string" && date <= readingDate && (!previous || date >= previous.date)) {
        previous = { date, reading: Number(reading) };
      }
    }
    previousReading = previous?.reading ?? null;
  }
  const effectivePreviousReading = manualPreviousReading == null ? previousReading
    : manualPreviousReading === "" ? null : Number(manualPreviousReading);
  const consumption =
    meterReading && effectivePreviousReading != null ? Number(meterReading) - effectivePreviousReading : null;

  const usingUnitRate = type === "ELECTRICITY" && !amountLocked && unitRate !== "";
  const calculatedAmount = usingUnitRate ? electricityAmountAtRate(consumption, unitRate) : "";
  const billAmount = typeDefault?.amount ?? (usingUnitRate ? calculatedAmount : draftAmount ?? "");
  const includeDraft = !!billAmount && !(queuedBills.length && amountLocked && draftAmount === "" && !draftDate && !meterReading);
  const invalidCalculation = usingUnitRate && (!calculatedAmount || Number(calculatedAmount) <= 0);
  useImperativeHandle(collectionRef, () => ({
    read(formData) {
      if (loadingDefaults || invalidCalculation || (editingBill && !includeDraft)) return null;
      const bills = queuedBills.map(({ data }) => data);
      if (includeDraft) bills.push(collectionBillData(formData));
      return bills;
    },
  }));

  const typeLabels: Record<UtilityType, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  // Water is company policy: always the company's own cost, never collected
  // from the tenant — locked, not just defaulted, and enforced again
  // server-side in addUtilityBill. See add-utility-bill-dialog-global.tsx.
  function handleTypeChange(next: UtilityType) {
    setType(next);
    setPayerOverride(null);
    if (defaults?.length) setDraftAmount(null);
    setMeterReading("");
    setManualPreviousReading(null);
    setUnitRate("");
    setReceived("");
  }
  const isWater = type === "WATER";

  function resetDraft() {
    handleTypeChange("ELECTRICITY");
    setDraftAmount("");
    setDraftDate(null);
  }

  return (
    <>
    {tenantBilling && queuedBills.length ? (
      <ul aria-label={t("utilityBillsToSave")} className="divide-y rounded-lg border">
        {queuedBills.map(({ id, data }) => {
          const label = typeLabels[data.get("type") as UtilityType];
          const amount = formatTaka(Number(data.get("amount")), 2);
          const dueDate = formatDate(new Date(String(data.get("dueDate"))), locale);
          return (
            <li key={id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <div>
                <p className="font-medium">{label} · {amount}</p>
                <p className="text-xs text-muted-foreground">
                  {dueDate}
                  {data.get("meterReading") ? ` · ${t("meterReading")} ${data.get("meterReading")}` : null}
                  {data.get("paidByCompany") === "true" ? ` · ${t("paidByCompanyLabel")}` : null}
                  {Number(data.get("received")) > 0 ? ` · ${t("collectionNewBillReceived")} ${formatTaka(Number(data.get("received")), 2)}` : null}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" disabled={isPending}
                aria-label={t("removeUtilityBillFromList", { type: label, amount })}
                onClick={() => setQueuedBills((bills) => bills.filter((bill) => bill.id !== id))}>
                <X className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    ) : null}
    <Fields
      data-collection-bill-fields={embedded || undefined}
      action={embedded ? undefined : (formData: FormData) => startTransition(async () => {
        if (loadingDefaults) return;
        if (!tenantBilling) {
          await addUtilityBill(formData);
          return;
        }
        try {
          const bills = queuedBills.map((bill) => bill.data);
          if (includeDraft) bills.push(formData);
          const result = await addTenantUtilityBills(tenantBilling.leaseId, tenantBilling.month, bills);
          if (!result.ok) {
            toast.error(t(result.error));
            return;
          }
          toast.success(t("utilityBillsAddedToMonth", { count: bills.length, month: monthLabel(tenantBilling.month, locale) }));
          setQueuedBills([]);
          setReadingLookup(null);
          setReadingRefresh((version) => version + 1);
          resetDraft();
          onSaved?.();
        } catch {
          toast.error(t("utilityBillAddFailed"));
        }
      })}
      className="grid gap-3 sm:grid-cols-2"
    >
      {!embedded ? <input type="hidden" name="propertyId" value={propertyId} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="paidByCompany" value={isWater || paidByCompany ? "true" : "false"} />
      <input
        type="hidden"
        name="unitId"
        value={fixedUnitId ?? (unitId === NONE_VALUE ? "" : unitId)}
      />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <FormField label={t("utilityType")} htmlFor="utilityBillType" required className="sm:col-span-2">
        <Select
          value={type}
          onValueChange={(v) => handleTypeChange((v ?? "OTHER") as UtilityType)}
          items={(["GAS", "ELECTRICITY", "WATER", "OTHER"] as UtilityType[]).map((k) => ({
            value: k,
            label: typeLabels[k],
          }))}
        >
          <SelectTrigger id="utilityBillType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["GAS", "ELECTRICITY", "WATER", "OTHER"] as UtilityType[]).map((k) => (
              <SelectItem key={k} value={k}>
                {typeLabels[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {type === "ELECTRICITY" ? (
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <PreviousMeterReadingField id="utilityBillPreviousMeterReading" automatic={previousReading}
            manual={manualPreviousReading} onChange={setManualPreviousReading} recordAutomatic={usingUnitRate} />
          <FormField label={t("currentMeterReading")} htmlFor="utilityBillMeterReading">
            <Input
              id="utilityBillMeterReading"
              name="meterReading"
              type="number"
              step="any"
              min={manualPreviousReading ? Number(manualPreviousReading) : 0}
              value={meterReading}
              onChange={(event) => setMeterReading(event.target.value)}
            />
          </FormField>
          <FormField label={t("electricityUnitRate")} htmlFor="utilityBillUnitRate" className="sm:col-span-2">
            <Input id="utilityBillUnitRate" name="electricityUnitRate" type="number" step="any" min={0}
              value={amountLocked ? "" : unitRate} disabled={amountLocked}
              onChange={(event) => setUnitRate(event.target.value)} />
          </FormField>
          <p aria-live="polite" className="text-xs text-muted-foreground sm:col-span-2">
            {calculatedAmount
              ? t("electricityRateCalculation", { units: consumption ?? 0, amount: formatTaka(Number(calculatedAmount), 2) })
              : consumption != null
                ? t("consumptionPreview", { units: consumption })
              : effectivePreviousReading == null
                ? t(lookupForDate?.failed ? "meterReadingLookupFailed"
                  : !lookupForDate && readingDate ? "meterReadingLoading" : "noPreviousMeterReading")
                : null}
          </p>
          {invalidCalculation ? <p className="text-xs text-destructive sm:col-span-2">{t("electricityRateNeedsReadings")}</p> : null}
        </div>
      ) : null}

      <FormField label={t(tenantBilling ? "invoiceUtilityBillAmount" : "amount")} htmlFor="utilityBillAmount" required>
        <Input id="utilityBillAmount" name={embedded ? "utilityAmount" : "amount"} type="number" step="any" min={tenantBilling ? 0.01 : 0}
          required={!embedded && (!queuedBills.length || !!meterReading)}
          value={billAmount}
          readOnly={usingUnitRate || amountLocked}
          onChange={(event) => setDraftAmount(event.target.value)}
        />
      </FormField>
      {embedded && !isWater && !paidByCompany ? (
        <FormField label={t("collectionNewBillReceived")} htmlFor="collectionNewBillReceived">
          <Input id="collectionNewBillReceived" name="received" type="number" min={0} max={billAmount || undefined}
            step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} />
        </FormField>
      ) : null}
      <FormField label={t("billDueDate")} htmlFor="utilityBillDueDate" required>
        <Input id="utilityBillDueDate" name="dueDate" type="date" min={minDate} max={maxDate} required
          value={readingDate}
          onChange={(event) => setDraftDate(event.target.value)}
        />
      </FormField>

      <label
        htmlFor="utilityBillPaidByCompany"
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
      >
        <Checkbox
          id="utilityBillPaidByCompany"
          checked={isWater || paidByCompany}
          disabled={isWater || payerLocked}
          onCheckedChange={(checked) => { setPayerOverride(checked === true); if (checked) setReceived(""); }}
        />
        {isWater ? t("paidByCompanyWaterLocked") : t("paidByCompanyLabel")}
      </label>
      {amountLocked || payerLocked ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">{t("utilityDefaultsLocked")}</p>
      ) : null}

      {fixedUnitId || tenantBilling ? null : (
        <FormField label={t("unitOptional")} htmlFor="utilityBillUnit" className="sm:col-span-2">
          <Select
            value={unitId}
            onValueChange={(v) => { setUnitId(v ?? NONE_VALUE); handleTypeChange(type); setDraftAmount(null); }}
            items={[
              { value: NONE_VALUE, label: t("noSpecificUnit") },
              ...units.map((u) => ({ value: u.id, label: unitPickerLabel(u) })),
            ]}
          >
            <SelectTrigger id="utilityBillUnit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>{t("noSpecificUnit")}</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} className="[&_span]:whitespace-normal">
                  {unitPickerLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {tenantBilling ? (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3 sm:col-span-2">
          <Button type="button" variant="outline" disabled={isPending || loadingDefaults || !billAmount || invalidCalculation}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (!form) return;
              const group = event.currentTarget.closest("[data-collection-bill-fields]");
              const valid = group ? [...group.querySelectorAll("input")]
                .every((input) => input.reportValidity()) : form.reportValidity();
              if (!valid) return;
              const formData = new FormData(form);
              const item = { id: nextBillId.current++, data: embedded ? collectionBillData(formData) : formData };
              setQueuedBills((bills) => [...bills, item]);
              resetDraft();
            }}>
            <Plus className="size-3.5" />
            {t("addAnotherUtilityBill")}
          </Button>
          {!embedded ? <Button type="submit" variant="secondary" disabled={isPending || loadingDefaults || invalidCalculation || (!includeDraft && !queuedBills.length)}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("saveUtilityBills", { count: queuedBills.length + Number(includeDraft) })}
          </Button> : null}
        </div>
      ) : (
        <DialogFooter className="sm:col-span-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button type="submit" disabled={isPending || invalidCalculation}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      )}
    </Fields>
    </>
  );
}
