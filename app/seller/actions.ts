"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";
import { executePayoutForOrder } from "@/lib/payouts";
import {
  createConnectedAccount,
  createAccountLink,
  getConnectedAccountStatus,
  createListingProductAndPlan,
} from "@/lib/whop-platform";

/**
 * Seller-scoped server actions. The pattern throughout: identity comes from
 * the session, the seller row is resolved server-side from profile_id, and
 * every order/listing mutation re-verifies ownership in SQL before executing
 * on the service-role client. The client never sends a seller id.
 */

export interface Result {
  ok: boolean;
  message: string;
  url?: string;
}

interface SellerContext {
  id: string;
  name: string;
  email: string;
  whop_company_id: string | null;
  whop_payout_account_id?: string | null;
}

/** Resolve the session user's seller row, or a failure message. */
async function requireSeller(): Promise<
  { seller: SellerContext; error: null } | { seller: null; error: string }
> {
  const profile = await getProfile();
  if (!profile) return { seller: null, error: "Sign in first." };
  if (profile.role !== "seller") {
    return { seller: null, error: "Only sellers can do this." };
  }
  const { data, error } = await getSupabase()
    .from("sellers")
    .select("id, name, email, whop_company_id, whop_payout_account_id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (error) return { seller: null, error: error.message };
  if (!data) return { seller: null, error: "No seller profile found." };
  return { seller: data as SellerContext, error: null };
}

/** True iff this order belongs to one of the seller's listings. */
async function ownsOrder(sellerId: string, orderId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from("orders")
    .select("id, listing:listings(seller_id)")
    .eq("id", orderId)
    .maybeSingle();
  const listing: any = data
    ? Array.isArray(data.listing)
      ? data.listing[0]
      : data.listing
    : null;
  return listing?.seller_id === sellerId;
}

// --- Onboarding (Component 2) ------------------------------------------------

/** Step 1: create the Whop connected account for the session seller. */
export async function setupConnectedAccount(): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (seller.whop_company_id) return fail("Connected account already exists.");

  try {
    const { companyId } = await createConnectedAccount({
      name: seller.name,
      email: seller.email,
    });
    await getSupabase()
      .from("sellers")
      .update({ whop_company_id: companyId, payout_status: "pending_kyc" })
      .eq("id", seller.id);
    revalidatePath("/seller");
    return { ok: true, message: "Connected account created. Next: verify your identity." };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Step 2 / payout management: hosted Whop link for the session seller. */
export async function getMyAccountLink(
  useCase: "account_onboarding" | "payouts_portal",
): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (!seller.whop_company_id) return fail("Create your connected account first.");

  try {
    const { url } = await createAccountLink({
      companyId: seller.whop_company_id,
      useCase,
    });
    return { ok: true, message: "Link ready — opens in a new tab.", url };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Step 3: pull payout readiness from Whop onto the seller row. */
export async function refreshMyPayoutStatus(): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (!seller.whop_company_id) return fail("Create your connected account first.");

  try {
    const { payoutStatus } = await getConnectedAccountStatus(
      seller.whop_company_id,
      seller.whop_payout_account_id,
    );
    await getSupabase()
      .from("sellers")
      .update({ payout_status: payoutStatus })
      .eq("id", seller.id);
    revalidatePath("/seller");
    return { ok: true, message: `Payout status: ${payoutStatus.replace(/_/g, " ")}.` };
  } catch (e) {
    return fail(msg(e));
  }
}

// --- Listings (Component 3) --------------------------------------------------

/** Draft a listing (not yet purchasable — publish pushes it to Whop). */
export async function createMyListing(
  title: string,
  description: string,
  priceDollars: number,
): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);

  const trimmed = title?.trim();
  if (!trimmed) return fail("Title is required.");
  const price = Number(priceDollars);
  if (!Number.isFinite(price) || price <= 0) return fail("Enter a valid price.");

  const { error: insertError } = await getSupabase().from("listings").insert({
    seller_id: seller.id,
    title: trimmed,
    description: description?.trim() || null,
    price_cents: Math.round(price * 100),
    currency: "usd",
  });
  if (insertError) return fail(insertError.message);
  revalidatePath("/seller/listings");
  return { ok: true, message: `Draft "${trimmed}" created.` };
}

/** Publish a draft: create the Whop product + one-time plan behind it. */
export async function publishMyListing(listingId: string): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);

  const { data: listing } = await getSupabase()
    .from("listings")
    .select("id, seller_id, title, description, price_cents, currency, whop_plan_id")
    .eq("id", listingId)
    .eq("seller_id", seller.id) // ownership enforced in the query itself
    .maybeSingle();
  if (!listing) return fail("Listing not found.");
  if (listing.whop_plan_id) return fail("Already published.");

  try {
    const { productId, planId } = await createListingProductAndPlan({
      title: listing.title,
      description: listing.description,
      priceCents: listing.price_cents,
      currency: listing.currency,
    });
    await getSupabase()
      .from("listings")
      .update({ whop_product_id: productId, whop_plan_id: planId })
      .eq("id", listing.id);
    revalidatePath("/seller/listings");
    revalidatePath("/");
    return { ok: true, message: "Published — it's live on the marketplace." };
  } catch (e) {
    return fail(msg(e));
  }
}

// --- Order workflow ----------------------------------------------------------

/** paid -> in_progress on an owned order. */
export async function startWork(orderId: string): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (!(await ownsOrder(seller.id, orderId))) return fail("Not your order.");

  const t = await transitionOrder(orderId, "in_progress");
  revalidatePath("/seller/orders");
  return t.applied
    ? { ok: true, message: "Marked in progress." }
    : fail(`No change (${t.reason}).`);
}

/** -> completed, attaching the deliverable. Note or URL — at least one. */
export async function deliverOrder(
  orderId: string,
  note: string,
  url: string,
): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (!(await ownsOrder(seller.id, orderId))) return fail("Not your order.");

  const trimmedNote = note?.trim() || null;
  const trimmedUrl = url?.trim() || null;
  if (!trimmedNote && !trimmedUrl) {
    return fail("Attach a note or a link so the buyer gets something.");
  }
  if (trimmedUrl && !/^https?:\/\//.test(trimmedUrl)) {
    return fail("Deliverable link must be an http(s) URL.");
  }

  // Persist the deliverable first, then advance; if the transition is refused
  // (e.g. refunded meanwhile) the deliverable is still recorded for audit.
  const { error: updateError } = await getSupabase()
    .from("orders")
    .update({ deliverable_note: trimmedNote, deliverable_url: trimmedUrl })
    .eq("id", orderId);
  if (updateError) return fail(updateError.message);

  const t = await transitionOrder(orderId, "completed");
  revalidatePath("/seller/orders");
  return t.applied
    ? { ok: true, message: "Delivered. You can withdraw once you're ready." }
    : fail(`Deliverable saved but state unchanged (${t.reason}).`);
}

/** Self-serve withdraw for a completed, owned order. */
export async function withdrawForOrder(orderId: string): Promise<Result> {
  const { seller, error } = await requireSeller();
  if (!seller) return fail(error);
  if (!seller.whop_company_id) return fail("Finish payout setup first.");
  if (!(await ownsOrder(seller.id, orderId))) return fail("Not your order.");

  const outcome = await executePayoutForOrder(orderId);
  revalidatePath("/seller/orders");
  revalidatePath("/seller/payouts");
  return outcome;
}

function fail(message: string): Result {
  return { ok: false, message };
}
function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
