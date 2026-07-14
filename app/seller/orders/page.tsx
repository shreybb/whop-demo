import { getMySeller, getMySellerOrders } from "@/lib/seller";
import { formatMoney, formatDateTime, shortId } from "@/lib/format";
import { StateBadge } from "@/app/_components/state-badge";
import { OrderWorkflow } from "../_components/order-workflow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders — CreatorJobs seller" };

/** The seller's work queue: every order on their listings, with actions. */
export default async function SellerOrdersPage() {
  const seller = await getMySeller();
  if (!seller) {
    return <p className="text-sm text-muted-foreground">No seller profile found.</p>;
  }
  const orders = await getMySellerOrders();
  const payoutReady = seller.payout_status === "ready";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Orders</h1>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
          No orders yet. They&apos;ll show up here the moment a buyer opens
          checkout.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {shortId(o.id)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {o.listing?.title ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.buyer_email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {formatMoney(o.amount_cents, o.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <StateBadge state={o.state} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(o.updated_at)}
                  </td>
                  <td className="px-3 py-2">
                    <OrderWorkflow
                      orderId={o.id}
                      state={o.state}
                      payoutReady={payoutReady}
                    />
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
