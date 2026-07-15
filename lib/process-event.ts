import type Whop from "@whop/sdk";
import { advanceOrderState, resolveOrderId } from "@/lib/orders";

export type ProcessResult =
  | { handled: false; reason: "no_matching_order" }
  | {
      handled: true;
      orderId: string;
      advance: Awaited<ReturnType<typeof advanceOrderState>>;
    };

/**
 * Turn a validated webhook event into an order state change.
 * Pure of HTTP/logging concerns so it can be reused by the live route handler
 * and by the dashboard "replay" action with identical behavior.
 */
export async function processEvent(
  event: Whop.UnwrapWebhookEvent,
): Promise<ProcessResult> {
  const orderId = await resolveOrderId(event);
  if (!orderId) {
    return { handled: false, reason: "no_matching_order" };
  }
  const advance = await advanceOrderState(orderId, event);
  return { handled: true, orderId, advance };
}
