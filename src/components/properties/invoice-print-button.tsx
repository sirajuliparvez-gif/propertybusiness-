"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintButton({ label }: { label?: string }) {
  const t = useTranslations("Properties");
  return (
    <Button type="button" variant={label ? "outline" : "default"} onClick={() => window.print()} className="print:hidden">
      <Printer className="size-3.5" />
      {label ?? t("printOrDownload")}
    </Button>
  );
}
