import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyOrder } from "@/lib/marketplace";
import { formatMoney, formatDateTime } from "@/lib/format";
import { StateBadge } from "@/app/_components/state-badge";
import { SiteHeader } from "@/app/_components/site-header";
import { OrderTimeline } from "./order-timeline";

export const dynamic = "force-dynamic";

/** Buyer's order detail: state timeline + deliverable + money facts. */
export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  // RLS scopes the read; a foreign order id 404s rather than leaking.
  const order = await getMyOrder(params.id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <SiteHeader />

      <nav className="text-xs text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">
          ← My orders
        </Link>
      </nav>

      <div className="rounded-lg border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {order.listing?.title ?? "Order"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by {order.listing?.seller_name ?? "—"} · placed{" "}
              {formatDateTime(order.created_at)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-foreground">
              {formatMoney(order.amount_cents, order.currency)}
            </div>
            <div className="mt-1">
              <StateBadge state={order.state} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <OrderTimeline state={order.state} />
        </div>

        {order.state === "pending" && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Waiting for payment confirmation from Whop. If you finished
            checkout, this updates automatically within a few seconds.
          </p>
        )}

        {order.refunded_amount_cents != null && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Refunded: {formatMoney(order.refunded_amount_cents, order.currency)}
          </p>
        )}

        {(order.deliverable_note || order.deliverable_url) && (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
            <h2 className="text-sm font-medium text-green-900">
              Delivered work
            </h2>
            {order.deliverable_note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-green-900">
                {order.deliverable_note}
              </p>
            )}
            {order.deliverable_url && (
              <a
                href={order.deliverable_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-green-900 underline"
              >
                Open deliverable →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
