"use client";

import { receiptAttempt, type ReceiptAttempt } from "@/lib/receipt-request";
import { dhakaTodayISO } from "@/lib/dhaka-time";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, Wallet } from "lucide-react";
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
import { AddUtilityBillForm } from "@/components/properties/add-utility-bill-dialog";
import { addTenantUtilityBills } from "@/lib/actions/utility-bills";
import { FormField } from "@/components/properties/form-field";
import { formatDate, formatTaka, monthLabel } from "@/lib/format";
import {
  recordTenantRentPayment,
  recordAdvanceRentPayment,
  recordOverdueRentPayment,
  getTenantUtilityArrears,
  getMultiMonthRentOptions,
  recordMultiMonthRentPayment,
} from "@/lib/actions/tenant-rent";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isPaymentMonth } from "@/lib/payment-month";
import { allocateRentPayment, LEDGER_START_MONTH } from "@/lib/rent-ledger";
import { Link } from "@/i18n/navigation";
import { computeServiceChargeAmount } from "@/lib/service-charge";
import { rentTermsDueAmount, resolveRentTermsForMonth, type EffectiveRentTerms } from "@/lib/rent-terms";

type Mode = "cash" | "downpaymentAdjustment" | "advance" | "overdue" | "multiMonth";
type MultiMonthRow = { id: number; month: string; amount: string };
const ADVANCE_MONTH_PRESETS = [3, 6, 12];
const ADVANCE_MONTHS_MIN = 1;
const ADVANCE_MONTHS_MAX = 36;

export type OverdueMonth = {
  month: string;
  gap: number;
};

export function RecordTenantRentPaymentDialog({
  fixedBillingMonth,
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
  collectionBalance,
}: {
  fixedBillingMonth?: string;
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
  collectionBalance?: number;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const receiptRequest = useRef<ReceiptAttempt | null>(null);
  const simpleCollection = collectionBalance != null;
  const [open, setOpen] = useState(false);
  const [hasUtilityDraft, setHasUtilityDraft] = useState(false);
  const [addingBill, setAddingBill] = useState(false);
  const billFields = useRef<{ read: (data: FormData) => FormData[] | null }>(null);
  const todayValue = dhakaTodayISO();
  const [mode, setMode] = useState<Mode>(arrearsPeriod ? "overdue" : monthSettled && !initialBillingMonth ? "advance" : "cash");
  const [method, setMethod] = useState("NONE");
  const [paymentDate, setPaymentDate] = useState(todayValue);
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
  const [amount, setAmount] = useState(String((collectionBalance ?? remainingForMonth(billingMonth)) || ""));
  const [startMonth, setStartMonth] = useState(todayValue.slice(0, 7));
  const [monthsCount, setMonthsCount] = useState("3");
  const totalOverdueAmount = overdueMonths.reduce((sum, m) => sum + m.gap, 0);
  const [overdueAmount, setOverdueAmount] = useState(String(totalOverdueAmount || ""));
  const [utilityArrears, setUtilityArrears] = useState<Awaited<ReturnType<typeof getTenantUtilityArrears>> | null>(null);
  const [utilityAmounts, setUtilityAmounts] = useState<Record<string, string>>({});
  const [utilityLoadFailed, setUtilityLoadFailed] = useState(false);
  const [utilityRefresh, setUtilityRefresh] = useState(0);
  useEffect(() => {
    if (!open || (mode !== "overdue" && !(simpleCollection && (mode === "cash" || mode === "multiMonth")))) return;
    let active = true;
    getTenantUtilityArrears(tenantLeaseId, simpleCollection).then(
      (bills) => { if (active) setUtilityArrears(bills); },
      () => { if (active) setUtilityLoadFailed(true); },
    );
    return () => { active = false; };
  }, [open, mode, simpleCollection, tenantLeaseId, utilityRefresh]);

  const [monthOptions, setMonthOptions] = useState<Awaited<ReturnType<typeof getMultiMonthRentOptions>> | null>(null);
  const [monthOptionsFailed, setMonthOptionsFailed] = useState(false);
  const [monthOptionsRefresh, setMonthOptionsRefresh] = useState(0);
  const [monthRows, setMonthRows] = useState<MultiMonthRow[]>([]);
  useEffect(() => {
    if (mode !== "multiMonth") return;
    let active = true;
    getMultiMonthRentOptions(tenantLeaseId).then(
      (options) => {
        if (!active) return;
        setMonthOptions(options);
        setMonthRows((rows) => rows.length ? rows : [{
          id: 0,
          month: options.find(({ month }) => month === billingMonth)?.month ?? (simpleCollection ? "" : options[0]?.month ?? ""),
          amount: "",
        }]);
      },
      () => { if (active) setMonthOptionsFailed(true); },
    );
    return () => { active = false; };
  }, [mode, simpleCollection, tenantLeaseId, billingMonth, monthOptionsRefresh]);

  function reloadMonthOptions() {
    setMonthOptions(null);
    setMonthRows([]);
    setMonthOptionsFailed(false);
    setMonthOptionsRefresh((version) => version + 1);
  }

  function changeMonthRow(id: number, change: Partial<Omit<MultiMonthRow, "id">>) {
    setMonthRows((rows) => rows.map((row) => row.id === id ? { ...row, ...change } : row));
  }

  const remainingByMonth = new Map(monthOptions?.map(({ month, remainingCents }) => [month, remainingCents]));
  const monthPayments = monthRows
    .filter(({ amount }) => !simpleCollection || amount !== "")
    .map(({ month, amount }) => ({ month, amount, remainingCents: remainingByMonth.get(month) }));
  const utilityPayments = simpleCollection && (mode === "cash" || mode === "multiMonth") ? (utilityArrears ?? []).flatMap((bill) => {
    const amount = utilityAmounts[bill.id];
    return amount ? [{ id: bill.id, amount, remainingCents: Math.round(bill.remaining * 100) }] : [];
  }) : [];
  const plannedPayments = [...monthPayments, ...utilityPayments];
  const multiMonthTotal = plannedPayments.reduce((sum, { amount }) =>
    sum + (Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : 0), 0) / 100;
  const canSubmitMultiMonth = plannedPayments.length > 0 &&
    new Set(monthPayments.map(({ month }) => month)).size === monthPayments.length &&
    plannedPayments.every(({ amount, remainingCents }) =>
      /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 &&
      Math.round(Number(amount) * 100) <= (remainingCents ?? 0));
  const cashBalance = collectionBalance ?? remainingForMonth(billingMonth);
  const cashCents = Math.round(cashBalance * 100);
  const cashPayment = Number(amount);
  const validCashPayment = /^\d+(\.\d{1,2})?$/.test(amount) && cashPayment > 0 &&
    Math.round(cashPayment * 100) <= cashCents;
  const noRentPayment = amount === "" || cashPayment === 0;
  const basicPayment = simpleCollection && mode === "cash";
  const rentAmountRequired = mode !== "cash" || (!addingBill && !utilityPayments.length);
  const UtilityPaymentSection = basicPayment ? "details" : "section";
  const PaymentDetails = basicPayment ? "details" : "div";
  const paymentMethods = [
    { value: "NONE", label: t("noPaymentRecord") },
    { value: "CASH", label: t("paymentMethodCash") },
    { value: "BKASH", label: t("paymentMethodBkash") },
    { value: "NAGAD", label: t("paymentMethodNagad") },
    { value: "BANK", label: t("paymentMethodBank") },
    { value: "BANK_CHECK", label: t("paymentMethodBankCheck") },
    { value: "OTHER", label: t("paymentMethodOther") },
  ];
  const currentMonth = todayValue.slice(0, 7);

  const utilityTypeLabels = {
    GAS: t("utilityTypeGas"),
    ELECTRICITY: t("utilityTypeElectricity"),
    WATER: t("utilityTypeWater"),
    WASTE: t("utilityTypeWaste"),
    SECURITY: t("utilityTypeSecurity"),
    OTHER: t("utilityTypeOther"),
  };
  const utilityTotal = utilityArrears?.reduce((sum, bill) => sum + Number(utilityAmounts[bill.id] || 0), 0) ?? 0;
  const trimmedOverdueAmount = overdueAmount.trim();
  const overdueValue = trimmedOverdueAmount === "" ? 0
    : /^(?:\d+|\d{1,3}(?:,\d{2,3})*,\d{3})(?:\.\d+)?$/.test(trimmedOverdueAmount)
      ? Number(trimmedOverdueAmount.replaceAll(",", ""))
      : NaN;
  const invalidOverdueAmount = trimmedOverdueAmount !== "" &&
    (!Number.isFinite(overdueValue) || overdueValue > totalOverdueAmount);
  const validOverdueAmount = Number.isFinite(overdueValue) && overdueValue > 0 && overdueValue <= totalOverdueAmount;
  const canSubmitOverdue = validOverdueAmount || (overdueValue === 0 && utilityTotal > 0);
  const allocations = mode === "overdue" && validOverdueAmount ? allocateRentPayment(overdueMonths, overdueValue) : [];
  const advanceTotal = Array.from({ length: Number(monthsCount) || 0 }, (_, index) => {
    const [year, monthNumber] = startMonth.split("-").map(Number);
    const date = new Date(year, monthNumber - 1 + index, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return remainingForMonth(month);
  }).reduce((sum, value) => sum + value, 0);
  const billMonth = fixedBillingMonth ?? billingMonth;
  const showUtilityBills = (mode === "cash" || mode === "multiMonth") && isPaymentMonth(billMonth);
  const actionMonth = mode === "advance" ? startMonth : billingMonth;
  const actionAmount =
    mode === "advance" ? advanceTotal : mode === "overdue" ? (Number.isFinite(overdueValue) ? overdueValue : 0) + utilityTotal : Number(amount);
  const dialogTitle =
    mode === "multiMonth" ? t("multiMonthTitle") : mode === "advance" ? t("advanceRentPayment") : mode === "overdue" ? (arrearsPeriod ? triggerLabel ?? t("settleOverdue") : t("settleOverdue")) : t("collectRent");
  const submitLabel =
    simpleCollection && mode === "cash" ? t("invoicePaymentSave") :
    mode === "multiMonth" ? t("multiMonthSave") :
    mode === "advance"
      ? t("recordAdvanceRentAction", { count: Number(monthsCount) || 0, amount: formatTaka(actionAmount || 0) })
      : mode === "overdue"
        ? t(utilityTotal > 0 ? "recordOverdueWithUtilitiesAction" : "recordOverdueRentAction", { amount: formatTaka(actionAmount || 0, 2) })
        : t("recordRentAction", {
            month: monthLabel(actionMonth, locale),
            amount: formatTaka(actionAmount || 0),
          });

  function handleModeChange(next: Mode) {
    if (next === "multiMonth" && mode !== "multiMonth") reloadMonthOptions();
    setMode(next);
    setAmount(
      next === "downpaymentAdjustment"
        ? String(Math.min(dueAmount, currentDownpaymentBalance))
        : String(remainingForMonth(billingMonth) || "")
    );
  }

  function changeCollectionMode(next: Mode) {
    if (next === "multiMonth") {
      setMonthOptions(null);
      setMonthOptionsFailed(false);
      setMonthRows([{ id: 0, month: cashCents > 0 ? billingMonth : "", amount: validCashPayment ? amount : "" }]);
    }
    if (next === "cash" && mode === "multiMonth") {
      setAmount(monthRows.find((row) => row.month === billingMonth)?.amount ?? String(cashBalance || ""));
    }
    if (next === "downpaymentAdjustment" || mode === "downpaymentAdjustment") {
      handleModeChange(next);
      return;
    }
    setMode(next);
  }

  function readNewBills(formData: FormData) {
    const bills = addingBill && showUtilityBills ? billFields.current?.read(formData) : [];
    if (!bills) toast.error(t("collectionCheckNewBill"));
    return bills;
  }

  function createBillsOnly(formData: FormData) {
    if (isPending) return;
    const bills = readNewBills(formData);
    if (!bills) return;
    if (!bills.length) {
      toast.error(t("collectionCheckNewBill"));
      return;
    }
    if (bills.some((bill) => Number(bill.get("received")) > 0)) {
      toast.error(t("collectionUseReceivedAction"));
      return;
    }
    startTransition(async () => {
      try {
        const result = await addTenantUtilityBills(tenantLeaseId, billMonth, bills);
        if (!result.ok) {
          toast.error(t(result.error));
          return;
        }
        toast.success(t("utilityBillsAddedToMonth", { count: bills.length, month: monthLabel(billMonth, locale) }));
        setAddingBill(false);
        setHasUtilityDraft(false);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(t("utilityBillAddFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (isPending) return;
      setOpen(next);
      if (!next) {
        setHasUtilityDraft(false);
        setAddingBill(false);
      }
      if (!next && simpleCollection) {
        setMode("cash");
        setAmount(String(cashBalance || ""));
        setUtilityAmounts({});
        setUtilityArrears(null);
        setUtilityLoadFailed(false);
      }
    }}>
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
        <DialogContent className={simpleCollection ? "max-h-[90dvh] overflow-y-auto sm:max-w-xl" : "max-h-[90dvh] overflow-y-auto sm:max-w-3xl sm:gap-5 sm:p-6"}>
        <DialogHeader>
          <DialogTitle>{showUtilityBills ? t("rentAndUtilityTitle") : dialogTitle}</DialogTitle>
        </DialogHeader>
        {tenantName ? (
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
            <p className="font-semibold">{tenantName}</p>
            <p className="text-xs text-muted-foreground">
              {[propertyName, unitLabel ? t("unitWithValue", { unit: unitLabel }) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {simpleCollection ? <p className="mt-1 text-sm font-medium">{monthLabel(billingMonth, locale)} · {t("collectionMonthBalance", { amount: formatTaka(cashCents / 100, 2) })}</p> : mode !== "multiMonth" ? <p className="mt-1 text-xs font-medium text-foreground">
              {mode === "overdue" ? dialogTitle : monthLabel(actionMonth, locale)} · {formatTaka(actionAmount || 0, 2)}
            </p> : null}
          </div>
        ) : null}
          <form
            action={(formData: FormData) =>
              startTransition(async () => {
                try {
                const bills = readNewBills(formData);
                if (!bills || isPending) return;
                const receivedUtility = bills.some((bill) => Number(bill.get("received")) > 0);
                if (mode === "multiMonth" || (mode === "cash" && (simpleCollection || bills.length))) {
                  const single = mode === "cash";
                  if (single ? !(validCashPayment || (noRentPayment && (receivedUtility || utilityPayments.length)))
                    : !(canSubmitMultiMonth || (!plannedPayments.length && receivedUtility))) {
                    toast.error(t("multiMonthInvalid"));
                    return;
                  }
                  if (single) {
                    formData.set("collectionMode", "single");
                    formData.set("multiMonthPayments", JSON.stringify(validCashPayment ? [{ month: billMonth, amount, remainingCents: cashCents }] : []));
                  }
                  if (simpleCollection) {
                    formData.set("multiMonthUtilities", JSON.stringify(utilityPayments));
                  }
                  formData.set("billingMonth", billMonth);
                  receiptRequest.current = receiptAttempt(formData, receiptRequest.current, bills);
                  formData.set("receiptRequestId", receiptRequest.current.id);
                  const result = await recordMultiMonthRentPayment(formData, bills);
                  if (result?.reason === "utility") {
                    toast.error(t(result.error));
                  } else if (result?.reason === "changed") {
                    toast.error(t("multiMonthChanged"));
                    if (simpleCollection) {
                      setUtilityArrears(null);
                      setUtilityAmounts({});
                      setUtilityLoadFailed(false);
                      setUtilityRefresh((version) => version + 1);
                      router.refresh();
                    }
                    reloadMonthOptions();
                  } else if (result?.reason === "invalid") {
                    toast.error(t("multiMonthInvalid"));
                  } else if (simpleCollection) {
                    setOpen(false);
                    setMode("cash");
                    setUtilityAmounts({});
                    setUtilityArrears(null);
                  }
                } else if (mode === "overdue") {
                  if (!canSubmitOverdue || isPending) return;
                  formData.set("amount", String(overdueValue));
                  receiptRequest.current = receiptAttempt(formData, receiptRequest.current);
                  formData.set("receiptRequestId", receiptRequest.current.id);
                  const result = await recordOverdueRentPayment(formData);
                  if (result?.reason === "changed") {
                    toast.error(t(utilityTotal > 0 ? "overdueUtilityBalanceChanged" : "overdueBalanceChanged"));
                    setUtilityArrears(null);
                    setUtilityAmounts({});
                    setUtilityLoadFailed(false);
                    setUtilityRefresh((version) => version + 1);
                    router.refresh();
                  } else if (result?.reason === "invalid") {
                    toast.error(t("overdueInvalidPayment"));
                  }
                } else if (mode === "advance") {
                  await recordAdvanceRentPayment(formData);
                } else {
                  await recordTenantRentPayment(formData);
                }
                } catch (error) {
                  if (error && typeof error === "object" && "digest" in error) throw error;
                  toast.error(t("receiptRetrySame"));
                }
              })
            }
            className="flex min-w-0 flex-col gap-3"
          >
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="tenantLeaseId" value={tenantLeaseId} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="method" value={mode !== "downpaymentAdjustment" ? method : ""} />
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

            {mode === "multiMonth" ? <input type="hidden" name="multiMonthPayments" value={JSON.stringify(monthPayments)} /> : null}
            {mode === "overdue" ? <input type="hidden" name="rentAllocation" value={JSON.stringify(allocations)} /> : null}
            {arrearsPeriod ? <>
              <input type="hidden" name="arrearsFrom" value={arrearsPeriod.from} />
              <input type="hidden" name="arrearsTo" value={arrearsPeriod.to} />
            </> : simpleCollection && !basicPayment ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={isPending}
                  onClick={() => changeCollectionMode(mode === "cash" ? "multiMonth" : "cash")}>
                  {t(mode === "cash" ? "collectionMore" : "collectionOnlySelected")}
                </Button>
                {mode === "multiMonth" && currentDownpaymentBalance > 0 ? (
                  <Button type="button" variant="ghost" size="sm" disabled={isPending || hasUtilityDraft}
                    onClick={() => changeCollectionMode("downpaymentAdjustment")}>
                    {t("adjustFromDownpayment")}
                  </Button>
                ) : null}
              </div>
            ) : fixedBillingMonth || basicPayment ? null : <FormField label={t("paymentMode")} htmlFor="rentPaymentModeTabs">
              <Tabs value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
                <TabsList id="rentPaymentModeTabs" className="h-auto w-full flex-wrap">
                  <TabsTrigger value="cash" className="flex-1 text-xs">
                    {t("cashPayment")}
                  </TabsTrigger>
                  <TabsTrigger value="multiMonth" disabled={hasUtilityDraft} className="flex-1 text-xs">
                    {t("multiMonthTab")}
                  </TabsTrigger>
                  <TabsTrigger value="overdue" disabled={hasUtilityDraft} className="flex-1 text-xs">
                    {t("settleOverdue")}
                  </TabsTrigger>
                  <TabsTrigger value="advance" disabled={hasUtilityDraft} className="flex-1 text-xs">
                    {t("advanceRentPayment")}
                  </TabsTrigger>
                  {currentDownpaymentBalance > 0 ? (
                    <TabsTrigger value="downpaymentAdjustment" disabled={hasUtilityDraft} className="flex-1 text-xs">
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

            {fixedBillingMonth || simpleCollection ? (
              <input type="hidden" name="billingMonth" value={fixedBillingMonth ?? billingMonth} />
            ) : mode === "cash" || mode === "downpaymentAdjustment" ? (
              <FormField label={t("billingMonth")} htmlFor="rentBillingMonth" required>
                <Input
                  id="rentBillingMonth"
                  name="billingMonth"
                  type="month"
                  max={todayValue.slice(0, 7)}
                  readOnly={hasUtilityDraft}
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

            {mode === "multiMonth" ? (
              <section className="space-y-3" aria-label={t("multiMonthTitle")}>
                <p className="text-sm text-muted-foreground">{t("multiMonthHint")}</p>
                {simpleCollection ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {t("collectionMissingMonths", { month: monthLabel(LEDGER_START_MONTH, locale) })}{" "}
                    <Link href={`/tenants/${tenantLeaseId}#rent-account-tools`} className="font-medium text-primary underline underline-offset-2">
                      {t("addOldRentArrears")}
                    </Link>
                  </p>
                ) : null}
                {monthOptionsFailed ? (
                  <p role="status" className="text-sm text-destructive">
                    {t("multiMonthLoadFailed")}{" "}
                    <button type="button" className="underline" onClick={reloadMonthOptions}>{t("multiMonthRetry")}</button>
                  </p>
                ) : monthOptions == null ? (
                  <p role="status" className="text-sm text-muted-foreground">{t("multiMonthLoading")}</p>
                ) : monthOptions.length === 0 ? (
                  <p role="status" className="text-sm text-muted-foreground">{t("multiMonthEmpty")}</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {monthRows.map(({ id, month, amount }) => {
                        const remaining = remainingByMonth.get(month);
                        return (
                          <div key={id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <FormField label={t("billingMonth")} htmlFor={`multiMonth-${id}`} required={!simpleCollection}>
                              <select
                                id={`multiMonth-${id}`}
                                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-ring"
                                value={month}
                                required={!simpleCollection}
                                onChange={(event) => changeMonthRow(id, { month: event.target.value, amount: "" })}
                              >
                                <option value="">{t("multiMonthChoose")}</option>
                                {monthOptions.map(({ month: option }) => (
                                  <option key={option} value={option} disabled={monthRows.some((row) => row.id !== id && row.month === option)}>
                                    {monthLabel(option, locale)} · {t(option < currentMonth ? "multiMonthPrevious" : option === currentMonth ? "multiMonthCurrent" : "multiMonthAdvance")}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label={t("amount")} htmlFor={`multiMonthAmount-${id}`} required={!simpleCollection}>
                              <Input
                                id={`multiMonthAmount-${id}`}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0.01"
                                max={remaining == null ? undefined : remaining / 100}
                                disabled={!month}
                                required={!simpleCollection}
                                value={amount}
                                onChange={(event) => changeMonthRow(id, { amount: event.target.value })}
                              />
                              {remaining != null ? (
                                <p className="text-xs text-muted-foreground">
                                  {t(simpleCollection && Number(amount) > 0 ? "overdueAfterPayment" : "multiMonthRemaining", {
                                    amount: formatTaka(Math.max(0, remaining / 100 - (simpleCollection ? Number(amount) || 0 : 0)), 2),
                                  })}
                                </p>
                              ) : null}
                            </FormField>
                            {monthRows.length > 1 ? (
                              <Button type="button" variant="ghost" size="sm" className="justify-self-start sm:mt-5"
                                onClick={() => setMonthRows((rows) => rows.filter((row) => row.id !== id))}>
                                {t("multiMonthRemove")}
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={monthRows.length >= Math.min(36, monthOptions.length)}
                      onClick={() => setMonthRows((rows) => [...rows, { id: (rows.at(-1)?.id ?? 0) + 1, month: "", amount: "" }])}
                    >
                      <Plus className="size-4" /> {t("multiMonthAdd")}
                    </Button>
                    {!simpleCollection ? <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold">
                      <span>{t("multiMonthTotal")}</span>
                      <span className="tabular-nums">{formatTaka(multiMonthTotal, 2)}</span>
                    </div> : null}
                  </>
                )}
              </section>
            ) : mode === "advance" ? (
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
                <FormField label={t("oldRentAmount")} htmlFor="rentOverdueAmount">
                  <Input
                    id="rentOverdueAmount"
                    type="text"
                    inputMode="decimal"
                    aria-invalid={invalidOverdueAmount}
                    aria-describedby={invalidOverdueAmount ? "rent-overdue-amount-error" : undefined}
                    value={overdueAmount}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setOverdueAmount(event.target.value)}
                  />
                  {invalidOverdueAmount ? (
                    <p id="rent-overdue-amount-error" className="text-xs text-destructive">
                      {t("overdueAmountLimit", { amount: formatTaka(totalOverdueAmount, 2) })}
                    </p>
                  ) : null}
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
            ) : simpleCollection && mode === "cash" && cashCents === 0 ? null : (
              <FormField label={t(basicPayment ? "collectionRentReceived" : "amount")} htmlFor="rentPaymentAmount" required={rentAmountRequired}>
                <Input
                  id="rentPaymentAmount"
                  name="amount"
                  type="number"
                  step={simpleCollection ? "0.01" : "any"}
                  min={(fixedBillingMonth || simpleCollection) && rentAmountRequired ? 0.01 : 0}
                  max={
                    mode === "downpaymentAdjustment"
                      ? Math.min(currentDownpaymentBalance, remainingForMonth(billingMonth))
                      : cashBalance
                  }
                  required={rentAmountRequired}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {!simpleCollection && serviceChargeAmount > 0 ? (
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

            {fixedBillingMonth || (simpleCollection && mode === "cash") ? (
              <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
                {t("overdueAfterPayment", {
                  amount: formatTaka(Math.max(0, cashCents / 100 - (simpleCollection && !validCashPayment ? 0 : Math.max(0, Number(amount) || 0))), 2),
                })}
              </p>
            ) : null}

            {mode === "overdue" || (simpleCollection && (mode === "multiMonth" || (mode === "cash" && utilityArrears?.length))) ? (
              <UtilityPaymentSection className="space-y-3 rounded-lg border p-3" aria-label={t(simpleCollection ? "collectionUtilityBills" : "oldUtilityBills")}>
                {basicPayment ? (
                  <summary className="cursor-pointer text-sm font-medium">
                    {t("collectionUtilityBills")}
                    {utilityPayments.length ? ` · ${formatTaka(utilityTotal, 2)}` : null}
                  </summary>
                ) : <h3 className="font-semibold">{t(simpleCollection ? "collectionUtilityBills" : "oldUtilityBills")}</h3>}
                {utilityLoadFailed ? (
                  <p role="status" className="text-xs text-destructive">{t("oldUtilityLoadFailed")}</p>
                ) : utilityArrears == null ? (
                  <p role="status" className="text-xs text-muted-foreground">{t("oldUtilityLoading")}</p>
                ) : utilityArrears.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t(simpleCollection ? "collectionUtilityEmpty" : "oldUtilityEmpty")}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{t("oldUtilityPaymentHint")}</p>
                    {utilityArrears.map((bill) => (
                      <div key={bill.id} className="grid items-center gap-2 border-t pt-2 sm:grid-cols-[1fr_9rem]">
                        <label htmlFor={`utility-arrears-${bill.id}`} className="text-sm">
                          {utilityTypeLabels[bill.type]}{bill.meterLabel ? ` · ${bill.meterLabel}` : ""} · {monthLabel(bill.month, locale)}
                          <span className="block text-xs text-muted-foreground">
                            {simpleCollection ? `${formatDate(bill.dueDate, locale)} · ` : null}
                            {t("utilityRemainingDue", { amount: formatTaka(bill.remaining, 2) })}
                          </span>
                        </label>
                        <div>
                          <Input id={`utility-arrears-${bill.id}`} name={`utilityPayment:${bill.id}`}
                            type="number" step={simpleCollection ? "0.01" : "any"} min={simpleCollection ? 0.01 : 0} max={simpleCollection ? Math.round(bill.remaining * 100) / 100 : bill.remaining}
                            placeholder={t("oldUtilityPaymentAmount")}
                            value={utilityAmounts[bill.id] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setUtilityAmounts((amounts) => ({ ...amounts, [bill.id]: value }));
                            }}
                          />
                          {simpleCollection && Number(utilityAmounts[bill.id]) > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("overdueAfterPayment", { amount: formatTaka(Math.max(0, bill.remaining - Number(utilityAmounts[bill.id])), 2) })}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </UtilityPaymentSection>
            ) : null}

            {simpleCollection && mode === "multiMonth" ? (
              <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold">
                <span>{t("multiMonthTotal")}</span>
                <span className="tabular-nums">{formatTaka(multiMonthTotal, 2)}</span>
              </div>
            ) : null}
            <PaymentDetails className={basicPayment ? "rounded-lg border px-3 py-2 text-sm" : undefined}>
              {basicPayment ? (
                <summary className="cursor-pointer text-muted-foreground">
                  {t("invoicePaymentDetails")} · {paymentDate ? formatDate(paymentDate, locale) : "—"}
                  {method !== "NONE" ? ` · ${paymentMethods.find(({ value }) => value === method)?.label}` : null}
                </summary>
              ) : null}
              <div className={basicPayment ? "mt-2 grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
                <FormField label={t("paymentDate")} htmlFor="rentPaymentDate" required>
                  <Input id="rentPaymentDate" name="date" type="date" max={todayValue}
                    value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
                </FormField>

            {mode !== "downpaymentAdjustment" ? (
              <FormField label={t("paymentMethod")} htmlFor="rentPaymentMethod">
                <Select
                  value={method}
                  onValueChange={(v) => setMethod(v ?? "NONE")}
                  items={paymentMethods}
                >
                  <SelectTrigger id="rentPaymentMethod" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <FormField label={t("notes")} htmlFor="rentPaymentNotes">
                <Input id="rentPaymentNotes" name="notes" />
              </FormField>
            )}
              </div>
            </PaymentDetails>

            {basicPayment ? (
              <Button type="button" variant="ghost" size="sm" className="self-start" disabled={isPending}
                onClick={() => changeCollectionMode("multiMonth")}>
                {t("collectionMore")}
              </Button>
            ) : null}

            {showUtilityBills ? (
              <section className="grid min-w-0 gap-3 rounded-lg border p-3">
                {addingBill ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{t("addUtilityFromRent")}</h3>
                      <Button type="button" variant="ghost" size="sm" disabled={isPending}
                        onClick={() => { setAddingBill(false); setHasUtilityDraft(false); }}>
                        {t("collectionRemoveNewBill")}
                      </Button>
                    </div>
                    <AddUtilityBillForm key={billMonth} tenantBilling={{ leaseId: tenantLeaseId, month: billMonth }}
                      collectionRef={billFields} onDraftChange={setHasUtilityDraft} />
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={isPending}
                    onClick={() => setAddingBill(true)}>
                    <Plus className="size-4" />{t("invoiceAddBill")}
                  </Button>
                )}
              </section>
            ) : null}
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>
                    {t("cancel")}
                  </DialogClose>
                  <Button type="submit" disabled={isPending || (!addingBill && simpleCollection && mode === "cash" &&
                    !validCashPayment && !(noRentPayment && utilityPayments.length)) ||
                    (mode === "overdue" && !canSubmitOverdue) || (!addingBill && mode === "multiMonth" && !canSubmitMultiMonth)}>
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {simpleCollection && showUtilityBills ? t("invoicePaymentSave") : showUtilityBills ? t("collectionReceivedAction") : submitLabel}
                  </Button>
                  {showUtilityBills && addingBill ? (
                    <Button type="submit" variant="outline" formAction={createBillsOnly} formNoValidate disabled={isPending}>
                      {t("collectionCreateBill")}
                    </Button>
                  ) : null}
                </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
