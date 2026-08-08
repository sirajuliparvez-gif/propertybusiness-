"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/properties/form-field";

export function OwnerPicker({
  owners,
  defaultOwnerId,
}: {
  owners: { id: string; name: string }[];
  defaultOwnerId?: string;
}) {
  const t = useTranslations("Properties");
  const [mode, setMode] = useState<"existing" | "new">("existing");

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="ownerMode" value={mode} />
      <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
        <TabsList className="h-8">
          <TabsTrigger value="existing" className="text-xs">
            {t("useExistingOwner")}
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs">
            {t("addNewOwner")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "existing" ? (
        <FormField label={t("owner")} htmlFor="ownerId" required>
          <Select name="ownerId" defaultValue={defaultOwnerId} items={owners.map((o) => ({ value: o.id, label: o.name }))}>
            <SelectTrigger id="ownerId" className="w-full">
              <SelectValue placeholder={t("selectOwner")} />
            </SelectTrigger>
            <SelectContent>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("ownerName")} htmlFor="newOwnerName" required>
            <Input id="newOwnerName" name="newOwnerName" required={mode === "new"} />
          </FormField>
          <FormField label={t("ownerContact")} htmlFor="newOwnerContact">
            <Input id="newOwnerContact" name="newOwnerContact" />
          </FormField>
          <FormField label={t("ownerAddress")} htmlFor="newOwnerAddress" className="sm:col-span-2">
            <Input id="newOwnerAddress" name="newOwnerAddress" />
          </FormField>
        </div>
      )}
    </div>
  );
}
