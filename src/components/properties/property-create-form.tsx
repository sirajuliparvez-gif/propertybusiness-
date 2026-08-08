"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building2, Loader2, User, Home, FileText, MapPin } from "lucide-react";
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
import { isHotelType } from "@/lib/property-types";
import { UnitOverridesTable } from "@/components/properties/unit-overrides-table";
import { createProperty } from "@/lib/actions/properties";
import { formatTaka } from "@/lib/format";

function SectionHeader({
  icon: Icon,
  tone,
  title,
}: {
  icon: typeof Building2;
  tone: string;
  title: string;
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <span className={`flex size-7 items-center justify-center rounded-lg bg-linear-to-br ${tone}`}>
        <Icon className="size-3.5" />
      </span>
      {title}
    </CardTitle>
  );
}

export function PropertyCreateForm({ owners }: { owners: { id: string; name: string }[] }) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState("");
  const [unitCount, setUnitCount] = useState("1");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUnit, setSizeUnit] = useState("sqft");
  const [rentMode, setRentMode] = useState<"perUnit" | "fixed">("perUnit");
  const [downpaymentMethod, setDownpaymentMethod] = useState("NONE");
  const [ownerRentAmount, setOwnerRentAmount] = useState("");
  const [ownerDownpaymentAmount, setOwnerDownpaymentAmount] = useState("");
  const [tenantDefaultRentAmount, setTenantDefaultRentAmount] = useState("");
  const [tenantDefaultDownpaymentAmount, setTenantDefaultDownpaymentAmount] = useState("");
  const [tenantDefaultNightlyRateAmount, setTenantDefaultNightlyRateAmount] = useState("");
  const [fixedMonthlyRentAmount, setFixedMonthlyRentAmount] = useState("");
  const isHotel = isHotelType(type);

  const monthlyOwnerRentPreview = useMemo(() => {
    if (rentMode === "fixed") return Number(fixedMonthlyRentAmount) || 0;
    return (Number(ownerRentAmount) || 0) * (Number(unitCount) || 0);
  }, [rentMode, fixedMonthlyRentAmount, ownerRentAmount, unitCount]);

  return (
    <form
      action={(formData: FormData) => startTransition(() => createProperty(formData))}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="rentMode" value={rentMode} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={Building2}
              tone="from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400"
              title={t("basicInfo")}
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label={t("name")} htmlFor="name" required>
              <Input
                id="name"
                name="name"
                placeholder={t("namePlaceholder")}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField label={t("address")} htmlFor="address">
              <Input
                id="address"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </FormField>
            <FormField label={t("type")} htmlFor="type" required>
              <input type="hidden" name="type" value={type} />
              <PropertyTypePicker value={type} onChange={setType} />
            </FormField>
            <FormField label={t("notes")} htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              icon={User}
              tone="from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400"
              title={t("ownerInfo")}
            />
          </CardHeader>
          <CardContent>
            <OwnerPicker owners={owners} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 [--card-spacing:--spacing(6)]">
          <CardHeader>
            <SectionHeader
              icon={Home}
              tone="from-teal-500/25 to-teal-500/5 text-teal-600 dark:text-teal-400"
              title={t("unitTypeInfo")}
            />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("unitTypeLabel")} htmlFor="unitTypeLabel" required className="sm:col-span-2">
              <Input id="unitTypeLabel" name="unitTypeLabel" placeholder={t("unitTypeLabelPlaceholder")} required />
            </FormField>
            <FormField label={t("sizeValue")} htmlFor="sizeValue">
              <Input
                id="sizeValue"
                name="sizeValue"
                type="number"
                step="any"
                min={0}
                value={sizeValue}
                onChange={(e) => setSizeValue(e.target.value)}
              />
            </FormField>
            <FormField label={t("sizeUnit")} htmlFor="sizeUnit">
              <Input id="sizeUnit" name="sizeUnit" value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)} />
            </FormField>
            <FormField label={t("unitCount")} htmlFor="unitCount" required>
              <Input
                id="unitCount"
                name="unitCount"
                type="number"
                min={1}
                step={1}
                required
                value={unitCount}
                onChange={(e) => setUnitCount(e.target.value)}
              />
            </FormField>
            <FormField
              label={t("ownerRentAmount")}
              htmlFor="ownerRentAmount"
              required={rentMode === "perUnit"}
            >
              <Input
                id="ownerRentAmount"
                name="ownerRentAmount"
                type="number"
                step="any"
                min={0}
                required={rentMode === "perUnit"}
                value={ownerRentAmount}
                onChange={(e) => setOwnerRentAmount(e.target.value)}
              />
              {rentMode === "fixed" ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("ownerRentAmountOptionalHint")}</p>
              ) : null}
            </FormField>
            {rentMode === "perUnit" ? (
              <FormField label={t("ownerDownpaymentAmount")} htmlFor="ownerDownpaymentAmount">
                <Input
                  id="ownerDownpaymentAmount"
                  name="ownerDownpaymentAmount"
                  type="number"
                  step="any"
                  min={0}
                  value={ownerDownpaymentAmount}
                  onChange={(e) => setOwnerDownpaymentAmount(e.target.value)}
                />
              </FormField>
            ) : null}
            <FormField label={t("tenantDefaultRentAmount")} htmlFor="tenantDefaultRentAmount">
              <Input
                id="tenantDefaultRentAmount"
                name="tenantDefaultRentAmount"
                type="number"
                step="any"
                min={0}
                value={tenantDefaultRentAmount}
                onChange={(e) => setTenantDefaultRentAmount(e.target.value)}
              />
            </FormField>
            <FormField label={t("tenantDefaultDownpaymentAmount")} htmlFor="tenantDefaultDownpaymentAmount">
              <Input
                id="tenantDefaultDownpaymentAmount"
                name="tenantDefaultDownpaymentAmount"
                type="number"
                step="any"
                min={0}
                value={tenantDefaultDownpaymentAmount}
                onChange={(e) => setTenantDefaultDownpaymentAmount(e.target.value)}
              />
            </FormField>
            {isHotel ? (
              <FormField label={t("tenantDefaultNightlyRateAmount")} htmlFor="tenantDefaultNightlyRateAmount" className="sm:col-span-2">
                <Input
                  id="tenantDefaultNightlyRateAmount"
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
                showOwnerRent={rentMode === "perUnit"}
                showNightlyRate={isHotel}
                onCountChange={(count) => setUnitCount(String(count))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionHeader
              icon={FileText}
              tone="from-warning/25 to-warning/5 text-warning"
              title={t("leaseAgreementInfo")}
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label={t("rentMode")} htmlFor="rentModeTabs" className="sm:max-w-xs">
              <Tabs value={rentMode} onValueChange={(v) => setRentMode(v as "perUnit" | "fixed")}>
                <TabsList className="h-8 w-full">
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
              <FormField label={t("fixedMonthlyRentAmount")} htmlFor="fixedMonthlyRentAmount" required className="sm:max-w-xs">
                <Input
                  id="fixedMonthlyRentAmount"
                  name="fixedMonthlyRentAmount"
                  type="number"
                  step="any"
                  min={0}
                  required
                  value={fixedMonthlyRentAmount}
                  onChange={(e) => setFixedMonthlyRentAmount(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("fixedRentHint")}</p>
              </FormField>
            ) : null}
            {rentMode === "fixed" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={t("downpaymentAmount")} htmlFor="downpaymentAmount" required>
                  <Input id="downpaymentAmount" name="downpaymentAmount" type="number" step="any" min={0} required />
                </FormField>
                <FormField label={t("paymentMethod")} htmlFor="downpaymentMethod">
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
                    <SelectTrigger id="downpaymentMethod" className="w-full">
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
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </FormField>
              <FormField label={t("endDate")} htmlFor="endDate">
                <Input id="endDate" name="endDate" type="date" />
              </FormField>
            </div>
            <FormField label={t("agreementNotes")} htmlFor="agreementNotes">
              <Textarea id="agreementNotes" name="agreementNotes" rows={2} />
            </FormField>
            <FormField label={t("uploadDocument")} htmlFor="documentUpload">
              <DocumentUploadField />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-linear-to-br from-primary/8 via-card to-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("preview")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name || t("namePlaceholder")}</p>
              {address ? (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {address}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("monthlyOwnerRent")}</p>
              <p className="font-mono font-semibold tabular-nums">
                {formatTaka(monthlyOwnerRentPreview)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("create")}
        </Button>
      </div>
    </form>
  );
}
