"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil } from "lucide-react";
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
import { updateEmployee } from "@/lib/actions/employees";

const COMPANY_STAFF_VALUE = "COMPANY";

export function EditEmployeeDialog({
  employeeId,
  propertyId: initialPropertyId,
  properties,
  name,
  contactInfo,
  nidNumber,
  role,
  salaryAmount,
  notes,
  returnTo,
}: {
  employeeId: string;
  propertyId: string | null;
  properties: { id: string; name: string }[];
  name: string;
  contactInfo: string | null;
  nidNumber: string | null;
  role: string;
  salaryAmount: number;
  notes: string | null;
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? COMPANY_STAFF_VALUE);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Pencil className="size-3.5" />
        {t("edit")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editEmployeeTitle")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => updateEmployee(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="propertyId" value={propertyId === COMPANY_STAFF_VALUE ? "" : propertyId} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <FormField label={t("propertyLabel")} htmlFor="editEmployeeProperty" required className="sm:col-span-2">
            <Select
              value={propertyId}
              onValueChange={(v) => setPropertyId(v ?? COMPANY_STAFF_VALUE)}
              items={[
                { value: COMPANY_STAFF_VALUE, label: t("companyStaffOption") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger id="editEmployeeProperty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COMPANY_STAFF_VALUE}>{t("companyStaffOption")}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t("employeeName")} htmlFor="editEmployeeName" required className="sm:col-span-2">
            <Input id="editEmployeeName" name="name" defaultValue={name} required />
          </FormField>

          <FormField label={t("phone")} htmlFor="editEmployeeContact">
            <Input id="editEmployeeContact" name="contactInfo" className="font-mono" defaultValue={contactInfo ?? ""} />
          </FormField>
          <FormField label={t("nidNumber")} htmlFor="editEmployeeNid">
            <Input id="editEmployeeNid" name="nidNumber" defaultValue={nidNumber ?? ""} />
          </FormField>

          <FormField label={t("role")} htmlFor="editEmployeeRole" required className="sm:col-span-2">
            <Input id="editEmployeeRole" name="role" defaultValue={role} required />
          </FormField>

          <FormField label={t("salary")} htmlFor="editEmployeeSalary" required>
            <Input
              id="editEmployeeSalary"
              name="salaryAmount"
              type="number"
              step="any"
              min={0}
              required
              defaultValue={salaryAmount}
            />
          </FormField>

          <FormField label={t("notes")} htmlFor="editEmployeeNotes" className="sm:col-span-2">
            <Textarea id="editEmployeeNotes" name="notes" rows={2} defaultValue={notes ?? ""} />
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
