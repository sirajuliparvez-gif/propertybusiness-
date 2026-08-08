"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { updateTenantLease } from "@/lib/actions/tenants";

export function EditTenantDialog({
  leaseId,
  tenantId,
  tenantName,
  contactInfo,
  occupation,
  tenantType: initialTenantType,
  nidNumber,
  businessRegistrationNumber,
  monthlyRentAmount,
  initialDownpaymentAmount,
  currentDownpaymentBalance,
  serviceChargeType: initialServiceChargeType,
  serviceChargeValue,
  notes,
  returnTo,
}: {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  contactInfo: string | null;
  occupation: string | null;
  tenantType: "INDIVIDUAL" | "BUSINESS";
  nidNumber: string | null;
  businessRegistrationNumber: string | null;
  monthlyRentAmount: number;
  initialDownpaymentAmount: number;
  currentDownpaymentBalance: number;
  serviceChargeType: "FLAT" | "PERCENTAGE" | null;
  serviceChargeValue: number | null;
  notes: string | null;
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [tenantType, setTenantType] = useState<"INDIVIDUAL" | "BUSINESS">(initialTenantType);
  const [serviceChargeType, setServiceChargeType] = useState<string>(initialServiceChargeType ?? "NONE");
  const [serviceChargeValueInput, setServiceChargeValueInput] = useState(
    serviceChargeValue != null ? String(serviceChargeValue) : ""
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Pencil className="size-3.5" />
        {t("edit")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editTenantTitle")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => updateTenantLease(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="tenantType" value={tenantType} />
          <input
            type="hidden"
            name="serviceChargeType"
            value={serviceChargeType === "NONE" ? "" : serviceChargeType}
          />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <FormField label={t("tenantName")} htmlFor="editTenantName" required className="sm:col-span-2">
            <Input id="editTenantName" name="name" defaultValue={tenantName} required />
          </FormField>
          <FormField label={t("tenantContact")} htmlFor="editTenantContact">
            <Input id="editTenantContact" name="contactInfo" defaultValue={contactInfo ?? ""} />
          </FormField>
          <FormField label={t("tenantOccupation")} htmlFor="editTenantOccupation">
            <Input id="editTenantOccupation" name="occupation" defaultValue={occupation ?? ""} />
          </FormField>
          <FormField label={t("tenantType")} htmlFor="editTenantType">
            <Select
              value={tenantType}
              onValueChange={(v) => setTenantType(v as "INDIVIDUAL" | "BUSINESS")}
              items={[
                { value: "INDIVIDUAL", label: t("tenantTypeIndividual") },
                { value: "BUSINESS", label: t("tenantTypeBusiness") },
              ]}
            >
              <SelectTrigger id="editTenantType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">{t("tenantTypeIndividual")}</SelectItem>
                <SelectItem value="BUSINESS">{t("tenantTypeBusiness")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {tenantType === "INDIVIDUAL" ? (
            <FormField label={t("nidNumber")} htmlFor="editTenantNid">
              <Input id="editTenantNid" name="nidNumber" defaultValue={nidNumber ?? ""} />
            </FormField>
          ) : (
            <FormField label={t("businessRegistrationNumber")} htmlFor="editTenantRegistration">
              <Input
                id="editTenantRegistration"
                name="businessRegistrationNumber"
                defaultValue={businessRegistrationNumber ?? ""}
              />
            </FormField>
          )}

          <FormField label={t("nidPhoto")} htmlFor="editTenantNidUpload">
            <DocumentUploadField
              urlFieldName="nidDocumentUrl"
              typeFieldName="nidDocumentFileType"
              label={t("uploadNidPhoto")}
            />
          </FormField>
          <FormField label={t("tenantPhoto")} htmlFor="editTenantPhotoUpload">
            <DocumentUploadField
              urlFieldName="tenantPhotoUrl"
              typeFieldName="tenantPhotoFileType"
              label={t("uploadTenantPhoto")}
            />
          </FormField>

          <FormField label={t("leaseMonthlyRent")} htmlFor="editTenantRent" required>
            <Input
              id="editTenantRent"
              name="monthlyRentAmount"
              type="number"
              step="any"
              min={0}
              required
              defaultValue={monthlyRentAmount}
            />
          </FormField>
          <FormField label={t("initialDownpayment")} htmlFor="editTenantInitialDownpayment" required>
            <Input
              id="editTenantInitialDownpayment"
              name="initialDownpaymentAmount"
              type="number"
              step="any"
              min={0}
              required
              defaultValue={initialDownpaymentAmount}
            />
          </FormField>
          <FormField
            label={t("downpaymentBalance")}
            htmlFor="editTenantCurrentDownpayment"
            required
            className="sm:col-span-2"
          >
            <Input
              id="editTenantCurrentDownpayment"
              name="currentDownpaymentBalance"
              type="number"
              step="any"
              min={0}
              required
              defaultValue={currentDownpaymentBalance}
            />
            <p className="mt-1 text-xs text-primary">{t("currentTenantBalanceHint")}</p>
          </FormField>

          <FormField label={t("serviceChargeTypeLabel")} htmlFor="editTenantServiceChargeType">
            <Select
              value={serviceChargeType}
              onValueChange={(v) => setServiceChargeType(v ?? "NONE")}
              items={[
                { value: "NONE", label: t("serviceChargeNone") },
                { value: "FLAT", label: t("serviceChargeFlat") },
                { value: "PERCENTAGE", label: t("serviceChargePercentage") },
              ]}
            >
              <SelectTrigger id="editTenantServiceChargeType" className="w-full">
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
              htmlFor="editTenantServiceChargeValue"
              required
            >
              <Input
                id="editTenantServiceChargeValue"
                name="serviceChargeValue"
                type="number"
                step="any"
                min={0}
                max={serviceChargeType === "PERCENTAGE" ? 100 : undefined}
                required
                value={serviceChargeValueInput}
                onChange={(e) => setServiceChargeValueInput(e.target.value)}
              />
            </FormField>
          ) : (
            <div />
          )}

          <FormField label={t("leaseNotes")} htmlFor="editTenantNotes" className="sm:col-span-2">
            <Textarea id="editTenantNotes" name="notes" rows={2} defaultValue={notes ?? ""} />
          </FormField>
          <FormField label={t("uploadAgreementCopy")} htmlFor="editTenantAgreementUpload" className="sm:col-span-2">
            <DocumentUploadField urlFieldName="agreementDocumentUrl" typeFieldName="agreementDocumentFileType" />
          </FormField>

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
