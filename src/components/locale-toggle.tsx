"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const nextLocale = locale === "bn" ? "en" : "bn";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2.5 font-medium"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
    >
      {nextLocale === "bn" ? "বাং" : "EN"}
    </Button>
  );
}
