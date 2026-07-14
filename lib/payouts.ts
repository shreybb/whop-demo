import { getSupabase } from "@/lib/supabase";
import { transitionOrder } from "@/lib/orders";
import { payoutConnectedAccount } from "@/lib/whop-platform";

/**
 * Payout core, shared by the admin console and the seller's own
 * "withdraw" button. Callers are responsible for AUTHORIZATION (is this
 * user allowed to pay out this order?); this module owns CORRECTNESS:
 *
 * Idempotent: a `payouts` row (unique per order_id) is claimed *before* the
 * withdrawal is issued, so a retry / double-click can't send a second
 * withdrawal. The row records the Whop withdrawal id and status, closing the
 * reconciliation loop.
 */
export interface PayoutOutcome {
  ok: boolean;
  message: string;
}

export async function executePayoutForOrder(
  orderId: string,
): Promise<PayoutOutcome> {
  const supabase = getSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, state, amount_cents, currency, listing:listings(currency, seller:sellers(id, whop_company_id))",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  if (order.state !== "completed") {
    return { ok: false, message: "Order is not ready for payout." };
  }

  const listing: any = Array.isArray(order.listing) ? order.listing[0] : order.listing;
  const seller: any = listing
    ? Array.isArray(listing.seller)
      ? listing.seller[0]
      : listing.seller
    : null;
  if (!seller?.whop_company_id) {
    return { ok: false, message: "Seller has no connected account." };
  }

  const amountCents = order.amount_cents ?? 0;
  const currency = order.currency ?? listing?.currency ?? "usd";

  // Claim the payout: insert a pending row. The unique(order_id) constraint is the
  // idempotency guard — a concurrent or retried call collides here instead of paying twice.
  const { error: claimError } = await supabase.from("payouts").insert({
    order_id: orderId,
    seller_id: seller.id,
    amount_cents: amountCents,
    currency,
    status: "pending",
  });
  if (claimError) {
    if (claimError.code !== "23505") return { ok: false, message: claimError.message };
    // A payout row already exists for this order.
    const { data: existing } = await supabase
      .from("payouts")
      .select("status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing?.status === "sent") return { ok: true, message: "Already paid out." };
    if (existing?.status === "pending") {
      return { ok: false, message: "Payout already in progress." };
    }
    // A prior attempt failed — reset it to pending and retry below.
    await supabase
      .from("payouts")
      .update({ status: "pending", error: null })
      .eq("order_id", orderId);
  }

  try {
    const { withdrawalId } = await payoutConnectedAccount({
      companyId: seller.whop_company_id,
      amountCents,
      currency,
    });
    await supabase
      .from("payouts")
      .update({ status: "sent", whop_withdrawal_id: withdrawalId, error: null })
      .eq("order_id", orderId);
    const t = await transitionOrder(orderId, "paid_out");
    if (!t.applied) {
      return { ok: false, message: `Payout sent but state unchanged (${t.reason}).` };
    }
    return { ok: true, message: `Paid out (${withdrawalId}).` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Withdrawal failed: mark the row failed so a later retry is allowed, and the
    // failure is visible for reconciliation.
    await supabase
      .from("payouts")
      .update({ status: "failed", error: message })
      .eq("order_id", orderId);
    return { ok: false, message };
  }
}
