import { getTranslations } from "next-intl/server";
import { Languages, SunMoon, Info, UserCircle, ScrollText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LanguageSetting } from "@/components/settings/language-setting";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const tAuth = await getTranslations("Auth");
  const user = await requireCurrentUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-teal-500/25 to-teal-500/5 text-teal-600 dark:text-teal-400">
              <UserCircle className="size-3.5" />
            </span>
            {t("accountTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tAuth("loggedInAs")}: {tAuth(user.role === "ADMIN" ? "roleAdmin" : "roleManager")}
            </p>
          </div>
          <LogoutButton variant="full" />
        </CardContent>
      </Card>

      {user.role === "ADMIN" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-amber-500/25 to-amber-500/5 text-amber-600 dark:text-amber-400">
                <ScrollText className="size-3.5" />
              </span>
              {t("auditLogTitle")}
            </CardTitle>
            <CardDescription>{t("auditLogDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/audit-log" className={buttonVariants({ variant: "outline", size: "sm" })}>{t("auditLogOpen")}</Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-500/25 to-blue-500/5 text-blue-600 dark:text-blue-400">
              <Languages className="size-3.5" />
            </span>
            {t("languageTitle")}
          </CardTitle>
          <CardDescription>{t("languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400">
              <SunMoon className="size-3.5" />
            </span>
            {t("themeTitle")}
          </CardTitle>
          <CardDescription>{t("themeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSetting />
        </CardContent>
      </Card>

      <Card className="border-none bg-linear-to-br from-primary/8 via-card to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-primary/25 to-primary/5 text-primary">
              <Info className="size-3.5" />
            </span>
            {t("aboutTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("aboutDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
