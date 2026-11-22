"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
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
  reverseSalaryPayment,
  reverseUtilityPayment,
  type PaymentReversalErrorCode,
} from "@/lib/actions/payment-reversal";

// Admin-only undo for a mistaken salary or utility payment. The payment entry is deleted and
// the salary month / bill shows as owed again.
export function ReversePaymentButton({ transactionId, kind }: { transactionId: string; kind: "salary" | "utility" }) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<PaymentReversalErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorMessages: Record<PaymentReversalErrorCode, string> = {
    missingFields: t("reversePaymentErrMissing"),
    notFound: t("reversePaymentErrNotFound"),
    notReversible: t("reversePaymentErrNotReversible"),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={t("reversePayment")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Undo2 className="size-3.5" />
        {t("reversePayment")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reversePaymentTitle")}</DialogTitle>
          <DialogDescription>{t(kind === "salary" ? "reversePaymentSalaryDesc" : "reversePaymentUtilityDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              setError(null);
              const result = await (kind === "salary" ? reverseSalaryPayment(formData) : reverseUtilityPayment(formData));
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(t("reversePaymentSuccess"));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <input type="hidden" name="transactionId" value={transactionId} />
          {error ? <p role="alert" className="mb-3 text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>{t("cancel")}</DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              {t("reversePayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
