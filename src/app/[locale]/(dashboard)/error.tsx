"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown instead of Next's generic error page when a page or an action throws,
// so staff get a readable message and a way to retry in their own language.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Auth");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="text-xl font-bold tracking-tight">{t("errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
      <Button onClick={reset}>{t("errorRetry")}</Button>
    </div>
  );
}
