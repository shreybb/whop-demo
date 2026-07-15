import Link from "next/link";
import { getMySeller, getMyListings } from "@/lib/seller";
import { formatMoney } from "@/lib/format";
import { LocalTime } from "@/app/_components/local-time";
import { Badge } from "@/components/ui/badge";
import { ListingForm } from "../_components/listing-form";
import { PublishButton } from "../_components/publish-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "My listings — CreatorJobs" };

export default async function SellerListingsPage() {
  const seller = await getMySeller();
  if (!seller) {
    return <p className="text-sm text-muted-foreground">No seller profile found.</p>;
  }
  const listings = await getMyListings(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">My listings</h1>

      <ListingForm />

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
          No listings yet — create your first draft above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => {
                const published = !!l.whop_plan_id;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{l.title}</td>
                    <td className="px-3 py-2 text-foreground">
                      {formatMoney(l.price_cents, l.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={published ? "green" : "gray"}>
                        {published ? "live" : "draft"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <LocalTime iso={l.created_at} />
                    </td>
                    <td className="px-3 py-2">
                      {published ? (
                        <Link
                          href={`/listings/${l.id}`}
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                        >
                          View live →
                        </Link>
                      ) : (
                        <PublishButton listingId={l.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
