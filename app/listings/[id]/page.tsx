import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedListing } from "@/lib/marketplace";
import { getProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { BuyButton } from "./buy-button";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const [listing, profile] = await Promise.all([
    getPublishedListing(params.id),
    getProfile(),
  ]);
  if (!listing) notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← All listings
        </Link>
      </nav>

      <article className="rounded-lg border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by {listing.seller_name}
            </p>
          </div>
          <span className="text-xl font-semibold text-foreground">
            {formatMoney(listing.price_cents, listing.currency)}
          </span>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">
          {listing.description ?? "No description provided."}
        </p>

        <div className="mt-6 border-t border-border pt-4">
          {profile ? (
            <BuyButton listingId={listing.id} />
          ) : (
            <Link
              href={`/login?next=/listings/${listing.id}`}
              className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in to buy
            </Link>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Payment is handled by Whop. You&apos;ll get an order here the moment
            checkout opens, and it flips to paid when Whop confirms.
          </p>
        </div>
      </article>
    </div>
  );
}
