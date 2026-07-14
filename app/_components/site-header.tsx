import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";

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
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Browse
          </Link>
          {profile?.role === "buyer" && (
            <Link href="/orders" className="hover:text-foreground">
              My orders
            </Link>
          )}
          {profile?.role === "seller" && (
            <Link href="/seller" className="hover:text-foreground">
              Seller portal
            </Link>
          )}
          {profile?.role === "admin" && (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
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
