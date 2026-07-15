import type Whop from "@whop/sdk";
import { getSupabase } from "@/lib/supabase";
import {
  actionToTargetState,
  canTransition,
  eventAction,
  isTerminal,
  toCents,
  type OrderState,
} from "@/lib/state-machine";

export type { OrderState } from "@/lib/state-machine";
export {
  canTransition,
  actionToTargetState,
  toCents,
} from "@/lib/state-machine";

export interface AdvanceResult {
  applied: boolean;
  from: OrderState | null;
  to: OrderState | null;
  reason:
    | "applied"
    | "no_state_mapping"
    | "out_of_order"
    | "already_terminal"
    | "order_not_found";
}

/**
 * Advance a single order in response to a validated webhook event.
 *
 * Never throws for expected business conditions (unknown mapping, out-of-order,
 * missing order) — it returns a structured result so the caller can record it
 * and always ack the webhook. It *does* throw on unexpected DB failures so the
 * caller can log them and surface the event as unprocessed.
 *
 * The guard is enforced twice: in code, and again in the UPDATE's WHERE clause
 * (`state = <from>`), so concurrent deliveries can't race into a regression.
 */
export async function advanceOrderState(
  orderId: string,
  event: Whop.UnwrapWebhookEvent,
): Promise<AdvanceResult> {
  const target = actionToTargetState(eventAction(event));
  if (!target) {
    return { applied: false, from: null, to: null, reason: "no_state_mapping" };
  }

  const supabase = getSupabase();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, state")
    .eq("id", orderId)
    .maybeSingle();

  if (readError) throw readError;
  if (!order) {
    return { applied: false, from: null, to: null, reason: "order_not_found" };
  }

  const from = order.state as OrderState;
  if (isTerminal(from)) {
    return { applied: false, from, to: target, reason: "already_terminal" };
  }
  if (!canTransition(from, target)) {
    return { applied: false, from, to: target, reason: "out_of_order" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      state: target,
      updated_at: new Date().toISOString(),
      ...buildPatch(event),
    })
    .eq("id", orderId)
    .eq("state", from) // optimistic guard
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    return { applied: false, from, to: target, reason: "out_of_order" };
  }
  return { applied: true, from, to: target, reason: "applied" };
}

/**
 * Manually move an order to a new state (seller/admin actions from the dashboard:
 * start work -> in_progress, deliver -> completed, pay out -> paid_out).
 * Same guard as the webhook path, so the UI can never regress an order.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderState,
): Promise<AdvanceResult> {
  const supabase = getSupabase();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, state")
    .eq("id", orderId)
    .maybeSingle();
  if (readError) throw readError;
  if (!order) return { applied: false, from: null, to, reason: "order_not_found" };

  const from = order.state as OrderState;
  if (isTerminal(from)) return { applied: false, from, to, reason: "already_terminal" };
  if (!canTransition(from, to)) return { applied: false, from, to, reason: "out_of_order" };

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ state: to, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("state", from)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) return { applied: false, from, to, reason: "out_of_order" };

  return { applied: true, from, to, reason: "applied" };
}

/**
 * Persist payment/refund facts alongside the state change (immutable patch).
 *
 * Field names verified against a real captured sandbox delivery: a Payment's
 * charged amount is `total` (decimal currency units), NOT `final_amount` —
 * that field doesn't exist on `Shared.Payment`. `final_amount` was a holdover
 * from `@whop/api`'s (unused, now-removed) typed union; the mismatch would
 * have silently written `amount_cents: null` on every payment.
 */
function buildPatch(event: Whop.UnwrapWebhookEvent): Record<string, unknown> {
  const action = eventAction(event);
  if (action === "payment.succeeded" || action === "payment_succeeded") {
    const data = event.data as { id?: string; total?: number | null };
    return {
      whop_payment_id: data.id,
      amount_cents: toCents(data.total),
    };
  }
  if (action.startsWith("refund.") || action.startsWith("refund_")) {
    const { refundId, refundedAmountCents } = extractRefundInfo(event);
    return {
      ...(refundId ? { whop_refund_id: refundId } : {}),
      ...(refundedAmountCents != null
        ? { refunded_amount_cents: refundedAmountCents }
        : {}),
    };
  }
  return {};
}

/**
 * Pull the refund id + amount from a refund event. Refund payloads carry their
 * own `id` and `amount`, and nest the original payment under `.payment`; we
 * fall back to the nested payment's `total` when the refund omits an explicit
 * amount (both confirmed field names, not `final_amount`).
 */
function extractRefundInfo(event: Whop.UnwrapWebhookEvent): {
  refundId: string | null;
  refundedAmountCents: number | null;
} {
  const data = event.data as Record<string, any>;
  const refundId = typeof data?.id === "string" ? data.id : null;
  const payment =
    data && typeof data.payment === "object" && data.payment ? data.payment : null;
  const rawAmount =
    typeof data?.amount === "number"
      ? data.amount
      : typeof payment?.total === "number"
        ? payment.total
        : null;
  return { refundId, refundedAmountCents: toCents(rawAmount) };
}

/**
 * Pull the references we use to map an event back to one of our orders.
 * Refund/dispute events nest the original payment (with its metadata), so we
 * reach through `.payment` for those.
 */
function extractEventRefs(event: Whop.UnwrapWebhookEvent): {
  metadata: Record<string, unknown> | null;
  paymentId: string | null;
} {
  const data = event.data as Record<string, any>;
  const payment =
    data && typeof data.payment === "object" && data.payment ? data.payment : data;
  const metadata =
    payment && typeof payment.metadata === "object" ? payment.metadata : null;
  const paymentId =
    (payment && typeof payment.id === "string" && payment.id) ||
    (typeof data.payment_id === "string" && data.payment_id) ||
    null;
  return { metadata, paymentId };
}

/**
 * Resolve the order id for an event: prefer our checkout metadata
 * (`metadata.order_id`), fall back to a lookup by `whop_payment_id`.
 */
export async function resolveOrderId(
  event: Whop.UnwrapWebhookEvent,
): Promise<string | null> {
  const { metadata, paymentId } = extractEventRefs(event);

  const orderId =
    metadata && typeof metadata.order_id === "string" ? metadata.order_id : null;
  if (orderId) return orderId;

  if (paymentId) {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id")
      .eq("whop_payment_id", paymentId)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  return null;
}
