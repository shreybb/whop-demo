import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAuth } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

/**
 * Session + role helpers for server components and server actions.
 *
 * The auth cookie tells us WHO the user is (verified against Supabase Auth via
 * `getUser()`, never trusted from the cookie alone). The `profiles` row tells
 * us WHAT they are (buyer / seller / admin / undecided).
 */

export type Role = "buyer" | "seller" | "admin";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: Role | null; // null until chosen at /onboarding/role
}

/** The verified auth user, or null when logged out. */
export async function getSessionUser(): Promise<User | null> {
  const { data, error } = await getSupabaseAuth().auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * The logged-in user's profile, or null when logged out.
 * Read via service-role: the profile must exist even if an RLS misconfig
 * would hide it, otherwise every layout would bounce users to /login.
 */
export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  // The on_auth_user_created trigger normally creates this row; self-heal in
  // case the trigger predates this user (e.g. schema applied after signup).
  if (!data) {
    const fallback = {
      id: user.id,
      email: user.email ?? "",
      display_name: null,
      role: null,
    };
    const { error: insertError } = await getSupabase()
      .from("profiles")
      .insert({ id: fallback.id, email: fallback.email });
    if (insertError && insertError.code !== "23505") throw insertError;
    return fallback;
  }
  return data as Profile;
}

/** Where each persona lands after login. */
export function roleHome(role: Role | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "seller":
      return "/seller";
    case "buyer":
      return "/";
    default:
      return "/onboarding/role";
  }
}

/**
 * Layout guard: require a logged-in user with the given role.
 * Redirects (never returns) when logged out, undecided, or the wrong role.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(roleHome(profile.role));
  return profile;
}

/** Guard for pages that just need *someone* logged in (e.g. role picker). */
export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}
