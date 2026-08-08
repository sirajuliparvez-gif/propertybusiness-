"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Point = { month?: string; year?: string; income: number; expense: number; net: number };

function CustomTooltip({
  active,
  payload,
  label,
  incomeLabel,
  expenseLabel,
  netLabel,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  incomeLabel: string;
  expenseLabel: string;
  netLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value ?? 0;
  const net = income - expense;
  return (
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" />
            {incomeLabel}
          </span>
          <span className="font-mono tabular-nums">{formatTaka(income)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            {expenseLabel}
          </span>
          <span className="font-mono tabular-nums">{formatTaka(expense)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-1 font-medium">
          <span>{netLabel}</span>
          <span
            className={cn(
              "font-mono tabular-nums",
              net >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {formatTaka(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function IncomeExpenseChart({
  monthly,
  yearly,
}: {
  monthly: Point[];
  yearly: Point[];
}) {
  const t = useTranslations("Dashboard");
  const [range, setRange] = useState<"monthly" | "yearly">("monthly");
  const data = range === "monthly" ? monthly : yearly;
  const xKey = range === "monthly" ? "month" : "year";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-primary/25 to-primary/5 text-primary">
            <BarChart3 className="size-3.5" />
          </span>
          {t("financialAnalytics")}
        </CardTitle>
        <Tabs value={range} onValueChange={(v) => setRange(v as "monthly" | "yearly")}>
          <TabsList className="h-8">
            <TabsTrigger value="monthly" className="text-xs">
              {t("monthly")}
            </TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs">
              {t("yearly")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} barGap={2} margin={{ left: -12, top: 8, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted-foreground)"
                tickFormatter={(v) => `৳${Math.round(v / 1000)}k`}
                width={48}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    incomeLabel={t("income")}
                    expenseLabel={t("expense")}
                    netLabel={t("net")}
                  />
                }
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
              />
              <Bar dataKey="income" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line
                dataKey="net"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" /> {t("income")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" /> {t("expense")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> {t("net")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
