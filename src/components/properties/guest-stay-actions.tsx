"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogIn, Ban, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateGuestStayStatus } from "@/lib/actions/guest-stays";

// Simple one-click status flips — no confirmation needed, same precedent as
// EmployeeActions' activate/deactivate toggle. Checkout (has a deposit-refund
// decision) is its own dialog component, not bundled in here.
export function GuestStayActions({
  guestStayId,
  propertyId,
  status,
  returnTo,
}: {
  guestStayId: string;
  propertyId: string;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  returnTo?: string;
}) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();

  if (status !== "RESERVED") return null;

  function submitStatus(next: string) {
    const formData = new FormData();
    formData.set("guestStayId", guestStayId);
    formData.set("propertyId", propertyId);
    formData.set("status", next);
    if (returnTo) formData.set("returnTo", returnTo);
    startTransition(() => updateGuestStayStatus(formData));
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={isPending}
        title={t("checkInAction")}
        onClick={() => submitStatus("CHECKED_IN")}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
        <span className="sr-only">{t("checkInAction")}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        title={t("markNoShow")}
        onClick={() => submitStatus("NO_SHOW")}
      >
        <UserX className="size-3.5" />
        <span className="sr-only">{t("markNoShow")}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        title={t("cancelBooking")}
        onClick={() => submitStatus("CANCELLED")}
      >
        <Ban className="size-3.5" />
        <span className="sr-only">{t("cancelBooking")}</span>
      </Button>
    </div>
  );
}
