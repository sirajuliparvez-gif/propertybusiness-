"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building2, FileText as FileTextIcon, Home, Loader2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/properties/form-field";
import { OwnerPicker } from "@/components/properties/owner-picker";
import { DocumentUploadField } from "@/components/properties/document-upload-field";
import { PropertyTypePicker } from "@/components/properties/property-type-picker";
import { AddUnitTypeDialog } from "@/components/properties/add-unit-type-dialog";
import { EditUnitTypeDialog } from "@/components/properties/edit-unit-type-dialog";
import { updateProperty } from "@/lib/actions/properties";
import { formatDate, formatTaka } from "@/lib/format";
import type { PropertyDetail } from "@/lib/properties-data";

export function PropertyEditForm({
  property,
  owners,
}: {
  property: PropertyDetail;
  owners: { id: string; name: string }[];
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [rentMode, setRentMode] = useState<"perUnit" | "fixed">(
    property.activeAgreement?.fixedMonthlyRentAmount != null ? "fixed" : "perUnit"
  );
  const [type, setType] = useState(property.type ?? "");

  return (
    <form
      action={(formData: FormData) => startTransition(() => updateProperty(formData))}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="propertyId" value={property.id} />
      {property.activeAgreement ? (
        <>
          <input type="hidden" name="agreementId" value={property.activeAgreement.id} />
          <input type="hidden" name="rentMode" value={rentMode} />
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400">
                <Building2 className="size-3.5" />
              </span>
              {t("basicInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label={t("name")} htmlFor="name" required>
              <Input id="name" name="name" defaultValue={property.name} required />
            </FormField>
            <FormField label={t("address")} htmlFor="address">
              <Input id="address" name="address" defaultValue={property.address ?? ""} />
            </FormField>
            <FormField label={t("status")} htmlFor="status">
              <Select
                name="status"
                defaultValue={property.status}
                items={[
                  { value: "ACTIVE", label: t("active") },
                  { value: "INACTIVE", label: t("inactive") },
                ]}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                  <SelectItem value="INACTIVE">{t("inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("type")} htmlFor="type">
              <input type="hidden" name="type" value={type} />
              <PropertyTypePicker value={type} onChange={setType} />
            </FormField>
            <FormField label={t("notes")} htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} defaultValue={property.notes ?? ""} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400">
                <User className="size-3.5" />
              </span>
              {t("ownerInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OwnerPicker owners={owners} defaultOwnerId={property.owner.id} />
          </CardContent>
        </Card>

        {property.activeAgreement ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-warning/25 to-warning/5 text-warning">
                  <FileTextIcon className="size-3.5" />
                </span>
                {t("leaseAgreementInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <FormField label={t("rentMode")} htmlFor="rentModeTabs">
                <Tabs value={rentMode} onValueChange={(v) => setRentMode(v as "perUnit" | "fixed")}>
                  <TabsList className="h-8 w-full sm:w-auto">
                    <TabsTrigger value="perUnit" className="flex-1 text-xs">
                      {t("perUnitRent")}
                    </TabsTrigger>
                    <TabsTrigger value="fixed" className="flex-1 text-xs">
                      {t("fixedTotalRent")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormField>
              {rentMode === "fixed" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("fixedMonthlyRentAmount")} htmlFor="fixedMonthlyRentAmount" required>
                    <Input
                      id="fixedMonthlyRentAmount"
                      name="fixedMonthlyRentAmount"
                      type="number"
                      step="any"
                      min={0}
                      required
                      defaultValue={property.activeAgreement.fixedMonthlyRentAmount ?? ""}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("fixedRentHint")}</p>
                  </FormField>
                  <FormField label={t("downpaymentAmount")} htmlFor="downpaymentAmount" required>
                    <Input
                      id="downpaymentAmount"
                      name="downpaymentAmount"
                      type="number"
                      step="any"
                      min={0}
                      required
                      defaultValue={property.activeAgreement.downpaymentAmount ?? ""}
                    />
                  </FormField>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("perUnitDownpaymentHint")}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={t("startDate")} htmlFor="startDate" required>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    required
                    defaultValue={property.activeAgreement.startDate.toISOString().slice(0, 10)}
                  />
                </FormField>
                <FormField label={t("endDate")} htmlFor="endDate">
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    defaultValue={property.activeAgreement.endDate?.toISOString().slice(0, 10) ?? ""}
                  />
                </FormField>
              </div>
              <FormField label={t("agreementNotes")} htmlFor="agreementNotes">
                <Textarea
                  id="agreementNotes"
                  name="agreementNotes"
                  rows={2}
                  defaultValue={property.activeAgreement.notes ?? ""}
                />
              </FormField>

              <FormField label={t("agreementDocuments")} htmlFor="documents">
                {property.activeAgreement.documents.length > 0 ? (
                  <ul className="mb-2 flex flex-col gap-1.5">
                    {property.activeAgreement.documents.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-primary underline-offset-2 hover:underline"
                        >
                          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                          {t("viewDocument")}
                          <span className="ml-auto text-xs font-normal text-muted-foreground">
                            {formatDate(d.uploadedAt)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <DocumentUploadField />
              </FormField>
            </CardContent>
          </Card>
        ) : null}

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-teal-500/25 to-teal-500/5 text-teal-600 dark:text-teal-400">
                <Home className="size-3.5" />
              </span>
              {t("unitTypes")}
            </CardTitle>
            <AddUnitTypeDialog
              propertyId={property.id}
              propertyType={property.type}
              existingUnitCount={property.totalUnits}
            />
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">{t("unitTypeVsUnitHint")}</p>
            {property.unitTypes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noUnitTypes")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {property.unitTypes.map((ut) => (
                  <div
                    key={ut.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{ut.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ut.sizeValue ? `${ut.sizeValue} ${ut.sizeUnit} · ` : ""}
                        {ut.unitCount} {t("units").toLowerCase()}
                        {ut.ownerRentAmount != null
                          ? ` · ${formatTaka(ut.ownerRentAmount)} ${t("monthlyOwnerRent").toLowerCase()}`
                          : ""}
                      </p>
                    </div>
                    <EditUnitTypeDialog
                      propertyId={property.id}
                      propertyType={property.type}
                      unitType={ut}
                      totalUnitCount={property.totalUnits}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
