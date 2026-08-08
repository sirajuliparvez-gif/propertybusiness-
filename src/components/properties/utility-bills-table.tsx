"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import { payUtilityBill } from "@/lib/actions/utility-bills";

type Filter = "all" | "unpaid" | "paid";
const ALL_PROPERTIES = "ALL";

export type UtilityBillRow = {
  id: string;
  type: "GAS" | "ELECTRICITY" | "WATER" | "OTHER";
  dueDate: Date;
  amount: number;
  status: "PAID" | "UNPAID";
  paidByCompany: boolean;
  paymentMethod: "CASH" | "BKASH" | "NAGAD" | "BANK" | "OTHER" | null;
  unitLabel: string | null;
  propertyId: string;
  propertyName?: string;
  meterReading?: number | null;
  previousMeterReading?: number | null;
  consumptionUnits?: number | null;
};

export const UTILITY_TYPE_LABEL_KEYS: Record<string, string> = {
  GAS: "utilityTypeGas",
  ELECTRICITY: "utilityTypeElectricity",
  WATER: "utilityTypeWater",
  OTHER: "utilityTypeOther",
};

export function PayUtilityBillButton({
  billId,
  propertyId,
  amount,
  paidByCompany,
  returnTo,
  iconOnly = false,
  variant = "button",
  rowContent,
}: {
  billId: string;
  propertyId: string;
  amount: number;
  paidByCompany: boolean;
  returnTo: string;
  iconOnly?: boolean;
  // "row": the whole trigger becomes a full-width tappable row (mobile list
  // pattern) rendering `rowContent` instead of the button label.
  variant?: "button" | "row";
  rowContent?: React.ReactNode;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState("NONE");

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
              title={iconOnly ? t("payBill") : undefined}
            />
          )
        }
      >
        {variant === "row" ? (
          rowContent
        ) : (
          <>
            <Wallet className="size-3.5" />
            {iconOnly ? <span className="sr-only">{t("payBill")}</span> : t("payBill")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payBill")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => payUtilityBill(formData))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="billId" value={billId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="method" value={method} />
          <p className="text-sm text-muted-foreground">
            {paidByCompany
              ? t("confirmPayCompanyDesc", { amount: formatTaka(amount) })
              : t("confirmPayDesc", { amount: formatTaka(amount) })}
          </p>
          <FormField label={t("paymentMethod")} htmlFor="payMethod">
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
              <SelectTrigger id="payMethod" className="w-full">
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("payBill")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UtilityBillsTable({
  bills,
  showPropertyColumn = false,
  returnTo,
}: {
  bills: UtilityBillRow[];
  showPropertyColumn?: boolean;
  // Overrides the default per-row returnTo (otherwise /utility-bills when
  // showPropertyColumn, else /properties/{propertyId}) — the Tenant Profile
  // page needs paying a bill to come back to itself instead of either default.
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("all");
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const properties = useMemo(() => {
    if (!showPropertyColumn) return [];
    const byId = new Map<string, string>();
    bills.forEach((b) => {
      if (b.propertyName && !byId.has(b.propertyId)) byId.set(b.propertyId, b.propertyName);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [bills, showPropertyColumn]);

  // Kept separate from `filtered` (which also applies the status chip) so the
  // footer's "total unpaid" tracks the property/date scope but doesn't
  // collapse to zero just because the "paid" chip happens to be selected.
  const byProperty = useMemo(
    () =>
      !showPropertyColumn || propertyFilter === ALL_PROPERTIES
        ? bills
        : bills.filter((b) => b.propertyId === propertyFilter),
    [bills, propertyFilter, showPropertyColumn]
  );

  const byPropertyAndDate = useMemo(() => {
    if (!dateFrom && !dateTo) return byProperty;
    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the "to" day
    return byProperty.filter((b) => {
      const due = new Date(b.dueDate);
      return (!rangeStart || due >= rangeStart) && (!rangeEnd || due < rangeEnd);
    });
  }, [byProperty, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (filter === "unpaid") return byPropertyAndDate.filter((b) => b.status === "UNPAID");
    if (filter === "paid") return byPropertyAndDate.filter((b) => b.status === "PAID");
    return byPropertyAndDate;
  }, [byPropertyAndDate, filter]);

  if (bills.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noUtilityBills")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "unpaid", label: t("filterUnpaid") },
    { key: "paid", label: t("filterPaid") },
  ];

  const totalUnpaid = byPropertyAndDate
    .filter((b) => b.status === "UNPAID")
    .reduce((sum, b) => sum + b.amount, 0);
  const leadingColSpan = showPropertyColumn ? 5 : 4;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t("dateRangeFrom")}
            className="h-8 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t("dateRangeTo")}
            className="h-8 w-36 text-xs"
          />
          {dateFrom || dateTo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              {t("clearDateRange")}
            </Button>
          ) : null}

          {showPropertyColumn && properties.length > 0 ? (
          <Select
            value={propertyFilter}
            onValueChange={(v) => setPropertyFilter(v ?? ALL_PROPERTIES)}
            items={[
              { value: ALL_PROPERTIES, label: t("allProperties") },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROPERTIES}>{t("allProperties")}</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noUtilityBills")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {showPropertyColumn ? <TableHead>{t("propertyLabel")}</TableHead> : null}
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("utilityType")}</TableHead>
              <TableHead>{t("unit")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                {showPropertyColumn ? (
                  <TableCell className="font-medium">{b.propertyName ?? "—"}</TableCell>
                ) : null}
                <TableCell className="font-mono text-muted-foreground">{formatDate(b.dueDate)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {t(UTILITY_TYPE_LABEL_KEYS[b.type] ?? "utilityTypeOther")}
                    {b.paidByCompany ? (
                      <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                        {t("paidByCompanyBadge")}
                      </Badge>
                    ) : null}
                  </div>
                  {b.type === "ELECTRICITY" && b.meterReading != null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("meterReadingCell", { reading: b.meterReading })}
                      {b.consumptionUnits != null ? " · " + t("consumptionCell", { units: b.consumptionUnits }) : ""}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{b.unitLabel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {paymentMethodLabel(t, b.paymentMethod)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatTaka(b.amount)}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "border-transparent",
                      b.status === "PAID" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    )}
                  >
                    {b.status === "PAID" ? t("paid") : t("billStatusUnpaid")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {b.status === "UNPAID" ? (
                    <PayUtilityBillButton
                      billId={b.id}
                      propertyId={b.propertyId}
                      amount={b.amount}
                      paidByCompany={b.paidByCompany}
                      returnTo={returnTo ?? (showPropertyColumn ? "/utility-bills" : `/properties/${b.propertyId}`)}
                      iconOnly={showPropertyColumn}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={leadingColSpan} className="text-right text-muted-foreground">
                {t("totalUnpaid")}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {formatTaka(totalUnpaid)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
