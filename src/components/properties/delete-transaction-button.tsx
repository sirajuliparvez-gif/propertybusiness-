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
  deleteManualTransaction,
  type TransactionDeleteErrorCode,
} from "@/lib/actions/transactions";

export function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
  const t = useTranslations("Properties");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<TransactionDeleteErrorCode | null>(null);
  const errorMessages: Record<TransactionDeleteErrorCode, string> = {
    missingFields: t("transactionDeleteErrMissingFields"),
    notFound: t("transactionDeleteErrNotFound"),
    notEditable: t("transactionDeleteErrNotEditable"),
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
            title={t("deleteTransaction")}
            aria-label={t("deleteTransaction")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmDeleteTransactionTitle")}</DialogTitle>
          <DialogDescription>{t("confirmDeleteTransactionDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await deleteManualTransaction(formData);
              if (result.ok) {
                setOpen(false);
              } else {
                setError(result.error);
              }
            })
          }
        >
          <input type="hidden" name="transactionId" value={transactionId} />
          {error ? <p className="mb-3 text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t("deleteTransaction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

