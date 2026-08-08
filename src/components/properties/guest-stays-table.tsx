"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InitialAvatar } from "@/components/properties/initial-avatar";
import { GuestStayActions } from "@/components/properties/guest-stay-actions";
import { CheckoutGuestStayDialog } from "@/components/properties/checkout-guest-stay-dialog";
import { CollectGuestStayPaymentDialog } from "@/components/properties/collect-guest-stay-payment-dialog";
import { formatTaka, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
const ALL_PROPERTIES = "ALL";

// Minimal row shape both the global page's AllGuestStaysData["bookings"] and
// the per-property page's getPropertyDetail() guestStays array already
// satisfy — kept narrow (only what this table/its dialogs actually render)
// so neither caller has to over-fetch fields the other doesn't have.
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

function BookingStatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const styles: Record<string, string> = {
    RESERVED: "bg-warning/15 text-warning",
    CHECKED_IN: "bg-success/15 text-success",
    CHECKED_OUT: "bg-muted text-muted-foreground",
    CANCELLED: "bg-muted text-muted-foreground line-through",
    NO_SHOW: "bg-destructive/15 text-destructive",
  };
  return <Badge className={cn("border-transparent", styles[status])}>{labels[status] ?? status}</Badge>;
}

export function GuestStaysTable({
  bookings,
  showPropertyColumn = false,
}: {
  bookings: GuestStayRow[];
  showPropertyColumn?: boolean;
}) {
  const t = useTranslations("Properties");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [propertyFilter, setPropertyFilter] = useState(ALL_PROPERTIES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statusLabels: Record<string, string> = {
    RESERVED: t("statusReserved"),
    CHECKED_IN: t("statusCheckedIn"),
    CHECKED_OUT: t("statusCheckedOut"),
    CANCELLED: t("statusCancelled"),
    NO_SHOW: t("statusNoShow"),
  };

  const properties = useMemo(() => {
    const byId = new Map<string, string>();
    bookings.forEach((b) => {
      if (!byId.has(b.propertyId)) byId.set(b.propertyId, b.propertyName);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [bookings]);

  const filtered = useMemo(() => {
    let rows = bookings;
    if (filter !== "ALL") rows = rows.filter((b) => b.status === filter);
    if (propertyFilter !== ALL_PROPERTIES) rows = rows.filter((b) => b.propertyId === propertyFilter);

    if (!dateFrom && !dateTo) return rows;
    const rangeStart = dateFrom ? new Date(dateFrom) : null;
    const rangeEnd = dateTo ? new Date(dateTo) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);
    return rows.filter((b) => {
      const start = new Date(b.checkInDate);
      const end = b.checkOutDate ? new Date(b.checkOutDate) : null;
      const startsBeforeRangeEnds = !rangeEnd || start < rangeEnd;
      const endsAfterRangeStarts = !rangeStart || !end || end >= rangeStart;
      return startsBeforeRangeEnds && endsAfterRangeStarts;
    });
  }, [bookings, filter, propertyFilter, dateFrom, dateTo]);

  if (bookings.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noBookings")}</p>;
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t("dateRangeFrom")}
            className="h-8 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t("dateRangeTo")}
            className="h-8 w-36 text-xs"
          />
          {dateFrom || dateTo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              {t("clearDateRange")}
            </Button>
          ) : null}

          {showPropertyColumn && properties.length > 0 ? (
            <Select
              value={propertyFilter}
              onValueChange={(v) => setPropertyFilter(v ?? ALL_PROPERTIES)}
              items={[
                { value: ALL_PROPERTIES, label: t("allProperties") },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROPERTIES}>{t("allProperties")}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noBookings")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("guestNameLabel")}</TableHead>
              {showPropertyColumn ? <TableHead>{t("propertyLabel")}</TableHead> : null}
              <TableHead>{t("unit")}</TableHead>
              <TableHead>{t("checkInDateLabel")}</TableHead>
              <TableHead>{t("checkOutDateLabel")}</TableHead>
              <TableHead className="text-right">{t("totalAmountLabel")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => {
              const isFinal = b.status === "CHECKED_OUT" || b.status === "CANCELLED" || b.status === "NO_SHOW";
              return (
                <TableRow key={b.id} className={isFinal ? "opacity-70" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={b.guestName} />
                      <div className="flex flex-col">
                        {b.guestName}
                        {b.guestPhone ? (
                          <span className="font-mono text-xs text-muted-foreground">{b.guestPhone}</span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  {showPropertyColumn ? (
                    <TableCell>
                      <Link
                        href={`/properties/${b.propertyId}`}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {b.propertyName}
                      </Link>
                    </TableCell>
                  ) : null}
                  <TableCell className="font-mono text-muted-foreground">{b.unitLabel}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{formatDate(b.checkInDate)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {b.checkOutDate ? formatDate(b.checkOutDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono tabular-nums">{formatTaka(b.totalAmount)}</span>
                      {b.remaining > 0 && b.status !== "CANCELLED" ? (
                        <span className="font-mono text-xs text-warning tabular-nums">
                          {t("remaining")}: {formatTaka(b.remaining)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <BookingStatusBadge status={b.status} labels={statusLabels} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {b.remaining > 0 && b.status !== "CANCELLED" && b.status !== "NO_SHOW" ? (
                        <CollectGuestStayPaymentDialog
                          propertyId={b.propertyId}
                          guestStayId={b.id}
                          defaultAmount={b.remaining}
                          returnTo={showPropertyColumn ? "/guest-stays" : undefined}
                          iconOnly
                        />
                      ) : null}
                      {b.status === "CHECKED_IN" ? (
                        <CheckoutGuestStayDialog
                          guestStayId={b.id}
                          propertyId={b.propertyId}
                          depositAmount={b.depositAmount}
                          returnTo={showPropertyColumn ? "/guest-stays" : undefined}
                          iconOnly
                        />
                      ) : (
                        <GuestStayActions
                          guestStayId={b.id}
                          propertyId={b.propertyId}
                          status={b.status}
                          returnTo={showPropertyColumn ? "/guest-stays" : undefined}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
