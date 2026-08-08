"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/properties/form-field";
import { checkOutGuestStay } from "@/lib/actions/guest-stays";

export function CheckoutGuestStayDialog({
  guestStayId,
  propertyId,
  depositAmount,
  returnTo,
  iconOnly = false,
}: {
  guestStayId: string;
  propertyId: string;
  depositAmount: number | null;
  returnTo?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [refundMethod, setRefundMethod] = useState("NONE");
  const hasDeposit = !!depositAmount && depositAmount > 0;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={iconOnly ? "icon-sm" : "sm"}
            title={iconOnly ? t("checkOutAction") : undefined}
          />
        }
      >
        <LogOut className="size-3.5" />
        {iconOnly ? <span className="sr-only">{t("checkOutAction")}</span> : t("checkOutAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmCheckOutTitle")}</DialogTitle>
          <DialogDescription>{t("confirmCheckOutDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => checkOutGuestStay(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="guestStayId" value={guestStayId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="refundMethod" value={refundMethod} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          {hasDeposit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("depositRefundAmount")} htmlFor="guestDepositRefundAmount">
                <Input
                  id="guestDepositRefundAmount"
                  name="refundAmount"
                  type="number"
                  step="any"
                  min={0}
                  max={depositAmount ?? undefined}
                  defaultValue={depositAmount ?? undefined}
                />
              </FormField>
              <FormField label={t("paymentMethod")} htmlFor="guestDepositRefundMethod">
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
                  <SelectTrigger id="guestDepositRefundMethod" className="w-full">
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
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("depositRefundHint")}</p>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("checkOutAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
