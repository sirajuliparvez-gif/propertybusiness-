"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
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
import { dhakaISO } from "@/lib/dhaka-time";
import { formatTaka } from "@/lib/format";
import { updateUtilityBill, type UtilityBillErrorCode } from "@/lib/actions/utility-bills";
import { listPropertyUnits } from "@/lib/actions/units";
import { unitPickerLabel } from "@/lib/unit-label";

const NONE_VALUE = "NONE";
type UtilityType = "GAS" | "ELECTRICITY" | "WATER" | "OTHER";

// What the edit form needs about a bill — deliberately narrower than
// UtilityBillRow so the invoice page's richer row shape fits too.
export type EditableUtilityBill = {
  id: string;
  propertyId: string;
  type: UtilityType;
  unitId?: string | null;
  unitLabel?: string | null;
  amount: number;
  paidAmount: number;
  paidByCompany: boolean;
  dueDate: Date | string;
  meterReading?: number | null;
  // This bill's own predecessor in the meter chain, for the consumption hint.
  previousMeterReading?: number | null;
};

// Corrections of a bill already in the system — same form as Add Bill, but
// prefilled, and a refusal (amount below what's already collected, unit of
// another property) shows up inside the dialog instead of throwing.
export function EditUtilityBillDialog({
  bill,
  returnTo,
  fixedUnitId,
}: {
  bill: EditableUtilityBill;
  returnTo: string;
  // Same meaning as in AddUtilityBillDialog: the bill stays on this unit,
  // so the unit picker isn't rendered at all.
  fixedUnitId?: string;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<UtilityType>(bill.type);
  const [unitId, setUnitId] = useState(fixedUnitId ?? bill.unitId ?? NONE_VALUE);
  const [paidByCompany, setPaidByCompany] = useState(bill.paidByCompany);
  const [meterReading, setMeterReading] = useState(
    bill.meterReading != null ? String(bill.meterReading) : ""
  );
  const [error, setError] = useState<UtilityBillErrorCode | null>(null);
  const [units, setUnits] = useState<
    { id: string; label: string; unitTypeLabel: string; tenantName?: string | null }[] | null
  >(null);

  // Units are fetched on first open rather than passed in: the cross-
  // property Utility Bills page has no per-property unit list to hand down,
  // and loading them for every row up front would be one query per row.
  // `units` doubles as the "already fetched" guard, so a closed-then-
  // reopened dialog doesn't refire the request.
  useEffect(() => {
    if (!open || fixedUnitId || units) return;
    let cancelled = false;
    listPropertyUnits(bill.propertyId)
      .then((list) => {
        if (!cancelled) setUnits(list);
      })
      .catch(() => {
        // Network hiccup: keep the current unit selectable (so the value
        // the form submits can't silently change) instead of an empty list.
        if (!cancelled) {
          setUnits(
            bill.unitId
              ? [{ id: bill.unitId, label: bill.unitLabel ?? bill.unitId, unitTypeLabel: "", tenantName: null }]
              : []
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fixedUnitId, units, bill.propertyId, bill.unitId, bill.unitLabel]);

  const previousReading = bill.previousMeterReading ?? null;
  const consumption =
    meterReading && previousReading != null ? Number(meterReading) - previousReading : null;
  const isWater = type === "WATER";

  const typeLabels: Record<UtilityType, string> = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  // Mirror of the Add form's rule: water is always the company's own cost,
  // and the meter reading only exists for electricity.
  function handleTypeChange(next: UtilityType) {
    setType(next);
    setPaidByCompany(next === "WATER");
    setMeterReading("");
  }

  const errorMessages: Record<UtilityBillErrorCode, string> = {
    missingFields: t("billErrMissingFields"),
    notFound: t("billErrNotFound"),
    unitNotInProperty: t("billErrUnitNotInProperty"),
    amountBelowPaid: t("billErrAmountBelowPaid", { amount: formatTaka(bill.paidAmount) }),
    hasPayments: t("billErrHasPayments", { amount: formatTaka(bill.paidAmount) }),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="icon-sm" title={t("editUtilityBill")} />
        }
      >
        <Pencil className="size-3.5" />
        <span className="sr-only">{t("editUtilityBill")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editUtilityBill")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const res = await updateUtilityBill(formData);
              if (!res.ok) setError(res.error);
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="propertyId" value={bill.propertyId} />
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="paidByCompany"
            value={isWater || paidByCompany ? "true" : "false"}
          />
          <input
            type="hidden"
            name="unitId"
            value={fixedUnitId ?? (unitId === NONE_VALUE ? "" : unitId)}
          />
          <input type="hidden" name="returnTo" value={returnTo} />

          <FormField
            label={t("utilityType")}
            htmlFor="editUtilityBillType"
            required
            className="sm:col-span-2"
          >
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange((v ?? "OTHER") as UtilityType)}
              items={(["GAS", "ELECTRICITY", "WATER", "OTHER"] as UtilityType[]).map((k) => ({
                value: k,
                label: typeLabels[k],
              }))}
            >
              <SelectTrigger id="editUtilityBillType" className="w-full">
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

          <FormField label={t("amount")} htmlFor="editUtilityBillAmount" required>
            <Input
              id="editUtilityBillAmount"
              name="amount"
              type="number"
              step="any"
              min={0}
              defaultValue={bill.amount}
              required
            />
          </FormField>
          <FormField label={t("billDueDate")} htmlFor="editUtilityBillDueDate" required>
            <Input
              id="editUtilityBillDueDate"
              name="dueDate"
              type="date"
              defaultValue={dhakaISO(bill.dueDate)}
              required
            />
          </FormField>

          {type === "ELECTRICITY" ? (
            <FormField
              label={t("meterReading")}
              htmlFor="editUtilityBillMeterReading"
              className="sm:col-span-2"
              hint={
                previousReading != null
                  ? t("previousMeterReadingHint", { reading: previousReading })
                  : t("noPreviousMeterReading")
              }
            >
              <Input
                id="editUtilityBillMeterReading"
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
            htmlFor="editUtilityBillPaidByCompany"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          >
            <Checkbox
              id="editUtilityBillPaidByCompany"
              checked={isWater || paidByCompany}
              disabled={isWater}
              onCheckedChange={(checked) => setPaidByCompany(checked === true)}
            />
            {isWater ? t("paidByCompanyWaterLocked") : t("paidByCompanyLabel")}
          </label>

          {fixedUnitId ? null : (
            <FormField
              label={t("unitOptional")}
              htmlFor="editUtilityBillUnit"
              className="sm:col-span-2"
            >
              {units == null ? (
                <p className="text-xs text-muted-foreground">{t("loadingUnits")}</p>
              ) : (
                <Select
                  value={unitId}
                  onValueChange={(v) => setUnitId(v ?? NONE_VALUE)}
                  items={[
                    { value: NONE_VALUE, label: t("noSpecificUnit") },
                    ...units.map((u) => ({ value: u.id, label: unitPickerLabel(u) })),
                  ]}
                >
                  <SelectTrigger id="editUtilityBillUnit" className="w-full">
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
              )}
            </FormField>
          )}

          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{errorMessages[error]}</p>
          ) : null}

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
