"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageSetting() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const options = [
    { value: "bn", label: t("langBn") },
    { value: "en", label: t("langEn") },
  ] as const;

  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1 sm:inline-grid sm:w-auto sm:auto-cols-max sm:grid-flow-col">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => router.replace(pathname, { locale: opt.value })}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            locale === opt.value
              ? "bg-card text-foreground shadow-(--shadow-xs)"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
