import type { WhopWebhookRequestBody } from "@whop/api";

/**
 * Pure order state machine — no I/O, no dependencies, fully unit-testable.
 *
 *   pending -> paid -> in_progress -> completed -> paid_out
 *   (any non-terminal state) -> failed | refunded   [terminal branches]
 */

export type OrderState =
  | "pending"
  | "paid"
  | "in_progress"
  | "completed"
  | "paid_out"
  | "failed"
  | "refunded";

export const CHAIN: OrderState[] = [
  "pending",
  "paid",
  "in_progress",
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
 * Map a Whop webhook action to the order state it should drive (or null).
 *
 * Accepts BOTH naming schemes: the `@whop/api` typed union uses dots
 * ("payment.succeeded") while the v1 REST webhook catalog (what the
 * dashboard's 41-event list configures) uses underscores
 * ("payment_succeeded"). Typed as string so either can flow through.
 */
export function actionToTargetState(
  action: WhopWebhookRequestBody["action"] | (string & {}),
): OrderState | null {
  switch (action) {
    case "payment.succeeded":
    case "payment_succeeded":
    case "app_payment.succeeded":
      return "paid";
    case "payment.failed":
    case "payment_failed":
    case "app_payment.failed":
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

/**
 * Pull the action name off a webhook body regardless of payload vintage:
 * `action` (@whop/api app-webhook shape) or `type`/`event` (v1 REST shape).
 */
export function eventAction(event: unknown): string {
  const e = event as Record<string, unknown> | null;
  const candidate = e?.action ?? e?.type ?? e?.event;
  return typeof candidate === "string" && candidate ? candidate : "unknown";
}

/** Whop amounts are decimal currency units (e.g. 29.99); we store integer cents. */
export function toCents(amount: number | null | undefined): number | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}
