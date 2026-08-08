"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserMinus } from "lucide-react";
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
import { FormField } from "@/components/properties/form-field";
import { formatTaka } from "@/lib/format";
import { vacateTenantLease } from "@/lib/actions/units";

export function VacateTenantDialog({
  leaseId,
  propertyId,
  tenantName,
  currentDownpaymentBalance,
  returnTo,
  iconOnly = false,
}: {
  leaseId: string;
  propertyId: string;
  tenantName: string;
  currentDownpaymentBalance: number;
  returnTo?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [refundMethod, setRefundMethod] = useState("NONE");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={iconOnly ? "icon-sm" : "sm"}
            className="text-destructive hover:text-destructive"
            title={iconOnly ? t("vacateTenant") : undefined}
          />
        }
      >
        <UserMinus className="size-3.5" />
        {iconOnly ? <span className="sr-only">{t("vacateTenant")}</span> : t("vacateTenant")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("vacateTenant")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => vacateTenantLease(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="refundMethod" value={refundMethod} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <p className="text-sm font-medium text-destructive">
            {t("vacateTenantConfirm", { name: tenantName })}
          </p>
          <p className="text-xs text-muted-foreground">{t("vacateTenantConfirmHint")}</p>

          {currentDownpaymentBalance > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("refundAmount")} htmlFor="vacateRefundAmount">
                <Input
                  id="vacateRefundAmount"
                  name="refundAmount"
                  type="number"
                  step="any"
                  min={0}
                  max={currentDownpaymentBalance}
                  defaultValue={currentDownpaymentBalance}
                />
              </FormField>
              <FormField label={t("paymentMethod")} htmlFor="vacateRefundMethod">
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
                  <SelectTrigger id="vacateRefundMethod" className="w-full">
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
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("refundHint")}</p>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-3.5" />}
              {t("confirmVacate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
