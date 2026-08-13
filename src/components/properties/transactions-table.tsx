"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTaka, formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import type { AllTransactionsData } from "@/lib/transactions-data";

type Direction = "ALL" | "INCOMING" | "OUTGOING";
const ALL_PROPERTIES = "ALL";
const ALL_TYPES = "ALL";
// Sentinel for transactions with no property (company-level staff payroll) —
// its own filterable "property" so it's not lumped invisibly into "all".
const COMPANY_WIDE = "__company__";

const TYPE_LABEL_KEYS: Record<string, string> = {
  RENT_RECEIVED_FROM_TENANT: "transactionTypeRentReceived",
  RENT_PAID_TO_OWNER: "transactionTypeRentPaidToOwner",
  DOWNPAYMENT_PAID_TO_OWNER: "transactionTypeDownpaymentPaidToOwner",
  DOWNPAYMENT_RECEIVED_FROM_TENANT: "transactionTypeDownpaymentReceivedFromTenant",
  DOWNPAYMENT_REFUND_TO_TENANT: "transactionTypeDownpaymentRefundToTenant",
  DOWNPAYMENT_REFUND_FROM_OWNER: "transactionTypeDownpaymentRefundFromOwner",
  UTILITY_REIMBURSEMENT_FROM_TENANT: "transactionTypeUtilityReimbursement",
  SERVICE_CHARGE_RECEIVED_FROM_TENANT: "transactionTypeServiceCharge",
  GUEST_STAY_PAYMENT_RECEIVED: "transactionTypeGuestStayPayment",
  GUEST_DEPOSIT_REFUND: "transactionTypeGuestDepositRefund",
  PAYROLL_EXPENSE: "transactionTypePayrollExpense",
  UTILITY_EXPENSE: "transactionTypeUtilityExpense",
  MAINTENANCE_EXPENSE: "expenseTypeMaintenance",
  OTHER: "expenseTypeOther",
  OWNER_WITHDRAWAL: "transactionTypeOwnerWithdrawal",
};

export function TransactionsTable({ transactions }: { transactions: AllTransactionsData["transactions"] }) {
  const t = useTranslations("Properties");
  const [direction, setDirection] = useState<Direction>("ALL");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const properties = useMemo(() => {
    const byId = new Map<string, string>();
    transactions.forEach((tx) => {
      const key = tx.propertyId ?? COMPANY_WIDE;
      if (!byId.has(key)) byId.set(key, tx.propertyName);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [transactions]);

  const typesPresent = useMemo(() => {
    const set = new Set(transactions.map((tx) => tx.type));
    return Array.from(set);
  }, [transactions]);

  const filtered = useMemo(() => {
    let rows = transactions;
    if (direction !== "ALL") rows = rows.filter((tx) => tx.direction === direction);
    if (typeFilter !== ALL_TYPES) rows = rows.filter((tx) => tx.type === typeFilter);
    if (propertyFilter !== ALL_PROPERTIES) {
      rows = rows.filter((tx) => (tx.propertyId ?? COMPANY_WIDE) === propertyFilter);
    }

    if (!dateFrom && !dateTo) return rows;
    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);
    return rows.filter((tx) => {
      const d = new Date(tx.date);
      return (!rangeStart || d >= rangeStart) && (!rangeEnd || d < rangeEnd);
    });
  }, [transactions, direction, typeFilter, propertyFilter, dateFrom, dateTo]);

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>;
  }

  const directions: { key: Direction; label: string }[] = [
    { key: "ALL", label: t("filterAll") },
    { key: "INCOMING", label: t("directionIncoming") },
    { key: "OUTGOING", label: t("directionOutgoing") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {directions.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDirection(d.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                direction === d.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-muted"
              )}
            >
              {d.label}
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

          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v ?? ALL_TYPES)}
            items={[
              { value: ALL_TYPES, label: t("filterAll") },
              ...typesPresent.map((type) => ({ value: type, label: t(TYPE_LABEL_KEYS[type] ?? type) })),
            ]}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>{t("filterAll")}</SelectItem>
              {typesPresent.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(TYPE_LABEL_KEYS[type] ?? type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {properties.length > 0 ? (
            <Select
              value={propertyFilter}
              onValueChange={(v) => setPropertyFilter(v ?? ALL_PROPERTIES)}
              items={[
                { value: ALL_PROPERTIES, label: t("allProperties") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
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
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("propertyLabel")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("relatedTo")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>{t("paymentMethod")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-mono text-muted-foreground">{formatDate(tx.date)}</TableCell>
                <TableCell>
                  {tx.propertyId ? (
                    <Link
                      href={`/properties/${tx.propertyId}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {tx.propertyName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{tx.propertyName}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{t(TYPE_LABEL_KEYS[tx.type] ?? tx.type)}</span>
                    {!tx.isProfitAffecting ? (
                      <span className="text-xs text-muted-foreground">{t("notCountedInProfit")}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tx.relatedName ?? tx.unitLabel ?? "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    !tx.isProfitAffecting
                      ? "text-muted-foreground"
                      : tx.direction === "INCOMING"
                        ? "text-success"
                        : "text-destructive"
                  )}
                >
                  {tx.direction === "INCOMING" ? "+" : "−"}
                  {formatTaka(tx.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground">{paymentMethodLabel(t, tx.method)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
