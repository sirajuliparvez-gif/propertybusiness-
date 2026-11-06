"use client";

import { dhakaTodayISO } from "@/lib/dhaka-time";
import { useMemo, useState, useTransition } from "react";
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
import { addUtilityBill } from "@/lib/actions/utility-bills";
import type { AllUtilityBillsData } from "@/lib/utility-bills-data";
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
  const [paidByCompany, setPaidByCompany] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const [manualPreviousReading, setManualPreviousReading] = useState<string | null>(null);
  const todayValue = dhakaTodayISO();

  const effectiveUnitId = unitId === NONE_VALUE ? "" : unitId;
  const previousReading =
    properties.find((p) => p.id === propertyId)?.previousElectricityReadingByUnit[
      effectiveUnitId || "__property__"
    ] ?? null;
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
    setPaidByCompany(next === "WATER");
    setMeterReading("");
    setManualPreviousReading(null);
  }
  const isWater = type === "WATER";

  const unitsForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.units ?? [],
    [properties, propertyId]
  );

  function handlePropertyChange(v: string | null) {
    setPropertyId(v ?? "");
    setUnitId(NONE_VALUE);
    setMeterReading("");
    setManualPreviousReading(null);
  }

  return (
    <Dialog
      defaultOpen={dismissTo != null}
      onOpenChange={(open) => {
        if (!open && dismissTo) router.replace(dismissTo, { scroll: false });
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        {t("addUtilityBill")}
      </DialogTrigger>
      <DialogContent>
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

          <FormField label={t("amount")} htmlFor="utilityBillAmount" required>
            <Input id="utilityBillAmount" name="amount" type="number" step="any" min={0} required />
          </FormField>
          <FormField label={t("billDueDate")} htmlFor="utilityBillDueDate" required>
            <Input id="utilityBillDueDate" name="dueDate" type="date" defaultValue={todayValue} required />
          </FormField>

          {type === "ELECTRICITY" ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <PreviousMeterReadingField id="utilityBillGlobalPreviousReading" automatic={previousReading}
                manual={manualPreviousReading} onChange={setManualPreviousReading} />
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
                {consumption != null ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("consumptionPreview", { units: consumption })}
                  </p>
                ) : null}
              </FormField>
            </div>
          ) : null}

          <label
            htmlFor="utilityBillPaidByCompanyGlobal"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          >
            <Checkbox
              id="utilityBillPaidByCompanyGlobal"
              checked={isWater || paidByCompany}
              disabled={isWater}
              onCheckedChange={(checked) => setPaidByCompany(checked === true)}
            />
            {isWater ? t("paidByCompanyWaterLocked") : t("paidByCompanyLabel")}
          </label>

          <FormField label={t("unitOptional")} htmlFor="utilityBillUnit" className="sm:col-span-2">
            <Select
              value={unitId}
              onValueChange={(v) => { setUnitId(v ?? NONE_VALUE); setManualPreviousReading(null); }}
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

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !propertyId}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
