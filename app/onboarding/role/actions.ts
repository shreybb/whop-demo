"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getProfile, roleHome, type Role } from "@/lib/auth";

export interface RoleResult {
  ok: boolean;
  message: string;
}

/**
 * One-time role selection after first login. Runs on the service-role client
 * on purpose: profiles have no RLS update policy, so users can never write
 * their own role — this action is the only path, and it only ever assigns
 * buyer/seller (admin is promoted by hand in SQL) and only when unset.
 *
 * Choosing "seller" also creates the linked `sellers` row so the seller
 * portal and Whop onboarding have something to hang off immediately.
 */
export async function chooseRole(
  role: Role,
  displayName: string,
): Promise<RoleResult> {
  if (role !== "buyer" && role !== "seller") {
    return { ok: false, message: "Pick buyer or seller." };
  }
  const name = displayName?.trim();
  if (!name) return { ok: false, message: "Tell us your name." };

  const profile = await getProfile();
  if (!profile) return { ok: false, message: "Not signed in." };
  if (profile.role) {
    // Role already locked in — nothing to change, just go home.
    redirect(roleHome(profile.role));
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ role, display_name: name })
    .eq("id", profile.id)
    .is("role", null); // guard: never overwrite an existing role
  if (error) return { ok: false, message: error.message };

  if (role === "seller") {
    const { error: sellerError } = await supabase
      .from("sellers")
      .insert({ profile_id: profile.id, name, email: profile.email });
    // 23505 = seller row already exists for this profile; that's fine.
    if (sellerError && sellerError.code !== "23505") {
      return { ok: false, message: sellerError.message };
    }
  }

  redirect(roleHome(role));
}
