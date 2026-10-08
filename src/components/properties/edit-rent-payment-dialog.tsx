"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
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
import { dhakaISO } from "@/lib/dhaka-time";
import {
  updateTenantRentPayment,
  type RentPaymentEditErrorCode,
} from "@/lib/actions/tenant-rent";

type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK" | "BANK_CHECK" | "OTHER";

export function EditRentPaymentDialog({
  payment,
  tenantLeaseId,
  returnTo,
}: {
  payment: {
    id: string;
    month: string;
    amount: number;
    dueAmount: number;
    date: Date | string;
    method: PaymentMethod | null;
  };
  tenantLeaseId: string;
  returnTo: string;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<PaymentMethod | "NONE">(payment.method ?? "NONE");
  const [error, setError] = useState<RentPaymentEditErrorCode | null>(null);

  const errorMessages: Record<RentPaymentEditErrorCode, string> = {
    missingFields: t("rentPaymentEditErrMissingFields"),
    notFound: t("rentPaymentEditErrNotFound"),
    notEditable: t("rentPaymentEditErrNotEditable"),
    invalidAmount: t("rentPaymentEditErrInvalidAmount"),
    amountExceedsDue: t("rentPaymentEditErrAmountExceedsDue"),
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
        render={<Button type="button" variant="outline" size="icon-sm" title={t("editRentPayment")} />}
      >
        <Pencil className="size-3.5" />
        <span className="sr-only">{t("editRentPayment")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editRentPayment")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await updateTenantRentPayment(formData);
              if (!result.ok) setError(result.error);
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="rentPaymentId" value={payment.id} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="method" value={method} />

          <p className="text-sm text-muted-foreground sm:col-span-2">
            {t("editRentPaymentHint", { month: payment.month })}
          </p>
          <FormField label={t("amount")} htmlFor={`editRentAmount-${payment.id}`} required>
            <Input
              id={`editRentAmount-${payment.id}`}
              name="amount"
              type="number"
              step="any"
              min={0.01}
              max={payment.dueAmount}
              defaultValue={payment.amount}
              required
            />
          </FormField>
          <FormField label={t("paymentDate")} htmlFor={`editRentDate-${payment.id}`} required>
            <Input
              id={`editRentDate-${payment.id}`}
              name="date"
              type="date"
              defaultValue={dhakaISO(payment.date)}
              required
            />
          </FormField>
          <FormField label={t("paymentMethod")} htmlFor={`editRentMethod-${payment.id}`} className="sm:col-span-2">
            <Select
              value={method}
              onValueChange={(value) => setMethod((value ?? "NONE") as PaymentMethod | "NONE")}
              items={options}
            >
              <SelectTrigger id={`editRentMethod-${payment.id}`} className="w-full">
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
