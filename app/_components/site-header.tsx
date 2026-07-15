import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { NavLink } from "@/app/_components/nav-link";

/**
 * Public/buyer navigation. Adapts to the session:
 * logged out -> Sign in; buyer -> My orders; seller/admin -> link to their console.
 */
export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold text-foreground">
          CreatorJobs
        </Link>
        <nav className="flex gap-3 text-sm">
          <NavLink href="/" match="exact">
            Browse
          </NavLink>
          {profile?.role === "buyer" && (
            <NavLink href="/orders">My orders</NavLink>
          )}
          {profile?.role === "seller" && (
            <NavLink href="/seller">Seller portal</NavLink>
          )}
          {profile?.role === "admin" && (
            <NavLink href="/admin">Admin</NavLink>
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
