import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyOrders } from "@/lib/marketplace";
import { formatMoney, formatDateTime, shortId } from "@/lib/format";
import { StateBadge } from "@/app/_components/state-badge";
import { SiteHeader } from "@/app/_components/site-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders — CreatorJobs" };

/**
 * The session user's purchases. Reads go through the RLS client, so the
 * only rows that can ever come back are ones with buyer_id = auth.uid().
 */
export default async function MyOrdersPage() {
  await requireUser();
  const orders = await getMyOrders();

  return (
    <div className="flex flex-col gap-6">
      <SiteHeader />
      <h1 className="text-xl font-semibold text-foreground">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          Nothing yet.{" "}
          <Link href="/" className="underline hover:text-foreground">
            Browse the marketplace
          </Link>{" "}
          to place your first order.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-xs underline hover:text-foreground"
                    >
                      {shortId(o.id)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {o.listing?.title ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {o.listing?.seller_name ?? "—"}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
