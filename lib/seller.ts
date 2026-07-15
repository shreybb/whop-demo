import { getSupabaseAuth } from "@/lib/supabase-server";
import type { OrderState } from "@/lib/orders";

/**
 * Read models for the seller portal. Everything here runs on the RLS client:
 * the sellers_select_own / listings_all_own / orders_select_seller /
 * payouts_select_seller policies scope every query to the session user, so
 * these functions can't leak another seller's rows even if called wrong.
 */

export interface MySeller {
  id: string;
  name: string;
  email: string;
  whop_company_id: string | null;
  payout_status: string;
}

/** The session user's seller row, or null if they haven't got one. */
export async function getMySeller(): Promise<MySeller | null> {
  const { data, error } = await getSupabaseAuth()
    .from("sellers")
    .select("id, name, email, whop_company_id, payout_status")
    .maybeSingle(); // RLS already scopes to profile_id = auth.uid()
  if (error) throw error;
  return (data as MySeller) ?? null;
}

export interface MyListing {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  whop_product_id: string | null;
  whop_plan_id: string | null;
  created_at: string;
}

export async function getMyListings(sellerId: string): Promise<MyListing[]> {
  const { data, error } = await getSupabaseAuth()
    .from("listings")
    .select(
      "id, title, description, price_cents, currency, whop_product_id, whop_plan_id, created_at",
    )
    .eq("seller_id", sellerId) // explicit filter; RLS is the backstop
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyListing[];
}

export interface SellerOrder {
  id: string;
  state: OrderState;
  amount_cents: number | null;
  currency: string;
  buyer_email: string | null;
  deliverable_note: string | null;
  deliverable_url: string | null;
  created_at: string;
  updated_at: string;
  listing: { id: string; title: string } | null;
}

/**
 * Orders on the seller's listings — the work queue. Explicitly filtered by
 * listing ownership: RLS policies OR together, so a seller who BUYS someone
 * else's listing would otherwise see their own purchase here (the buyer
 * policy grants the read). RLS stays as the cross-tenant backstop.
 */
export async function getMySellerOrders(sellerId: string): Promise<SellerOrder[]> {
  const { data, error } = await getSupabaseAuth()
    .from("orders")
    .select(
      "id, state, amount_cents, currency, buyer_email, deliverable_note, " +
        "deliverable_url, created_at, updated_at, listing:listings!inner(id, title, seller_id)",
    )
    .eq("listing.seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    listing: Array.isArray(row.listing) ? (row.listing[0] ?? null) : row.listing,
  })) as SellerOrder[];
}

export interface MyPayout {
  id: string;
  order_id: string;
  whop_withdrawal_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  error: string | null;
  created_at: string;
}

export async function getMyPayouts(): Promise<MyPayout[]> {
  const { data, error } = await getSupabaseAuth()
    .from("payouts")
    .select(
      "id, order_id, whop_withdrawal_id, amount_cents, currency, status, error, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyPayout[];
}

