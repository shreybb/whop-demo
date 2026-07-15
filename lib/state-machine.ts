import type Whop from "@whop/sdk";

/**
 * Pure order state machine — no I/O, no dependencies, fully unit-testable.
 *
 *   pending -> paid -> in_progress -> awaiting_approval -> completed -> paid_out
 *   (any non-terminal state) -> failed | refunded   [terminal branches]
 */

export type OrderState =
  | "pending"
  | "paid"
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "paid_out"
  | "failed"
  | "refunded";

export const CHAIN: OrderState[] = [
  "pending",
  "paid",
  "in_progress",
  "awaiting_approval",
  "completed",
  "paid_out",
];

export const RANK: Record<string, number> = Object.fromEntries(
  CHAIN.map((s, i) => [s, i]),
);

export const TERMINAL = new Set<OrderState>(["failed", "refunded"]);

export function isTerminal(state: OrderState): boolean {
  return TERMINAL.has(state);
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false; // terminal is final
  if (TERMINAL.has(to)) return true; // any non-terminal -> failed/refunded
  return RANK[to] > RANK[from]; // linear chain: forward-only
}

/**
 * Map a Whop webhook event type to the order state it should drive (or null).
 *
 * `Whop.WebhookEvent["type"]` values are dotted ("payment.succeeded"),
 * confirmed against a real captured delivery. Also accepts the equivalent
 * underscored spelling ("payment_succeeded") some Whop surfaces (e.g. the
 * dashboard's event picker) use for the same events — harmless redundancy,
 * not a second real format.
 */
export function actionToTargetState(
  type: Whop.WebhookEvent | (string & {}),
): OrderState | null {
  switch (type) {
    case "payment.succeeded":
    case "payment_succeeded":
      return "paid";
    case "payment.failed":
    case "payment_failed":
      return "failed";
    case "refund.created":
    case "refund_created":
    case "refund.updated":
    case "refund_updated":
      return "refunded";
    default:
      return null;
  }
}

/** Pull the event type off a webhook body: `type` (current), `action` (legacy). */
export function eventAction(event: unknown): string {
  const e = event as Record<string, unknown> | null;
  const candidate = e?.type ?? e?.action ?? e?.event;
  return typeof candidate === "string" && candidate ? candidate : "unknown";
}

/** Whop amounts are decimal currency units (e.g. 29.99); we store integer cents. */
export function toCents(amount: number | null | undefined): number | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}
