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
import { recordPayrollPayment, recordOverduePayrollPayment } from "@/lib/actions/payroll";

type Mode = "cash" | "overdue";

export type OverdueMonth = {
  month: string;
  dueAmount: number;
  paidAmount: number;
  gap: number;
};

export function RecordPayrollPaymentDialog({
  propertyId,
  employeeId,
  defaultAmount,
  overdueMonths = [],
  returnTo,
  iconOnly = false,
}: {
  propertyId: string | null;
  employeeId: string;
  defaultAmount: number;
  overdueMonths?: OverdueMonth[];
  returnTo?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("cash");
  const [method, setMethod] = useState("NONE");
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const totalOverdueAmount = overdueMonths.reduce((sum, m) => sum + m.gap, 0);
  const [overdueAmount, setOverdueAmount] = useState(String(totalOverdueAmount || ""));
  const todayValue = new Date().toISOString().slice(0, 10);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={iconOnly ? "icon-sm" : "sm"}
            title={iconOnly ? t("paySalary") : undefined}
          />
        }
      >
        <Wallet className="size-3.5" />
        {iconOnly ? <span className="sr-only">{t("paySalary")}</span> : t("paySalary")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("paySalary")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(() =>
              mode === "overdue" ? recordOverduePayrollPayment(formData) : recordPayrollPayment(formData)
            )
          }
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId ?? ""} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="method" value={method} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          {overdueMonths.length > 0 ? (
            <FormField label={t("paymentMode")} htmlFor="payrollModeTabs">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="h-8 w-full">
                  <TabsTrigger value="cash" className="flex-1 text-xs">
                    {t("cashPayment")}
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="flex-1 text-xs">
                    {t("settleOverdue")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </FormField>
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

          {mode === "overdue" ? (
            <FormField label={t("amount")} htmlFor="payrollOverdueAmount" required>
              <Input
                id="payrollOverdueAmount"
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
            <FormField label={t("amount")} htmlFor="payrollAmount" required>
              <Input
                id="payrollAmount"
                name="amount"
                type="number"
                step="any"
                min={0}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
          )}

          <FormField label={t("paymentDate")} htmlFor="payrollDate" required>
            <Input id="payrollDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          <FormField label={t("paymentMethod")} htmlFor="payrollMethod">
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
              <SelectTrigger id="payrollMethod" className="w-full">
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
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
