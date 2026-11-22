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
import { reactivateTenantLease, type ReactivateLeaseErrorCode } from "@/lib/actions/units";

// Undo for a move-out done by mistake.
export function ReactivateLeaseButton({ leaseId, propertyId, tenantName }: { leaseId: string; propertyId: string; tenantName: string }) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ReactivateLeaseErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorMessages: Record<ReactivateLeaseErrorCode, string> = {
    missingFields: t("reactivateLeaseErrMissing"),
    notFound: t("reactivateLeaseErrNotFound"),
    unitOccupied: t("reactivateLeaseErrOccupied"),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Undo2 className="size-3.5" />
        {t("reactivateLease")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reactivateLeaseTitle", { name: tenantName })}</DialogTitle>
          <DialogDescription>{t("reactivateLeaseDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              setError(null);
              const result = await reactivateTenantLease(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(t("reactivateLeaseSuccess"));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          {error ? <p role="alert" className="mb-3 text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              {t("reactivateLease")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
