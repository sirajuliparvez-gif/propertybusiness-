"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/properties/form-field";
import { DocumentUploadField } from "@/components/properties/document-upload-field";
import { formatTaka, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isHotelType } from "@/lib/property-types";
import { updateUnitStatus, addTenantToUnit, vacateTenantLease } from "@/lib/actions/units";
import type { PropertyDetail } from "@/lib/properties-data";

type UnitShape = PropertyDetail["unitTypes"][number]["units"][number] & {
  unitTypeLabel?: string;
};

export function UnitDetailDialog({
  unit,
  propertyId,
  propertyType,
  tenants,
  triggerClassName,
  children,
}: {
  unit: UnitShape;
  propertyId: string;
  propertyType?: string | null;
  tenants: { id: string; name: string; contactInfo: string | null }[];
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [refundMethod, setRefundMethod] = useState("NONE");
  const [tenantMode, setTenantMode] = useState<"existing" | "new">("existing");
  const [newTenantType, setNewTenantType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [downpaymentMethod, setDownpaymentMethod] = useState("NONE");
  const [serviceChargeType, setServiceChargeType] = useState("NONE");
  const [serviceChargeValue, setServiceChargeValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const isHotel = isHotelType(propertyType);

  const vacantDays = unit.vacantSince
    ? Math.max(0, Math.floor((Date.now() - new Date(unit.vacantSince).getTime()) / 86_400_000))
    : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setShowAddTenant(false);
      setShowVacateConfirm(false);
      setRefundMethod("NONE");
      setTenantMode("existing");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn("cursor-pointer", triggerClassName)}
      >
        {children}
      </span>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {unit.label}
            {unit.unitTypeLabel ? (
              <span className="text-sm font-normal text-muted-foreground">
                · {unit.unitTypeLabel}
              </span>
            ) : null}
            <Badge
              className={cn(
                "ml-auto border-transparent",
                unit.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {unit.status === "ACTIVE" ? t("unitStatusActive") : t("unitStatusInactive")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/40 p-4">
            {unit.sizeValue != null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("sizeValue")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {unit.sizeValue} {unit.sizeUnit ?? ""}
                </span>
              </div>
            ) : null}
            {unit.ownerRentAmount != null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("ownerRentAmount")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTaka(unit.ownerRentAmount)}
                </span>
              </div>
            ) : null}
            {unit.ownerDownpaymentAmount != null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("ownerDownpaymentAmount")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTaka(unit.ownerDownpaymentAmount)}
                </span>
              </div>
            ) : null}
            {unit.tenantDefaultRentAmount != null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("tenantDefaultRentAmount")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTaka(unit.tenantDefaultRentAmount)}
                </span>
              </div>
            ) : null}
            {isHotel && unit.tenantDefaultNightlyRateAmount != null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("tenantDefaultNightlyRateAmount")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatTaka(unit.tenantDefaultNightlyRateAmount)}
                </span>
              </div>
            ) : null}
          </div>

          {unit.occupied && unit.currentTenant ? (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <p className="mb-2 text-xs font-semibold text-success">{t("currentTenant")}</p>
              <p className="text-base font-medium">{unit.currentTenant.name}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("monthlyRent")}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatTaka(unit.currentTenant.monthlyRentAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("initialDownpayment")}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatTaka(unit.currentTenant.downpaymentAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("downpaymentBalance")}</span>
                  <span
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      unit.currentTenant.currentDownpaymentBalance < unit.currentTenant.downpaymentAmount
                        ? "text-warning"
                        : undefined
                    )}
                  >
                    {formatTaka(unit.currentTenant.currentDownpaymentBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("leaseStarted")}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatDate(unit.currentTenant.startDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("leaseEnds")}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {unit.currentTenant.endDate ? formatDate(unit.currentTenant.endDate) : t("noEndDateSet")}
                  </span>
                </div>
              </div>

              {!showVacateConfirm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 text-destructive hover:text-destructive"
                  onClick={() => setShowVacateConfirm(true)}
                >
                  <UserMinus className="size-3.5" />
                  {t("vacateTenant")}
                </Button>
              ) : (
                <form
                  action={(formData: FormData) =>
                    startTransition(() => vacateTenantLease(formData))
                  }
                  className="mt-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <input type="hidden" name="leaseId" value={unit.currentTenant.leaseId} />
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="refundMethod" value={refundMethod} />
                  <p className="text-xs font-medium text-destructive">
                    {t("vacateTenantConfirm", { name: unit.currentTenant.name })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("vacateTenantConfirmHint")}</p>

                  {unit.currentTenant.currentDownpaymentBalance > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <FormField label={t("refundAmount")} htmlFor="refundAmount">
                        <Input
                          id="refundAmount"
                          name="refundAmount"
                          type="number"
                          step="any"
                          min={0}
                          max={unit.currentTenant.currentDownpaymentBalance}
                          defaultValue={unit.currentTenant.currentDownpaymentBalance}
                        />
                      </FormField>
                      <FormField label={t("paymentMethod")} htmlFor="refundMethodSelect">
                        <Select
                          value={refundMethod}
                          onValueChange={(v) => setRefundMethod(v ?? "NONE")}
                          items={[
                            { value: "NONE", label: t("noPaymentRecord") },
                            { value: "CASH", label: t("paymentMethodCash") },
                            { value: "BKASH", label: t("paymentMethodBkash") },
                            { value: "NAGAD", label: t("paymentMethodNagad") },
                            { value: "BANK", label: t("paymentMethodBank") },
                            { value: "OTHER", label: t("paymentMethodOther") },
                          ]}
                        >
                          <SelectTrigger id="refundMethodSelect" className="w-full">
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
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        {t("refundHint")}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowVacateConfirm(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
                      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
                      {t("confirmVacate")}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="mb-2 text-xs font-semibold text-warning">
                {vacantDays != null ? t("vacantDays", { count: vacantDays }) : t("vacantSinceUnknown")}
              </p>
              {unit.lastTenant ? (
                <>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("lastTenant")}</p>
                  <p className="text-base font-medium">{unit.lastTenant.name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("monthlyRent")}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatTaka(unit.lastTenant.monthlyRentAmount)}
                      </span>
                    </div>
                    {unit.lastTenant.leftOn ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t("vacantSince")}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatDate(unit.lastTenant.leftOn)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noPreviousTenant")}</p>
              )}
            </div>
          )}

          {!unit.occupied ? (
            <>
              {!showAddTenant ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTenant(true)}
                >
                  <UserPlus className="size-3.5" />
                  {t("addTenant")}
                </Button>
              ) : (
                <form
                  action={(formData: FormData) =>
                    startTransition(() => addTenantToUnit(formData))
                  }
                  className="flex flex-col gap-3 rounded-lg border p-3"
                >
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="tenantMode" value={tenantMode} />
                  <input
                    type="hidden"
                    name="serviceChargeType"
                    value={serviceChargeType === "NONE" ? "" : serviceChargeType}
                  />
                  <p className="text-xs font-semibold">{t("addTenantToUnit")}</p>

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

                  {tenantMode === "existing" ? (
                    <FormField label={t("tenant")} htmlFor="tenantId" required>
                      <Select
                        name="tenantId"
                        items={tenants.map((tn) => ({ value: tn.id, label: tn.name }))}
                      >
                        <SelectTrigger id="tenantId" className="w-full">
                          <SelectValue placeholder={t("selectTenant")} />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((tn) => (
                            <SelectItem key={tn.id} value={tn.id}>
                              {tn.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label={t("tenantName")} htmlFor="newTenantName" required className="sm:col-span-2">
                        <Input id="newTenantName" name="newTenantName" required={tenantMode === "new"} />
                      </FormField>
                      <FormField label={t("tenantContact")} htmlFor="newTenantContact">
                        <Input id="newTenantContact" name="newTenantContact" />
                      </FormField>
                      <FormField label={t("tenantOccupation")} htmlFor="newTenantOccupation">
                        <Input id="newTenantOccupation" name="newTenantOccupation" />
                      </FormField>
                      <FormField label={t("tenantType")} htmlFor="newTenantType">
                        <input type="hidden" name="newTenantType" value={newTenantType} />
                        <Select
                          value={newTenantType}
                          onValueChange={(v) => setNewTenantType(v as "INDIVIDUAL" | "BUSINESS")}
                          items={[
                            { value: "INDIVIDUAL", label: t("tenantTypeIndividual") },
                            { value: "BUSINESS", label: t("tenantTypeBusiness") },
                          ]}
                        >
                          <SelectTrigger id="newTenantType" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INDIVIDUAL">{t("tenantTypeIndividual")}</SelectItem>
                            <SelectItem value="BUSINESS">{t("tenantTypeBusiness")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                      {newTenantType === "INDIVIDUAL" ? (
                        <FormField label={t("nidNumber")} htmlFor="newTenantNid">
                          <Input id="newTenantNid" name="newTenantNid" />
                        </FormField>
                      ) : (
                        <FormField label={t("businessRegistrationNumber")} htmlFor="newTenantRegistration">
                          <Input id="newTenantRegistration" name="newTenantRegistration" />
                        </FormField>
                      )}
                      {newTenantType === "INDIVIDUAL" ? (
                        <FormField label={t("nidPhoto")} htmlFor="nidDocumentUpload">
                          <DocumentUploadField
                            urlFieldName="nidDocumentUrl"
                            typeFieldName="nidDocumentFileType"
                            label={t("uploadNidPhoto")}
                          />
                        </FormField>
                      ) : null}
                      <FormField label={t("tenantPhoto")} htmlFor="tenantPhotoUpload">
                        <DocumentUploadField
                          urlFieldName="tenantPhotoUrl"
                          typeFieldName="tenantPhotoFileType"
                          label={t("uploadTenantPhoto")}
                        />
                      </FormField>
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label={t("leaseMonthlyRent")} htmlFor="monthlyRentAmount" required>
                      <Input
                        id="monthlyRentAmount"
                        name="monthlyRentAmount"
                        type="number"
                        step="any"
                        min={0}
                        required
                        defaultValue={unit.tenantDefaultRentAmount ?? ""}
                      />
                    </FormField>
                    <FormField label={t("leaseDownpayment")} htmlFor="initialDownpaymentAmount" required>
                      <Input
                        id="initialDownpaymentAmount"
                        name="initialDownpaymentAmount"
                        type="number"
                        step="any"
                        min={0}
                        required
                        defaultValue={unit.tenantDefaultDownpaymentAmount ?? ""}
                      />
                    </FormField>
                    <FormField label={t("paymentMethod")} htmlFor="unitAddTenantDownpaymentMethod">
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
                        <SelectTrigger id="unitAddTenantDownpaymentMethod" className="w-full">
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
                    <FormField label={t("serviceChargeTypeLabel")} htmlFor="serviceChargeType">
                      <Select
                        value={serviceChargeType}
                        onValueChange={(v) => setServiceChargeType(v ?? "NONE")}
                        items={[
                          { value: "NONE", label: t("serviceChargeNone") },
                          { value: "FLAT", label: t("serviceChargeFlat") },
                          { value: "PERCENTAGE", label: t("serviceChargePercentage") },
                        ]}
                      >
                        <SelectTrigger id="serviceChargeType" className="w-full">
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
                        label={
                          serviceChargeType === "PERCENTAGE"
                            ? t("serviceChargeValuePercent")
                            : t("serviceChargeValueFlat")
                        }
                        htmlFor="serviceChargeValue"
                        required
                      >
                        <Input
                          id="serviceChargeValue"
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

                    <FormField label={t("leaseStartDate")} htmlFor="startDate" required>
                      <Input id="startDate" name="startDate" type="date" required />
                    </FormField>
                    <FormField label={t("leaseEndDateOptional")} htmlFor="endDate">
                      <Input id="endDate" name="endDate" type="date" />
                    </FormField>
                    <FormField label={t("leaseNotes")} htmlFor="leaseNotes" className="sm:col-span-2">
                      <Textarea id="leaseNotes" name="notes" rows={2} />
                    </FormField>
                    <FormField label={t("uploadAgreementCopy")} htmlFor="agreementDocumentUpload" className="sm:col-span-2">
                      <DocumentUploadField
                        urlFieldName="agreementDocumentUrl"
                        typeFieldName="agreementDocumentFileType"
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddTenant(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" size="sm" disabled={isPending}>
                      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      {t("addTenant")}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <form
            action={(formData: FormData) => startTransition(() => updateUnitStatus(formData))}
          >
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="status" value={unit.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isPending}
              className={unit.status === "ACTIVE" ? "text-destructive hover:text-destructive" : ""}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {unit.status === "ACTIVE" ? t("deactivateUnit") : t("activateUnit")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
