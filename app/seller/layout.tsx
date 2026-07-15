import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { NavLink } from "@/app/_components/nav-link";

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
          <nav className="flex gap-3 text-sm">
            <NavLink href="/seller" match="exact">Overview</NavLink>
            <NavLink href="/seller/listings">Listings</NavLink>
            <NavLink href="/seller/orders">Orders</NavLink>
            <NavLink href="/seller/payouts">Payouts</NavLink>
            <NavLink href="/" match="exact">Marketplace</NavLink>
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
