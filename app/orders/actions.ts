"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";

export interface ApproveResult {
  ok: boolean;
  message: string;
}

/**
 * Buyer sign-off: awaiting_approval -> completed. Only the order's buyer can
 * approve, verified against the session — the client sends only the order id.
 * Completion is what unlocks the seller's withdraw, so this is the buyer's
 * acceptance gate on the delivered work.
 */
export async function approveCompletion(orderId: string): Promise<ApproveResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, message: "Sign in first." };

  const { data: order, error } = await getSupabase()
    .from("orders")
    .select("id, buyer_id, state")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, message: "Not your order." };
  }
  if (order.state !== "awaiting_approval") {
    return { ok: false, message: "Nothing to approve yet." };
  }

  const t = await transitionOrder(orderId, "completed");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return t.applied
    ? { ok: true, message: "Approved — the seller can now be paid." }
    : { ok: false, message: `No change (${t.reason}).` };
}

/** Buyer rejection: awaiting_approval -> back to in_progress for rework. */
export async function rejectDelivery(orderId: string): Promise<ApproveResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, message: "Sign in first." };

  const { data: order, error } = await getSupabase()
    .from("orders")
    .select("id, buyer_id, state")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, message: "Not your order." };
  }
  if (order.state !== "awaiting_approval") {
    return { ok: false, message: "Nothing to reject right now." };
  }

  const t = await transitionOrder(orderId, "in_progress");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return t.applied
    ? { ok: true, message: "Sent back to the seller for rework." }
    : { ok: false, message: `No change (${t.reason}).` };
}
