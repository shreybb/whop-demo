"use server";

import { getSupabaseAuth } from "@/lib/supabase-server";
import { env } from "@/lib/env";

export interface LoginResult {
  ok: boolean;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a magic link. Passwordless is the whole auth story: one flow for
 * buyers, sellers, and the admin. `next` (a same-site path) survives the
 * round-trip through the email link so deep links keep working.
 */
export async function sendMagicLink(
  email: string,
  next?: string,
): Promise<LoginResult> {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  // Only allow relative paths — never redirect off-site after auth.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const { error } = await getSupabaseAuth().auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    console.error("[auth] signInWithOtp failed:", error.code, error.message);
    // Supabase's built-in SMTP is capped at a couple of emails per hour —
    // surface that honestly instead of a generic "try again".
    if (error.code === "over_email_send_rate_limit") {
      return {
        ok: false,
        message:
          "Email limit reached (the demo mailer allows only a few per hour). " +
          "Wait a bit and try again, or use a link you already received.",
      };
    }
    return { ok: false, message: "Could not send the link. Try again shortly." };
  }
  return { ok: true, message: `Magic link sent to ${trimmed}. Check your inbox.` };
}
