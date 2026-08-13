"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, HandCoins } from "lucide-react";
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
import { recordOwnerWithdrawal } from "@/lib/actions/owner-withdrawal";

const NONE_VALUE = "NONE";

export function AddOwnerWithdrawalDialogGlobal() {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState(NONE_VALUE);
  const todayValue = new Date().toISOString().slice(0, 10);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <HandCoins className="size-3.5" />
        {t("addOwnerWithdrawal")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addOwnerWithdrawal")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => recordOwnerWithdrawal(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="method" value={method} />
          <input type="hidden" name="returnTo" value="/transactions" />

          <FormField label={t("withdrawalRecipient")} htmlFor="withdrawalRecipient" required className="sm:col-span-2">
            <Input id="withdrawalRecipient" name="recipientName" required placeholder={t("withdrawalRecipientPlaceholder")} />
          </FormField>

          <FormField label={t("amount")} htmlFor="withdrawalAmount" required>
            <Input id="withdrawalAmount" name="amount" type="number" step="any" min={0} required />
          </FormField>
          <FormField label={t("date")} htmlFor="withdrawalDate" required>
            <Input id="withdrawalDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          <FormField label={t("paymentMethod")} htmlFor="withdrawalMethod">
            <Select
              value={method}
              onValueChange={(v) => setMethod(v ?? NONE_VALUE)}
              items={[
                { value: NONE_VALUE, label: t("noPaymentRecord") },
                { value: "CASH", label: t("paymentMethodCash") },
                { value: "BKASH", label: t("paymentMethodBkash") },
                { value: "NAGAD", label: t("paymentMethodNagad") },
                { value: "BANK", label: t("paymentMethodBank") },
                { value: "OTHER", label: t("paymentMethodOther") },
              ]}
            >
              <SelectTrigger id="withdrawalMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t("noPaymentRecord")}</SelectItem>
                <SelectItem value="CASH">{t("paymentMethodCash")}</SelectItem>
                <SelectItem value="BKASH">{t("paymentMethodBkash")}</SelectItem>
                <SelectItem value="NAGAD">{t("paymentMethodNagad")}</SelectItem>
                <SelectItem value="BANK">{t("paymentMethodBank")}</SelectItem>
                <SelectItem value="OTHER">{t("paymentMethodOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("note")} htmlFor="withdrawalNotes" className="sm:col-span-2">
            <Textarea id="withdrawalNotes" name="notes" rows={2} />
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
