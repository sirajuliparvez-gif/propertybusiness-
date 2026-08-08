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
import { createEmployee } from "@/lib/actions/employees";
import { cn } from "@/lib/utils";

const COMPANY_STAFF_VALUE = "COMPANY";

// Matches the role text already stored on real Employee rows in this
// database — quick-fill only, `role` stays a plain free-text field on the
// Employee model (not an enum), so anything typed here works too.
const ROLE_PRESETS = [
  { label: "কেয়ারটেকার", defaultSalary: 8000 },
  { label: "নিরাপত্তা প্রহরী", defaultSalary: 12000 },
  { label: "ক্লিনার", defaultSalary: 6500 },
  { label: "ব্যবস্থাপক", defaultSalary: 18000 },
  { label: "রিসেপশনিস্ট", defaultSalary: 14000 },
];

export function AddEmployeeDialogGlobal({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? COMPANY_STAFF_VALUE);
  const [role, setRole] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const todayValue = new Date().toISOString().slice(0, 10);

  function applyRolePreset(preset: (typeof ROLE_PRESETS)[number]) {
    setRole(preset.label);
    if (!salaryAmount) setSalaryAmount(String(preset.defaultSalary));
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        {t("addEmployee")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addEmployee")}</DialogTitle>
        </DialogHeader>
        <form
          action={(formData: FormData) => startTransition(() => createEmployee(formData))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="returnTo" value="/employees" />

          <FormField label={t("propertyLabel")} htmlFor="addEmployeeProperty" required className="sm:col-span-2">
            <Select
              value={propertyId}
              onValueChange={(v) => setPropertyId(v ?? COMPANY_STAFF_VALUE)}
              items={[
                { value: COMPANY_STAFF_VALUE, label: t("companyStaffOption") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger id="addEmployeeProperty" className="w-full">
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
            <input type="hidden" name="propertyId" value={propertyId === COMPANY_STAFF_VALUE ? "" : propertyId} />
          </FormField>

          <FormField label={t("employeeName")} htmlFor="addEmployeeName" required className="sm:col-span-2">
            <Input id="addEmployeeName" name="name" required />
          </FormField>

          <FormField label={t("phone")} htmlFor="addEmployeeContact">
            <Input id="addEmployeeContact" name="contactInfo" className="font-mono" />
          </FormField>
          <FormField label={t("nidNumber")} htmlFor="addEmployeeNid">
            <Input id="addEmployeeNid" name="nidNumber" />
          </FormField>

          <FormField label={t("role")} htmlFor="addEmployeeRole" required className="sm:col-span-2">
            <Input
              id="addEmployeeRole"
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="self-center text-xs text-muted-foreground">{t("quickRoles")}:</span>
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyRolePreset(preset)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    role === preset.label
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label={t("salary")} htmlFor="addEmployeeSalary" required>
            <Input
              id="addEmployeeSalary"
              name="salaryAmount"
              type="number"
              step="any"
              min={0}
              required
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
            />
          </FormField>
          <FormField label={t("joined")} htmlFor="addEmployeeJoinedAt" required>
            <Input id="addEmployeeJoinedAt" name="joinedAt" type="date" required defaultValue={todayValue} />
          </FormField>

          <FormField label={t("notes")} htmlFor="addEmployeeNotes" className="sm:col-span-2">
            <Textarea id="addEmployeeNotes" name="notes" rows={2} />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !propertyId}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />}
              {t("addEmployee")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
