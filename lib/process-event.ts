import type Whop from "@whop/sdk";
import { advanceOrderState, resolveOrderId } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import { eventAction } from "@/lib/state-machine";
import { mapPayoutStatus } from "@/lib/whop-platform";

export type ProcessResult =
  | { handled: false; reason: "no_matching_order" }
  | { handled: false; reason: "seller_status_updated" }
  | {
      handled: true;
      orderId: string;
      advance: Awaited<ReturnType<typeof advanceOrderState>>;
    };

/**
 * Turn a validated webhook event into a state change.
 * Pure of HTTP/logging concerns so it can be reused by the live route handler
 * and by the dashboard "replay" action with identical behavior.
 *
 * Two families of events are consumed:
 *  - payment/refund -> the order state machine (via checkout metadata)
 *  - payout_account.status_updated -> sellers.payout_status. The event's
 *    top-level company_id is the seller's connected-account id, and data.id
 *    is the poact_ payout-account id that future status retrieves are keyed
 *    by (retrieve-by-biz_ 404s — confirmed live). Without consuming this,
 *    a seller who finishes hosted KYC still shows pending forever.
 */
export async function processEvent(
  event: Whop.UnwrapWebhookEvent,
): Promise<ProcessResult> {
  if (eventAction(event) === "payout_account.status_updated") {
    await syncSellerPayoutStatus(event);
    return { handled: false, reason: "seller_status_updated" };
  }

  const orderId = await resolveOrderId(event);
  if (!orderId) {
    return { handled: false, reason: "no_matching_order" };
  }
  const advance = await advanceOrderState(orderId, event);
  return { handled: true, orderId, advance };
}

async function syncSellerPayoutStatus(event: Whop.UnwrapWebhookEvent): Promise<void> {
  const companyId = (event as { company_id?: string | null }).company_id;
  if (!companyId) return;
  const data = event.data as { id?: string; status?: string | null };

  const supabase = getSupabase();
  const patch = {
    payout_status: mapPayoutStatus(
      (data.status ?? null) as Parameters<typeof mapPayoutStatus>[0],
    ),
    whop_payout_account_id: data.id ?? null,
  };
  const { error } = await supabase
    .from("sellers")
    .update(patch)
    .eq("whop_company_id", companyId);
  // Tolerate DBs created before whop_payout_account_id existed.
  if (error && /whop_payout_account_id/.test(error.message)) {
    await supabase
      .from("sellers")
      .update({ payout_status: patch.payout_status })
      .eq("whop_company_id", companyId);
  } else if (error) {
    throw error;
  }
}
