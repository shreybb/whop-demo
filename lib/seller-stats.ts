// Relative import (not @/) so the node --test runner can load this module.
import type { OrderState } from "./state-machine";

/**
 * Pure seller-dashboard math — no I/O, unit-testable (like state-machine.ts).
 */

export interface StatOrder {
  state: OrderState;
  amount_cents: number | null;
}

export interface StatPayout {
  status: string;
  amount_cents: number;
}

export interface SellerStats {
  activeOrders: number;
  earnedCents: number; // completed + paid_out order value
  paidOutCents: number; // ledger rows actually sent
}

export function computeSellerStats(
  orders: readonly StatOrder[],
  payouts: readonly StatPayout[],
): SellerStats {
  const activeOrders = orders.filter(
    (o) =>
      o.state === "paid" ||
      o.state === "in_progress" ||
      o.state === "awaiting_approval",
  ).length;
  const earnedCents = orders
    .filter((o) => o.state === "completed" || o.state === "paid_out")
    .reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);
  const paidOutCents = payouts
    .filter((p) => p.status === "sent")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  return { activeOrders, earnedCents, paidOutCents };
}
