"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  deleteTenantRentPayment,
  type RentPaymentDeleteErrorCode,
} from "@/lib/actions/tenant-rent";

export function DeleteRentPaymentButton({
  paymentId,
  month,
  tenantLeaseId,
  returnTo,
}: {
  paymentId: string;
  month: string;
  tenantLeaseId: string;
  returnTo: string;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<RentPaymentDeleteErrorCode | null>(null);
  const errorMessages: Record<RentPaymentDeleteErrorCode, string> = {
    missingFields: t("rentPaymentEditErrMissingFields"),
    notFound: t("rentPaymentEditErrNotFound"),
    notEditable: t("rentPaymentDeleteErrNotEditable"),
  };

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
            variant="ghost"
            size="icon-sm"
            title={t("deleteRentPayment")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">{t("deleteRentPayment")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmDeleteRentPaymentTitle")}</DialogTitle>
          <DialogDescription>{t("confirmDeleteRentPaymentDesc", { month })}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await deleteTenantRentPayment(formData);
              if (!result.ok) setError(result.error);
            })
          }
        >
          <input type="hidden" name="rentPaymentId" value={paymentId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {error ? <p className="mb-3 text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t("deleteRentPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
