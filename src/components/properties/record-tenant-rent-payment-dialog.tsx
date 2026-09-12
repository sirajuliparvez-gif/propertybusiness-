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
import { formatTaka, formatDate } from "@/lib/format";
import {
  recordTenantRentPayment,
  recordAdvanceRentPayment,
  recordOverdueRentPayment,
} from "@/lib/actions/tenant-rent";
import { computeServiceChargeAmount } from "@/lib/service-charge";

type Mode = "cash" | "downpaymentAdjustment" | "advance" | "overdue";
const ADVANCE_MONTH_PRESETS = [3, 6, 12];
const ADVANCE_MONTHS_MIN = 1;
const ADVANCE_MONTHS_MAX = 36;

export type OverdueMonth = {
  month: string;
  dueAmount: number;
  paidAmount: number;
  gap: number;
};

export function RecordTenantRentPaymentDialog({
  propertyId,
  tenantLeaseId,
  monthlyRentAmount,
  currentDownpaymentBalance,
  serviceChargeType = null,
  serviceChargeValue = null,
  overdueMonths = [],
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
  // Every month this lease still owes something for, oldest first — real
  // RentPayment rows AND months nobody ever recorded (see rent-ledger.ts).
  // Powers the "Settle Overdue" tab's breakdown and its oldest-first payoff.
  overdueMonths?: OverdueMonth[];
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
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthsCount, setMonthsCount] = useState("3");
  const totalOverdueAmount = overdueMonths.reduce((sum, m) => sum + m.gap, 0);
  const [overdueAmount, setOverdueAmount] = useState(String(totalOverdueAmount || ""));
  const todayValue = new Date().toISOString().slice(0, 10);
  const serviceChargeAmount = computeServiceChargeAmount(monthlyRentAmount, serviceChargeType, serviceChargeValue);
  const advanceTotal = (monthlyRentAmount + serviceChargeAmount) * (Number(monthsCount) || 0);

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
          action={(formData: FormData) =>
            startTransition(() =>
              mode === "advance"
                ? recordAdvanceRentPayment(formData)
                : mode === "overdue"
                  ? recordOverdueRentPayment(formData)
                  : recordTenantRentPayment(formData)
            )
          }
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="method" value={mode !== "downpaymentAdjustment" ? method : ""} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <FormField label={t("paymentMode")} htmlFor="rentPaymentModeTabs">
            <Tabs value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
              <TabsList className="h-8 w-full flex-wrap">
                <TabsTrigger value="cash" className="flex-1 text-xs">
                  {t("cashPayment")}
                </TabsTrigger>
                {overdueMonths.length > 0 ? (
                  <TabsTrigger value="overdue" className="flex-1 text-xs">
                    {t("settleOverdue")}
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="advance" className="flex-1 text-xs">
                  {t("advanceRentPayment")}
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

          {mode === "overdue" ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {t("overdueMonthsHint", { count: overdueMonths.length, total: formatTaka(totalOverdueAmount) })}
              </p>
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                {overdueMonths.map((m) => (
                  <li key={m.month} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{formatDate(new Date(`${m.month}-01`))}</span>
                    <span className="font-mono font-medium tabular-nums text-destructive">
                      {formatTaka(m.gap)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("overdueOldestFirstHint")}</p>
            </div>
          ) : null}

          {mode === "advance" ? (
            <>
              <FormField label={t("advanceStartMonth")} htmlFor="rentAdvanceStartMonth" required>
                <Input
                  id="rentAdvanceStartMonth"
                  name="startMonth"
                  type="month"
                  required
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                />
              </FormField>

              <FormField label={t("advanceMonthsCount")} htmlFor="rentAdvanceMonthsCount" required>
                <Input
                  id="rentAdvanceMonthsCount"
                  name="monthsCount"
                  type="number"
                  min={ADVANCE_MONTHS_MIN}
                  max={ADVANCE_MONTHS_MAX}
                  required
                  value={monthsCount}
                  onChange={(e) => setMonthsCount(e.target.value)}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ADVANCE_MONTH_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMonthsCount(String(n))}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        Number(monthsCount) === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t("advanceMonthsPreset", { count: n })}
                    </button>
                  ))}
                </div>
              </FormField>

              <p className="text-xs text-muted-foreground">
                {t("advanceTotalHint", { total: formatTaka(advanceTotal) })}
              </p>
            </>
          ) : mode === "overdue" ? (
            <FormField label={t("amount")} htmlFor="rentOverdueAmount" required>
              <Input
                id="rentOverdueAmount"
                name="amount"
                type="number"
                step="any"
                min={0}
                max={totalOverdueAmount}
                required
                value={overdueAmount}
                onChange={(e) => setOverdueAmount(e.target.value)}
              />
            </FormField>
          ) : (
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
          )}

          <FormField label={t("paymentDate")} htmlFor="rentPaymentDate" required>
            <Input id="rentPaymentDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          {mode !== "downpaymentAdjustment" ? (
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
