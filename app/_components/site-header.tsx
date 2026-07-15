import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { NavLink } from "@/app/_components/nav-link";

/**
 * Single app-wide header. Nav items are determined entirely by role so the
 * bar looks identical no matter which page within that role the user is on.
 */
export async function SiteHeader() {
  const profile = await getProfile();

  if (profile?.role === "seller") {
    return (
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
    );
  }

  if (profile?.role === "admin") {
    return (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-lg font-semibold text-foreground">
            CreatorJobs <span className="text-muted-foreground">/ admin</span>
          </Link>
          <nav className="flex gap-3 text-sm">
            <NavLink href="/admin" match="exact">Overview</NavLink>
            <NavLink href="/" match="exact">Marketplace</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{profile.email}</span>
          <SignOutButton />
        </div>
      </header>
    );
  }

  // buyer or logged-out
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold text-foreground">
          CreatorJobs
        </Link>
        <nav className="flex gap-3 text-sm">
          <NavLink href="/" match="exact">Browse</NavLink>
          {profile?.role === "buyer" && (
            <NavLink href="/orders">My orders</NavLink>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {profile ? (
          <>
            <span>{profile.email}</span>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
