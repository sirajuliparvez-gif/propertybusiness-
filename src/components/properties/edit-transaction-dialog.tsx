"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FilePenLine, Loader2 } from "lucide-react";
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
import { dhakaISO } from "@/lib/dhaka-time";
import {
  updateManualTransaction,
  type TransactionEditErrorCode,
} from "@/lib/actions/transactions";

type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK" | "BANK_CHECK" | "OTHER";

export function EditTransactionDialog({
  transaction,
  compact = false,
}: {
  transaction: {
    id: string;
    amount: number;
    date: Date | string;
    method: PaymentMethod | null;
    notes: string | null;
  };
  compact?: boolean;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<PaymentMethod | "NONE">(transaction.method ?? "NONE");
  const [error, setError] = useState<TransactionEditErrorCode | null>(null);

  const errorMessages: Record<TransactionEditErrorCode, string> = {
    missingFields: t("transactionEditErrMissingFields"),
    invalidAmount: t("transactionEditErrInvalidAmount"),
    invalidDate: t("transactionEditErrInvalidDate"),
    notFound: t("transactionEditErrNotFound"),
    notEditable: t("transactionEditErrNotEditable"),
  };
  const options: { value: PaymentMethod | "NONE"; label: string }[] = [
    { value: "NONE", label: t("noPaymentRecord") },
    { value: "CASH", label: t("paymentMethodCash") },
    { value: "BKASH", label: t("paymentMethodBkash") },
    { value: "NAGAD", label: t("paymentMethodNagad") },
    { value: "BANK", label: t("paymentMethodBank") },
    { value: "BANK_CHECK", label: t("paymentMethodBankCheck") },
    { value: "OTHER", label: t("paymentMethodOther") },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon-sm" : "sm"}
            title={t("editTransaction")}
            aria-label={t("editTransaction")}
          />
        }
      >
        <FilePenLine className="size-3.5" />
        {compact ? null : t("edit")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTransaction")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await updateManualTransaction(formData);
              if (result.ok) {
                setOpen(false);
              } else {
                setError(result.error);
              }
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input type="hidden" name="method" value={method} />

          <p className="text-sm text-muted-foreground sm:col-span-2">
            {t("editTransactionHint")}
          </p>
          <FormField label={t("amount")} htmlFor={`transactionAmount-${transaction.id}`} required>
            <Input
              id={`transactionAmount-${transaction.id}`}
              name="amount"
              type="number"
              step="any"
              min={0.01}
              defaultValue={transaction.amount}
              required
            />
          </FormField>
          <FormField label={t("date")} htmlFor={`transactionDate-${transaction.id}`} required>
            <Input
              id={`transactionDate-${transaction.id}`}
              name="date"
              type="date"
              defaultValue={dhakaISO(transaction.date)}
              required
            />
          </FormField>
          <FormField
            label={t("paymentMethod")}
            htmlFor={`transactionMethod-${transaction.id}`}
            className="sm:col-span-2"
          >
            <Select
              value={method}
              onValueChange={(value) => setMethod((value ?? "NONE") as PaymentMethod | "NONE")}
              items={options}
            >
              <SelectTrigger id={`transactionMethod-${transaction.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={t("transactionDescription")}
            htmlFor={`transactionNotes-${transaction.id}`}
            required
            className="sm:col-span-2"
          >
            <Textarea
              id={`transactionNotes-${transaction.id}`}
              name="notes"
              rows={3}
              defaultValue={transaction.notes ?? ""}
              required
            />
          </FormField>

          {error ? <p className="text-sm text-destructive sm:col-span-2">{errorMessages[error]}</p> : null}
          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
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

