"use client";

import { dhakaTodayISO } from "@/lib/dhaka-time";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { formatTaka, monthLabel } from "@/lib/format";
import {
  recordTenantRentPayment,
  recordAdvanceRentPayment,
  recordOverdueRentPayment,
} from "@/lib/actions/tenant-rent";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { allocateRentPayment } from "@/lib/rent-ledger";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { rentTermsDueAmount, resolveRentTermsForMonth, type EffectiveRentTerms } from "@/lib/rent-terms";

type Mode = "cash" | "downpaymentAdjustment" | "advance" | "overdue";
const ADVANCE_MONTH_PRESETS = [3, 6, 12];
const ADVANCE_MONTHS_MIN = 1;
const ADVANCE_MONTHS_MAX = 36;

export type OverdueMonth = {
  month: string;
  gap: number;
};

export function RecordTenantRentPaymentDialog({
  propertyId,
  tenantLeaseId,
  tenantName,
  propertyName,
  unitLabel,
  monthlyRentAmount = 0,
  currentDownpaymentBalance = 0,
  serviceChargeType = null,
  serviceChargeValue = null,
  rentRates = [],
  paymentProgress = [],
  overdueMonths = [],
  monthSettled = false,
  returnTo,
  iconOnly = false,
  variant = "button",
  rowContent,
  initialBillingMonth,
  triggerLabel,
  arrearsPeriod,
}: {
  propertyId: string;
  tenantLeaseId: string;
  tenantName?: string;
  propertyName?: string;
  unitLabel?: string;
  monthlyRentAmount?: number;
  currentDownpaymentBalance?: number;
  serviceChargeType?: "FLAT" | "PERCENTAGE" | null;
  serviceChargeValue?: number | null;
  rentRates?: EffectiveRentTerms[];
  paymentProgress?: { month: string; dueAmount: number; paidAmount: number }[];
  // Every month this lease still owes something for, oldest first — real
  // RentPayment rows AND months nobody ever recorded (see rent-ledger.ts).
  // Powers the "Settle Overdue" tab's breakdown and its oldest-first payoff.
  overdueMonths?: OverdueMonth[];
  // This month is already fully paid. Advance remains the initial mode, but
  // cash/downpayment stay available because the user can select an older
  // billing month; the server still refuses duplicates for the chosen month.
  monthSettled?: boolean;
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
  initialBillingMonth?: string;
  triggerLabel?: string;
  arrearsPeriod?: { from: string; to: string };
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const todayValue = dhakaTodayISO();
  const [mode, setMode] = useState<Mode>(arrearsPeriod ? "overdue" : monthSettled && !initialBillingMonth ? "advance" : "cash");
  const [method, setMethod] = useState("NONE");
  const [billingMonth, setBillingMonth] = useState(initialBillingMonth ?? todayValue.slice(0, 7));
  const fallbackTerms = { monthlyRentAmount, serviceChargeType, serviceChargeValue };
  const termsForMonth = (month: string) => resolveRentTermsForMonth(fallbackTerms, rentRates, month);
  const dueForMonth = (month: string) => rentTermsDueAmount(termsForMonth(month));
  const selectedTerms = termsForMonth(billingMonth);
  const serviceChargeAmount = computeServiceChargeAmount(
    selectedTerms.monthlyRentAmount,
    selectedTerms.serviceChargeType,
    selectedTerms.serviceChargeValue
  );
  // "Rent due" is rent + service charge bundled as one figure — see the
  // matching note in actions/tenant-rent.ts.
  const dueAmount = dueForMonth(billingMonth);
  const remainingForMonth = (month: string) => {
    const recorded = paymentProgress.find((payment) => payment.month === month);
    return recorded ? Math.max(0, recorded.dueAmount - recorded.paidAmount) : dueForMonth(month);
  };
  const [amount, setAmount] = useState(String(remainingForMonth(billingMonth) || ""));
  const [startMonth, setStartMonth] = useState(todayValue.slice(0, 7));
  const [monthsCount, setMonthsCount] = useState("3");
  const totalOverdueAmount = overdueMonths.reduce((sum, m) => sum + m.gap, 0);
  const [overdueAmount, setOverdueAmount] = useState(String(totalOverdueAmount || ""));
  const overdueValue = Number(overdueAmount);
  const validOverdueAmount = Number.isFinite(overdueValue) && overdueValue > 0 && overdueValue <= totalOverdueAmount;
  const allocations = mode === "overdue" && validOverdueAmount ? allocateRentPayment(overdueMonths, overdueValue) : [];
  const advanceTotal = Array.from({ length: Number(monthsCount) || 0 }, (_, index) => {
    const [year, monthNumber] = startMonth.split("-").map(Number);
    const date = new Date(year, monthNumber - 1 + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return remainingForMonth(month);
  }).reduce((sum, value) => sum + value, 0);
  const actionMonth = mode === "advance" ? startMonth : billingMonth;
  const actionAmount =
    mode === "advance" ? advanceTotal : mode === "overdue" ? Number(overdueAmount) : Number(amount);
  const dialogTitle =
    mode === "advance" ? t("advanceRentPayment") : mode === "overdue" ? (arrearsPeriod ? triggerLabel ?? t("settleOverdue") : t("settleOverdue")) : t("collectRent");
  const submitLabel =
    mode === "advance"
      ? t("recordAdvanceRentAction", { count: Number(monthsCount) || 0, amount: formatTaka(actionAmount || 0) })
      : mode === "overdue"
        ? t("recordOverdueRentAction", { amount: formatTaka(actionAmount || 0) })
        : t("recordRentAction", {
            month: monthLabel(actionMonth, locale),
            amount: formatTaka(actionAmount || 0),
          });

  function handleModeChange(next: Mode) {
    setMode(next);
    setAmount(
      next === "downpaymentAdjustment"
        ? String(Math.min(dueAmount, currentDownpaymentBalance))
        : String(remainingForMonth(billingMonth) || "")
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          variant === "row" ? (
            <button
              type="button"
              aria-label={triggerLabel ?? t("collectRent")}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60"
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size={iconOnly ? "icon-sm" : "sm"}
              title={iconOnly ? (triggerLabel ?? t("collectRent")) : undefined}
            />
          )
        }
      >
        {variant === "row" ? (
          rowContent
        ) : (
          <>
            <Wallet className="size-3.5" />
            {iconOnly ? (
              <span className="sr-only">{triggerLabel ?? t("collectRent")}</span>
            ) : (
              triggerLabel ?? t("collectRent")
            )}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        {tenantName ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
            <p className="font-semibold">{tenantName}</p>
            <p className="text-xs text-muted-foreground">
              {[propertyName, unitLabel ? t("unitWithValue", { unit: unitLabel }) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-1 text-xs font-medium text-foreground">
              {mode === "overdue" ? dialogTitle : monthLabel(actionMonth, locale)} · {formatTaka(actionAmount || 0)}
            </p>
          </div>
        ) : null}
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              if (mode === "overdue") {
                const result = await recordOverdueRentPayment(formData);
                if (result?.reason === "changed") {
                  toast.error(t("overdueBalanceChanged"));
                  router.refresh();
                } else if (result?.reason === "invalid") {
                  toast.error(t("overdueInvalidPayment"));
                }
              } else if (mode === "advance") {
                await recordAdvanceRentPayment(formData);
              } else {
                await recordTenantRentPayment(formData);
              }
            })
          }
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="method" value={mode !== "downpaymentAdjustment" ? method : ""} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          {mode === "overdue" ? <input type="hidden" name="rentAllocation" value={JSON.stringify(allocations)} /> : null}
          {arrearsPeriod ? <>
            <input type="hidden" name="arrearsFrom" value={arrearsPeriod.from} />
            <input type="hidden" name="arrearsTo" value={arrearsPeriod.to} />
          </> : <FormField label={t("paymentMode")} htmlFor="rentPaymentModeTabs">
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
                {currentDownpaymentBalance > 0 ? (
                  <TabsTrigger value="downpaymentAdjustment" className="flex-1 text-xs">
                    {t("adjustFromDownpayment")}
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </Tabs>
          </FormField>}

          {mode === "downpaymentAdjustment" ? (
            <p className="text-xs text-muted-foreground">
              {t("availableDownpaymentBalance")}: {formatTaka(currentDownpaymentBalance)}
            </p>
          ) : null}

          {mode === "cash" || mode === "downpaymentAdjustment" ? (
            <FormField label={t("billingMonth")} htmlFor="rentBillingMonth" required>
              <Input
                id="rentBillingMonth"
                name="billingMonth"
                type="month"
                max={todayValue.slice(0, 7)}
                required
                value={billingMonth}
                onChange={(e) => {
                  setBillingMonth(e.target.value);
                  setAmount(String(remainingForMonth(e.target.value) || ""));
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("billingMonthHint")}</p>
            </FormField>
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
            <>
              <p className="text-xs text-muted-foreground">
                {arrearsPeriod
                  ? t("arrearsPeriodHint", { from: monthLabel(arrearsPeriod.from, locale), to: monthLabel(arrearsPeriod.to, locale), total: formatTaka(totalOverdueAmount) })
                  : t("overdueMonthsHint", { count: overdueMonths.length, total: formatTaka(totalOverdueAmount) })}
              </p>
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
              {allocations.length > 0 ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">{t("overdueAllocation")}</p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto">
                    {allocations.map(({ month, amount }) => (
                      <li key={month} className="flex justify-between gap-2 text-xs">
                        <span>{monthLabel(month, locale)}</span>
                        <span className="tabular-nums">{formatTaka(amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    {t("overdueAfterPayment", { amount: formatTaka(Math.max(0, totalOverdueAmount - overdueValue)) })}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <FormField label={t("amount")} htmlFor="rentPaymentAmount" required>
              <Input
                id="rentPaymentAmount"
                name="amount"
                type="number"
                step="any"
                min={0}
                max={
                  mode === "downpaymentAdjustment"
                    ? Math.min(currentDownpaymentBalance, remainingForMonth(billingMonth))
                    : remainingForMonth(billingMonth)
                }
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {serviceChargeAmount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("serviceChargeBundledHint", {
                    rent: formatTaka(selectedTerms.monthlyRentAmount),
                    service: formatTaka(serviceChargeAmount),
                    total: formatTaka(dueAmount),
                  })}
                </p>
              ) : null}
            </FormField>
          )}

          <FormField label={t("paymentDate")} htmlFor="rentPaymentDate" required>
            <Input id="rentPaymentDate" name="date" type="date" max={todayValue} defaultValue={todayValue} required />
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
                  { value: "BANK_CHECK", label: t("paymentMethodBankCheck") },
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
                  <SelectItem value="BANK_CHECK">{t("paymentMethodBankCheck")}</SelectItem>
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
            <Button type="submit" disabled={isPending || (mode === "overdue" && !validOverdueAmount)}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
