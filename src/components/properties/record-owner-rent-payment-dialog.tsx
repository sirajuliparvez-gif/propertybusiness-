"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wallet } from "lucide-react";
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
import { recordOwnerRentPayment } from "@/lib/actions/owner-lease";

const WHOLE_PROPERTY = "WHOLE_PROPERTY";

export function RecordOwnerRentPaymentDialog({
  propertyId,
  ownerLeaseAgreementId,
  defaultAmount,
  units,
}: {
  propertyId: string;
  ownerLeaseAgreementId: string;
  defaultAmount: number;
  units: { id: string; label: string; unitTypeLabel: string; ownerRentAmount: number | null }[];
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState("NONE");
  const [unitId, setUnitId] = useState(WHOLE_PROPERTY);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const todayValue = new Date().toISOString().slice(0, 10);

  function handleUnitChange(v: string | null) {
    const next = v ?? WHOLE_PROPERTY;
    setUnitId(next);
    if (next === WHOLE_PROPERTY) {
      setAmount(defaultAmount ? String(defaultAmount) : "");
    } else {
      const unit = units.find((u) => u.id === next);
      setAmount(unit?.ownerRentAmount != null ? String(unit.ownerRentAmount) : "");
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wallet className="size-3.5" />
        {t("recordRentPayment")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recordRentPayment")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => recordOwnerRentPayment(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="ownerLeaseAgreementId" value={ownerLeaseAgreementId} />
          <input type="hidden" name="method" value={method} />
          <input type="hidden" name="unitId" value={unitId === WHOLE_PROPERTY ? "" : unitId} />

          {units.length > 0 ? (
            <FormField label={t("unitOptional")} htmlFor="ownerPaymentUnit" className="sm:col-span-2">
              <Select
                value={unitId}
                onValueChange={handleUnitChange}
                items={[
                  { value: WHOLE_PROPERTY, label: t("wholeProperty") },
                  ...units.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` })),
                ]}
              >
                <SelectTrigger id="ownerPaymentUnit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WHOLE_PROPERTY}>{t("wholeProperty")}</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label} · {u.unitTypeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <FormField label={t("amount")} htmlFor="ownerPaymentAmount" required>
            <Input
              id="ownerPaymentAmount"
              name="amount"
              type="number"
              step="any"
              min={0}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("paymentDate")} htmlFor="ownerPaymentDate" required>
            <Input id="ownerPaymentDate" name="date" type="date" defaultValue={todayValue} required />
          </FormField>

          <FormField label={t("paymentMethod")} htmlFor="ownerPaymentMethod" className="sm:col-span-2">
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
              <SelectTrigger id="ownerPaymentMethod" className="w-full">
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
