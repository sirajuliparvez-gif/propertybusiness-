"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, AlertOctagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { getPropertyPerformance } from "@/lib/dashboard-data";

type Performance = Awaited<ReturnType<typeof getPropertyPerformance>>;

function RankedBar({
  name,
  value,
  max,
  tone,
  detail,
}: {
  name: string;
  value: number;
  max: number;
  tone: "success" | "destructive";
  detail?: string;
}) {
  const pct = max > 0 ? Math.max(4, (Math.abs(value) / max) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{name}</span>
        <span
          className={cn(
            "shrink-0 font-mono text-sm font-semibold tabular-nums",
            tone === "success" ? "text-success" : "text-destructive"
          )}
        >
          {formatTaka(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "success" ? "bg-success" : "bg-destructive")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </li>
  );
}

const CATEGORY_LABEL_KEYS = {
  ownerRent: "ownerRent",
  payroll: "payroll",
  utility: "utility",
  maintenance: "maintenance",
  refund: "refund",
  other: "other",
} as const;

export function PropertyPerformance({ data }: { data: Performance }) {
  const t = useTranslations("Dashboard");

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("propertyPerformance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noPropertyData")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const byExpense = [...data].sort((a, b) => b.expense - a.expense).slice(0, 5);
  const byProfit = [...data].filter((p) => p.net > 0).sort((a, b) => b.net - a.net).slice(0, 5);
  const atLoss = [...data].filter((p) => p.net < 0).sort((a, b) => a.net - b.net).slice(0, 5);

  const maxExpense = Math.max(...byExpense.map((p) => p.expense), 1);
  const maxProfit = Math.max(...byProfit.map((p) => p.net), 1);
  const maxLoss = Math.max(...atLoss.map((p) => Math.abs(p.net)), 1);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <span className="absolute inset-x-0 top-0 h-0.5 bg-destructive" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-6 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <TrendingDown className="size-3.5" />
            </span>
            {t("mostExpense")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byExpense.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noPropertyData")}</p>
          ) : (
            <ul className="space-y-3">
              {byExpense.map((p) => (
                <RankedBar key={p.id} name={p.name} value={p.expense} max={maxExpense} tone="destructive" />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <span className="absolute inset-x-0 top-0 h-0.5 bg-success" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-6 items-center justify-center rounded-md bg-success/10 text-success">
              <TrendingUp className="size-3.5" />
            </span>
            {t("mostProfit")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byProfit.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noPropertyData")}</p>
          ) : (
            <ul className="space-y-3">
              {byProfit.map((p) => (
                <RankedBar key={p.id} name={p.name} value={p.net} max={maxProfit} tone="success" />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <span className="absolute inset-x-0 top-0 h-0.5 bg-warning" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-6 items-center justify-center rounded-md bg-warning/10 text-warning">
              <AlertOctagon className="size-3.5" />
            </span>
            {t("atLoss")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {atLoss.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noPropertyData")}</p>
          ) : (
            <ul className="space-y-3">
              {atLoss.map((p) => (
                <RankedBar
                  key={p.id}
                  name={p.name}
                  value={p.net}
                  max={maxLoss}
                  tone="destructive"
                  detail={
                    p.topExpenseCategory
                      ? `${t("topExpenseReason")}: ${t(
                          CATEGORY_LABEL_KEYS[
                            p.topExpenseCategory.category as keyof typeof CATEGORY_LABEL_KEYS
                          ] ?? "other"
                        )} (${formatTaka(p.topExpenseCategory.amount)})`
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
