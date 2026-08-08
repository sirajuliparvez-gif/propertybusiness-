"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintButton() {
  const t = useTranslations("Properties");
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-3.5" />
      {t("printOrDownload")}
    </Button>
  );
}
