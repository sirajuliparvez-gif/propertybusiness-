"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wallet } from "lucide-react";
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
import { recordGuestStayPayment } from "@/lib/actions/guest-stays";

export function CollectGuestStayPaymentDialog({
  guestStayId,
  propertyId,
  defaultAmount,
  returnTo,
  iconOnly = false,
}: {
  guestStayId: string;
  propertyId: string;
  defaultAmount: number;
  returnTo?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState("NONE");
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const todayValue = new Date().toISOString().slice(0, 10);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={iconOnly ? "icon-sm" : "sm"}
            title={iconOnly ? t("collectPayment") : undefined}
          />
        }
      >
        <Wallet className="size-3.5" />
        {iconOnly ? <span className="sr-only">{t("collectPayment")}</span> : t("collectPayment")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("collectPayment")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => recordGuestStayPayment(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="guestStayId" value={guestStayId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="method" value={method} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <p className="text-sm text-muted-foreground">{t("collectPaymentDesc")}</p>

          <FormField label={t("amount")} htmlFor="guestPaymentAmount" required>
            <Input
              id="guestPaymentAmount"
              name="amount"
              type="number"
              step="any"
              min={0}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>

          <FormField label={t("paymentDate")} htmlFor="guestPaymentDate" required>
            <Input id="guestPaymentDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          <FormField label={t("paymentMethod")} htmlFor="guestPaymentMethod">
            <Select
              value={method}
              onValueChange={(v) => setMethod(v ?? "NONE")}
              items={[
                { value: "NONE", label: t("noPaymentRecord") },
                { value: "CASH", label: t("paymentMethodCash") },
                { value: "BKASH", label: t("paymentMethodBkash") },
                { value: "NAGAD", label: t("paymentMethodNagad") },
                { value: "BANK", label: t("paymentMethodBank") },
                { value: "OTHER", label: t("paymentMethodOther") },
              ]}
            >
              <SelectTrigger id="guestPaymentMethod" className="w-full">
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
