"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatTaka } from "@/lib/format";
import { recordTenantRentPayment } from "@/lib/actions/tenant-rent";
import { computeServiceChargeAmount } from "@/lib/service-charge";

type Mode = "cash" | "downpaymentAdjustment";

export function RecordTenantRentPaymentDialog({
  propertyId,
  tenantLeaseId,
  monthlyRentAmount,
  currentDownpaymentBalance,
  serviceChargeType = null,
  serviceChargeValue = null,
  returnTo,
  iconOnly = false,
  variant = "button",
  rowContent,
}: {
  propertyId: string;
  tenantLeaseId: string;
  monthlyRentAmount: number;
  currentDownpaymentBalance: number;
  serviceChargeType?: "FLAT" | "PERCENTAGE" | null;
  serviceChargeValue?: number | null;
  returnTo?: string;
  // Table rows need the button to just be an icon (hover reveals the label
  // via the native `title` tooltip) so the actions column doesn't force the
  // whole table wider — this codebase doesn't use a Tooltip primitive
  // anywhere (EmployeeActions set that precedent), so `title` + `sr-only`
  // text is the established way to keep a hover label without one.
  iconOnly?: boolean;
  // "row": the whole trigger becomes a full-width tappable row (mobile list
  // pattern) rendering `rowContent` instead of the button label — the dialog
  // body/behavior stays identical either way.
  variant?: "button" | "row";
  rowContent?: React.ReactNode;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("cash");
  const [method, setMethod] = useState("NONE");
  const [amount, setAmount] = useState(String(monthlyRentAmount || ""));
  const todayValue = new Date().toISOString().slice(0, 10);
  const serviceChargeAmount = computeServiceChargeAmount(monthlyRentAmount, serviceChargeType, serviceChargeValue);

  function handleModeChange(next: Mode) {
    setMode(next);
    setAmount(
      next === "downpaymentAdjustment"
        ? String(Math.min(monthlyRentAmount, currentDownpaymentBalance))
        : String(monthlyRentAmount || "")
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          variant === "row" ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60"
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size={iconOnly ? "icon-sm" : "sm"}
              title={iconOnly ? t("collectRent") : undefined}
            />
          )
        }
      >
        {variant === "row" ? (
          rowContent
        ) : (
          <>
            <Wallet className="size-3.5" />
            {iconOnly ? <span className="sr-only">{t("collectRent")}</span> : t("collectRent")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("collectRent")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => recordTenantRentPayment(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="method" value={mode === "cash" ? method : ""} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <FormField label={t("paymentMode")} htmlFor="rentPaymentModeTabs">
            <Tabs value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
              <TabsList className="h-8 w-full">
                <TabsTrigger value="cash" className="flex-1 text-xs">
                  {t("cashPayment")}
                </TabsTrigger>
                <TabsTrigger value="downpaymentAdjustment" className="flex-1 text-xs">
                  {t("adjustFromDownpayment")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </FormField>

          {mode === "downpaymentAdjustment" ? (
            <p className="text-xs text-muted-foreground">
              {t("availableDownpaymentBalance")}: {formatTaka(currentDownpaymentBalance)}
            </p>
          ) : null}

          <FormField label={t("amount")} htmlFor="rentPaymentAmount" required>
            <Input
              id="rentPaymentAmount"
              name="amount"
              type="number"
              step="any"
              min={0}
              max={mode === "downpaymentAdjustment" ? currentDownpaymentBalance : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {mode === "cash" && serviceChargeAmount > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("serviceChargeBundledHint", {
                  amount: formatTaka(serviceChargeAmount),
                  total: formatTaka(Number(amount || 0) + serviceChargeAmount),
                })}
              </p>
            ) : null}
          </FormField>

          <FormField label={t("paymentDate")} htmlFor="rentPaymentDate" required>
            <Input id="rentPaymentDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          {mode === "cash" ? (
            <FormField label={t("paymentMethod")} htmlFor="rentPaymentMethod">
              <Select
                value={method}
                onValueChange={(v) => setMethod(v ?? "NONE")}
                items={[
                  { value: "NONE", label: t("noPaymentRecord") },
                  { value: "CASH", label: t("paymentMethodCash") },
                  { value: "BKASH", label: t("paymentMethodBkash") },
                  { value: "NAGAD", label: t("paymentMethodNagad") },
                  { value: "BANK", label: t("paymentMethodBank") },
                  { value: "OTHER", label: t("paymentMethodOther") },
                ]}
              >
                <SelectTrigger id="rentPaymentMethod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">{t("noPaymentRecord")}</SelectItem>
                  <SelectItem value="CASH">{t("paymentMethodCash")}</SelectItem>
                  <SelectItem value="BKASH">{t("paymentMethodBkash")}</SelectItem>
                  <SelectItem value="NAGAD">{t("paymentMethodNagad")}</SelectItem>
                  <SelectItem value="BANK">{t("paymentMethodBank")}</SelectItem>
                  <SelectItem value="OTHER">{t("paymentMethodOther")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <FormField label={t("notes")} htmlFor="rentPaymentNotes">
              <Input id="rentPaymentNotes" name="notes" />
            </FormField>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
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
