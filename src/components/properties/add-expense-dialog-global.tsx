"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { PropertyUnitOptions } from "@/lib/transactions-data";

const NONE_VALUE = "NONE";
const COMPANY_EXPENSE_VALUE = "COMPANY";

export function AddExpenseDialogGlobal({ properties }: { properties: PropertyUnitOptions }) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState(COMPANY_EXPENSE_VALUE);
  const [type, setType] = useState<"MAINTENANCE_EXPENSE" | "OTHER">("OTHER");
  const [unitId, setUnitId] = useState(NONE_VALUE);
  const [method, setMethod] = useState(NONE_VALUE);
  const todayValue = new Date().toISOString().slice(0, 10);

  const unitsForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.units ?? [],
    [properties, propertyId]
  );

  function handlePropertyChange(v: string | null) {
    setPropertyId(v ?? COMPANY_EXPENSE_VALUE);
    setUnitId(NONE_VALUE);
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        {t("addCompanyExpense")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addCompanyExpense")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => addExpense(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input
            type="hidden"
            name="propertyId"
            value={propertyId === COMPANY_EXPENSE_VALUE ? "" : propertyId}
          />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="unitId" value={unitId === NONE_VALUE ? "" : unitId} />
          <input type="hidden" name="method" value={method} />
          <input type="hidden" name="returnTo" value="/transactions" />

          <FormField label={t("propertyLabel")} htmlFor="globalExpenseProperty" required className="sm:col-span-2">
            <Select
              value={propertyId}
              onValueChange={handlePropertyChange}
              items={[
                { value: COMPANY_EXPENSE_VALUE, label: t("companyOfficeExpenseOption") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger id="globalExpenseProperty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COMPANY_EXPENSE_VALUE}>{t("companyOfficeExpenseOption")}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("category")} htmlFor="globalExpenseType" required className="sm:col-span-2">
            <Select
              value={type}
              onValueChange={(v) => setType((v as "MAINTENANCE_EXPENSE" | "OTHER") ?? "OTHER")}
              items={[
                { value: "MAINTENANCE_EXPENSE", label: t("expenseTypeMaintenance") },
                { value: "OTHER", label: t("expenseTypeOther") },
              ]}
            >
              <SelectTrigger id="globalExpenseType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAINTENANCE_EXPENSE">{t("expenseTypeMaintenance")}</SelectItem>
                <SelectItem value="OTHER">{t("expenseTypeOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("amount")} htmlFor="globalExpenseAmount" required>
            <Input id="globalExpenseAmount" name="amount" type="number" step="any" min={0} required />
          </FormField>
          <FormField label={t("date")} htmlFor="globalExpenseDate" required>
            <Input id="globalExpenseDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          {propertyId !== COMPANY_EXPENSE_VALUE ? (
            <FormField label={t("unitOptional")} htmlFor="globalExpenseUnit" className="sm:col-span-2">
              <Select
                value={unitId}
                onValueChange={(v) => setUnitId(v ?? NONE_VALUE)}
                items={[
                  { value: NONE_VALUE, label: t("noSpecificUnit") },
                  ...unitsForProperty.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` })),
                ]}
              >
                <SelectTrigger id="globalExpenseUnit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{t("noSpecificUnit")}</SelectItem>
                  {unitsForProperty.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label} · {u.unitTypeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <FormField label={t("paymentMethod")} htmlFor="globalExpenseMethod">
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
              <SelectTrigger id="globalExpenseMethod" className="w-full">
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

          <FormField label={t("note")} htmlFor="globalExpenseNotes" className="sm:col-span-2">
            <Textarea id="globalExpenseNotes" name="notes" rows={2} />
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
