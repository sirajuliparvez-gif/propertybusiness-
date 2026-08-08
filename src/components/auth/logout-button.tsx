"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";

export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const t = useTranslations("Auth");

  return (
    <form action={logout}>
      <Button
        type="submit"
        variant={variant === "icon" ? "ghost" : "outline"}
        size={variant === "icon" ? "icon" : "sm"}
        className={variant === "icon" ? "size-8" : undefined}
        title={variant === "icon" ? t("logout") : undefined}
      >
        <LogOut className="size-4" />
        {variant === "full" ? t("logout") : <span className="sr-only">{t("logout")}</span>}
      </Button>
    </form>
  );
}
