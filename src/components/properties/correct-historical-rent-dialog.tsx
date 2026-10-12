"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarSync, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  correctHistoricalRent,
  type HistoricalRentCorrectionErrorCode,
} from "@/lib/actions/tenant-rent";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { previousPaymentMonth } from "@/lib/payment-month";

export function CorrectHistoricalRentDialog({
  tenantLeaseId,
  leaseStartMonth,
  currentMonthlyRent,
  returnTo,
}: {
  tenantLeaseId: string;
  leaseStartMonth: string;
  currentMonthlyRent: number;
  returnTo: string;
}) {
  const t = useTranslations("Properties");
  const currentMonth = dhakaTodayISO().slice(0, 7);
  const lastMonth = previousPaymentMonth(currentMonth);
  const suggestedMonth = leaseStartMonth > lastMonth ? currentMonth : lastMonth;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<HistoricalRentCorrectionErrorCode | null>(null);
  const errorMessages: Record<HistoricalRentCorrectionErrorCode, string> = {
    missingFields: t("historicalRentErrMissingFields"),
    invalidMonth: t("historicalRentErrInvalidMonth"),
    beforeLeaseStart: t("historicalRentErrBeforeLease"),
    futureMonth: t("historicalRentErrFutureMonth"),
    invalidAmount: t("historicalRentErrInvalidAmount"),
    notFound: t("historicalRentErrNotFound"),
    settledMonths: t("historicalRentErrSettledMonths"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <CalendarSync className="size-3.5" />
        {t("correctHistoricalRent")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("correctHistoricalRent")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await correctHistoricalRent(formData);
              if (!result.ok) setError(result.error);
            })
          }
          className="grid gap-3"
        >
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <p className="text-sm text-muted-foreground">{t("correctHistoricalRentHint")}</p>
          <FormField label={t("historicalRentStartMonth")} htmlFor={`historicalRentMonth-${tenantLeaseId}`} required>
            <Input
              id={`historicalRentMonth-${tenantLeaseId}`}
              name="effectiveMonth"
              type="month"
              min={leaseStartMonth}
              max={currentMonth}
              defaultValue={suggestedMonth}
              required
            />
          </FormField>
          <FormField label={t("correctMonthlyRentAmount")} htmlFor={`historicalRentAmount-${tenantLeaseId}`} required>
            <Input
              id={`historicalRentAmount-${tenantLeaseId}`}
              name="monthlyRentAmount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={currentMonthlyRent > 0 ? currentMonthlyRent : undefined}
              placeholder="15000"
              required
            />
          </FormField>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            {t("correctHistoricalRentSafetyHint")}
          </div>
          {error ? <p className="text-sm text-destructive">{errorMessages[error]}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("saveHistoricalRent")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
