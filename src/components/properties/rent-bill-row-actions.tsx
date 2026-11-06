"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Pencil, Printer } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BillPopup = "print" | "receive" | "printed";

export function RentBillRowActions({ leaseId, month, revision, scoped }: {
  leaseId: string; month: string; revision: number; scoped: boolean;
}) {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const router = useRouter();
  const [popup, setPopup] = useState<BillPopup | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const query = new URLSearchParams({ month, embed: "1", ...(scoped ? { tenant: "1" } : {}) });
  if (popup === "print" || popup === "receive") query.set(popup, "1");
  const href = `/rent/${leaseId}/invoice?${query}`;
  const title = popup === "receive" ? t("rentBillReceive")
    : popup === "printed" ? t("rentBillPrinted") : t(revision ? "rentBillCorrection" : "invoicePrintBill");

  useEffect(() => {
    if (!popup) return;
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data === "rent-bill-print-saved") {
        setPopup(null);
        router.refresh();
      }
      if (event.data === "rent-bill-print-cancelled") setPopup(null);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
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
        setPopup(null);
        router.refresh();
      }}>
        <DialogContent className="gap-2 p-3 sm:max-w-2xl sm:p-4">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {popup ? <iframe ref={frame} src={`/${locale}${href}`} title={title} className="h-[min(80dvh,44rem)] w-full rounded-lg border" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
