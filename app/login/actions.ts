"use server";

import { getSupabaseAuth } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
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

/**
 * Simple signup: email + password, no verification (demo). The service-role
 * client creates the user pre-confirmed; duplicate emails surface a friendly
 * error. On success we immediately sign in to establish the cookie session —
 * the profiles trigger fires on creation, and the role picker takes it from
 * there.
 */
export async function signUp(
  email: string,
  password: string,
  next?: string,
): Promise<LoginResult> {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!password || password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const { error } = await getSupabase().auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true, // demo: skip verification entirely
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { ok: false, message: "That email already has an account — sign in instead." };
    }
    console.error("[auth] signUp failed:", error.message);
    return { ok: false, message: "Could not create the account. Try again shortly." };
  }

  return signIn(trimmed, password, next);
}
