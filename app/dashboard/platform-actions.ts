"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { transitionOrder } from "@/lib/orders";
import {
  createConnectedAccount,
  createAccountLink,
  getConnectedAccountStatus,
  createListingProductAndPlan,
  createCheckoutForOrder,
  payoutConnectedAccount,
} from "@/lib/whop-platform";

export interface Result {
  ok: boolean;
  message: string;
  url?: string;
}

/** Component 2: create a connected account for a seller and store its id. */
export async function onboardSeller(
  sellerId: string,
  ownerEmail?: string,
): Promise<Result> {
  const supabase = getSupabase();
  const { data: seller, error } = await supabase
    .from("sellers")
    .select("id, name, email, whop_company_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!seller) return fail("Seller not found.");
  if (seller.whop_company_id) return fail("Seller already onboarded.");

  // Whop requires the connected-account owner email to be a real, deliverable
  // inbox. Prefer the email entered at onboarding time; fall back to the seller's.
  const email = (ownerEmail && ownerEmail.trim()) || seller.email;

  try {
    const { companyId } = await createConnectedAccount({
      name: seller.name,
      email,
    });
    await supabase
      .from("sellers")
      .update({ whop_company_id: companyId, payout_status: "pending_kyc" })
      .eq("id", sellerId);
    revalidatePath("/dashboard");
    return { ok: true, message: `Connected account ${companyId} created.` };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Component 2/4: hosted KYC onboarding or payout portal link. */
export async function getSellerLink(
  sellerId: string,
  useCase: "account_onboarding" | "payouts_portal",
): Promise<Result> {
  const supabase = getSupabase();
  const { data: seller } = await supabase
    .from("sellers")
    .select("whop_company_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller?.whop_company_id) return fail("Onboard the seller first.");

  try {
    const { url } = await createAccountLink({
      companyId: seller.whop_company_id,
      useCase,
    });
    return { ok: true, message: "Link ready.", url };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Component 2: refresh a seller's payout_status from Whop. */
export async function syncPayoutStatus(sellerId: string): Promise<Result> {
  const supabase = getSupabase();
  const { data: seller } = await supabase
    .from("sellers")
    .select("whop_company_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller?.whop_company_id) return fail("Seller not onboarded.");

  try {
    const { payoutStatus } = await getConnectedAccountStatus(seller.whop_company_id);
    await supabase
      .from("sellers")
      .update({ payout_status: payoutStatus })
      .eq("id", sellerId);
    revalidatePath("/dashboard");
    return { ok: true, message: `Payout status: ${payoutStatus}.` };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Component 3: create the Whop product + plan for a listing. */
export async function publishListing(listingId: string): Promise<Result> {
  const supabase = getSupabase();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, price_cents, currency, whop_plan_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return fail("Listing not found.");
  if (listing.whop_plan_id) return fail("Listing already published.");

  try {
    const { productId, planId } = await createListingProductAndPlan({
      title: listing.title,
      description: listing.description,
      priceCents: listing.price_cents,
      currency: listing.currency,
    });
    await supabase
      .from("listings")
      .update({ whop_product_id: productId, whop_plan_id: planId })
      .eq("id", listingId);
    revalidatePath("/dashboard");
    return { ok: true, message: `Published (plan ${planId}).` };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Component 3: create an order + a checkout carrying its metadata. */
export async function buyListing(
  listingId: string,
  buyerEmail: string,
): Promise<Result> {
  const supabase = getSupabase();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, price_cents, whop_plan_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return fail("Listing not found.");
  if (!listing.whop_plan_id) return fail("Publish the listing first.");

  // Create the pending order first so its id can ride in the checkout metadata.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_email: buyerEmail || null,
      state: "pending",
      amount_cents: listing.price_cents,
    })
    .select("id")
    .single();
  if (orderError || !order) return fail(orderError?.message ?? "Could not create order.");

  try {
    const { purchaseUrl } = await createCheckoutForOrder({
      planId: listing.whop_plan_id,
      orderId: order.id,
      listingId: listing.id,
      sellerId: listing.seller_id,
    });
    revalidatePath("/dashboard");
    return { ok: true, message: "Checkout ready.", url: purchaseUrl };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Component 4: pay out the seller for a completed order, then mark it paid_out. */
export async function payoutForOrder(orderId: string): Promise<Result> {
  const supabase = getSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, state, amount_cents, listing:listings(currency, seller:sellers(whop_company_id))",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return fail("Order not found.");
  if (order.state !== "completed") return fail("Order is not ready for payout.");

  const listing: any = Array.isArray(order.listing) ? order.listing[0] : order.listing;
  const seller: any = listing
    ? Array.isArray(listing.seller)
      ? listing.seller[0]
      : listing.seller
    : null;
  if (!seller?.whop_company_id) return fail("Seller has no connected account.");

  try {
    await payoutConnectedAccount({
      companyId: seller.whop_company_id,
      amountCents: order.amount_cents ?? 0,
      currency: listing?.currency ?? "usd",
    });
    const t = await transitionOrder(orderId, "paid_out");
    revalidatePath("/dashboard");
    if (!t.applied) return fail(`Payout sent but state unchanged (${t.reason}).`);
    return { ok: true, message: "Paid out." };
  } catch (e) {
    return fail(msg(e));
  }
}

function fail(message: string): Result {
  return { ok: false, message };
}
function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
