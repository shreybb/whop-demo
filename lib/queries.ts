import { getSupabase } from "@/lib/supabase";
import type { OrderState } from "@/lib/orders";

/**
 * Read models for the dashboard. All server-side (service role).
 * Kept as plain typed shapes so the page components stay presentational.
 */

export interface OrderRow {
  id: string;
  buyer_email: string | null;
  state: OrderState;
  amount_cents: number | null;
  whop_payment_id: string | null;
  created_at: string;
  updated_at: string;
  listing: {
    title: string;
    currency: string;
    seller: { name: string; payout_status: string } | null;
  } | null;
}

export interface WebhookEventRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  signature_valid: boolean;
  processed: boolean;
  error: string | null;
  received_at: string;
}

export async function getOrders(limit = 100): Promise<OrderRow[]> {
  const { data, error } = await getSupabase()
    .from("orders")
    .select(
      "id, buyer_email, state, amount_cents, whop_payment_id, created_at, updated_at, " +
        "listing:listings(title, currency, seller:sellers(name, payout_status))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  // PostgREST returns embedded relations as arrays or objects depending on cardinality;
  // normalize to a single object.
  return (data ?? []).map((row: any) => ({
    ...row,
    listing: unwrapOne(row.listing)
      ? {
          ...unwrapOne(row.listing),
          seller: unwrapOne(unwrapOne(row.listing)?.seller) ?? null,
        }
      : null,
  })) as OrderRow[];
}

export async function getWebhookEvents(limit = 100): Promise<WebhookEventRow[]> {
  const { data, error } = await getSupabase()
    .from("webhook_events")
    .select("id, type, payload, signature_valid, processed, error, received_at")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as WebhookEventRow[];
}

export interface SellerRow {
  id: string;
  name: string;
  email: string;
  whop_company_id: string | null;
  payout_status: string;
}

export interface ListingRow {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  whop_plan_id: string | null;
  seller: { name: string } | null;
}

export async function getSellers(): Promise<SellerRow[]> {
  const { data, error } = await getSupabase()
    .from("sellers")
    .select("id, name, email, whop_company_id, payout_status")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SellerRow[];
}

export async function getListings(): Promise<ListingRow[]> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select("id, title, price_cents, currency, whop_plan_id, seller:sellers(name)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    seller: Array.isArray(row.seller) ? (row.seller[0] ?? null) : row.seller,
  })) as ListingRow[];
}

export interface DashboardStats {
  totalOrders: number;
  unprocessedEvents: number;
  invalidSignatures: number;
}

export async function getStats(events: WebhookEventRow[], orders: OrderRow[]): Promise<DashboardStats> {
  return {
    totalOrders: orders.length,
    unprocessedEvents: events.filter((e) => e.signature_valid && !e.processed).length,
    invalidSignatures: events.filter((e) => !e.signature_valid).length,
  };
}

function unwrapOne<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}
