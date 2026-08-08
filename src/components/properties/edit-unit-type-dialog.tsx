"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/properties/form-field";
import { UnitOverridesTable } from "@/components/properties/unit-overrides-table";
import { isHotelType } from "@/lib/property-types";
import { updateUnitType } from "@/lib/actions/properties";
import type { PropertyDetail } from "@/lib/properties-data";

export function EditUnitTypeDialog({
  propertyId,
  propertyType,
  unitType,
  totalUnitCount,
}: {
  propertyId: string;
  propertyType?: string | null;
  unitType: PropertyDetail["unitTypes"][number];
  totalUnitCount: number;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [sizeValue, setSizeValue] = useState(unitType.sizeValue != null ? String(unitType.sizeValue) : "");
  const [sizeUnit, setSizeUnit] = useState(unitType.sizeUnit ?? "sqft");
  const [ownerRentAmount, setOwnerRentAmount] = useState(
    unitType.ownerRentAmount != null ? String(unitType.ownerRentAmount) : ""
  );
  const [ownerDownpaymentAmount, setOwnerDownpaymentAmount] = useState(
    unitType.ownerDownpaymentAmount != null ? String(unitType.ownerDownpaymentAmount) : ""
  );
  const [tenantDefaultRentAmount, setTenantDefaultRentAmount] = useState(
    unitType.tenantDefaultRentAmount != null ? String(unitType.tenantDefaultRentAmount) : ""
  );
  const [tenantDefaultDownpaymentAmount, setTenantDefaultDownpaymentAmount] = useState(
    unitType.tenantDefaultDownpaymentAmount != null ? String(unitType.tenantDefaultDownpaymentAmount) : ""
  );
  const [tenantDefaultNightlyRateAmount, setTenantDefaultNightlyRateAmount] = useState(
    unitType.tenantDefaultNightlyRateAmount != null ? String(unitType.tenantDefaultNightlyRateAmount) : ""
  );
  const isHotel = isHotelType(propertyType);

  const initialRows = unitType.units.map((u) => ({
    id: u.id,
    label: u.label,
    sizeValue: u.overrides.sizeValue != null ? String(u.overrides.sizeValue) : "",
    sizeUnit: u.overrides.sizeUnit ?? "",
    ownerRent: u.overrides.ownerRentAmount != null ? String(u.overrides.ownerRentAmount) : "",
    ownerDownpayment:
      u.overrides.ownerDownpaymentAmount != null ? String(u.overrides.ownerDownpaymentAmount) : "",
    tenantRent: u.overrides.tenantDefaultRentAmount != null ? String(u.overrides.tenantDefaultRentAmount) : "",
    // For a unit with a current tenant, this column edits that tenant's
    // actual live lease balance (tenantLeaseId set below) instead of the
    // unit's future-tenant default — see UnitOverridesTable's tenantLeaseId
    // handling for why these can't share the same "just a default" behavior.
    tenantDownpayment: u.currentTenant
      ? String(u.currentTenant.currentDownpaymentBalance)
      : u.overrides.tenantDefaultDownpaymentAmount != null
        ? String(u.overrides.tenantDefaultDownpaymentAmount)
        : "",
    tenantLeaseId: u.currentTenant?.leaseId,
    nightlyRate:
      u.overrides.tenantDefaultNightlyRateAmount != null
        ? String(u.overrides.tenantDefaultNightlyRateAmount)
        : "",
  }));

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-3.5" />
        <span className="sr-only">{t("editUnitType")}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("editUnitType")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => updateUnitType(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="unitTypeId" value={unitType.id} />
          <input type="hidden" name="existingTotalUnitCount" value={totalUnitCount} />

          <FormField label={t("unitTypeLabel")} htmlFor="eut-unitTypeLabel" required className="sm:col-span-2">
            <Input
              id="eut-unitTypeLabel"
              name="unitTypeLabel"
              defaultValue={unitType.label}
              required
            />
          </FormField>
          <FormField label={t("sizeValue")} htmlFor="eut-sizeValue">
            <Input
              id="eut-sizeValue"
              name="sizeValue"
              type="number"
              step="any"
              min={0}
              value={sizeValue}
              onChange={(e) => setSizeValue(e.target.value)}
            />
          </FormField>
          <FormField label={t("sizeUnit")} htmlFor="eut-sizeUnit">
            <Input id="eut-sizeUnit" name="sizeUnit" value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)} />
          </FormField>
          <FormField label={t("ownerRentAmount")} htmlFor="eut-ownerRentAmount">
            <Input
              id="eut-ownerRentAmount"
              name="ownerRentAmount"
              type="number"
              step="any"
              min={0}
              value={ownerRentAmount}
              onChange={(e) => setOwnerRentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("ownerDownpaymentAmount")} htmlFor="eut-ownerDownpaymentAmount">
            <Input
              id="eut-ownerDownpaymentAmount"
              name="ownerDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              value={ownerDownpaymentAmount}
              onChange={(e) => setOwnerDownpaymentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("tenantDefaultRentAmount")} htmlFor="eut-tenantDefaultRentAmount">
            <Input
              id="eut-tenantDefaultRentAmount"
              name="tenantDefaultRentAmount"
              type="number"
              step="any"
              min={0}
              value={tenantDefaultRentAmount}
              onChange={(e) => setTenantDefaultRentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("tenantDefaultDownpaymentAmount")} htmlFor="eut-tenantDefaultDownpaymentAmount">
            <Input
              id="eut-tenantDefaultDownpaymentAmount"
              name="tenantDefaultDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              value={tenantDefaultDownpaymentAmount}
              onChange={(e) => setTenantDefaultDownpaymentAmount(e.target.value)}
            />
          </FormField>
          {isHotel ? (
            <FormField
              label={t("tenantDefaultNightlyRateAmount")}
              htmlFor="eut-tenantDefaultNightlyRateAmount"
              className="sm:col-span-2"
            >
              <Input
                id="eut-tenantDefaultNightlyRateAmount"
                name="tenantDefaultNightlyRateAmount"
                type="number"
                step="any"
                min={0}
                value={tenantDefaultNightlyRateAmount}
                onChange={(e) => setTenantDefaultNightlyRateAmount(e.target.value)}
              />
            </FormField>
          ) : null}
          <div className="sm:col-span-2">
            <UnitOverridesTable
              unitCount={initialRows.length}
              initialRows={initialRows}
              initiallyExpanded
              defaultSizeValue={sizeValue}
              defaultSizeUnit={sizeUnit}
              defaultOwnerRent={ownerRentAmount}
              defaultOwnerDownpayment={ownerDownpaymentAmount}
              defaultTenantRent={tenantDefaultRentAmount}
              defaultTenantDownpayment={tenantDefaultDownpaymentAmount}
              defaultNightlyRate={tenantDefaultNightlyRateAmount}
              showNightlyRate={isHotel}
              // Units elsewhere in the property, excluding this UnitType's own
              // — its own existing rows are already accounted for by their
              // position in the row array, so including them here as well
              // would double-count and skip label numbers for newly-added rows.
              startIndex={totalUnitCount - unitType.unitCount}
            />
          </div>

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
