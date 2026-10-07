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
import { deleteUtilityBill, type UtilityBillErrorCode } from "@/lib/actions/utility-bills";
import { formatTaka } from "@/lib/format";

// Deleting a bill is offered on every unpaid row; a bill that already has
// money recorded against it refuses inside this dialog (with how much has
// been collected) rather than letting the ledger lose that history.
export function DeleteUtilityBillButton({
  billId,
  propertyId,
  paidAmount,
  returnTo,
}: {
  billId: string;
  propertyId: string;
  paidAmount: number;
  returnTo: string;
}) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<UtilityBillErrorCode | null>(null);

  const errorMessages: Record<UtilityBillErrorCode, string> = {
    missingFields: t("billErrMissingFields"),
    notFound: t("billErrNotFound"),
    unitNotInProperty: t("billErrUnitNotInProperty"),
    amountBelowPaid: t("billErrAmountBelowPaid", { amount: formatTaka(paidAmount) }),
    hasPayments: t("billErrHasPayments", { amount: formatTaka(paidAmount) }),
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
            title={t("delete")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">{t("delete")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmDeleteBillTitle")}</DialogTitle>
          <DialogDescription>{t("confirmDeleteBillDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const res = await deleteUtilityBill(formData);
              if (!res.ok) setError(res.error);
            })
          }
        >
          <input type="hidden" name="billId" value={billId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {error ? <p className="mb-3 text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("delete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
