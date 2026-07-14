"use server";

import { revalidatePath } from "next/cache";
import { executePayoutForOrder } from "@/lib/payouts";

/**
 * Admin-only Whop override. Seller/listing/checkout management is fully
 * self-serve now (app/seller/actions.ts, app/listings/actions.ts); the
 * operator keeps just this one money-moving action for support cases.
 */

export interface Result {
  ok: boolean;
  message: string;
}

/**
 * Component 4: pay out the seller for a completed order, then mark it paid_out.
 * The idempotent claim-then-withdraw core lives in lib/payouts.ts, shared with
 * the seller portal's self-serve withdraw — admin adds no extra authorization
 * because the admin layout already gates this route group.
 */
export async function payoutForOrder(orderId: string): Promise<Result> {
  const outcome = await executePayoutForOrder(orderId);
  revalidatePath("/admin");
  return outcome;
}
