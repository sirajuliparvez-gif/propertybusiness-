"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { addExpense } from "@/lib/actions/expenses";

const NONE_VALUE = "NONE";

export function AddExpenseDialog({
  propertyId,
  units,
}: {
  propertyId: string;
  units: { id: string; label: string; unitTypeLabel: string }[];
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<"MAINTENANCE_EXPENSE" | "OTHER">("MAINTENANCE_EXPENSE");
  const [unitId, setUnitId] = useState(NONE_VALUE);
  const [method, setMethod] = useState(NONE_VALUE);
  const todayValue = new Date().toISOString().slice(0, 10);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" />
        {t("addExpense")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addExpense")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => addExpense(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="unitId" value={unitId === NONE_VALUE ? "" : unitId} />
          <input type="hidden" name="method" value={method} />

          <FormField label={t("category")} htmlFor="expenseType" required className="sm:col-span-2">
            <Select
              value={type}
              onValueChange={(v) => setType(v as "MAINTENANCE_EXPENSE" | "OTHER")}
              items={[
                { value: "MAINTENANCE_EXPENSE", label: t("expenseTypeMaintenance") },
                { value: "OTHER", label: t("expenseTypeOther") },
              ]}
            >
              <SelectTrigger id="expenseType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAINTENANCE_EXPENSE">{t("expenseTypeMaintenance")}</SelectItem>
                <SelectItem value="OTHER">{t("expenseTypeOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("amount")} htmlFor="expenseAmount" required>
            <Input id="expenseAmount" name="amount" type="number" step="any" min={0} required />
          </FormField>
          <FormField label={t("date")} htmlFor="expenseDate" required>
            <Input id="expenseDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          <FormField label={t("unitOptional")} htmlFor="expenseUnit">
            <Select
              value={unitId}
              onValueChange={(v) => setUnitId(v ?? NONE_VALUE)}
              items={[
                { value: NONE_VALUE, label: t("noSpecificUnit") },
                ...units.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` })),
              ]}
            >
              <SelectTrigger id="expenseUnit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t("noSpecificUnit")}</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} · {u.unitTypeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("paymentMethod")} htmlFor="expenseMethod">
            <Select
              value={method}
              onValueChange={(v) => setMethod(v ?? NONE_VALUE)}
              items={[
                { value: NONE_VALUE, label: t("noPaymentRecord") },
                { value: "CASH", label: t("paymentMethodCash") },
                { value: "BKASH", label: t("paymentMethodBkash") },
                { value: "NAGAD", label: t("paymentMethodNagad") },
                { value: "BANK", label: t("paymentMethodBank") },
                { value: "OTHER", label: t("paymentMethodOther") },
              ]}
            >
              <SelectTrigger id="expenseMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t("noPaymentRecord")}</SelectItem>
                <SelectItem value="CASH">{t("paymentMethodCash")}</SelectItem>
                <SelectItem value="BKASH">{t("paymentMethodBkash")}</SelectItem>
                <SelectItem value="NAGAD">{t("paymentMethodNagad")}</SelectItem>
                <SelectItem value="BANK">{t("paymentMethodBank")}</SelectItem>
                <SelectItem value="OTHER">{t("paymentMethodOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("note")} htmlFor="expenseNotes" className="sm:col-span-2">
            <Textarea id="expenseNotes" name="notes" rows={2} />
          </FormField>

          <DialogFooter className="sm:col-span-2">
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
