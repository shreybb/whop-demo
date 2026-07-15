import { getPlatformBalance } from "@/lib/whop-platform";
import { formatMoney } from "@/lib/format";

/**
 * Surfaces the platform's settling funds so a failing withdraw isn't a
 * mystery: buyer payments land in the platform's ledger as PENDING first,
 * and payouts can only draw on the available balance. Renders nothing once
 * funds have settled (or if the balance can't be read — never block the page).
 */
export async function FundsNotice() {
  let available = 0;
  let pending = 0;
  try {
    const balance = await getPlatformBalance();
    available = balance.availableCents;
    pending = balance.pendingCents;
  } catch {
    return null;
  }
  if (pending <= 0) return null;

  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {formatMoney(pending)} from recent sales is still settling with Whop
      (platform available balance: {formatMoney(available)}). Withdrawals draw
      on settled funds only — if a withdrawal fails right now, retry after
      settlement completes.
    </p>
  );
}
