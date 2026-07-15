"use server";

import { getSupabaseAuth } from "@/lib/supabase-server";
import { getProfile, roleHome } from "@/lib/auth";

export interface LoginResult {
  ok: boolean;
  message: string;
  redirectTo?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(
  email: string,
  password: string,
  next?: string,
): Promise<LoginResult> {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!password) {
    return { ok: false, message: "Enter your password." };
  }

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  const { error } = await getSupabaseAuth().auth.signInWithPassword({
    email: trimmed,
    password,
  });

  if (error) {
    console.error("[auth] signInWithPassword failed:", error.code, error.message);
    if (error.code === "invalid_credentials") {
      return { ok: false, message: "Incorrect email or password." };
    }
    return { ok: false, message: "Sign-in failed. Try again shortly." };
  }

  const profile = await getProfile();
  const redirectTo = safeNext ?? roleHome(profile?.role ?? null);
  return { ok: true, message: "Signed in.", redirectTo };
}
