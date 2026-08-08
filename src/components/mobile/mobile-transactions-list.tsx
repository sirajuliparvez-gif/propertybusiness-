"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { formatTaka, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AllTransactionsData } from "@/lib/transactions-data";

type Direction = "ALL" | "INCOMING" | "OUTGOING";

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
};

export function MobileTransactionsList({
  transactions,
}: {
  transactions: AllTransactionsData["transactions"];
}) {
  const t = useTranslations("Properties");
  const [direction, setDirection] = useState<Direction>("ALL");

  const filtered = useMemo(
    () => (direction === "ALL" ? transactions : transactions.filter((tx) => tx.direction === direction)),
    [transactions, direction]
  );

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">{t("noTransactions")}</p>;
  }

  const directions: { key: Direction; label: string }[] = [
    { key: "ALL", label: t("filterAll") },
    { key: "INCOMING", label: t("directionIncoming") },
    { key: "OUTGOING", label: t("directionOutgoing") },
  ];

  return (
    <div className="flex flex-col gap-3 md:hidden">
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

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {filtered.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    tx.direction === "INCOMING" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  )}
                >
                  {tx.direction === "INCOMING" ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t(TYPE_LABEL_KEYS[tx.type] ?? tx.type)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tx.propertyId ? (
                      <Link href={`/properties/${tx.propertyId}`} className="hover:underline">
                        {tx.propertyName}
                      </Link>
                    ) : (
                      tx.propertyName
                    )}
                    {" · "}
                    {formatDate(tx.date)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-semibold tabular-nums",
                    !tx.isProfitAffecting
                      ? "text-muted-foreground"
                      : tx.direction === "INCOMING"
                        ? "text-success"
                        : "text-destructive"
                  )}
                >
                  {tx.direction === "INCOMING" ? "+" : "−"}
                  {formatTaka(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
