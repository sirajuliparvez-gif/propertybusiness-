"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatTaka, monthLabel } from "@/lib/format";
import type { RentActionResult } from "@/lib/rent-action-feedback";

const RESULTS = new Set<RentActionResult>([
  "recorded",
  "alreadyPaid",
  "advance",
  "overdue",
  "updated",
  "deleted",
]);

export function RentActionFeedback() {
  const t = useTranslations("Properties");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resultValue = searchParams.get("rentResult") as RentActionResult | null;

  useEffect(() => {
    if (!resultValue || !RESULTS.has(resultValue)) return;

    const month = searchParams.get("rentMonth");
    const amount = Number(searchParams.get("rentAmount") ?? 0);
    const count = Number(searchParams.get("rentCount") ?? 0);
    const monthText = month ? monthLabel(month, locale) : "";
    const amountText = amount > 0 ? formatTaka(amount) : "";
    const message =
      resultValue === "recorded"
        ? t("rentFeedbackRecorded", { month: monthText, amount: amountText })
        : resultValue === "alreadyPaid"
          ? t("rentFeedbackAlreadyPaid", { month: monthText })
          : resultValue === "advance"
            ? t("rentFeedbackAdvance", { count, amount: amountText })
            : resultValue === "overdue"
              ? t("rentFeedbackOverdue", { amount: amountText })
              : resultValue === "updated"
                ? t("rentFeedbackUpdated", { month: monthText })
                : t("rentFeedbackDeleted", { month: monthText });

    if (resultValue === "alreadyPaid") toast.info(message, { id: "rent-action-feedback" });
    else toast.success(message, { id: "rent-action-feedback" });

    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete("rentResult");
    cleaned.delete("rentMonth");
    cleaned.delete("rentAmount");
    cleaned.delete("rentCount");
    router.replace(cleaned.size > 0 ? `${pathname}?${cleaned}` : pathname);
  }, [locale, pathname, resultValue, router, searchParams, t]);

  return null;
}
