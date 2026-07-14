import { getSupabase } from "@/lib/supabase";
import { getSupabaseAuth } from "@/lib/supabase-server";
import type { OrderState } from "@/lib/orders";

/**
 * Read models for the public storefront and the buyer's order pages.
 *
 * Public reads run on the service-role client (these pages are server-rendered
 * and only safe fields leave this module). Buyer reads run on the RLS client:
 * the `orders_select_buyer` policy scopes rows to the session user, so a bug
 * here can leak nothing.
 */

export interface PublicListing {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  seller_name: string;
}

export async function getPublishedListings(): Promise<PublicListing[]> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select("id, title, description, price_cents, currency, seller:sellers(name)")
    .not("whop_plan_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPublicListing);
}

export async function getPublishedListing(
  id: string,
): Promise<PublicListing | null> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select("id, title, description, price_cents, currency, seller:sellers(name)")
    .eq("id", id)
    .not("whop_plan_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  return data ? toPublicListing(data) : null;
}

export interface BuyerOrder {
  id: string;
  state: OrderState;
  amount_cents: number | null;
  currency: string;
  refunded_amount_cents: number | null;
  deliverable_note: string | null;
  deliverable_url: string | null;
  created_at: string;
  updated_at: string;
  listing: { title: string; seller_name: string } | null;
}

/** The session buyer's orders — RLS does the scoping, not a WHERE clause. */
export async function getMyOrders(): Promise<BuyerOrder[]> {
  const { data, error } = await getSupabaseAuth()
    .from("orders")
    .select(
      "id, state, amount_cents, currency, refunded_amount_cents, " +
        "deliverable_note, deliverable_url, created_at, updated_at, " +
        "listing:listings(title, seller:sellers(name))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toBuyerOrder);
}

export async function getMyOrder(id: string): Promise<BuyerOrder | null> {
  const { data, error } = await getSupabaseAuth()
    .from("orders")
    .select(
      "id, state, amount_cents, currency, refunded_amount_cents, " +
        "deliverable_note, deliverable_url, created_at, updated_at, " +
        "listing:listings(title, seller:sellers(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toBuyerOrder(data) : null;
}

// --- row normalization (PostgREST embeds come back as object OR array) ------

function toPublicListing(row: any): PublicListing {
  const seller = unwrapOne(row.seller);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    price_cents: row.price_cents,
    currency: row.currency ?? "usd",
    seller_name: seller?.name ?? "Unknown seller",
  };
}

function toBuyerOrder(row: any): BuyerOrder {
  const listing = unwrapOne(row.listing);
  const seller = listing ? unwrapOne(listing.seller) : null;
  return {
    id: row.id,
    state: row.state,
    amount_cents: row.amount_cents,
    currency: row.currency ?? "usd",
    refunded_amount_cents: row.refunded_amount_cents,
    deliverable_note: row.deliverable_note ?? null,
    deliverable_url: row.deliverable_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    listing: listing
      ? { title: listing.title, seller_name: seller?.name ?? "Unknown seller" }
      : null,
  };
}

function unwrapOne<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}
