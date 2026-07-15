import { getMySeller, getMyPayouts } from "@/lib/seller";
import { formatMoney, formatDateTime, shortId } from "@/lib/format";
import { PayoutStatusBadge } from "@/app/_components/state-badge";
import { PayoutPortalButton } from "../_components/payout-portal-button";
import { FundsNotice } from "../_components/funds-notice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts — CreatorJobs seller" };

/** The seller's payout ledger + a hosted portal link for payout methods. */
export default async function SellerPayoutsPage() {
  const seller = await getMySeller();
  if (!seller) {
    return <p className="text-sm text-muted-foreground">No seller profile found.</p>;
  }
  const payouts = await getMyPayouts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Payouts</h1>
        {seller.whop_company_id && <PayoutPortalButton />}
      </div>

      <FundsNotice />

      {payouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
          No payouts yet. Deliver an order, then hit Withdraw on it.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Whop withdrawal</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {shortId(p.order_id)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {formatMoney(p.amount_cents, p.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <PayoutStatusBadge status={p.status} />
                    {p.error && (
                      <span className="ml-2 text-xs text-red-700">{p.error}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {p.whop_withdrawal_id ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
