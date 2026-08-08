"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
import { addUtilityBill } from "@/lib/actions/utility-bills";

const NONE_VALUE = "NONE";
type UtilityType = "GAS" | "ELECTRICITY" | "WATER" | "OTHER";

export function AddUtilityBillDialog({
  propertyId,
  units = [],
  fixedUnitId,
  returnTo,
  previousElectricityReadingByUnit = {},
}: {
  propertyId: string;
  units?: { id: string; label: string; unitTypeLabel: string }[];
  // When set, this bill is always for one specific unit (e.g. the Tenant
  // Profile page's own utility bills section) — skips the unit picker
  // entirely instead of showing a dropdown whose only sensible answer is
  // already known.
  fixedUnitId?: string;
  returnTo?: string;
  // Latest known electricity meter reading per unit (key "__property__" for
  // a bill with no specific unit) — what a new electricity bill would chain
  // from, used to show a live consumption preview before saving.
  previousElectricityReadingByUnit?: Record<string, number>;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<UtilityType>("ELECTRICITY");
  const [unitId, setUnitId] = useState(NONE_VALUE);
  const [paidByCompany, setPaidByCompany] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const todayValue = new Date().toISOString().slice(0, 10);

  const effectiveUnitId = fixedUnitId ?? (unitId === NONE_VALUE ? "" : unitId);
  const previousReading = previousElectricityReadingByUnit[effectiveUnitId || "__property__"] ?? null;
  const consumption =
    meterReading && previousReading != null ? Number(meterReading) - previousReading : null;

  const typeLabels: Record<UtilityType, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  // Water is company policy: they never collect it from the tenant. Still
  // fully editable either way — see add-utility-bill-dialog-global.tsx and
  // payUtilityBill for the same behavior.
  function handleTypeChange(next: UtilityType) {
    setType(next);
    setPaidByCompany(next === "WATER");
    setMeterReading("");
  }

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
        <form
          action={(formData: FormData) => startTransition(() => addUtilityBill(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="paidByCompany" value={paidByCompany ? "true" : "false"} />
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

          <FormField label={t("amount")} htmlFor="utilityBillAmount" required>
            <Input id="utilityBillAmount" name="amount" type="number" step="any" min={0} required />
          </FormField>
          <FormField label={t("billDueDate")} htmlFor="utilityBillDueDate" required>
            <Input id="utilityBillDueDate" name="dueDate" type="date" defaultValue={todayValue} required />
          </FormField>

          {type === "ELECTRICITY" ? (
            <FormField
              label={t("meterReading")}
              htmlFor="utilityBillMeterReading"
              className="sm:col-span-2"
              hint={
                previousReading != null
                  ? t("previousMeterReadingHint", { reading: previousReading })
                  : t("noPreviousMeterReading")
              }
            >
              <Input
                id="utilityBillMeterReading"
                name="meterReading"
                type="number"
                step="any"
                min={0}
                value={meterReading}
                onChange={(e) => setMeterReading(e.target.value)}
              />
              {consumption != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("consumptionPreview", { units: consumption })}
                </p>
              ) : null}
            </FormField>
          ) : null}

          <label
            htmlFor="utilityBillPaidByCompany"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          >
            <Checkbox
              id="utilityBillPaidByCompany"
              checked={paidByCompany}
              onCheckedChange={(checked) => setPaidByCompany(checked === true)}
            />
            {t("paidByCompanyLabel")}
          </label>

          {fixedUnitId ? null : (
            <FormField label={t("unitOptional")} htmlFor="utilityBillUnit" className="sm:col-span-2">
              <Select
                value={unitId}
                onValueChange={(v) => setUnitId(v ?? NONE_VALUE)}
                items={[
                  { value: NONE_VALUE, label: t("noSpecificUnit") },
                  ...units.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` })),
                ]}
              >
                <SelectTrigger id="utilityBillUnit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{t("noSpecificUnit")}</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label} · {u.unitTypeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
