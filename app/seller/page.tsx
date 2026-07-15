import Link from "next/link";
import { getMySeller, getMySellerOrders, getMyPayouts } from "@/lib/seller";
import { computeSellerStats } from "@/lib/seller-stats";
import { formatMoney } from "@/lib/format";
import { PayoutBadge, StateBadge } from "@/app/_components/state-badge";
import { OnboardingCard } from "./_components/onboarding-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller portal — CreatorJobs" };

export default async function SellerOverviewPage() {
  const seller = await getMySeller();
  if (!seller) {
    // Shouldn't happen (role picker creates the row), but degrade politely.
    return (
      <p className="text-sm text-muted-foreground">
        No seller profile found. Contact support.
      </p>
    );
  }

  const [orders, payouts] = await Promise.all([
    getMySellerOrders(seller.id),
    getMyPayouts(),
  ]);
  const stats = computeSellerStats(orders, payouts);
  const ready = seller.payout_status === "ready";
  const recent = orders.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Hey, {seller.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Payout status: <PayoutBadge status={seller.payout_status} />
          </p>
        </div>
        <Link
          href="/seller/listings"
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + New listing
        </Link>
      </div>

      {!ready && (
        <OnboardingCard
          hasAccount={!!seller.whop_company_id}
          payoutStatus={seller.payout_status}
        />
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active orders" value={String(stats.activeOrders)} />
        <StatCard label="Earned (delivered)" value={formatMoney(stats.earnedCents)} />
        <StatCard label="Paid out" value={formatMoney(stats.paidOutCents)} />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent orders</h2>
          <Link
            href="/seller/orders"
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
            No orders yet — publish a listing to get started.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-4 py-2.5"
              >
                <span className="text-sm text-foreground">
                  {o.listing?.title ?? "—"}
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatMoney(o.amount_cents, o.currency)}
                  </span>
                  <StateBadge state={o.state} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
