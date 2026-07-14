import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";

/** Seller shell: hard role gate + portal nav. */
export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("seller");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href="/seller" className="text-lg font-semibold text-foreground">
            CreatorJobs <span className="text-muted-foreground">/ seller</span>
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <Link href="/seller" className="hover:text-foreground">
              Overview
            </Link>
            <Link href="/seller/listings" className="hover:text-foreground">
              Listings
            </Link>
            <Link href="/seller/orders" className="hover:text-foreground">
              Orders
            </Link>
            <Link href="/seller/payouts" className="hover:text-foreground">
              Payouts
            </Link>
            <Link href="/" className="hover:text-foreground">
              Marketplace
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{profile.email}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
