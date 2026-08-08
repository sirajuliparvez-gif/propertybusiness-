"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, FileX } from "lucide-react";
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
import { endLeaseAgreement } from "@/lib/actions/owner-lease";

export function EndLeaseAgreementButton({
  agreementId,
  propertyId,
  downpaymentAmount,
}: {
  agreementId: string;
  propertyId: string;
  downpaymentAmount?: number | null;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [refundMethod, setRefundMethod] = useState("NONE");
  const hasDownpayment = !!downpaymentAmount && downpaymentAmount > 0;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive" />}>
        <FileX className="size-3.5" />
        {t("endLease")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmEndLeaseTitle")}</DialogTitle>
          <DialogDescription>{t("confirmEndLeaseDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => endLeaseAgreement(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="agreementId" value={agreementId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="refundMethod" value={refundMethod} />

          {hasDownpayment ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("refundAmount")} htmlFor="ownerRefundAmount">
                <Input
                  id="ownerRefundAmount"
                  name="refundAmount"
                  type="number"
                  step="any"
                  min={0}
                  max={downpaymentAmount ?? undefined}
                  defaultValue={downpaymentAmount ?? undefined}
                />
              </FormField>
              <FormField label={t("paymentMethod")} htmlFor="ownerRefundMethod">
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
                  <SelectTrigger id="ownerRefundMethod" className="w-full">
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
                {t("ownerRefundHint")}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("endLease")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
