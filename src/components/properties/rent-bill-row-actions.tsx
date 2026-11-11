"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Pencil, Printer } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

type BillPopup = "print" | "receive" | "printed";

export function RentBillDates({ lastPrintedAt, lastReceivedAt }: {
  lastPrintedAt: Date | null;
  lastReceivedAt: Date | null;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();

  return (
    <dl className="grid w-fit grid-cols-[auto_auto] gap-x-3 gap-y-0.5 whitespace-nowrap text-xs">
      <dt className="text-muted-foreground">{t("rentBillLastPrintDate")}</dt>
      <dd>{lastPrintedAt ? formatDate(lastPrintedAt, locale) : "—"}</dd>
      <dt className="text-muted-foreground">{t("rentBillLastReceivedDate")}</dt>
      <dd>{lastReceivedAt ? formatDate(lastReceivedAt, locale) : "—"}</dd>
    </dl>
  );
}

export function RentBillRowActions({ leaseId, month, revision, scoped }: {
  leaseId: string; month: string; revision: number; scoped: boolean;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [popup, setPopup] = useState<BillPopup | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const query = new URLSearchParams({ month, embed: "1", ...(scoped ? { tenant: "1" } : {}) });
  if (popup === "print" || popup === "receive") query.set(popup, "1");
  const href = `/rent/${leaseId}/invoice?${query}`;
  const title = popup === "receive" ? t("rentBillReceive")
    : popup === "printed" ? t("rentBillPrinted") : t(revision ? "rentBillCorrection" : "invoicePrintBill");

  useEffect(() => {
    if (!popup) return;
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "rent-bill-dirty") dirty.current = event.data.dirty === true;
      if (event.data === "rent-bill-print-saved") {
        dirty.current = false;
        setPopup(null);
        router.refresh();
      }
      if (event.data === "rent-bill-print-cancelled") {
        if (dirty.current) setConfirmClose(true);
        else setPopup(null);
      }
    }
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("message", handleMessage);
    return () => { window.removeEventListener("message", handleMessage); window.removeEventListener("beforeunload", warn); };
  }, [popup, router]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {revision ? (
        <>
          <Button type="button" size="sm" variant="ghost" className="text-success" onClick={() => setPopup("printed")}>
            <Check className="size-4" />{t("rentBillPrinted")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPopup("print")}>
            <Pencil className="size-3.5" />{t("rentBillCorrectionCount", { count: revision - 1 })}
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setPopup("print")}>
          <Printer className="size-4" />{t("invoicePrintBill")}
        </Button>
      )}
      <Button type="button" size="sm" onClick={() => setPopup("receive")}>
        {t("rentBillReceive")}
      </Button>
      <Dialog open={popup != null} onOpenChange={(open) => {
        if (open) return;
        if (dirty.current) { setConfirmClose(true); return; }
        dirty.current = false;
        setPopup(null);
        router.refresh();
      }}>
        <DialogContent className={popup === "receive" ? "gap-2 p-3 sm:max-w-2xl sm:p-4" : "gap-2 p-3 sm:max-w-6xl sm:p-4"}>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {popup ? <iframe ref={frame} src={`/${locale}${href}`} title={title} className={popup === "receive" ? "h-[min(80dvh,44rem)] w-full rounded-lg border" : "h-[calc(100dvh-6rem)] w-full rounded-lg border"} /> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("invoiceUnsavedTitle")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("invoiceDiscardDraft")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmClose(false)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => {
              dirty.current = false; setConfirmClose(false); setPopup(null); router.refresh();
            }}>{t("invoiceDiscardAndClose")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
