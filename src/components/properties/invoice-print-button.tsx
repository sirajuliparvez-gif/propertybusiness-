"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintButton({ label, printOnOpen = false }: { label?: string; printOnOpen?: boolean }) {
  const t = useTranslations("Properties");
  const printed = useRef(false);
  useEffect(() => {
    if (!printOnOpen || printed.current) return;
    let active = true;
    void document.fonts.ready.then(() => {
      if (!active || printed.current) return;
      printed.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("print");
      window.history.replaceState(window.history.state, "", url);
      window.print();
    });
    return () => { active = false; };
  }, [printOnOpen]);
  return (
    <Button type="button" variant={label ? "outline" : "default"} onClick={() => window.print()} className="print:hidden">
      <Printer className="size-3.5" />
      {label ?? t("printOrDownload")}
    </Button>
  );
}
