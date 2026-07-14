"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";
import { createOrderWithCheckout } from "@/lib/checkout";

export interface BuyResult {
  ok: boolean;
  message: string;
  url?: string;
}

/**
 * Self-serve purchase for the logged-in user. Identity comes from the
 * session — the client sends nothing but the listing id.
 *
 * Runs on the service-role client because it must read any published listing
 * and write a cross-tenant order row; authorization is the session check +
 * the own-listing guard below.
 */
export async function buyListing(listingId: string): Promise<BuyResult> {
  const profile = await getProfile();
  if (!profile) {
    return { ok: false, message: "Sign in to buy." };
  }

  const supabase = getSupabase();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, seller_id, price_cents, currency, whop_plan_id, seller:sellers(profile_id)")
    .eq("id", listingId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!listing?.whop_plan_id) {
    return { ok: false, message: "This listing isn't available for purchase." };
  }

  // Sellers can't buy their own work — that's just moving money in a circle.
  const sellerProfile = Array.isArray(listing.seller)
    ? listing.seller[0]
    : listing.seller;
  if (sellerProfile?.profile_id === profile.id) {
    return { ok: false, message: "You can't buy your own listing." };
  }

  try {
    const { purchaseUrl } = await createOrderWithCheckout({
      listing,
      buyerId: profile.id,
      buyerEmail: profile.email,
    });
    revalidatePath("/orders");
    return { ok: true, message: "Checkout ready — finish paying on Whop.", url: purchaseUrl };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
