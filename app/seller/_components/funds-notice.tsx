import { getSupabase } from "@/lib/supabase";
import { getPlatformBalance } from "@/lib/whop-platform";
import { formatMoney } from "@/lib/format";

/**
 * Seller-facing settlement notice. Shows ONLY the seller's own earned-but-
 * unpaid amount — never the platform-wide balance (that includes the
 * marketplace's take and other sellers' money, and is nobody else's
 * business). The platform balance is read server-side purely to decide
 * whether their withdrawal would clear right now.
 */
export async function FundsNotice({ sellerId }: { sellerId: string }) {
  try {
    const supabase = getSupabase();
    const { data: orders } = await supabase
      .from("orders")
      .select("amount_cents, listing:listings!inner(seller_id)")
      .eq("state", "completed")
      .eq("listing.seller_id", sellerId);
    const owedCents = (orders ?? []).reduce(
      (sum, o) => sum + (o.amount_cents ?? 0),
      0,
    );
    if (owedCents <= 0) return null;

    const { availableCents } = await getPlatformBalance();
    if (availableCents >= owedCents) return null;

    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {formatMoney(owedCents)} from your delivered orders is still settling.
        Payments can take up to 3 days to settle — withdrawals unlock once
        they do.
      </p>
    );
  } catch {
    return null; // never block the page on a balance read
  }
}
