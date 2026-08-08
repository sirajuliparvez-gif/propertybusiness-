"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
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
import { addUnitType } from "@/lib/actions/properties";

export function AddUnitTypeDialog({
  propertyId,
  propertyType,
  existingUnitCount = 0,
}: {
  propertyId: string;
  propertyType?: string | null;
  existingUnitCount?: number;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [unitCount, setUnitCount] = useState("1");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUnit, setSizeUnit] = useState("sqft");
  const [ownerRentAmount, setOwnerRentAmount] = useState("");
  const [ownerDownpaymentAmount, setOwnerDownpaymentAmount] = useState("");
  const [tenantDefaultRentAmount, setTenantDefaultRentAmount] = useState("");
  const [tenantDefaultDownpaymentAmount, setTenantDefaultDownpaymentAmount] = useState("");
  const [tenantDefaultNightlyRateAmount, setTenantDefaultNightlyRateAmount] = useState("");
  const isHotel = isHotelType(propertyType);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" />
        {t("addUnitType")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("addUnitType")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => addUnitType(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <FormField label={t("unitTypeLabel")} htmlFor="ut-unitTypeLabel" required className="sm:col-span-2">
            <Input id="ut-unitTypeLabel" name="unitTypeLabel" placeholder={t("unitTypeLabelPlaceholder")} required />
          </FormField>
          <FormField label={t("sizeValue")} htmlFor="ut-sizeValue">
            <Input
              id="ut-sizeValue"
              name="sizeValue"
              type="number"
              step="any"
              min={0}
              value={sizeValue}
              onChange={(e) => setSizeValue(e.target.value)}
            />
          </FormField>
          <FormField label={t("sizeUnit")} htmlFor="ut-sizeUnit">
            <Input id="ut-sizeUnit" name="sizeUnit" value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)} />
          </FormField>
          <FormField label={t("unitCount")} htmlFor="ut-unitCount" required>
            <Input
              id="ut-unitCount"
              name="unitCount"
              type="number"
              min={1}
              step={1}
              required
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
            />
          </FormField>
          <FormField label={t("ownerRentAmount")} htmlFor="ut-ownerRentAmount">
            <Input
              id="ut-ownerRentAmount"
              name="ownerRentAmount"
              type="number"
              step="any"
              min={0}
              value={ownerRentAmount}
              onChange={(e) => setOwnerRentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("ownerDownpaymentAmount")} htmlFor="ut-ownerDownpaymentAmount">
            <Input
              id="ut-ownerDownpaymentAmount"
              name="ownerDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              value={ownerDownpaymentAmount}
              onChange={(e) => setOwnerDownpaymentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("tenantDefaultRentAmount")} htmlFor="ut-tenantDefaultRentAmount">
            <Input
              id="ut-tenantDefaultRentAmount"
              name="tenantDefaultRentAmount"
              type="number"
              step="any"
              min={0}
              value={tenantDefaultRentAmount}
              onChange={(e) => setTenantDefaultRentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("tenantDefaultDownpaymentAmount")} htmlFor="ut-tenantDefaultDownpaymentAmount">
            <Input
              id="ut-tenantDefaultDownpaymentAmount"
              name="tenantDefaultDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              value={tenantDefaultDownpaymentAmount}
              onChange={(e) => setTenantDefaultDownpaymentAmount(e.target.value)}
            />
          </FormField>
          {isHotel ? (
            <FormField label={t("tenantDefaultNightlyRateAmount")} htmlFor="ut-tenantDefaultNightlyRateAmount" className="sm:col-span-2">
              <Input
                id="ut-tenantDefaultNightlyRateAmount"
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
              unitCount={Number(unitCount) || 0}
              defaultSizeValue={sizeValue}
              defaultSizeUnit={sizeUnit}
              defaultOwnerRent={ownerRentAmount}
              defaultOwnerDownpayment={ownerDownpaymentAmount}
              defaultTenantRent={tenantDefaultRentAmount}
              defaultTenantDownpayment={tenantDefaultDownpaymentAmount}
              defaultNightlyRate={tenantDefaultNightlyRateAmount}
              showNightlyRate={isHotel}
              startIndex={existingUnitCount}
              onCountChange={(count) => setUnitCount(String(count))}
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
