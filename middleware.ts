import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth middleware:
 *  1. Refreshes the Supabase session cookie on every matched request (the SSR
 *     client can't always write cookies from Server Components, so this is
 *     where token refresh actually happens).
 *  2. Bounces logged-out users away from protected prefixes.
 *
 * Role-level gating (admin vs seller vs buyer) is NOT done here — it needs a
 * profiles lookup, and a DB round-trip per request in middleware is waste.
 * Each section's layout calls `requireRole()` instead.
 */

const PROTECTED_PREFIXES = ["/admin", "/seller", "/orders", "/onboarding"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() validates the JWT against Supabase Auth AND triggers the cookie
  // refresh via setAll above. Do not swap for getSession() (unverified).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && needsAuth) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // Logged-in users don't need the login page.
  if (user && path === "/login") {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return res;
}

export const config = {
  // Everything except static assets and the webhook endpoint (webhooks are
  // signature-authenticated; a session refresh there is pointless overhead).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
