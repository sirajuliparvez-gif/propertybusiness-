"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/properties/form-field";
import { login, type LoginState } from "@/lib/actions/auth";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const t = useTranslations("Auth");
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-4">
          <FormField label={t("email")} htmlFor="email" required>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </FormField>
          <FormField label={t("password")} htmlFor="password" required>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </FormField>
          {state.error ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {t(state.error)}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
