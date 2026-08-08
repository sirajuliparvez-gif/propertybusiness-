"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { GuestStayActions } from "@/components/properties/guest-stay-actions";
import { CheckoutGuestStayDialog } from "@/components/properties/checkout-guest-stay-dialog";
import { CollectGuestStayPaymentDialog } from "@/components/properties/collect-guest-stay-payment-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

type GuestStayRow = {
  id: string;
  guestName: string;
  guestPhone: string | null;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  checkInDate: Date;
  checkOutDate: Date | null;
  totalAmount: number;
  depositAmount: number | null;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  remaining: number;
};

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-warning/15 text-warning",
  CHECKED_IN: "bg-success/15 text-success",
  CHECKED_OUT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground line-through",
  NO_SHOW: "bg-destructive/15 text-destructive",
};

export function MobileGuestStaysList({ bookings }: { bookings: GuestStayRow[] }) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("ALL");

  const statusLabels: Record<string, string> = {
    RESERVED: t("statusReserved"),
    CHECKED_IN: t("statusCheckedIn"),
    CHECKED_OUT: t("statusCheckedOut"),
    CANCELLED: t("statusCancelled"),
    NO_SHOW: t("statusNoShow"),
  };

  const filtered = useMemo(
    () => (filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter)),
    [bookings, filter]
  );

  if (bookings.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground md:hidden">{t("noBookings")}</p>;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL", label: t("filterAll") },
    { key: "RESERVED", label: t("statusReserved") },
    { key: "CHECKED_IN", label: t("statusCheckedIn") },
    { key: "CHECKED_OUT", label: t("statusCheckedOut") },
    { key: "CANCELLED", label: t("statusCancelled") },
    { key: "NO_SHOW", label: t("statusNoShow") },
  ];

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noBookings")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => {
            const isFinal = b.status === "CHECKED_OUT" || b.status === "CANCELLED" || b.status === "NO_SHOW";
            return (
              <Card key={b.id} className={cn("p-0", isFinal ? "opacity-70" : undefined)}>
                <div className="flex items-center gap-3 p-4">
                  <InitialAvatar name={b.guestName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.guestName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.propertyName} · {b.unitLabel}
                    </p>
                  </div>
                  <Badge className={cn("border-transparent shrink-0", STATUS_STYLES[b.status])}>
                    {statusLabels[b.status] ?? b.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {formatDate(b.checkInDate)} – {b.checkOutDate ? formatDate(b.checkOutDate) : "…"}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-semibold tabular-nums">{formatTaka(b.totalAmount)}</span>
                    {b.remaining > 0 && b.status !== "CANCELLED" ? (
                      <span className="ml-1.5 font-mono text-warning tabular-nums">
                        ({t("remaining")}: {formatTaka(b.remaining)})
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5 border-t px-4 py-2">
                  {b.remaining > 0 && b.status !== "CANCELLED" && b.status !== "NO_SHOW" ? (
                    <CollectGuestStayPaymentDialog
                      propertyId={b.propertyId}
                      guestStayId={b.id}
                      defaultAmount={b.remaining}
                      returnTo="/guest-stays"
                      iconOnly
                    />
                  ) : null}
                  {b.status === "CHECKED_IN" ? (
                    <CheckoutGuestStayDialog
                      guestStayId={b.id}
                      propertyId={b.propertyId}
                      depositAmount={b.depositAmount}
                      returnTo="/guest-stays"
                      iconOnly
                    />
                  ) : (
                    <GuestStayActions
                      guestStayId={b.id}
                      propertyId={b.propertyId}
                      status={b.status}
                      returnTo="/guest-stays"
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
