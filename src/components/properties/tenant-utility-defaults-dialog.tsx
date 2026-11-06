"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { saveTenantUtilityBillDefaults } from "@/lib/actions/utility-bills";
import { type UtilityBillDefault, utilityBillTypes } from "@/lib/utility-bill-defaults";

export function TenantUtilityDefaultsDialog({ leaseId, defaults }: { leaseId: string; defaults: UtilityBillDefault[] }) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const labels = {
    ELECTRICITY: t("utilityTypeElectricity"),
    GAS: t("utilityTypeGas"),
    WATER: t("utilityTypeWater"),
    OTHER: t("utilityTypeOther"),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{t("utilityDefaultsTitle")}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("utilityDefaultsTitle")}</DialogTitle>
          <DialogDescription>{t("utilityDefaultsDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              if (await saveTenantUtilityBillDefaults(leaseId, data)) {
                toast.success(t("utilityDefaultsSaved"));
                setOpen(false);
                router.refresh();
                return;
              }
            } catch {
              // Keep the entries available so the user can retry.
            }
            toast.error(t("utilityDefaultsSaveFailed"));
          });
        }}>
          <fieldset disabled={pending} className="space-y-3">
            {utilityBillTypes.map((type) => {
              const saved = defaults.find((item) => item.type === type);
              return (
                <div key={type} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-md border p-3">
                  <p className="col-span-2 font-medium">{labels[type]}</p>
                  <select className="h-8 min-w-0 rounded-md border bg-background px-1 text-sm"
                    aria-label={`${labels[type]} · ${t("utilityDefaultsPayer")}`}
                    name={`payer-${type}`} disabled={type === "WATER"}
                    defaultValue={type === "WATER" || saved?.paidByCompany === true ? "company"
                      : saved?.paidByCompany === false ? "tenant" : ""}>
                    <option value="">{t("utilityDefaultsChooseOnBill")}</option>
                    <option value="company">{t("utilityDefaultsCompanyPays")}</option>
                    <option value="tenant">{t("utilityDefaultsTenantPays")}</option>
                  </select>
                  <Input name={`amount-${type}`} type="number" min="0.01" step="0.01" max="999999999999.99"
                    aria-label={`${labels[type]} · ${t("utilityDefaultAmount")}`}
                    placeholder={t("utilityDefaultAmount")} defaultValue={saved?.amount ?? ""} />
                </div>
              );
            })}
            <div className="flex justify-end">
              <Button type="submit">{t("utilityDefaultsSave")}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
