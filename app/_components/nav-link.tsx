"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  /** Use "exact" for root paths like "/" or "/seller" overview */
  match?: "exact" | "prefix";
  children: React.ReactNode;
}

export function NavLink({ href, match = "prefix", children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    match === "exact" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}
    >
      {children}
    </Link>
  );
}
