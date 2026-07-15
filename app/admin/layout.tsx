import { requireRole } from "@/lib/auth";

/**
 * Admin shell: hard role gate. Header is rendered by the root layout.
 * `requireRole` redirects anyone who isn't an admin, so every page under
 * /admin can assume the role.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  return <>{children}</>;
}
