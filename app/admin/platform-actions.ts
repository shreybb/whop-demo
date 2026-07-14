"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { createOrderWithCheckout } from "@/lib/checkout";
import { executePayoutForOrder } from "@/lib/payouts";
import {
  createConnectedAccount,
  createAccountLink,
  getConnectedAccountStatus,
  createListingProductAndPlan,
} from "@/lib/whop-platform";

export interface Result {
  ok: boolean;
  message: string;
  url?: string;
}

/** Add a seller the marketplace owner entered (name + email). Not yet onboarded. */
export async function createSeller(name: string, email: string): Promise<Result> {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();
  if (!trimmedName || !trimmedEmail) {
    return fail("Name and a deliverable email are required.");
  }
  const { error } = await getSupabase()
    .from("sellers")
    .insert({ name: trimmedName, email: trimmedEmail, payout_status: "not_started" });
  if (error) return fail(error.message);
  revalidatePath("/admin");
  return { ok: true, message: `Added ${trimmedName}.` };
}

/** Add a listing for a seller (price entered in dollars). */
export async function createListing(
  sellerId: string,
  title: string,
  priceDollars: number,
  currency = "usd",
): Promise<Result> {
  if (!sellerId) return fail("Pick a seller.");
  if (!title?.trim()) return fail("Title is required.");
  const price = Number(priceDollars);
  if (!Number.isFinite(price) || price <= 0) return fail("Enter a valid price.");

  const { error } = await getSupabase().from("listings").insert({
    seller_id: sellerId,
    title: title.trim(),
    price_cents: Math.round(price * 100),
    currency,
  });
  if (error) return fail(error.message);
  revalidatePath("/admin");
  return { ok: true, message: `Added "${title.trim()}".` };
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
    revalidatePath("/admin");
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
    revalidatePath("/admin");
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
    revalidatePath("/admin");
    return { ok: true, message: `Published (plan ${planId}).` };
  } catch (e) {
    return fail(msg(e));
  }
}

/**
 * Component 3: admin-created order + checkout (manual/test orders with no
 * buyer account). Self-serve buyer purchases live in app/listings/actions.ts;
 * both share lib/checkout.ts.
 */
export async function buyListing(
  listingId: string,
  buyerEmail: string,
): Promise<Result> {
  const supabase = getSupabase();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, price_cents, currency, whop_plan_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return fail("Listing not found.");
  if (!listing.whop_plan_id) return fail("Publish the listing first.");

  try {
    const { purchaseUrl } = await createOrderWithCheckout({
      listing,
      buyerId: null,
      buyerEmail: buyerEmail || null,
    });
    revalidatePath("/admin");
    return { ok: true, message: "Checkout ready.", url: purchaseUrl };
  } catch (e) {
    return fail(msg(e));
  }
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

function fail(message: string): Result {
  return { ok: false, message };
}
function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
