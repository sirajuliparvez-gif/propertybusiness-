"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
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
import { renewLeaseAgreement } from "@/lib/actions/owner-lease";

export function RenewLeaseAgreementDialog({
  propertyId,
  oldAgreementId,
  currentFixedMonthlyRentAmount,
}: {
  propertyId: string;
  oldAgreementId?: string;
  currentFixedMonthlyRentAmount?: number | null;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [rentMode, setRentMode] = useState<"perUnit" | "fixed">(
    currentFixedMonthlyRentAmount != null ? "fixed" : "perUnit"
  );
  const [downpaymentMethod, setDownpaymentMethod] = useState("NONE");
  const todayValue = new Date().toISOString().slice(0, 10);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <RefreshCw className="size-3.5" />
        {t("renewLease")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("renewLease")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => renewLeaseAgreement(formData))}
          className="grid gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          {oldAgreementId ? <input type="hidden" name="oldAgreementId" value={oldAgreementId} /> : null}
          <input type="hidden" name="rentMode" value={rentMode} />

          <FormField label={t("rentMode")} htmlFor="renewRentModeTabs">
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
            <FormField label={t("fixedMonthlyRentAmount")} htmlFor="renewFixedMonthlyRentAmount" required>
              <Input
                id="renewFixedMonthlyRentAmount"
                name="fixedMonthlyRentAmount"
                type="number"
                step="any"
                min={0}
                required
                defaultValue={currentFixedMonthlyRentAmount ?? ""}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("fixedRentHint")}</p>
            </FormField>
          ) : null}

          {rentMode === "fixed" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("downpaymentAmount")} htmlFor="renewDownpaymentAmount" required>
                <Input
                  id="renewDownpaymentAmount"
                  name="downpaymentAmount"
                  type="number"
                  step="any"
                  min={0}
                  required
                />
              </FormField>
              <FormField label={t("paymentMethod")} htmlFor="renewDownpaymentMethod">
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
                  <SelectTrigger id="renewDownpaymentMethod" className="w-full">
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
            <FormField label={t("startDate")} htmlFor="renewStartDate" required>
              <Input id="renewStartDate" name="startDate" type="date" defaultValue={todayValue} required />
            </FormField>
            <FormField label={t("endDate")} htmlFor="renewEndDate">
              <Input id="renewEndDate" name="endDate" type="date" />
            </FormField>
          </div>

          <FormField label={t("agreementNotes")} htmlFor="renewAgreementNotes">
            <Textarea id="renewAgreementNotes" name="notes" rows={2} />
          </FormField>

          <DialogFooter>
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
