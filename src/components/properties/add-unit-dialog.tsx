"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/properties/form-field";
import { addUnitToType, type AddUnitErrorCode } from "@/lib/actions/units";
import { MAX_UNIT_LABEL_LENGTH } from "@/lib/unit-label-key";

// One-step "add a unit": just its number or name. It joins this unit type and takes the type's
// size and rent, unless a different rent is typed.
export function AddUnitDialog({
  propertyId,
  unitTypeId,
  unitTypeLabel,
}: {
  propertyId: string;
  unitTypeId: string;
  unitTypeLabel: string;
}) {
  const t = useTranslations("Properties");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<AddUnitErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const errorMessages: Record<AddUnitErrorCode, string> = {
    missingLabel: t("addUnitErrMissingLabel"),
    labelTooLong: t("addUnitErrTooLong", { max: MAX_UNIT_LABEL_LENGTH }),
    invalidRent: t("addUnitErrRent"),
    notFound: t("addUnitErrNotFound"),
    duplicateLabel: t("addUnitErrDuplicate"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Plus className="size-3.5" />
        {t("addUnit")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addUnitTitle", { type: unitTypeLabel })}</DialogTitle>
          <DialogDescription>{t("addUnitDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              setError(null);
              const result = await addUnitToType(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(t("addUnitSuccess", { label: result.label }));
              setOpen(false);
              router.refresh();
            })
          }
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="unitTypeId" value={unitTypeId} />
          <FormField label={t("addUnitNumber")} htmlFor={`add-unit-label-${unitTypeId}`} required>
            <Input
              id={`add-unit-label-${unitTypeId}`}
              name="label"
              required
              autoFocus
              maxLength={MAX_UNIT_LABEL_LENGTH}
              placeholder={t("addUnitNumberPlaceholder")}
            />
          </FormField>
          <FormField label={t("addUnitRent")} htmlFor={`add-unit-rent-${unitTypeId}`}>
            <Input
              id={`add-unit-rent-${unitTypeId}`}
              name="tenantDefaultRentAmount"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder={t("addUnitRentPlaceholder")}
            />
          </FormField>
          {error ? (
            <p role="alert" className="text-sm text-destructive">{errorMessages[error]}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t("addUnit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
