"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeSetting() {
  const t = useTranslations("Settings");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ] as const;

  return (
    <div className="grid w-full grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1 sm:inline-grid sm:w-auto sm:auto-cols-max sm:grid-flow-col">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={!mounted}
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            mounted && theme === opt.value
              ? "bg-card text-foreground shadow-(--shadow-xs)"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <opt.icon className="size-3.5" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
