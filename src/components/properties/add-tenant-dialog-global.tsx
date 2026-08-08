"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FormField } from "@/components/properties/form-field";
import { DocumentUploadField } from "@/components/properties/document-upload-field";
import { addTenantToUnit } from "@/lib/actions/units";
import type { AllTenantsData } from "@/lib/tenants-data";

export function AddTenantDialogGlobal({
  properties,
  existingTenants,
  initialPropertyId,
  initialUnitId,
  returnTo,
  triggerClassName,
}: {
  properties: AllTenantsData["propertiesWithVacantUnits"];
  existingTenants: { id: string; name: string; contactInfo: string | null }[];
  // Pre-selects a property/unit (e.g. from the Vacant Units page's per-card
  // "Add Tenant" button) instead of always defaulting to the first one.
  initialPropertyId?: string;
  initialUnitId?: string;
  returnTo?: string;
  triggerClassName?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const initialProperty = properties.find((p) => p.id === initialPropertyId) ?? properties[0];
  const initialUnit = initialProperty?.units.find((u) => u.id === initialUnitId) ?? initialProperty?.units[0];
  const [propertyId, setPropertyId] = useState(initialProperty?.id ?? "");
  const [unitId, setUnitId] = useState(initialUnit?.id ?? "");
  const [tenantMode, setTenantMode] = useState<"existing" | "new">("new");
  const [newTenantType, setNewTenantType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [downpaymentMethod, setDownpaymentMethod] = useState("NONE");
  const [serviceChargeType, setServiceChargeType] = useState("NONE");
  const [serviceChargeValue, setServiceChargeValue] = useState("");
  const [monthlyRentAmount, setMonthlyRentAmount] = useState(
    initialUnit?.tenantDefaultRentAmount != null ? String(initialUnit.tenantDefaultRentAmount) : ""
  );
  const [initialDownpaymentAmount, setInitialDownpaymentAmount] = useState(
    initialUnit?.tenantDefaultDownpaymentAmount != null ? String(initialUnit.tenantDefaultDownpaymentAmount) : ""
  );
  const todayValue = new Date().toISOString().slice(0, 10);

  const unitsForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.units ?? [],
    [properties, propertyId]
  );

  function applyUnitDefaults(units: typeof unitsForProperty, nextUnitId: string) {
    const unit = units.find((u) => u.id === nextUnitId);
    setMonthlyRentAmount(unit?.tenantDefaultRentAmount != null ? String(unit.tenantDefaultRentAmount) : "");
    setInitialDownpaymentAmount(
      unit?.tenantDefaultDownpaymentAmount != null ? String(unit.tenantDefaultDownpaymentAmount) : ""
    );
  }

  function handlePropertyChange(v: string | null) {
    const next = v ?? "";
    setPropertyId(next);
    const units = properties.find((p) => p.id === next)?.units ?? [];
    const nextUnitId = units[0]?.id ?? "";
    setUnitId(nextUnitId);
    applyUnitDefaults(units, nextUnitId);
  }

  function handleUnitChange(v: string | null) {
    const next = v ?? "";
    setUnitId(next);
    applyUnitDefaults(unitsForProperty, next);
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" className={triggerClassName} />}>
        <Plus className="size-3.5" />
        {t("addTenant")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addTenant")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => addTenantToUnit(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="unitId" value={unitId} />
          <input type="hidden" name="tenantMode" value={tenantMode} />
          <input type="hidden" name="serviceChargeType" value={serviceChargeType === "NONE" ? "" : serviceChargeType} />
          <input type="hidden" name="returnTo" value={returnTo ?? "/tenants"} />

          <FormField label={t("propertyLabel")} htmlFor="addTenantProperty" required>
            <Select
              value={propertyId}
              onValueChange={handlePropertyChange}
              items={properties.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger id="addTenantProperty" className="w-full">
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

          <FormField label={t("unit")} htmlFor="addTenantUnit" required>
            <Select
              value={unitId}
              onValueChange={handleUnitChange}
              items={unitsForProperty.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` }))}
            >
              <SelectTrigger id="addTenantUnit" className="w-full">
                <SelectValue placeholder={t("selectUnit")} />
              </SelectTrigger>
              <SelectContent>
                {unitsForProperty.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} · {u.unitTypeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="sm:col-span-2">
            <Tabs value={tenantMode} onValueChange={(v) => setTenantMode(v as "existing" | "new")}>
              <TabsList className="h-8">
                <TabsTrigger value="existing" className="text-xs">
                  {t("useExistingTenant")}
                </TabsTrigger>
                <TabsTrigger value="new" className="text-xs">
                  {t("addNewTenant")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {tenantMode === "existing" ? (
            <FormField label={t("tenant")} htmlFor="addTenantExistingId" required className="sm:col-span-2">
              <Select name="tenantId" items={existingTenants.map((tn) => ({ value: tn.id, label: tn.name }))}>
                <SelectTrigger id="addTenantExistingId" className="w-full">
                  <SelectValue placeholder={t("selectTenant")} />
                </SelectTrigger>
                <SelectContent>
                  {existingTenants.map((tn) => (
                    <SelectItem key={tn.id} value={tn.id}>
                      {tn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <>
              <FormField label={t("tenantName")} htmlFor="addTenantNewName" required className="sm:col-span-2">
                <Input id="addTenantNewName" name="newTenantName" required={tenantMode === "new"} />
              </FormField>
              <FormField label={t("tenantContact")} htmlFor="addTenantNewContact">
                <Input id="addTenantNewContact" name="newTenantContact" />
              </FormField>
              <FormField label={t("tenantOccupation")} htmlFor="addTenantNewOccupation">
                <Input id="addTenantNewOccupation" name="newTenantOccupation" />
              </FormField>
              <FormField label={t("tenantType")} htmlFor="addTenantNewType">
                <input type="hidden" name="newTenantType" value={newTenantType} />
                <Select
                  value={newTenantType}
                  onValueChange={(v) => setNewTenantType(v as "INDIVIDUAL" | "BUSINESS")}
                  items={[
                    { value: "INDIVIDUAL", label: t("tenantTypeIndividual") },
                    { value: "BUSINESS", label: t("tenantTypeBusiness") },
                  ]}
                >
                  <SelectTrigger id="addTenantNewType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">{t("tenantTypeIndividual")}</SelectItem>
                    <SelectItem value="BUSINESS">{t("tenantTypeBusiness")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {newTenantType === "INDIVIDUAL" ? (
                <FormField label={t("nidNumber")} htmlFor="addTenantNewNid">
                  <Input id="addTenantNewNid" name="newTenantNid" />
                </FormField>
              ) : (
                <FormField label={t("businessRegistrationNumber")} htmlFor="addTenantNewRegistration">
                  <Input id="addTenantNewRegistration" name="newTenantRegistration" />
                </FormField>
              )}
              {newTenantType === "INDIVIDUAL" ? (
                <FormField label={t("nidPhoto")} htmlFor="addTenantNidUpload">
                  <DocumentUploadField
                    urlFieldName="nidDocumentUrl"
                    typeFieldName="nidDocumentFileType"
                    label={t("uploadNidPhoto")}
                  />
                </FormField>
              ) : null}
              <FormField label={t("tenantPhoto")} htmlFor="addTenantPhotoUpload">
                <DocumentUploadField
                  urlFieldName="tenantPhotoUrl"
                  typeFieldName="tenantPhotoFileType"
                  label={t("uploadTenantPhoto")}
                />
              </FormField>
            </>
          )}

          <FormField label={t("leaseMonthlyRent")} htmlFor="addTenantMonthlyRent" required>
            <Input
              id="addTenantMonthlyRent"
              name="monthlyRentAmount"
              type="number"
              step="any"
              min={0}
              required
              value={monthlyRentAmount}
              onChange={(e) => setMonthlyRentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("leaseDownpayment")} htmlFor="addTenantDownpayment" required>
            <Input
              id="addTenantDownpayment"
              name="initialDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              required
              value={initialDownpaymentAmount}
              onChange={(e) => setInitialDownpaymentAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("paymentMethod")} htmlFor="addTenantDownpaymentMethod">
            <input type="hidden" name="downpaymentMethod" value={downpaymentMethod} />
            <Select
              value={downpaymentMethod}
              onValueChange={(v) => setDownpaymentMethod(v ?? "NONE")}
              items={[
                { value: "NONE", label: t("noPaymentRecord") },
                { value: "CASH", label: t("paymentMethodCash") },
                { value: "BKASH", label: t("paymentMethodBkash") },
                { value: "NAGAD", label: t("paymentMethodNagad") },
                { value: "BANK", label: t("paymentMethodBank") },
                { value: "OTHER", label: t("paymentMethodOther") },
              ]}
            >
              <SelectTrigger id="addTenantDownpaymentMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t("noPaymentRecord")}</SelectItem>
                <SelectItem value="CASH">{t("paymentMethodCash")}</SelectItem>
                <SelectItem value="BKASH">{t("paymentMethodBkash")}</SelectItem>
                <SelectItem value="NAGAD">{t("paymentMethodNagad")}</SelectItem>
                <SelectItem value="BANK">{t("paymentMethodBank")}</SelectItem>
                <SelectItem value="OTHER">{t("paymentMethodOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("serviceChargeTypeLabel")} htmlFor="addTenantServiceChargeType">
            <Select
              value={serviceChargeType}
              onValueChange={(v) => setServiceChargeType(v ?? "NONE")}
              items={[
                { value: "NONE", label: t("serviceChargeNone") },
                { value: "FLAT", label: t("serviceChargeFlat") },
                { value: "PERCENTAGE", label: t("serviceChargePercentage") },
              ]}
            >
              <SelectTrigger id="addTenantServiceChargeType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t("serviceChargeNone")}</SelectItem>
                <SelectItem value="FLAT">{t("serviceChargeFlat")}</SelectItem>
                <SelectItem value="PERCENTAGE">{t("serviceChargePercentage")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {serviceChargeType !== "NONE" ? (
            <FormField
              label={serviceChargeType === "PERCENTAGE" ? t("serviceChargeValuePercent") : t("serviceChargeValueFlat")}
              htmlFor="addTenantServiceChargeValue"
              required
            >
              <Input
                id="addTenantServiceChargeValue"
                name="serviceChargeValue"
                type="number"
                step="any"
                min={0}
                max={serviceChargeType === "PERCENTAGE" ? 100 : undefined}
                required
                value={serviceChargeValue}
                onChange={(e) => setServiceChargeValue(e.target.value)}
              />
            </FormField>
          ) : (
            <div />
          )}

          <FormField label={t("leaseStartDate")} htmlFor="addTenantStartDate" required>
            <Input id="addTenantStartDate" name="startDate" type="date" required defaultValue={todayValue} />
          </FormField>
          <FormField label={t("leaseEndDateOptional")} htmlFor="addTenantEndDate">
            <Input id="addTenantEndDate" name="endDate" type="date" />
          </FormField>
          <FormField label={t("leaseNotes")} htmlFor="addTenantNotes" className="sm:col-span-2">
            <Textarea id="addTenantNotes" name="notes" rows={2} />
          </FormField>
          <FormField label={t("uploadAgreementCopy")} htmlFor="addTenantAgreementUpload" className="sm:col-span-2">
            <DocumentUploadField urlFieldName="agreementDocumentUrl" typeFieldName="agreementDocumentFileType" />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !propertyId || !unitId}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />}
              {t("addTenant")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
