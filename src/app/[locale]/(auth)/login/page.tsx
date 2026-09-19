import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const t = await getTranslations("Auth");
  const nav = await getTranslations("Nav");

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-(--shadow-sm)">
          <Image src="/logo.jpg" alt="" width={64} height={64} className="size-full object-contain" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{nav("brand")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <LoginForm />
    </div>
  );
}
