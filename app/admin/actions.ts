"use server";

import { revalidatePath } from "next/cache";
import type Whop from "@whop/sdk";
import { getSupabase } from "@/lib/supabase";
import { processEvent } from "@/lib/process-event";
import { transitionOrder, type OrderState } from "@/lib/orders";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Re-run processing for a stored webhook event. Used for the dashboard's
 * "replay" button on unprocessed rows. Idempotent by design: the state machine
 * no-ops if the order has already advanced.
 */
export async function replayEvent(id: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("webhook_events")
    .select("payload, signature_valid")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Event not found." };
  if (!data.signature_valid) {
    return { ok: false, message: "Refusing to replay an unverified event." };
  }

  try {
    const result = await processEvent(data.payload as Whop.UnwrapWebhookEvent);
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        error: null,
        order_id: result.handled ? result.orderId : null,
      })
      .eq("id", id);
    revalidatePath("/admin");
    return { ok: true, message: summarize(result) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("webhook_events")
      .update({ processed: false, error: message })
      .eq("id", id);
    revalidatePath("/admin");
    return { ok: false, message };
  }
}

/** Seller/admin action: move an order forward through the state machine. */
export async function advanceOrder(
  orderId: string,
  to: OrderState,
): Promise<ActionResult> {
  const result = await transitionOrder(orderId, to);
  revalidatePath("/admin");
  if (result.applied) {
    return { ok: true, message: `Order → ${result.to}` };
  }
  return { ok: false, message: `No change (${result.reason}).` };
}

function summarize(result: Awaited<ReturnType<typeof processEvent>>): string {
  if (!result.handled) return "No matching order for this event.";
  if (result.advance.applied) {
    return `Order ${result.advance.from} → ${result.advance.to}.`;
  }
  return `No state change (${result.advance.reason}).`;
}
