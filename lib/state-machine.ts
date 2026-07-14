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

/** Map a Whop webhook action to the order state it should drive (or null). */
export function actionToTargetState(
  action: WhopWebhookRequestBody["action"],
): OrderState | null {
  switch (action) {
    case "payment.succeeded":
    case "app_payment.succeeded":
      return "paid";
    case "payment.failed":
    case "app_payment.failed":
      return "failed";
    case "refund.created":
    case "refund.updated":
      return "refunded";
    default:
      return null;
  }
}

/** Whop amounts are decimal currency units (e.g. 29.99); we store integer cents. */
export function toCents(amount: number | null | undefined): number | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}
