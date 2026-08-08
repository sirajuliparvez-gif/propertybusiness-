"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Power, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { updateEmployeeStatus, terminateEmployee } from "@/lib/actions/employees";

export function EmployeeActions({
  employeeId,
  propertyId,
  status,
  returnTo,
}: {
  employeeId: string;
  propertyId: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();

  if (status === "TERMINATED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <form action={(formData: FormData) => startTransition(() => updateEmployeeStatus(formData))}>
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="propertyId" value={propertyId ?? ""} />
        <input type="hidden" name="status" value={status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          title={status === "ACTIVE" ? t("deactivateEmployee") : t("activateEmployee")}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
          <span className="sr-only">
            {status === "ACTIVE" ? t("deactivateEmployee") : t("activateEmployee")}
          </span>
        </Button>
      </form>

      <Dialog>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              title={t("terminateEmployee")}
            />
          }
        >
          <UserX className="size-3.5" />
          <span className="sr-only">{t("terminateEmployee")}</span>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTerminateTitle")}</DialogTitle>
            <DialogDescription>{t("confirmTerminateDesc")}</DialogDescription>
          </DialogHeader>
          <form action={(formData: FormData) => startTransition(() => terminateEmployee(formData))}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="propertyId" value={propertyId ?? ""} />
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("terminateEmployee")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
