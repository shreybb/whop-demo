import {
  getOrders,
  getWebhookEvents,
  getStats,
  getSellers,
  getListings,
  type OrderRow,
  type WebhookEventRow,
  type DashboardStats,
  type SellerRow,
  type ListingRow,
} from "@/lib/queries";
import { formatMoney, shortId } from "@/lib/format";
import { LocalTime } from "@/app/_components/local-time";
import { StateBadge, PayoutBadge, PayoutStatusBadge } from "@/app/_components/state-badge";
import { OrderActions } from "./_components/order-actions";
import { WebhookRow } from "./_components/webhook-row";

// Always render fresh — this is an operational console.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let orders: OrderRow[] = [];
  let events: WebhookEventRow[] = [];
  let sellers: SellerRow[] = [];
  let listings: ListingRow[] = [];
  let stats: DashboardStats = {
    totalOrders: 0,
    unprocessedEvents: 0,
    invalidSignatures: 0,
  };
  let loadError: string | null = null;
  try {
    [orders, events, sellers, listings] = await Promise.all([
      getOrders(),
      getWebhookEvents(),
      getSellers(),
      getListings(),
    ]);
    stats = await getStats(events, orders);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold">Marketplace console</h1>
        <p className="text-sm text-muted-foreground">
          Every seller, listing, and order on the platform — plus the live Whop
          webhook delivery log. Sellers and buyers self-serve; this is the
          operator&apos;s override and reconciliation view.
        </p>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Could not load data.</p>
          <p className="mt-1 font-mono text-xs">{loadError}</p>
          <p className="mt-2">
            Check <code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            and that <code>supabase/schema.sql</code> has been run.
          </p>
        </div>
      )}

      <section className="grid grid-cols-3 gap-4">
        <StatTile label="Orders" value={stats.totalOrders} />
        <StatTile
          label="Unprocessed events"
          value={stats.unprocessedEvents}
          tone={stats.unprocessedEvents > 0 ? "amber" : "default"}
        />
        <StatTile
          label="Invalid signatures"
          value={stats.invalidSignatures}
          tone={stats.invalidSignatures > 0 ? "red" : "default"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Sellers</h2>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <Th>Seller</Th>
                  <Th>Connected acct</Th>
                  <Th>Payout</Th>
                </tr>
              </thead>
              <tbody>
                {sellers.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No sellers yet — they sign up self-serve at /login.
                    </td>
                  </tr>
                )}
                {sellers.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div>{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {s.whop_company_id ? shortId(s.whop_company_id, 12) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <PayoutBadge status={s.payout_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium">Listings</h2>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <Th>Listing</Th>
                  <Th>Seller</Th>
                  <Th>Price</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {listings.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No listings yet — sellers create their own in the portal.
                    </td>
                  </tr>
                )}
                {listings.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">{l.title}</td>
                    <td className="px-3 py-2">{l.seller?.name ?? "—"}</td>
                    <td className="px-3 py-2">{formatMoney(l.price_cents, l.currency)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.whop_plan_id ? "live" : "draft"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Orders</h2>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <Th>Order</Th>
                <Th>Listing</Th>
                <Th>Seller</Th>
                <Th>Buyer</Th>
                <Th>Amount</Th>
                <Th>State</Th>
                <Th>Payout</Th>
                <Th>Updated</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && !loadError && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    No orders yet — buyers purchase from the public marketplace.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs" title={o.id}>
                    {shortId(o.id)}
                  </td>
                  <td className="px-3 py-2">{o.listing?.title ?? "—"}</td>
                  <td className="px-3 py-2">{o.listing?.seller?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{o.buyer_email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {formatMoney(o.amount_cents, o.currency)}
                    {o.refunded_amount_cents != null && (
                      <div className="text-xs text-red-700">
                        −{formatMoney(o.refunded_amount_cents, o.currency)} refunded
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StateBadge state={o.state} />
                  </td>
                  <td className="px-3 py-2">
                    {o.payout ? (
                      <div className="text-xs">
                        <PayoutStatusBadge status={o.payout.status} />
                        {o.payout.whop_withdrawal_id && (
                          <div
                            className="mt-0.5 font-mono text-muted-foreground"
                            title={o.payout.whop_withdrawal_id}
                          >
                            {shortId(o.payout.whop_withdrawal_id, 12)}
                          </div>
                        )}
                      </div>
                    ) : o.listing?.seller ? (
                      <PayoutBadge status={o.listing.seller.payout_status} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <LocalTime iso={o.updated_at} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <OrderActions orderId={o.id} state={o.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Webhook delivery log</h2>
          <span className="text-xs text-muted-foreground">
            Most recent {events.length} events
          </span>
        </div>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <Th>Event id</Th>
                <Th>Type</Th>
                <Th>Signature</Th>
                <Th>Processed</Th>
                <Th>Order</Th>
                <Th>Received</Th>
                <Th className="text-right">Replay</Th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && !loadError && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No webhook events received yet.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <WebhookRow key={e.id} event={e} />
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red";
}) {
  const color =
    tone === "amber"
      ? "text-amber-700"
      : tone === "red"
        ? "text-red-700"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      {children}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}
