"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus2, Loader2 } from "lucide-react";
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
  createHistoricalRentArrears,
  type RentArrearsCreateErrorCode,
} from "@/lib/actions/tenant-rent";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { formatTaka } from "@/lib/format";
import { paymentMonthRange, previousPaymentMonth } from "@/lib/payment-month";

export function AddRentArrearsDialog({
  tenantLeaseId,
  monthlyDueAmount,
  leaseStartMonth,
  returnTo,
}: {
  tenantLeaseId: string;
  monthlyDueAmount: number;
  leaseStartMonth: string;
  returnTo: string;
}) {
  const t = useTranslations("Properties");
  const lastMonth = previousPaymentMonth(dhakaTodayISO().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [startMonth, setStartMonth] = useState(lastMonth);
  const [endMonth, setEndMonth] = useState(lastMonth);
  const [error, setError] = useState<RentArrearsCreateErrorCode | null>(null);
  const months = useMemo(() => {
    try {
      return paymentMonthRange(startMonth, endMonth, 36);
    } catch {
      return [];
    }
  }, [endMonth, startMonth]);
  const totalDue = monthlyDueAmount * months.length;
  const errorMessages: Record<RentArrearsCreateErrorCode, string> = {
    missingFields: t("rentArrearsErrMissingFields"),
    invalidRange: t("rentArrearsErrInvalidRange"),
    currentOrFutureMonth: t("rentArrearsErrCurrentOrFuture"),
    beforeLeaseStart: t("rentArrearsErrBeforeLease"),
    notFound: t("rentArrearsErrNotFound"),
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
        <CalendarPlus2 className="size-3.5" />
        {t("addOldRentArrears")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addOldRentArrears")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const result = await createHistoricalRentArrears(formData);
              if (!result.ok) setError(result.error);
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("addOldRentArrearsHint")}</p>
          <FormField label={t("arrearsStartMonth")} htmlFor={`arrearsStart-${tenantLeaseId}`} required>
            <Input
              id={`arrearsStart-${tenantLeaseId}`}
              name="startMonth"
              type="month"
              min={leaseStartMonth}
              max={lastMonth}
              required
              value={startMonth}
              onChange={(event) => {
                const value = event.target.value;
                setStartMonth(value);
                if (endMonth < value) setEndMonth(value);
              }}
            />
          </FormField>
          <FormField label={t("arrearsEndMonth")} htmlFor={`arrearsEnd-${tenantLeaseId}`} required>
            <Input
              id={`arrearsEnd-${tenantLeaseId}`}
              name="endMonth"
              type="month"
              min={startMonth || leaseStartMonth}
              max={lastMonth}
              required
              value={endMonth}
              onChange={(event) => setEndMonth(event.target.value)}
            />
          </FormField>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm sm:col-span-2">
            <p className="font-semibold">
              {t("arrearsPreview", { count: months.length, amount: formatTaka(totalDue) })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("arrearsExistingMonthsHint")}</p>
          </div>
          {error ? <p className="text-sm text-destructive sm:col-span-2">{errorMessages[error]}</p> : null}
          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || months.length === 0}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("addArrearsAction", { count: months.length, amount: formatTaka(totalDue) })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
