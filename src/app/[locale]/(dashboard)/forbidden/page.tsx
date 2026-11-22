import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function ForbiddenPage() {
  await requireCurrentUser();
  const t = await getTranslations("Auth");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="text-xl font-bold tracking-tight">{t("adminOnlyTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("adminOnlyBody")}</p>
      <Link href="/" className={buttonVariants()}>{t("backToDashboard")}</Link>
    </div>
  );
}
