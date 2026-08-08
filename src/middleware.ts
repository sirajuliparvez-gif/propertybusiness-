import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function localeFromPath(pathname: string): string {
  const first = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(first) ? first : routing.defaultLocale;
}

function pathWithoutLocale(pathname: string, locale: string): string {
  if (pathname === `/${locale}`) return "/";
  if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  return pathname;
}

export default async function middleware(request: NextRequest) {
  const intlResponse = await intlMiddleware(request);

  // A redirect from next-intl (e.g. adding a missing locale prefix) takes
  // priority — auth gets checked again on the follow-up request it triggers.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            intlResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not swap this for getSession() — it doesn't validate the token, which
  // would let a spoofed cookie through. getUser() round-trips to Supabase to verify it.
  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data?.user;

  const locale = localeFromPath(request.nextUrl.pathname);
  const bare = pathWithoutLocale(request.nextUrl.pathname, locale);
  const isLoginPath = bare === "/login";

  if (!isAuthed && !isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthed && isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
