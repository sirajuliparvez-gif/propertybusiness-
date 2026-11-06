"use client";

import { dhakaTodayISO } from "@/lib/dhaka-time";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { addUtilityBill, getPreviousPropertyMeterReading } from "@/lib/actions/utility-bills";
import type { AllUtilityBillsData } from "@/lib/utility-bills-data";
import { electricityAmountAtRate } from "@/lib/electricity-consumption";
import { formatTaka } from "@/lib/format";
import { unitPickerLabel } from "@/lib/unit-label";

const NONE_VALUE = "NONE";
type UtilityType = "GAS" | "ELECTRICITY" | "WATER" | "OTHER";

export function AddUtilityBillDialogGlobal({
  properties,
  dismissTo,
}: {
  properties: AllUtilityBillsData["properties"];
  dismissTo?: string;
}) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<UtilityType>("ELECTRICITY");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [unitId, setUnitId] = useState(NONE_VALUE);
  const [payerOverride, setPayerOverride] = useState<boolean | null>(null);
  const [meterReading, setMeterReading] = useState("");
  const [manualPreviousReading, setManualPreviousReading] = useState<string | null>(null);
  const [open, setOpen] = useState(dismissTo != null);
  const [unitRate, setUnitRate] = useState("");
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(dhakaTodayISO);
  const [readingLookup, setReadingLookup] = useState<{ key: string; reading: number | null; failed?: boolean } | null>(null);

  const effectiveUnitId = unitId === NONE_VALUE ? "" : unitId;
  const readingKey = JSON.stringify([propertyId, effectiveUnitId, dueDate]);
  useEffect(() => {
    if (!open || !propertyId || type !== "ELECTRICITY" || !dueDate) return;
    let active = true;
    getPreviousPropertyMeterReading(propertyId, effectiveUnitId, dueDate).then(
      (result) => { if (active) setReadingLookup({ key: readingKey, reading: result?.reading ?? null }); },
      () => { if (active) setReadingLookup({ key: readingKey, reading: null, failed: true }); },
    );
    return () => { active = false; };
  }, [open, propertyId, effectiveUnitId, type, dueDate, readingKey]);
  const lookup = readingLookup?.key === readingKey ? readingLookup : null;
  const previousReading = lookup?.reading ?? null;
  const effectivePreviousReading = manualPreviousReading == null ? previousReading
    : manualPreviousReading === "" ? null : Number(manualPreviousReading);
  const consumption =
    meterReading && effectivePreviousReading != null ? Number(meterReading) - effectivePreviousReading : null;


  const typeLabels: Record<UtilityType, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  function handleTypeChange(next: UtilityType) {
    setType(next);
    resetBillFields();
  }
  const isWater = type === "WATER";

  const unitsForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.units ?? [],
    [properties, propertyId]
  );
  const unit = unitsForProperty.find((item) => item.id === unitId);
  const typeDefault = unit?.leaseStart && dueDate >= unit.leaseStart
    ? unit.utilityDefaults.find((item) => item.type === type)
    : undefined;
  const paidByCompany = typeDefault?.paidByCompany ?? payerOverride ?? false;
  const payerLocked = typeDefault?.paidByCompany != null;
  const amountLocked = typeDefault?.amount != null;
  const amount = typeDefault?.amount ?? amountOverride ?? "";
  const usingUnitRate = type === "ELECTRICITY" && !amountLocked && unitRate !== "";
  const calculatedAmount = usingUnitRate ? electricityAmountAtRate(consumption, unitRate) : "";

  function resetBillFields() {
    setPayerOverride(null);
    setAmountOverride(null);
    setMeterReading("");
    setManualPreviousReading(null);
    setUnitRate("");
  }

  function handlePropertyChange(v: string | null) {
    setPropertyId(v ?? "");
    setUnitId(NONE_VALUE);
    resetBillFields();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && dismissTo) router.replace(dismissTo, { scroll: false });
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        {t("addUtilityBill")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addUtilityBill")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => addUtilityBill(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="paidByCompany" value={isWater || paidByCompany ? "true" : "false"} />
          <input type="hidden" name="unitId" value={unitId === NONE_VALUE ? "" : unitId} />
          <input type="hidden" name="returnTo" value="/utility-bills" />

          <FormField label={t("propertyLabel")} htmlFor="utilityBillProperty" required className="sm:col-span-2">
            <Select
              value={propertyId}
              onValueChange={handlePropertyChange}
              items={properties.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger id="utilityBillProperty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

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

          <FormField label={t("unitOptional")} htmlFor="utilityBillUnit" className="sm:col-span-2">
            <Select
              value={unitId}
              onValueChange={(v) => { setUnitId(v ?? NONE_VALUE); resetBillFields(); }}
              items={[
                { value: NONE_VALUE, label: t("noSpecificUnit") },
                ...unitsForProperty.map((u) => ({ value: u.id, label: unitPickerLabel(u) })),
              ]}
            >
              <SelectTrigger id="utilityBillUnit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t("noSpecificUnit")}</SelectItem>
                {unitsForProperty.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="[&_span]:whitespace-normal">
                    {unitPickerLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {type === "ELECTRICITY" ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <PreviousMeterReadingField id="utilityBillGlobalPreviousReading" automatic={previousReading}
                manual={manualPreviousReading} onChange={setManualPreviousReading} recordAutomatic={usingUnitRate} />
              <FormField label={t("currentMeterReading")} htmlFor="utilityBillMeterReadingGlobal">
                <Input
                  id="utilityBillMeterReadingGlobal"
                  name="meterReading"
                  type="number"
                  step="any"
                  min={manualPreviousReading ? Number(manualPreviousReading) : 0}
                  value={meterReading}
                  onChange={(e) => setMeterReading(e.target.value)}
                />
              </FormField>
              <FormField label={t("electricityUnitRate")} htmlFor="utilityBillGlobalUnitRate" className="sm:col-span-2">
                <Input id="utilityBillGlobalUnitRate" name="electricityUnitRate" type="number" min={0} step="any"
                  value={amountLocked ? "" : unitRate} disabled={amountLocked}
                  onChange={(event) => setUnitRate(event.target.value)} />
              </FormField>
              <p aria-live="polite" className="text-xs text-muted-foreground sm:col-span-2">
                {calculatedAmount
                  ? t("electricityRateCalculation", { units: consumption ?? 0, amount: formatTaka(calculatedAmount, 2) })
                  : consumption != null ? t("consumptionPreview", { units: consumption })
                  : effectivePreviousReading == null ? t(lookup?.failed ? "meterReadingLookupFailed"
                    : !lookup && dueDate ? "meterReadingLoading" : "noPreviousMeterReading")
                  : null}
              </p>
              {usingUnitRate && !calculatedAmount ? (
                <p className="text-xs text-destructive sm:col-span-2">{t("electricityRateNeedsReadings")}</p>
              ) : null}
            </div>
          ) : null}

          <FormField label={t("invoiceUtilityBillAmount")} htmlFor="utilityBillAmount" required>
            <Input id="utilityBillAmount" name="amount" type="number" step="any" min={0}
              value={usingUnitRate ? calculatedAmount : amount} readOnly={usingUnitRate || amountLocked} required
              onChange={(event) => setAmountOverride(event.target.value)} />
          </FormField>
          <FormField label={t("billDueDate")} htmlFor="utilityBillDueDate" required>
            <Input id="utilityBillDueDate" name="dueDate" type="date" value={dueDate} required
              onChange={(event) => setDueDate(event.target.value)} />
          </FormField>

          <label
            htmlFor="utilityBillPaidByCompanyGlobal"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          >
            <Checkbox
              id="utilityBillPaidByCompanyGlobal"
              checked={isWater || paidByCompany}
              disabled={isWater || payerLocked}
              onCheckedChange={(checked) => setPayerOverride(checked === true)}
            />
            {isWater ? t("paidByCompanyWaterLocked") : t("paidByCompanyLabel")}
          </label>
          {amountLocked || payerLocked ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("utilityDefaultsLocked")}</p>
          ) : null}

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !propertyId || (usingUnitRate && !calculatedAmount)}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
