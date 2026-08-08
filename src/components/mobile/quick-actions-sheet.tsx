"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Building2, Wallet, Zap, HardHat, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function QuickActionsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Mobile");

  const actions = [
    { href: "/properties/new", label: t("newProperty"), icon: Building2, tone: "text-blue-600 dark:text-blue-400 bg-linear-to-br from-blue-500/20 to-blue-500/5" },
    { href: "/rent", label: t("recordRent"), icon: Wallet, tone: "text-success bg-linear-to-br from-success/25 to-success/5" },
    { href: "/tenants", label: t("newTenant"), icon: Users, tone: "text-blue-600 dark:text-blue-400 bg-linear-to-br from-blue-500/20 to-blue-500/5" },
    { href: "/utility-bills", label: t("newUtilityBill"), icon: Zap, tone: "text-warning bg-linear-to-br from-warning/25 to-warning/5" },
    { href: "/employees", label: t("newEmployee"), icon: HardHat, tone: "text-violet-600 dark:text-violet-400 bg-linear-to-br from-violet-500/20 to-violet-500/5" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <SheetHeader>
          <SheetTitle>{t("quickActionsTitle")}</SheetTitle>
          <SheetDescription>{t("quickActionsDesc")}</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => onOpenChange(false)}
              className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 text-center transition-colors active:bg-muted"
            >
              <span className={`flex size-10 items-center justify-center rounded-lg ${action.tone}`}>
                <action.icon className="size-5" />
              </span>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
