import Link from "next/link";
import { getPublishedListings } from "@/lib/marketplace";
import { formatMoney } from "@/lib/format";
import { SiteHeader } from "@/app/_components/site-header";

export const dynamic = "force-dynamic";

/** Marketplace home: every published listing, open to the world. */
export default async function HomePage() {
  const listings = await getPublishedListings();

  return (
    <div className="flex flex-col gap-6">
      <SiteHeader />

      <section>
        <h1 className="text-xl font-semibold text-foreground">
          Hire creators for anything
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay through Whop, track the work here, sellers get paid out on
          delivery.
        </p>
      </section>

      {listings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          No listings yet. Are you a creator?{" "}
          <Link href="/login" className="underline hover:text-foreground">
            Sign in
          </Link>{" "}
          and start selling.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/listings/${l.id}`}
                className="block h-full rounded-lg border border-border bg-white p-4 transition hover:border-foreground/40"
              >
                <h2 className="text-sm font-medium text-foreground">{l.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {l.description ?? "No description."}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">by {l.seller_name}</span>
                  <span className="font-semibold text-foreground">
                    {formatMoney(l.price_cents, l.currency)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
