import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/app/_components/sign-out-button";

/**
 * Admin shell: hard role gate + section nav. `requireRole` redirects anyone
 * who isn't an admin, so every page under /admin can assume the role.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-lg font-semibold text-foreground">
            CreatorJobs <span className="text-muted-foreground">/ admin</span>
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              Overview
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
