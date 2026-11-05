"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/properties/form-field";
import { changeTenantRent } from "@/lib/actions/tenants";
import { formatTaka, monthLabel } from "@/lib/format";

export function ChangeTenantRentDialog({ leaseId, currentRent, configuredRent, earliestMonth }: {
  leaseId: string;
  currentRent: number;
  configuredRent: number;
  earliestMonth: string;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <ArrowLeftRight className="size-3.5" />
        {t("changeRent")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changeRent")}</DialogTitle>
          <DialogDescription>{t("changeRentCurrent", { amount: formatTaka(currentRent) })}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" action={(formData) => startTransition(async () => {
          try {
            const result = await changeTenantRent(formData);
            if (!result.ok) {
              toast.error(t(result.error === "month" ? "changeRentMonthError" : "changeRentError"));
              return;
            }
            toast.success(t("changeRentSaved", {
              amount: formatTaka(String(formData.get("monthlyRentAmount"))),
              month: monthLabel(String(formData.get("rentEffectiveMonth")), locale),
            }));
            setOpen(false);
          } catch {
            toast.error(t("changeRentError"));
          }
        })}>
          <input type="hidden" name="leaseId" value={leaseId} />
          <FormField label={t("changeRentAmount")} htmlFor="changeRentAmount" required>
            <Input id="changeRentAmount" name="monthlyRentAmount" type="number" min={0} step="any"
              defaultValue={configuredRent} required />
          </FormField>
          <FormField label={t("rentEffectiveMonth")} htmlFor="changeRentMonth" required>
            <Input id="changeRentMonth" name="rentEffectiveMonth" type="month"
              min={earliestMonth} defaultValue={earliestMonth} required />
          </FormField>
          <p className="text-xs text-muted-foreground">{t("changeRentHint")}</p>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={isPending}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
