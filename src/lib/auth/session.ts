import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER";
};

// Supabase Auth only proves *which* auth user is signed in (via getUser(),
// which round-trips to Supabase to validate the token) — the profile fields
// (name, role) live in our own `public.User` row, whose id is deliberately
// kept equal to the Supabase auth user id.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
}

// Server Components/layouts that must never render for a signed-out visitor —
// middleware already redirects unauthenticated requests before they get this
// far, this is the defense-in-depth backstop.
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    return redirect({ href: "/login", locale });
  }
  return user;
}
