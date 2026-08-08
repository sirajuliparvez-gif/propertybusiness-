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
import { DocumentUploadField } from "@/components/properties/document-upload-field";
import { createGuestStay } from "@/lib/actions/guest-stays";
import type { AllGuestStaysData } from "@/lib/guest-stays-data";

export function AddGuestStayDialogGlobal({
  properties,
  initialPropertyId,
  initialUnitId,
  returnTo,
  triggerClassName,
}: {
  properties: AllGuestStaysData["propertiesWithUnits"];
  initialPropertyId?: string;
  initialUnitId?: string;
  returnTo?: string;
  triggerClassName?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const initialProperty = properties.find((p) => p.id === initialPropertyId) ?? properties[0];
  const initialUnit = initialProperty?.units.find((u) => u.id === initialUnitId) ?? initialProperty?.units[0];
  const [propertyId, setPropertyId] = useState(initialProperty?.id ?? "");
  const [unitId, setUnitId] = useState(initialUnit?.id ?? "");
  const [guestIdType, setGuestIdType] = useState("NID");
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState("");
  const [ratePerNight, setRatePerNight] = useState(
    initialUnit?.tenantDefaultNightlyRateAmount != null ? String(initialUnit.tenantDefaultNightlyRateAmount) : ""
  );
  const [totalAmount, setTotalAmount] = useState("");
  const [totalAmountTouched, setTotalAmountTouched] = useState(false);

  const unitsForProperty = useMemo(
    () => properties.find((p) => p.id === propertyId)?.units ?? [],
    [properties, propertyId]
  );

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return null;
    const d = Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000);
    return d > 0 ? d : null;
  }, [checkInDate, checkOutDate]);

  function applyAutoTotal(rate: string, n: number | null) {
    if (totalAmountTouched || !rate || !n) return;
    setTotalAmount(String(Number(rate) * n));
  }

  function handlePropertyChange(v: string | null) {
    const next = v ?? "";
    setPropertyId(next);
    const units = properties.find((p) => p.id === next)?.units ?? [];
    const nextUnitId = units[0]?.id ?? "";
    setUnitId(nextUnitId);
    const rate = units[0]?.tenantDefaultNightlyRateAmount;
    const rateStr = rate != null ? String(rate) : "";
    setRatePerNight(rateStr);
    applyAutoTotal(rateStr, nights);
  }

  function handleUnitChange(v: string | null) {
    const next = v ?? "";
    setUnitId(next);
    const unit = unitsForProperty.find((u) => u.id === next);
    const rateStr = unit?.tenantDefaultNightlyRateAmount != null ? String(unit.tenantDefaultNightlyRateAmount) : "";
    setRatePerNight(rateStr);
    applyAutoTotal(rateStr, nights);
  }

  function handleCheckOutChange(value: string) {
    setCheckOutDate(value);
    const n =
      checkInDate && value
        ? Math.round((new Date(value).getTime() - new Date(checkInDate).getTime()) / 86_400_000)
        : null;
    applyAutoTotal(ratePerNight, n && n > 0 ? n : null);
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" className={triggerClassName} />}>
        <Plus className="size-3.5" />
        {t("addBooking")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addBooking")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => createGuestStay(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="unitId" value={unitId} />
          <input type="hidden" name="guestIdType" value={guestIdType} />
          <input type="hidden" name="returnTo" value={returnTo ?? "/guest-stays"} />

          <FormField label={t("propertyLabel")} htmlFor="addGuestStayProperty" required>
            <Select
              value={propertyId}
              onValueChange={handlePropertyChange}
              items={properties.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger id="addGuestStayProperty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("unit")} htmlFor="addGuestStayUnit" required>
            <Select
              value={unitId}
              onValueChange={handleUnitChange}
              items={unitsForProperty.map((u) => ({ value: u.id, label: `${u.label} · ${u.unitTypeLabel}` }))}
            >
              <SelectTrigger id="addGuestStayUnit" className="w-full">
                <SelectValue placeholder={t("selectUnit")} />
              </SelectTrigger>
              <SelectContent>
                {unitsForProperty.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} · {u.unitTypeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("guestNameLabel")} htmlFor="addGuestStayName" required className="sm:col-span-2">
            <Input id="addGuestStayName" name="guestName" required />
          </FormField>
          <FormField label={t("phone")} htmlFor="addGuestStayPhone">
            <Input id="addGuestStayPhone" name="guestPhone" className="font-mono" />
          </FormField>
          <FormField label={t("address")} htmlFor="addGuestStayAddress">
            <Input id="addGuestStayAddress" name="guestAddress" />
          </FormField>

          <FormField label={t("guestIdTypeLabel")} htmlFor="addGuestStayIdType">
            <Select
              value={guestIdType}
              onValueChange={(v) => setGuestIdType(v ?? "NID")}
              items={[
                { value: "NID", label: t("guestIdTypeNid") },
                { value: "PASSPORT", label: t("guestIdTypePassport") },
                { value: "OTHER", label: t("expenseTypeOther") },
              ]}
            >
              <SelectTrigger id="addGuestStayIdType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NID">{t("guestIdTypeNid")}</SelectItem>
                <SelectItem value="PASSPORT">{t("guestIdTypePassport")}</SelectItem>
                <SelectItem value="OTHER">{t("expenseTypeOther")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("guestIdNumberLabel")} htmlFor="addGuestStayIdNumber">
            <Input id="addGuestStayIdNumber" name="guestIdNumber" />
          </FormField>

          <FormField label={t("guestIdPhotoLabel")} htmlFor="addGuestStayIdUpload" className="sm:col-span-2">
            <DocumentUploadField urlFieldName="idDocumentUrl" typeFieldName="idDocumentFileType" />
          </FormField>

          <FormField label={t("numberOfGuestsLabel")} htmlFor="addGuestStayCount">
            <Input id="addGuestStayCount" name="numberOfGuests" type="number" min={1} step={1} defaultValue={1} />
          </FormField>
          <div />

          <FormField label={t("checkInDateLabel")} htmlFor="addGuestStayCheckIn" required>
            <Input
              id="addGuestStayCheckIn"
              name="checkInDate"
              type="date"
              required
              value={checkInDate}
              onChange={(e) => {
                setCheckInDate(e.target.value);
                const n =
                  e.target.value && checkOutDate
                    ? Math.round((new Date(checkOutDate).getTime() - new Date(e.target.value).getTime()) / 86_400_000)
                    : null;
                applyAutoTotal(ratePerNight, n && n > 0 ? n : null);
              }}
            />
          </FormField>
          <FormField label={t("checkOutDateLabel")} htmlFor="addGuestStayCheckOut">
            <Input
              id="addGuestStayCheckOut"
              name="checkOutDate"
              type="date"
              value={checkOutDate}
              onChange={(e) => handleCheckOutChange(e.target.value)}
            />
            {nights ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {nights} {t("nightsLabel")}
              </p>
            ) : null}
          </FormField>

          <FormField label={t("ratePerNightLabel")} htmlFor="addGuestStayRate" required>
            <Input
              id="addGuestStayRate"
              name="ratePerNight"
              type="number"
              step="any"
              min={0}
              required
              value={ratePerNight}
              onChange={(e) => {
                setRatePerNight(e.target.value);
                applyAutoTotal(e.target.value, nights);
              }}
            />
          </FormField>
          <FormField label={t("totalAmountLabel")} htmlFor="addGuestStayTotal" required>
            <Input
              id="addGuestStayTotal"
              name="totalAmount"
              type="number"
              step="any"
              min={0}
              required
              value={totalAmount}
              onChange={(e) => {
                setTotalAmountTouched(true);
                setTotalAmount(e.target.value);
              }}
            />
          </FormField>

          <FormField label={t("depositAmountLabel")} htmlFor="addGuestStayDeposit" className="sm:col-span-2">
            <Input id="addGuestStayDeposit" name="depositAmount" type="number" step="any" min={0} />
          </FormField>

          <FormField label={t("notes")} htmlFor="addGuestStayNotes" className="sm:col-span-2">
            <Textarea id="addGuestStayNotes" name="notes" rows={2} />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !propertyId || !unitId}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />}
              {t("addBooking")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
