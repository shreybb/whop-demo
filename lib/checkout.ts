import { getSupabase } from "@/lib/supabase";
import { createCheckoutForOrder } from "@/lib/whop-platform";

/**
 * Shared checkout core: create a pending order, then a Whop checkout whose
 * metadata carries the order id (that metadata is how the payment webhook
 * finds its way back to the order).
 *
 * Used by both the buyer's self-serve purchase and the admin's manual
 * order creation — the only difference between them is who supplies
 * `buyerId`/`buyerEmail`.
 */
export interface CheckoutInput {
  listing: {
    id: string;
    seller_id: string;
    price_cents: number;
    currency: string | null;
    whop_plan_id: string | null;
  };
  buyerId: string | null; // profiles.id when a logged-in buyer; null for admin manual orders
  buyerEmail: string | null;
}

export interface CheckoutOutput {
  orderId: string;
  purchaseUrl: string;
}

export async function createOrderWithCheckout(
  input: CheckoutInput,
): Promise<CheckoutOutput> {
  const { listing } = input;
  if (!listing.whop_plan_id) {
    throw new Error("Listing is not published to Whop yet.");
  }

  // Create the pending order first so its id can ride in the checkout metadata.
  const { data: order, error } = await getSupabase()
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_id: input.buyerId,
      buyer_email: input.buyerEmail,
      state: "pending",
      amount_cents: listing.price_cents,
      currency: listing.currency ?? "usd",
    })
    .select("id")
    .single();
  if (error || !order) {
    throw new Error(error?.message ?? "Could not create the order.");
  }

  const { purchaseUrl } = await createCheckoutForOrder({
    planId: listing.whop_plan_id,
    orderId: order.id,
    listingId: listing.id,
    sellerId: listing.seller_id,
  });
  return { orderId: order.id, purchaseUrl };
}
