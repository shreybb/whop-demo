import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseAuth } from "@/lib/supabase-server";
import { getProfile, roleHome } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Magic-link landing. Supabase sends users here with either a PKCE `code`
 * or a `token_hash` + `type` pair depending on client/link flavor — handle
 * both, establish the cookie session, then route by role:
 * no role yet -> /onboarding/role, otherwise the persona's home (or `next`).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const supabase = getSupabaseAuth();

  let authError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    authError = error?.message ?? null;
  } else {
    authError = "missing code/token_hash";
  }

  if (authError) {
    console.error("[auth] callback failed:", authError);
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const profile = await getProfile();
  // First login: the trigger just created a role-less profile -> pick a role.
  if (!profile?.role) {
    return NextResponse.redirect(new URL("/onboarding/role", url.origin));
  }
  // Deep link wins when one was requested; otherwise land on the role's home.
  const dest = next !== "/" ? next : roleHome(profile.role);
  return NextResponse.redirect(new URL(dest, url.origin));
}
