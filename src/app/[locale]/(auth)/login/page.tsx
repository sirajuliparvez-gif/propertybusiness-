import { getTranslations } from "next-intl/server";
import { Building } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const t = await getTranslations("Auth");
  const nav = await getTranslations("Nav");

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-(--shadow-sm)">
          <Building className="size-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{nav("brand")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <LoginForm />
    </div>
  );
}
