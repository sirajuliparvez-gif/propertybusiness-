"use client";

import { useTranslations } from "next-intl";
import { Check, Pencil, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function RentBillRowActions({ leaseId, month, revision, scoped }: {
  leaseId: string; month: string; revision: number; scoped: boolean;
}) {
  const t = useTranslations("Properties");
  const href = `/rent/${leaseId}/invoice?month=${month}${scoped ? "&tenant=1" : ""}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {revision ? (
        <>
          <Button size="sm" variant="ghost" className="text-success" render={<Link href={href} prefetch={false} />} nativeButton={false}>
            <Check className="size-4" />{t("rentBillPrinted")}
          </Button>
          <Button size="sm" variant="outline" render={<Link href={`${href}&print=1`} prefetch={false} />} nativeButton={false}>
            <Pencil className="size-3.5" />{t("rentBillCorrectionCount", { count: revision - 1 })}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" render={<Link href={`${href}&print=1`} prefetch={false} />} nativeButton={false}>
          <Printer className="size-4" />{t("invoicePrintBill")}
        </Button>
      )}
      <Button size="sm" render={<Link href={`${href}&receive=1`} prefetch={false} />} nativeButton={false}>
        {t("rentBillReceive")}
      </Button>
    </div>
  );
}
